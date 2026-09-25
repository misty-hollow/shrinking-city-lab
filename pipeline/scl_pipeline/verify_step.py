"""앱 데이터 검증.

1. 불변식: 수요점 161, 시설 10, 행렬 161×10, 결측·NaN·음수·비정상 시간 없음,
   인구 합계, 현재 10일, provenance 항목 존재, 파생 파일에 적힌 단계 코드 해시 = 지금 코드.
2. 재현: 임시 폴더에 build를 다시 돌려 저장소의 app 데이터와 바이트가 같은지.
3. 잠금: data.lock.json(파생·앱 산출물 sha256)과 현재 파일이 같은지.
"""

from __future__ import annotations

import math
import tempfile
from pathlib import Path
from typing import Any

from . import access, build_step, config
from .util import module_sha256, read_json, sha256_file, write_json

APP_FILES = (
    "scenario.json",
    "geometry.json",
    "landscape.json",
    "golden.json",
    "manifest.json",
    "terrain.bin",
)

REQUIRED_MANIFEST = (
    ("display_dates", "population"),
    ("display_dates", "schedule"),
    ("display_dates", "road_network"),
    ("sources", "population", "reference_date"),
    ("sources", "schedule", "reference_date"),
    ("sources", "schedule", "conversion_rule"),
    ("sources", "road_network", "osm_latest_object_timestamp"),
    ("sources", "routing", "profile"),
    ("sources", "routing", "image"),
    ("sources", "routing", "digest"),
    ("semantics", "demand_points"),
    ("semantics", "facilities"),
    ("semantics", "matrix"),
    ("reproducibility", "code_sha256"),
    ("reproducibility", "inputs"),
    ("reproducibility", "outputs"),
    ("classification",),
)


def _get(d: Any, path: tuple[str, ...]) -> Any:
    for p in path:
        d = d[p]
    return d


def invariants(data_dir: Path) -> list[str]:
    errs: list[str] = []
    sc = read_json(data_dir / "scenario.json")
    mf = read_json(data_dir / "manifest.json")
    v, f = sc["villages"], sc["facilities"]
    t = sc["matrix"]["tenths"]
    if len(v) != 161:
        errs.append(f"수요점 {len(v)} != 161")
    if len({x["id"] for x in v}) != len(v):
        errs.append("수요점 id 중복")
    if len(f) != 10:
        errs.append(f"시설 {len(f)} != 10")
    if len(t) != len(v) or any(len(r) != len(f) for r in t):
        errs.append("행렬 차원이 161×10이 아니다")
    flat = [c for r in t for c in r]
    if any(not isinstance(c, int) for c in flat):
        errs.append("행렬에 정수가 아닌 값(결측·NaN)이 있다")
    else:
        if min(flat) <= 0:
            errs.append(f"0 이하 시간 {min(flat)}")
        if max(flat) > 1200:
            errs.append(f"비정상적으로 긴 시간 {max(flat) / 10}분")
    for i, r in enumerate(t):
        if min(r) > 600:
            errs.append(f"{v[i]['id']}: 모든 지소가 도로망 60분 밖")
    if sum(x["pop"] for x in v) != sc["totals"]["pop"]:
        errs.append("인구 합계 불일치")
    if any((not isinstance(x["pop"], int)) or x["pop"] <= 0 for x in v):
        errs.append("0 이하 인구")
    if not math.isclose(sum(sc["current_allocation"]), 10.0):
        errs.append("현재 실제 진료일 합이 10이 아니다")
    for path in REQUIRED_MANIFEST:
        try:
            val = _get(mf, path)
            if val in (None, "", [], {}):
                errs.append(f"manifest {'.'.join(path)} 비어 있음")
        except KeyError:
            errs.append(f"manifest {'.'.join(path)} 없음")
    classes = {c["class"] for c in mf.get("classification", [])}
    if classes != {"REAL_DATA", "DERIVED", "SIMULATION_ASSUMPTION"}:
        errs.append(f"분류 세 가지가 모두 있어야 한다: {classes}")
    errs.extend(access_invariants(sc, mf))
    errs.extend(route_invariants(sc, read_json(data_dir / "geometry.json")))
    errs.extend(provenance_invariants(config.DERIVED_DIR))
    return errs


# 파생 파일 → 그 파일을 만든 단계 모듈. 모듈이 하나면 provenance.step_code_sha256은 문자열, 여럿이면 {모듈: 해시}.
STEP_MODULES: dict[str, tuple[str, ...]] = {
    "source_facts.json": ("import_step", "population", "schedule"),
    "boundaries.json": ("boundaries_step",),
    "osm_features.json": ("osm_step",),
    "osrm_car_table.json": ("route_step", "access"),
    "osrm_car_routes.json": ("routes_step",),
}


def provenance_invariants(derived_dir: Path) -> list[str]:
    """파생 파일이 지금 코드로 만들어졌는지. 단계 코드를 고치고 그 단계를 다시 돌리지 않으면 여기서 걸린다
    (docker가 필요한 osm·route·routes 단계는 CI가 돌리지 않으므로 이 대조가 유일한 안전장치다)."""
    errs: list[str] = []
    pkg = Path(__file__).resolve().parent
    for name, modules in STEP_MODULES.items():
        rec = read_json(derived_dir / name)["provenance"].get("step_code_sha256")
        cur = {m: module_sha256(str(pkg / f"{m}.py")) for m in modules}
        want: Any = cur[modules[0]] if len(modules) == 1 else cur
        if rec != want:
            errs.append(
                f"{name}: provenance.step_code_sha256이 지금 코드({', '.join(modules)})와 다르다 — 그 단계를 다시 돌려라"
            )
    return errs


def route_invariants(sc: dict[str, Any], geo: dict[str, Any]) -> list[str]:
    """도달 경로 형상: 도로망 20분 안 쌍마다 정확히 하나, 점 2개 이상, 끝점이 마을·지소 대표점 근처(접근점 1 km 안)."""
    errs: list[str] = []
    routes = geo.get("routes")
    if not routes:
        return ["geometry.routes가 없다"]
    lim = routes["threshold_min"] * 10
    t = sc["matrix"]["tenths"]
    want = {(i, j) for i, row in enumerate(t) for j, v in enumerate(row) if v <= lim}
    have = {(p[0], p[1]) for p in routes["pairs"]}
    if want != have:
        errs.append(
            f"경로 형상 쌍이 행렬의 {routes['threshold_min']}분 안 쌍과 다르다: 빠짐 {len(want - have)} 남음 {len(have - want)}"
        )
    v, f = sc["villages"], sc["facilities"]
    for i, j, coords in routes["pairs"]:
        if len(coords) < 2:
            errs.append(f"경로 {v[i]['id']}→{f[j]['id']}: 점이 2개 미만")
            continue
        (x0, y0), (x1, y1) = coords[0], coords[-1]
        if (
            math.hypot(x0 - v[i]["x"], y0 - v[i]["y"]) > 1.2
            or math.hypot(x1 - f[j]["x"], y1 - f[j]["y"]) > 1.2
        ):
            errs.append(f"경로 {v[i]['id']}→{f[j]['id']}: 끝점이 대표점에서 1.2 km 넘게 떨어짐")
    return errs


ACCESS_KEYS = ("lon", "lat", "dist_m", "osm_way", "highway")


def access_invariants(sc: dict[str, Any], mf: dict[str, Any]) -> list[str]:
    """접근점 규칙(access-v1) 불변식: 메타데이터 완전성, 고속도로·전용도로·터널 출발점 없음."""
    errs = []
    ap = mf.get("access_points", {})
    if not ap.get("rule_version") or not ap.get("rule"):
        errs.append("manifest access_points 규칙 판본이 없다")
    for x in sc["villages"] + sc["facilities"]:
        a = x.get("access") or {}
        missing = [k for k in ACCESS_KEYS if a.get(k) in (None, "")]
        if missing:
            errs.append(f"{x['id']}: 접근점 정보 누락 {missing}")
        elif a["highway"] in access.FORBIDDEN_HIGHWAY:
            errs.append(f"{x['id']}: 접근점이 {a['highway']} 위에 있다")
    table = read_json(config.DERIVED_DIR / "osrm_car_table.json")
    for p in table["sources"] + table["destinations"]:
        if p["access"].get("tags_flag"):
            errs.append(f"{p['id']}: 접근점 구간이 규칙에 어긋난다 ({p['access']['tags_flag']})")
    return errs


def lock_record() -> dict[str, Any]:
    files = {}
    for p in sorted(config.DERIVED_DIR.glob("*.json")):
        files[f"derived/{p.name}"] = sha256_file(p)
    for name in APP_FILES:
        files[f"app/public/data/{name}"] = sha256_file(config.APP_DATA_DIR / name)
    return {"data_version": config.DATA_VERSION, "files": files}


def write_lock() -> None:
    write_json(config.LOCK_PATH, lock_record(), pretty=True)


def run(*, rebuild: bool = True) -> bool:
    ok = True
    errs = invariants(config.APP_DATA_DIR)
    for e in errs:
        print(f"FAIL 불변식: {e}")
    ok &= not errs
    if not errs:
        print("PASS 불변식: 수요점 161 · 시설 10 · 행렬 161×10 · 결측/NaN/음수 없음 · 현재 10일 · provenance")
    for issue in read_json(config.APP_DATA_DIR / "manifest.json").get("known_issues", []):
        ids = ", ".join(p["id"] for p in issue.get("points", []))
        print(f"WARN 알려진 데이터 한계 {issue['id']}: {ids} — manifest.known_issues")

    if config.LOCK_PATH.exists():
        lock = read_json(config.LOCK_PATH)
        cur = lock_record()
        diff = [k for k in lock["files"] if lock["files"][k] != cur["files"].get(k)]
        if diff:
            ok = False
            print(f"FAIL 잠금: data.lock.json과 다른 파일 {diff}")
        else:
            print(f"PASS 잠금: {len(lock['files'])}개 파일 해시 일치")
    else:
        ok = False
        print("FAIL 잠금: data.lock.json이 없다")

    if rebuild:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            build_step.run(out)
            mism = [
                n
                for n in APP_FILES
                if n != "terrain.bin" and sha256_file(out / n) != sha256_file(config.APP_DATA_DIR / n)
            ]
        if mism:
            ok = False
            print(f"FAIL 재현: 다시 만든 결과가 저장소와 다르다 {mism}")
        else:
            print("PASS 재현: 임시 폴더에 다시 만든 앱 데이터가 저장소와 바이트 단위로 같다")
    return ok
