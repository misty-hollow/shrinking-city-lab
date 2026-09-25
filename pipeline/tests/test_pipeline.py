"""데이터·계산 회귀검사. 저장소에 들어 있는 실제 생성 데이터로 돈다(합성 픽스처 아님)."""

from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
import pytest

from scl_pipeline import build_step, config, import_step, model, mois_check, schedule, verify_step
from scl_pipeline.util import read_json, sha256_file, write_json

DATA = config.APP_DATA_DIR


@pytest.fixture(scope="module")
def scenario():
    return read_json(DATA / "scenario.json")


@pytest.fixture(scope="module")
def sc(scenario) -> model.Scenario:
    emd_idx = {e["id"]: i for i, e in enumerate(scenario["emds"])}
    return model.Scenario(
        np.array([v["pop"] for v in scenario["villages"]], dtype=np.int64),
        np.array([emd_idx[v["emd"]] for v in scenario["villages"]]),
        np.array(scenario["matrix"]["tenths"], dtype=np.int64),
    )


@pytest.fixture(scope="module")
def sc_r1(sc) -> model.Scenario:
    """r1(OSRM 기본 스냅 = 2026-09 반증 실험) 행렬. reports/r1_to_r2.json에 들어 있다."""
    r = read_json(config.REPORTS_DIR / "r1_to_r2.json")
    return model.Scenario(sc.pop, sc.emd, np.array(r["matrix"]["r1_tenths"], dtype=np.int64))


def test_committed_data_invariants():
    assert verify_step.invariants(DATA) == []


def test_access_points_never_start_on_controlled_access_roads():
    table = read_json(config.DERIVED_DIR / "osrm_car_table.json")
    pts = table["sources"] + table["destinations"]
    assert len(pts) == 171
    for p in pts:
        a = p["access"]
        assert a["highway"] not in ("motorway", "motorway_link"), p["id"]
        assert a["tags_flag"] is None, p["id"]
        assert a["osm_way"] and a["dist_m"] >= 0
    # r1에서 고속도로 본선·램프에 붙었던 7곳은 모두 바뀌었다.
    was_motorway = {p["id"] for p in pts if p["default_snap"]["highway"] in ("motorway", "motorway_link")}
    assert was_motorway == {
        "yugu-06",
        "jeongan-02",
        "jeongan-10",
        "useong-03",
        "useong-06",
        "useong-10",
        "useong-16",
    }
    assert all(p["access_changed"] for p in pts if p["id"] in was_motorway)
    # 문제 없던 수요점의 접근점은 기본 스냅 그대로다(규칙이 정상 구간을 건드리지 않는다).
    flagged = {p["id"] for p in pts if p["default_snap"]["tags_flag"]}
    assert {p["id"] for p in pts if p["access_changed"]} == flagged
    assert table["provenance"]["access_rule_version"] == "access-v1"
    assert "exclude 없음" in table["provenance"]["call"]
    # 접근점 뒤의 경로는 고속도로를 쓴다(고속도로를 뺀 표보다 짧은 칸이 있다).
    assert table["provenance"]["motorway_used_cells"] > 100


def test_unchanged_rows_keep_their_times(sc, sc_r1):
    table = read_json(config.DERIVED_DIR / "osrm_car_table.json")
    moved_cols = [j for j, d in enumerate(table["destinations"]) if d["access_changed"]]
    keep = [j for j in range(10) if j not in moved_cols]
    for i, s in enumerate(table["sources"]):
        if not s["access_changed"]:
            assert (sc.tenths[i, keep] == sc_r1.tenths[i, keep]).all(), s["id"]


def test_r2_fixes_expressway_start_times(sc, sc_r1, scenario):
    ids = [v["id"] for v in scenario["villages"]]
    i = ids.index("yugu-06")  # 유구 신영리 → 유구보건지소(열 0)
    assert sc_r1.tenths[i, 0] == 219
    assert sc.tenths[i, 0] <= 50


def test_dimensions_and_totals(scenario):
    assert len(scenario["villages"]) == 161
    assert len(scenario["facilities"]) == 10
    t = np.array(scenario["matrix"]["tenths"])
    assert t.shape == (161, 10)
    assert t.min() > 0 and np.isfinite(t).all()
    assert scenario["totals"]["pop"] == 40204
    assert scenario["totals"]["pop65"] == 19582
    assert sum(scenario["current_allocation"]) == 10.0


def test_schedule_conversion_from_official_table():
    s = import_step.load()[1]
    assert s.reference_date == "2026-04-13"
    days = {r.facility_id: r.weekly_days for r in s.rows}
    assert days == {
        "yugu": 0.0,
        "iin": 1.0,
        "tancheon": 1.5,
        "gyeryong": 0.0,
        "banpo": 0.0,
        "uidang": 5.0,
        "jeongan": 0.0,
        "useong": 0.0,
        "sagok": 0.0,
        "sinpung": 2.5,
    }


def test_schedule_rejects_unknown_cell():
    html = (
        "<h2>공주시보건소 순회근무 현황 (2026. 4. 13. 기준)</h2><table><tbody>"
        + "".join(
            f"<tr><td>{n[:2]}보건지소</td><td>오전</td><td></td><td></td><td></td><td></td><td></td></tr>"
            for _, n in config.EMDS
        )
        + "</tbody></table>"
    )
    with pytest.raises(ValueError, match="해석 규칙이 없는 칸"):
        schedule.parse_excerpt(html)


def test_ceil_preserves_threshold_membership():
    secs = [[899.9, 900.0, 900.1, 600.0, 1200.0, 1199.9, 1200.1, 601.2, 12.3, 5.0]]
    t = build_step.tenths_from_seconds(secs)[0]
    for limit in (10, 15, 20):
        assert [(s / 60) <= limit for s in secs[0]] == [v <= limit * 10 for v in t]


def test_current_actual_reproduces_experiment(sc_r1, scenario):
    """계산 의미 확인: r1 행렬(=2026-09 반증 실험)에서 실험(variants.py cap=1)의 현재 실제 배분 값을 재현."""
    sc = sc_r1
    cur = scenario["current_allocation"]
    ptot = sc.pop.sum()
    expected = {
        10: (1.35, 0.0, 44.72, 13.47, 4.16),
        15: (2.01, 0.0, 60.13, 21.40, 4.81),
        20: (3.09, 1.72, 83.78, 41.95, 3.28),
    }
    for t, (mean, worst, cov1, cov3, gap) in expected.items():
        k = model.kpis(sc, cur, t)
        assert round(k["mean_days"], 2) == mean
        assert round(k["worst_emd_days"], 2) == worst
        assert round(k["cov1_pop"] / ptot * 100, 2) == cov1
        assert round(k["cov3_pop"] / ptot * 100, 2) == cov3
        assert round(k["gap_days"], 2) == gap
        assert k["p90_tenths"] == 224


def test_b15_front_matches_experiment(sc_r1):
    sc = sc_r1
    b = model.evaluate_all(sc, model.all_allocations(15), 15, model.p90_by_mask(sc))
    assert len(b.x) == 831_204
    fr = model.coarse_front(b, int(sc.pop.sum()))
    assert [b.x[i].tolist() for i in fr] == [
        [4, 0, 1, 3, 1, 0, 1, 4, 0, 1],
        [4, 0, 0, 3, 0, 0, 3, 4, 0, 1],
        [3, 3, 0, 2, 2, 0, 2, 3, 0, 0],
        [0, 3, 0, 1, 3, 3, 1, 1, 0, 3],
        [0, 3, 0, 3, 3, 3, 0, 0, 0, 3],
        [3, 3, 0, 3, 0, 0, 3, 3, 0, 0],
    ]


def test_r2_current_actual_and_front(sc, scenario):
    """r2(접근점 규칙 access-v1) 값. 바뀌면 r1_to_r2 보고서와 함께 다시 검토한다."""
    cur = scenario["current_allocation"]
    ptot = sc.pop.sum()
    k = model.kpis(sc, cur, 15)
    assert round(k["mean_days"], 3) == 2.075
    assert round(k["cov1_pop"] / ptot * 100, 2) == 61.80
    assert round(k["cov3_pop"] / ptot * 100, 2) == 22.43
    assert k["worst_emd_days"] == 0.0 and k["p90_tenths"] == 222
    b = model.evaluate_all(sc, model.all_allocations(15), 15, model.p90_by_mask(sc))
    assert len(model.coarse_front(b, int(ptot))) == 7


def test_enumeration_counts():
    assert len(model.all_allocations(10)) == 85_228
    x = model.all_allocations(15)
    assert (x.sum(1) == 15).all() and x.max() <= 5 and x.min() >= 0
    # 사전식 오름차순
    assert (np.diff(x.astype(np.int64) @ (6 ** np.arange(9, -1, -1))) > 0).all()


def test_vector_and_single_kpis_agree(sc):
    x = model.all_allocations(15)[::50_000]
    for t in (10, 15, 20):
        b = model.evaluate_all(sc, x, t, model.p90_by_mask(sc))
        for i in range(len(x)):
            k = model.kpis(sc, x[i], t)
            assert b.mean_days[i] == pytest.approx(k["mean_days"], abs=1e-12)
            assert b.worst_emd_days[i] == pytest.approx(k["worst_emd_days"], abs=1e-12)
            assert int(b.worst_emd[i]) == k["worst_emd"]
            assert int(b.cov1_pop[i]) == k["cov1_pop"] and int(b.cov3_pop[i]) == k["cov3_pop"]
            assert int(b.p90_tenths[i]) == k["p90_tenths"]


def test_rank_thresholds_exact():
    rng = np.random.default_rng(7)
    vals = np.round(rng.random(997) * 5, 2)
    thr = model.rank_thresholds(vals)
    for v in list(vals[:200]) + [-1.0, 10.0]:
        frac = (vals > v).mean()
        n = next((k for k in range(1, 101) if v >= thr[k - 1]), 100)
        assert n == max(1, int(np.ceil(frac * 100 - 1e-9)))


def test_missions_follow_rule():
    ls = read_json(DATA / "landscape.json")
    m = ls["missions"]
    assert m["m1"]["target"] == 2.8
    assert m["m2"]["target"] == 1.0
    assert m["m3"]["target"] == 24800
    for v in m.values():
        assert v["share_at_or_above_target"] >= config.MISSION_TOP_SHARE
        assert sum(v["reference"]["x"]) == 15


def test_route_shapes_cover_reachable_pairs(scenario):
    """도달 경로 형상(관계 읽기 표현용): 20분 안 쌍마다 하나, 계산 행렬과 같은 그래프, 끝점은 접근점 근처."""
    geo = read_json(DATA / "geometry.json")
    routes = read_json(config.DERIVED_DIR / "osrm_car_routes.json")
    table = read_json(config.DERIVED_DIR / "osrm_car_table.json")
    assert routes["provenance"]["graph_input_sha256"] == table["provenance"]["graph_input_sha256"]
    assert routes["provenance"]["access_rule_version"] == "access-v1"
    assert verify_step.route_invariants(scenario, geo) == []
    assert geo["routes"]["threshold_min"] == 20
    assert len(geo["routes"]["pairs"]) == sum(
        1 for row in scenario["matrix"]["tenths"] for v in row if v <= 200
    )
    # 경로 시간은 표의 시간과 같은 계산이다(접근점이 같으니 2% 안).
    assert len(routes["provenance"]["table_route_mismatch"]) <= len(routes["routes"]) * 0.02


def test_derived_files_record_current_step_code():
    """파생 파일의 step_code_sha256 = 지금 코드. 코드를 고치고 단계를 다시 안 돌리면 verify가 잡는다."""
    assert verify_step.provenance_invariants(config.DERIVED_DIR) == []
    with tempfile.TemporaryDirectory() as tmp:
        for name in verify_step.STEP_MODULES:
            (Path(tmp) / name).write_bytes((config.DERIVED_DIR / name).read_bytes())
        routes = read_json(Path(tmp) / "osrm_car_routes.json")
        routes["provenance"]["step_code_sha256"] = "0" * 64
        write_json(Path(tmp) / "osrm_car_routes.json", routes)
        errs = verify_step.provenance_invariants(Path(tmp))
        assert len(errs) == 1 and errs[0].startswith("osrm_car_routes.json")


def test_population_matches_mois_open_data(scenario):
    """인구 값 = 같은 기준일 행정안전부 공공데이터포털 개방 자료(법정리 161·읍면 10×2·시 2·시내 동 6·수요점 161)."""
    facts = read_json(config.DERIVED_DIR / "source_facts.json")
    rep = mois_check.compare(facts, scenario)
    assert rep["result"] == "MATCH" and rep["checked"] == 350
    assert rep == read_json(mois_check.REPORT)
    # 한 값이라도 다르면 잡는다(대조가 실제로 값을 본다).
    facts["population"]["emds"][0]["ri"][0][1] += 1
    assert mois_check.compare(facts, scenario)["mismatches"]


def test_table_keeps_only_deterministic_osrm_values():
    """MLD /table의 distance는 그래프를 만들 때마다 0.1 m씩 흔들려(osrm-partition) 저장하지 않는다.
    duration은 분할과 무관하게 같다 — 계산은 이것만 쓴다."""
    table = read_json(config.DERIVED_DIR / "osrm_car_table.json")
    assert set(table) == {"provenance", "sources", "destinations", "durations_s"}
    assert "annotations=duration " in table["provenance"]["call"]


def test_golden_boundaries_straddle_mission_targets(sc):
    """골든 값의 미션 경계 배분: 15일·지소당 0~5, 15분 기준으로 목표 바로 아래는 미달, 바로 위는 달성."""
    ls = read_json(DATA / "landscape.json")
    golden = read_json(DATA / "golden.json")
    cases = {(c["name"], c["threshold_min"]): c for c in golden["cases"]}
    for mid, key, _unit, _label in build_step.MISSIONS:
        target = ls["missions"][mid]["target"]
        below = cases[(f"boundary_{mid}_below", 15)]
        at = cases[(f"boundary_{mid}_at", 15)]
        for c in (below, at):
            assert sum(c["x"]) == 15 and min(c["x"]) >= 0 and max(c["x"]) <= 5
            assert model.kpis(sc, c["x"], 15)[key] == c["kpis"][key]
        assert below["kpis"][key] < target <= at["kpis"][key]
        # 경계에 붙어 있다: 목표를 넘지 못한 배분 중 가장 높고, 넘은 배분 중 가장 낮다.
        assert at["kpis"][key] <= ls["missions"][mid]["top_share_exact_value"]


def test_rebuild_is_byte_identical():
    with tempfile.TemporaryDirectory() as tmp:
        build_step.run(Path(tmp))
        for name in ("scenario.json", "geometry.json", "landscape.json", "golden.json", "manifest.json"):
            assert sha256_file(Path(tmp) / name) == sha256_file(DATA / name), name
