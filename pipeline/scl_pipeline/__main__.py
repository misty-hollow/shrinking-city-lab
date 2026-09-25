"""명령줄.

python -m scl_pipeline fetch        Git 밖 원자료(공주시 인구·일정, 경계·DEM)를 cache/에 받는다(해시 고정)
python -m scl_pipeline import       공주시 원자료 → derived/source_facts.json(계산 입력 값만)
python -m scl_pipeline boundaries   경계 → derived/boundaries.json
python -m scl_pipeline osm          OSM 추출(docker osmium) → derived/osm_features.json
python -m scl_pipeline route        OSRM car 행렬(docker) → derived/osrm_car_table.json
python -m scl_pipeline routes       20분 안 쌍의 OSRM car 경로 형상(docker) → derived/osrm_car_routes.json
python -m scl_pipeline terrain      DEM → app/public/data/terrain.bin, derived/terrain.json
python -m scl_pipeline build        앱 데이터(JSON) 생성, data.lock.json 갱신
python -m scl_pipeline verify       불변식 + 다시 만들어 바이트 대조 + 잠금 대조
python -m scl_pipeline all          fetch → import → boundaries → osm → route → terrain → build → verify
python -m scl_pipeline compare DIR  반증 실험 산출물(exp2 폴더)과 1회 대조 → reports/
python -m scl_pipeline compare-r1 DIR   r1 스냅숏(DIR/derived, DIR/appdata)과 비교 → reports/r1_to_r2.json
python -m scl_pipeline check-hira --zip PATH   facilities.json의 HIRA 값을 원본과 대조
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import (
    boundaries_step,
    build_step,
    compare_r1,
    compare_step,
    hira_check,
    import_step,
    osm_step,
    route_step,
    routes_step,
    sources,
    terrain_step,
    verify_step,
)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(prog="scl_pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("fetch", "import", "boundaries", "osm", "route", "routes", "terrain", "build", "all"):
        sub.add_parser(name)
    v = sub.add_parser("verify")
    v.add_argument("--no-rebuild", action="store_true")
    c = sub.add_parser("compare")
    c.add_argument("exp2", type=Path)
    c1 = sub.add_parser("compare-r1")
    c1.add_argument("r1", type=Path)
    h = sub.add_parser("check-hira")
    h.add_argument("--zip", type=Path, required=True)
    a = ap.parse_args(argv)

    if a.cmd in ("fetch", "all"):
        sources.fetch()
    if a.cmd in ("import", "all"):
        import_step.run()
    if a.cmd in ("boundaries", "all"):
        boundaries_step.run()
    if a.cmd in ("osm", "all"):
        osm_step.run()
    if a.cmd in ("route", "all"):
        route_step.run()
    if a.cmd in ("routes", "all"):
        routes_step.run()
    if a.cmd in ("terrain", "all"):
        terrain_step.run()
    if a.cmd in ("build", "all"):
        build_step.run()
        verify_step.write_lock()
    if a.cmd in ("verify", "all"):
        return 0 if verify_step.run(rebuild=not getattr(a, "no_rebuild", False)) else 1
    if a.cmd == "compare":
        compare_step.run(a.exp2)
    if a.cmd == "compare-r1":
        compare_r1.run(a.r1)
    if a.cmd == "check-hira":
        return 0 if hira_check.run(a.zip) else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
