"""정적 앱 데이터 생성(순수 계산, 네트워크·docker 없음).

입력: sources/(원자료·큐레이션), derived/(OSM·OSRM·경계·지형 단계 결과)
출력: app/public/data/{manifest,scenario,geometry,landscape,golden}.json

같은 입력이면 같은 바이트가 나온다(verify가 임시 폴더에 다시 만들어 대조한다).
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np

from . import config, demand, import_step, model
from .sources import registry
from .util import code_sha256, project, projection_record, read_json, sha256_file, write_json

REAL = "REAL_DATA"
DERIVED = "DERIVED"
ASSUMPTION = "SIMULATION_ASSUMPTION"


def tenths_from_seconds(durations_s: list[list[float]]) -> np.ndarray:
    """OSRM 초(소수 1자리) → 0.1분 올림. 올림이라 '≤ T분' 판정이 원래 초 값과 정확히 같다."""
    ds = np.rint(np.asarray(durations_s, dtype=np.float64) * 10).astype(np.int64)
    return (ds + 59) // 60


def load_inputs() -> dict[str, Any]:
    pop, sched = import_step.load()
    osm = read_json(config.DERIVED_DIR / "osm_features.json")
    villages = demand.match_villages(pop, osm)
    facilities = demand.resolve_facilities(osm)
    table = read_json(config.DERIVED_DIR / "osrm_car_table.json")
    for v, s in zip(villages, table["sources"], strict=True):
        if (v.id, v.lon, v.lat) != (s["id"], s["lon"], s["lat"]):
            raise SystemExit(f"행렬의 수요점이 현재 수요점과 다르다: {v.id}. route 단계를 다시 돌려라.")
    for f, d in zip(facilities, table["destinations"], strict=True):
        if (f.id, f.lon, f.lat) != (d["id"], d["lon"], d["lat"]):
            raise SystemExit(f"행렬의 지소 좌표가 현재 지소 좌표와 다르다: {f.id}. route 단계를 다시 돌려라.")
    return {
        "pop": pop,
        "schedule": sched,
        "osm": osm,
        "villages": villages,
        "facilities": facilities,
        "table": table,
        "routes": read_json(config.DERIVED_DIR / "osrm_car_routes.json"),
        "boundaries": read_json(config.DERIVED_DIR / "boundaries.json"),
        "terrain": read_json(config.DERIVED_DIR / "terrain.json"),
    }


def _size_thresholds(pops: list[int]) -> tuple[int, int]:
    """인구 삼분위(설계안 6-4). 값으로 나눠 같은 인구가 다른 단계에 가지 않게 한다."""
    s = sorted(pops)
    n = len(s)
    return s[math.ceil(n / 3)], s[math.ceil(2 * n / 3)]


def build_scenario(inp: dict[str, Any]) -> tuple[dict[str, Any], model.Scenario, list[float]]:
    pop, villages, facilities = inp["pop"], inp["villages"], inp["facilities"]
    tenths = tenths_from_seconds(inp["table"]["durations_s"])
    emd_index = {slug: i for i, (slug, _) in enumerate(config.EMDS)}
    q1, q2 = _size_thresholds([v.pop for v in villages])

    def tier(n: int) -> int:
        return 0 if n < q1 else (1 if n < q2 else 2)

    by_fac = {r.facility_id: r for r in inp["schedule"].rows}
    current = [by_fac[f.id].weekly_days for f in facilities]
    if abs(sum(current) - config.CURRENT_TOTAL_DAYS) > 1e-9:
        raise SystemExit(f"현재 실제 진료일 합이 {sum(current)}이다(기대 {config.CURRENT_TOTAL_DAYS})")

    labels = {e["id"]: e for e in inp["boundaries"]["emds"]}
    emds = []
    for slug, name in config.EMDS:
        vp = sum(v.pop for v in villages if v.emd_id == slug)
        if vp != pop.emd_total[name]:
            raise SystemExit(f"{name}: 수요점 인구 합 {vp} != 읍·면 인구 {pop.emd_total[name]}")
        emds.append(
            {
                "id": slug,
                "name": name,
                "pop": vp,
                "pop65": pop.emd_65plus[name],
                "pop65_pct": round(pop.emd_65plus[name] / vp * 100, 1),
                "label": labels[slug]["label"],
            }
        )
    acc = {p["id"]: p["access"] for p in inp["table"]["sources"] + inp["table"]["destinations"]}

    def access_of(pid: str) -> dict[str, Any]:
        a = acc[pid]
        return {
            "lon": a["lon"],
            "lat": a["lat"],
            "dist_m": a["dist_m"],
            "osm_way": a["osm_way"],
            "highway": a["highway"],
        }

    vill_out = []
    for v in villages:
        x, y = project(v.lon, v.lat)
        vill_out.append(
            {
                "id": v.id,
                "name": v.name,
                "emd": v.emd_id,
                "pop": v.pop,
                "size": tier(v.pop),
                "lon": v.lon,
                "lat": v.lat,
                "x": round(x, 3),
                "y": round(y, 3),
                "access": access_of(v.id),
            }
        )
    fac_out = []
    for f, cur in zip(facilities, current, strict=True):
        x, y = project(f.lon, f.lat)
        row = by_fac[f.id]
        fac_out.append(
            {
                "id": f.id,
                "name": f.name,
                "short": f.name.replace("보건지소", ""),
                "emd": f.emd_id,
                "lon": f.lon,
                "lat": f.lat,
                "x": round(x, 3),
                "y": round(y, 3),
                "current_days": cur,
                "schedule_cells": list(row.cells),
                "schedule_note": row.note,
                "coordinate_method": f.coordinate_method,
                "access": access_of(f.id),
            }
        )
    total_pop = sum(v.pop for v in villages)
    total_65 = sum(pop.emd_65plus.values())
    scenario = {
        "data_version": config.DATA_VERSION,
        "totals": {
            "pop": total_pop,
            "pop65": total_65,
            "pop65_pct": round(total_65 / total_pop * 100, 1),
            "villages": len(vill_out),
            "facilities": len(fac_out),
        },
        "rules": {
            "max_days_per_facility": config.MAX_DAYS_PER_FACILITY,
            "resident_cap_days": config.RESIDENT_CAP_DAYS,
            "thresholds_min": list(config.THRESHOLDS_MIN),
            "mission_threshold_min": config.MISSION_THRESHOLD_MIN,
            "current_total_days": config.CURRENT_TOTAL_DAYS,
            "mission_budget": config.MISSION_BUDGET,
            "added_assumption_days": config.ADDED_ASSUMPTION_DAYS,
        },
        "size_tiers": {"thresholds": [q1, q2], "radius_ratio": [1, 1.5, 2.2]},
        "emds": emds,
        "villages": vill_out,
        "facilities": fac_out,
        "current_allocation": current,
        "matrix": {
            "unit": "tenths_of_minute",
            "rounding": "ceil",
            "rows": "villages 순서",
            "cols": "facilities 순서",
            "tenths": tenths.tolist(),
        },
    }
    sc = model.Scenario(
        np.array([v.pop for v in villages], dtype=np.int64),
        np.array([emd_index[v.emd_id] for v in villages]),
        tenths,
    )
    return scenario, sc, current


def build_geometry(inp: dict[str, Any]) -> dict[str, Any]:
    b, osm, terr, routes = inp["boundaries"], inp["osm"], inp["terrain"], inp["routes"]
    table = inp["table"]
    if routes["provenance"]["graph_input_sha256"] != table["provenance"]["graph_input_sha256"]:
        raise SystemExit("경로 형상이 행렬과 다른 그래프에서 나왔다. routes 단계를 다시 돌려라.")
    return {
        "projection": projection_record(),
        "emds": [{"id": e["id"], "label": e["label"], "polygons": e["polygons"]} for e in b["emds"]],
        "city_core": b["city_core"],
        "outer": b["outer"],
        "roads": osm["roads"],
        "rivers": osm["rivers"],
        "water_polygons": osm["water_polygons"],
        "terrain": {k: v for k, v in terr.items() if k != "provenance"},
        # 관계 읽기(6-6)용 실제 도로망 경로. 행렬 계산에는 쓰지 않는다. [행 i, 열 j, [[x,y]...]]
        "routes": {
            "threshold_min": routes["threshold_min"],
            "note": routes["provenance"]["purpose"],
            "pairs": [[r["i"], r["j"], r["coords"]] for r in routes["routes"]],
        },
    }


def _kpi_row(b: model.Batch, i: int) -> dict[str, Any]:
    return {
        "x": [int(v) for v in b.x[i]],
        "mean_days": float(b.mean_days[i]),
        "worst_emd_days": float(b.worst_emd_days[i]),
        "worst_emd": config.EMDS[int(b.worst_emd[i])][0],
        "cov1_pop": int(b.cov1_pop[i]),
        "cov3_pop": int(b.cov3_pop[i]),
        "gap_days": float(b.gap_days[i]),
        "p90_tenths": int(b.p90_tenths[i]),
    }


MISSIONS = (
    ("m1", "mean_days", 0.1, "평균 진료일"),
    ("m2", "worst_emd_days", 0.1, "가장 불리한 읍·면"),
    ("m3", "cov3_pop", 100, "주 3일 이상 닿는 주민"),
)


def _floor_to(v: float, step: float) -> float | int:
    if step == 100:
        return int(math.floor(v / 100) * 100)
    return math.floor(round(v * 10, 9)) / 10


def build_landscape(sc: model.Scenario) -> dict[str, Any]:
    ptot = int(sc.pop.sum())
    p90_table = model.p90_by_mask(sc)
    step = config.LANDSCAPE_GRID_STEP
    combos = []
    missions: dict[str, Any] = {}
    for budget in config.LANDSCAPE_BUDGETS:
        x_all = model.all_allocations(budget)
        for t in config.THRESHOLDS_MIN:
            b = model.evaluate_all(sc, x_all, t, p90_table)
            ix = np.floor(b.mean_days / step + 1e-9).astype(np.int64)
            iy = np.floor(b.worst_emd_days / step + 1e-9).astype(np.int64)
            cells, counts = np.unique(np.stack([ix, iy], 1), axis=0, return_counts=True)
            front = model.coarse_front(b, ptot)
            combos.append(
                {
                    "budget": budget,
                    "threshold_min": t,
                    "n_alloc": int(len(x_all)),
                    "density": {
                        "x": "mean_days",
                        "y": "worst_emd_days",
                        "step": step,
                        "cells": [[int(c[0]), int(c[1]), int(n)] for c, n in zip(cells, counts, strict=True)],
                    },
                    "front": [_kpi_row(b, i) for i in front],
                    "rank_thresholds": {
                        "mean_days": model.rank_thresholds(b.mean_days),
                        "worst_emd_days": model.rank_thresholds(b.worst_emd_days),
                        "cov3_pop": [int(v) for v in model.rank_thresholds(b.cov3_pop.astype(np.float64))],
                    },
                }
            )
            if budget == config.MISSION_BUDGET and t == config.MISSION_THRESHOLD_MIN:
                for mid, key, unit, label in MISSIONS:
                    vals = getattr(b, key).astype(np.float64)
                    exact = model.top_share_threshold(vals, config.MISSION_TOP_SHARE)
                    target = _floor_to(exact, unit)
                    ref = model.reference_index(vals, b.cov1_pop)
                    missions[mid] = {
                        "kpi": key,
                        "label": label,
                        "budget": budget,
                        "threshold_min": t,
                        "target": target,
                        "target_rule": (
                            f"가능한 모든 배분(B={budget}, T={t}분, {len(x_all):,}개) 중 상위 "
                            f"{int(config.MISSION_TOP_SHARE * 100)}% 경계값을 "
                            f"{'100명' if unit == 100 else '0.1일'} 단위로 내림"
                        ),
                        "top_share_exact_value": float(exact),
                        "share_at_or_above_target": round(float((vals >= target).mean()), 6),
                        "reference": _kpi_row(b, ref),
                        "reference_rule": "이 지표 값이 가장 높은 배분 하나. 동률이면 닿지 않는 주민이 적은 것, 그래도 같으면 사전식 첫 번째",
                    }
    return {
        "definition": {
            "allocations": "Σx = B(총량을 모두 놓은 배분), 지소마다 0~5일 정수. 사전식 순서",
            "front": (
                "체감 격자(평균 진료일 0.5일, 가장 불리한 읍·면 0.5일, 주 3일 이상 인구 5%p) 상자 사이에서 "
                "서로 지배되지 않는 상자마다 대표 배분 하나. 2026-09 반증 실험(variants.py)과 같은 정의"
            ),
            "rank": "상위 n% = 그 지표가 내 배분보다 높은 배분의 비율(올림, 최소 1). n = min{k : 값 ≥ rank_thresholds[k-1]}",
        },
        "combos": combos,
        "missions": missions,
    }


GOLDEN_ARBITRARY = (
    ("all_zero", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ("single_uidang5", [0, 0, 0, 0, 0, 5, 0, 0, 0, 0]),
    ("one_each", [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    ("partial_7", [2, 0, 1, 0, 0, 3, 0, 1, 0, 0]),
    ("full_15_mixed", [3, 1, 0, 2, 1, 4, 0, 2, 1, 1]),
)


def mission_boundaries(sc: model.Scenario, landscape: dict[str, Any]) -> list[tuple[str, list[int]]]:
    """미션 판정 경계의 바로 아래·바로 위 배분(B=15, T=15 전수 중). 브라우저 판정 검사용.

    below = 목표 미만 중 값이 가장 큰 배분, at = 목표 이상 중 값이 가장 작은 배분.
    동률이면 사전식 첫 번째(np.argmax/argmin은 첫 위치를 준다).
    """
    x_all = model.all_allocations(config.MISSION_BUDGET)
    b = model.evaluate_all(sc, x_all, config.MISSION_THRESHOLD_MIN, model.p90_by_mask(sc))
    out: list[tuple[str, list[int]]] = []
    for mid, key, _unit, _label in MISSIONS:
        vals = getattr(b, key).astype(np.float64)
        target = landscape["missions"][mid]["target"]
        below = np.where(vals < target)[0]
        at = np.where(vals >= target)[0]
        out.append((f"boundary_{mid}_below", [int(v) for v in x_all[below[np.argmax(vals[below])]]]))
        out.append((f"boundary_{mid}_at", [int(v) for v in x_all[at[np.argmin(vals[at])]]]))
    return out


def build_golden(sc: model.Scenario, current: list[float], landscape: dict[str, Any]) -> dict[str, Any]:
    cases = [("current_actual", current)]
    for mid, m in landscape["missions"].items():
        cases.append((f"reference_{mid}", m["reference"]["x"]))
    cases.extend(GOLDEN_ARBITRARY)
    cases.extend(mission_boundaries(sc, landscape))
    out = []
    for name, x in cases:
        for t in config.THRESHOLDS_MIN:
            k = model.kpis(sc, x, t)
            k.pop("village_days")
            out.append({"name": name, "x": list(x), "threshold_min": t, "kpis": k})
    return {
        "tolerance": {"days": 0.01, "pop": 0, "minutes": 0},
        "note": "파이썬 전처리(scl_pipeline.model)와 브라우저 엔진이 같은 값을 내는지 보는 기준값",
        "cases": out,
    }


def _classification() -> list[dict[str, str]]:
    return [
        {"item": "읍·면 10곳 이름·경계", "class": REAL},
        {"item": "법정리 161곳 이름·인구", "class": REAL},
        {"item": "읍·면 65세 이상 인구·비율", "class": REAL},
        {
            "item": "법정리 65세 이상 인구",
            "class": DERIVED,
            "note": "추정이라 앱 데이터와 화면에 넣지 않는다",
        },
        {"item": "법정리 대표점 좌표", "class": DERIVED},
        {"item": "보건지소 10곳 위치·이름", "class": REAL},
        {"item": "현재 진료일(의과 순회진료, 합 주 10일)", "class": REAL},
        {"item": "도로망", "class": REAL},
        {"item": "161×10 도로망 접근시간 행렬", "class": DERIVED},
        {"item": "지형 고도", "class": REAL, "note": "시각 표현 전용"},
        {"item": "금강·하천·주요 도로 형상", "class": REAL, "note": "시각 표현 전용"},
        {
            "item": "법정리→보건지소 도로망 경로 형상(20분 안 쌍)",
            "class": DERIVED,
            "note": "관계 읽기 표현 전용. 계산은 행렬",
        },
        {"item": "KPI·배분 지형도·목표치·참고 배분", "class": DERIVED},
        {"item": "진료일 단위(지소 하나의 주당 일반진료 1일, 모두 같은 가치)", "class": ASSUMPTION},
        {"item": "주민 1인 주당 상한 5일", "class": ASSUMPTION},
        {"item": "'닿는다' 기준 10·15·20분과 기준 안 지소의 균등 이용", "class": ASSUMPTION},
        {"item": "추가 진료자원 +5일(미션 총량 15일 = 실제 10일 + 가정 5일)", "class": ASSUMPTION},
        {"item": "정수 배분(격주 배분은 만들 수 없다)", "class": ASSUMPTION},
    ]


def build_manifest(inp: dict[str, Any], outputs: dict[str, str]) -> dict[str, Any]:
    reg = registry()
    fac_meta = read_json(config.SOURCES_DIR / "facilities.json")
    osm_prov, tab_prov = inp["osm"]["provenance"], inp["table"]["provenance"]
    road_date = osm_prov["osm_latest_object_timestamp"][:10]
    schedule_rows = [
        {"facility": r.facility_id, "cells": list(r.cells), "note": r.note, "weekly_days": r.weekly_days}
        for r in inp["schedule"].rows
    ]

    def src(key: str, *fields: str) -> dict[str, Any]:
        return {f: reg[key][f] for f in fields if f in reg[key]}

    return {
        "product": "Shrinking City Lab",
        "scenario": "진료일을 나누다 — 공주 보건지소 편",
        "data_version": config.DATA_VERSION,
        "data_version_date": config.DATA_VERSION_DATE,
        "reproducibility": {
            "pipeline_version": config.PIPELINE_VERSION,
            "code_sha256": code_sha256(),
            "inputs": {
                "population_tongban": reg["population_tongban"]["sha256"],
                "population_households_age": reg["population_households_age"]["sha256"],
                "population_mois_stdg": reg["population_mois_stdg"]["sha256"],
                "population_mois_admdong": reg["population_mois_admdong"]["sha256"],
                "clinic_schedule": reg["clinic_schedule"]["sha256"],
                "facilities_json": sha256_file(config.SOURCES_DIR / "facilities.json"),
                "osm_pbf": osm_prov["pbf_sha256"],
                "admin_boundaries": reg["admin_boundaries"]["sha256"],
                "dem_tiles": {k: v["sha256"] for k, v in reg["dem_srtm"]["tiles"].items()},
                "derived": {p.name: sha256_file(p) for p in sorted(config.DERIVED_DIR.glob("*.json"))},
            },
            "outputs": outputs,
            "regenerate": "README.md 「데이터 재생성」의 명령(pipeline/에서 python -m scl_pipeline). 같은 입력이면 같은 바이트가 나온다(verify가 대조).",
        },
        "display_dates": {
            "population": inp["pop"].reference_date,
            "schedule": inp["schedule"].reference_date,
            "road_network": road_date,
        },
        "sources": {
            # 공개 출처 표기는 이용허락범위가 확인된 행정안전부 개방 자료. 계산은 같은 값의 공주시 xlsx에서 읽었다
            # (값이 모두 같음을 verify가 매번 대조: mois_check, reports/mois_crosscheck.json).
            "population": {
                **src("population_mois_stdg", "publisher", "title", "page_url", "reference_date", "license"),
                "scope": "주민등록 인구(외국인 제외)",
                "attribution": (
                    f"{reg['population_mois_stdg']['publisher']}, 「지역별(법정동)·(행정동) 성별 연령별 주민등록 인구수」"
                    f"({reg['population_mois_stdg']['reference_date']} 기준), 공공데이터포털 — "
                    f"{reg['population_mois_stdg']['license']}"
                ),
                "computed_from": {
                    **src("population_tongban", "publisher", "page_url", "reference_date"),
                    "title": "2026년 8월 인구현황(법정동별통반별인구현황·인구 및 세대현황 xlsx)",
                    "note": "계산 입력. 원본 파일은 배포하지 않는다",
                },
                "crosscheck": (
                    "공주시 xlsx에서 계산한 인구 값이 같은 기준일 행정안전부 자료와 모두 같다 "
                    "(pipeline/reports/mois_crosscheck.json)"
                ),
                "method": "법정리 인구 = 같은 법정리의 통·반 총인구 합. 읍·면 합계와 일치를 검사한다",
            },
            "schedule": {
                **src(
                    "clinic_schedule",
                    "publisher",
                    "title",
                    "page_url",
                    "reference_date",
                    "conversion_rule",
                    "usage_status",
                    "visit_notice",
                ),
                "rows": schedule_rows,
            },
            "facilities": {
                "title": "공주시 읍·면 보건지소 10곳",
                "reference_month": fac_meta["hira_source"]["reference_month"],
                "official_address": fac_meta["official_address_source"]["url"],
                "coordinates": "HIRA 병원정보서비스 2026.6 좌표. 공식 주소와 HIRA 주소가 다른 유구·정안은 OSM 객체 중심점",
                "excluded": "공주 시내(동 지역) 보건소·병원, 보건진료소, 민간 의원, 다른 시군의 시설",
                "attribution": (
                    f"{reg['hira_hospitals']['publisher']} 「{fac_meta['hira_source']['title'].split(' — ')[0].removeprefix('건강보험심사평가원 ')}」 "
                    f"병원정보서비스 — {reg['hira_hospitals']['license']}"
                ),
            },
            "road_network": {
                "publisher": reg["osm_extract"]["publisher"],
                "license": reg["osm_extract"]["license"],
                "osm_latest_object_timestamp": osm_prov["osm_latest_object_timestamp"],
                "extract_bbox": osm_prov["bbox"],
                "pbf_sha256": osm_prov["pbf_sha256"],
            },
            "routing": {
                "engine": "OSRM",
                "image": tab_prov["osrm_image"],
                "digest": tab_prov["osrm_digest"],
                "profile": "car",
                "profile_detail": tab_prov["profile"],
                "algorithm": tab_prov["algorithm"],
                "conditions": tab_prov["conditions"],
                "runtime": "앱은 OSRM을 부르지 않는다. 전처리에서 한 번 만든 정적 행렬만 읽는다",
            },
            "boundaries": src(
                "admin_boundaries", "publisher", "title", "download_url", "reference_date", "license"
            ),
            "terrain": src("dem_srtm", "publisher", "title", "license"),
        },
        "semantics": {
            "demand_points": (
                "법정리 1곳 = 대표점 1개(161개). 대표점은 법정리 이름과 같은 OSM 마을(place=village/hamlet) 점 중 "
                "그 읍·면 중심 점에 가장 가까운 것. 리 주민 전체가 그 한 점에 있다고 본다. "
                "도로망 계산은 대표점에서 가장 가까운 '직접 들어갈 수 있는' 일반 도로 구간(접근점, access_points)에서 "
                "시작한다. 대표점 좌표 자체는 바꾸지 않는다"
            ),
            "facilities": "읍·면 보건지소 1곳 = 1점(10개). 시내·민간·다른 시군 시설은 포함하지 않는다",
            "matrix": (
                "161(법정리 접근점)×10(보건지소 접근점) 자동차 도로망 최단 접근시간. OSRM car, 혼잡·대기 없음. "
                "접근점 뒤의 경로는 고속도로를 포함한 정상 car 경로다. "
                "OSRM 초 값을 0.1분 단위로 올림해 정수(0.1분)로 저장한다. 행 = villages 순서, 열 = facilities 순서"
            ),
            "routes": (
                "geometry.routes: 도로망 20분 안의 (법정리, 보건지소) 쌍마다 같은 OSRM car 그래프·접근점으로 계산한 "
                "최단경로 폴리라인(40 m 단순화). 화면에서 hover·선택 때 '어느 지소가 어느 마을에 어떤 길로 닿는가'를 "
                "그리는 데만 쓴다. 접근시간 계산은 행렬(matrix)이다"
            ),
            "clinic_day": "한 보건지소에서 일반진료가 열리는 하루(주당). 게임용 자원 단위이며 실제 의료서비스 전체가 아니다",
            "current_total": "주 10일 = 2026-04-13 의과 순회진료 일정의 합(격주는 주 0.5일로 평균)",
            "mission_total": "주 15일 = 실제 10일(REAL DATA) + 추가 5일(SIMULATION ASSUMPTION). 가상 정책실험",
        },
        "classification": _classification(),
        "experiment_comparison": "pipeline/reports/experiment_comparison.json",
        "access_points": access_summary(inp),
        "r1_to_r2": "pipeline/reports/r1_to_r2.json",
        "known_issues": known_issues(inp),
    }


def known_issues(inp: dict[str, Any]) -> list[dict[str, Any]]:
    """고치지 않고 기록만 하는 데이터 한계(OSM 도로 수록 범위). 값은 규칙대로 만든 그대로다."""
    pts = inp["table"]["sources"] + inp["table"]["destinations"]
    far = [{"id": p["id"], "access_m": p["access"]["dist_m"]} for p in pts if p["access"]["dist_m"] > 800]
    frag = [
        {"id": p["id"], "skipped_candidates": sum("떨어" in r["why"] for r in p["rejected_candidates"])}
        for p in pts
        if any("떨어" in r["why"] for r in p["rejected_candidates"])
    ]
    out = []
    if far:
        out.append(
            {
                "id": "far_access_point",
                "detail": "대표점에서 가장 가까운 일반 도로 접근점이 800 m보다 멀다. OSM 마을 점 위치나 도로 수록 범위의 한계일 수 있다",
                "points": far,
            }
        )
    if frag:
        out.append(
            {
                "id": "disconnected_nearest_road",
                "detail": "가장 가까운 일반 도로가 OSM에서 도로망 본체와 이어지지 않은 조각이라 다음으로 가까운 이어진 도로를 썼다",
                "points": frag,
            }
        )
    return out


def access_summary(inp: dict[str, Any]) -> dict[str, Any]:
    """도로망 접근점 규칙과 그 결과(설계안 10-2-2 '수요점의 의미'를 보강)."""
    tab = inp["table"]
    prov = tab["provenance"]
    pops = {v.id: v.pop for v in inp["villages"]}

    def changed(points: list[dict[str, Any]], with_pop: bool) -> list[dict[str, Any]]:
        out = []
        for p in points:
            if not p["access_changed"]:
                continue
            d, a = p["default_snap"], p["access"]
            row = {
                "id": p["id"],
                "default": {k: d[k] for k in ("dist_m", "osm_way", "highway", "name", "tags_flag")},
                "access": {k: a[k] for k in ("dist_m", "osm_way", "highway", "name")},
            }
            if with_pop:
                row["pop"] = pops[p["id"]]
            out.append(row)
        return out

    src = changed(tab["sources"], True)
    dst = changed(tab["destinations"], False)
    return {
        "rule_version": prov["access_rule_version"],
        "rule": prov["access_rule"],
        "reason": (
            "r1(=2026-09 반증 실험)은 OSRM 기본 스냅을 그대로 써서 일부 법정리 대표점이 고속도로 본선·램프·"
            "터널 구간에서 출발했다(마을에서 직접 들어갈 수 없는 구간). r2는 접근점 고르기와 경로 계산을 나눈다"
        ),
        "changed_villages": len(src),
        "changed_villages_pop": sum(r["pop"] for r in src),
        "changed_facilities": len(dst),
        "villages": src,
        "facilities": dst,
        "max_access_m": max(p["access"]["dist_m"] for p in tab["sources"] + tab["destinations"]),
    }


def run(out_dir: Path | None = None) -> dict[str, str]:
    out_dir = out_dir or config.APP_DATA_DIR
    inp = load_inputs()
    scenario, sc, current = build_scenario(inp)
    geometry = build_geometry(inp)
    landscape = build_landscape(sc)
    golden = build_golden(sc, current, landscape)
    outputs = {
        "scenario.json": write_json(out_dir / "scenario.json", scenario),
        "geometry.json": write_json(out_dir / "geometry.json", geometry),
        "landscape.json": write_json(out_dir / "landscape.json", landscape),
        "golden.json": write_json(out_dir / "golden.json", golden),
        "terrain.bin": inp["terrain"]["sha256"],
    }
    manifest = build_manifest(inp, outputs)
    outputs["manifest.json"] = write_json(out_dir / "manifest.json", manifest, pretty=True)
    ms = landscape["missions"]
    print(
        "build: "
        + ", ".join(
            f"{k} 목표 {v['target']} (상위 10% 경계 {v['top_share_exact_value']:.4g})" for k, v in ms.items()
        )
    )
    return outputs
