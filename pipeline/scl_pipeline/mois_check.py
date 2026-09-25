"""인구 파생값을 행정안전부 공공데이터포털 주민등록 인구(이용허락범위 제한 없음)와 대조한다.

계산은 공주시 「2026년 8월 인구현황」 xlsx(Git 밖)에서 읽는다. 같은 기준일(2026-08-31)의 행정안전부 개방 자료가
같은 값을 주는지 여기서 확인한다. 개방 자료는 재배포가 허락되어 저장소(sources/mois/)에 원본 그대로 두므로
CI의 verify도 이 대조를 돈다.

- 법정동 자료(15099158): 법정리 인구 = 리 행 `계`, 읍·면 총인구·65세 이상 = 그 읍·면 리 행의 합, 시 전체 = 공주시 모든 행의 합
- 행정동 자료(15097972): 시내 동 6곳 총인구
- 앱 scenario.json의 수요점 인구 = source_facts의 법정리 값
"""

from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any

from . import config
from .sources import require_local
from .util import read_json, write_json

REPORT = config.REPORTS_DIR / "mois_crosscheck.json"


def _rows(key: str) -> tuple[list[dict[str, str]], dict[str, Any]]:
    path, meta = require_local(key)
    text = path.read_bytes().decode(meta["encoding"])
    rows = [r for r in csv.DictReader(io.StringIO(text)) if r["시군구명"] == "공주시"]
    return rows, meta


def _age(col: str) -> int | None:
    """'65세남자'·'110세 이상여자' → 65·110. 연령 칸이 아니면 None."""
    c = col.replace(" ", "")
    for sex in ("남자", "여자"):
        if c.endswith(sex):
            n = c[: -len(sex)].removesuffix("이상").removesuffix("세")
            return int(n) if n.isdigit() else None
    return None


def _pop65(r: dict[str, str]) -> int:
    return sum(int(v) for k, v in r.items() if (a := _age(k)) is not None and a >= 65)


def compare(source_facts: dict[str, Any], scenario: dict[str, Any]) -> dict[str, Any]:
    stdg, m1 = _rows("population_mois_stdg")
    adm, m2 = _rows("population_mois_admdong")
    pop = source_facts["population"]
    mism: list[str] = []
    n = 0

    def check(label: str, ours: int, theirs: int) -> None:
        nonlocal n
        n += 1
        if ours != theirs:
            mism.append(f"{label}: 저장소 {ours} / 행정안전부 {theirs}")

    for m in (m1, m2):
        dates = {r["기준연월"] for r in (stdg if m is m1 else adm)}
        if dates != {pop["reference_date"]}:
            mism.append(f"{m['title']}: 기준일 {sorted(dates)} != {pop['reference_date']}")
    for e in pop["emds"]:
        ri_rows = {r["리명"]: r for r in stdg if r["읍면동명"] == e["name"] and r["리명"]}
        ours = dict(e["ri"])
        if set(ri_rows) != set(ours):
            mism.append(f"{e['name']}: 법정리 목록이 다르다 {sorted(set(ri_rows) ^ set(ours))}")
        for ri, v in ours.items():
            check(f"{e['name']} {ri}", v, int(ri_rows[ri]["계"]) if ri in ri_rows else -1)
        check(f"{e['name']} 총인구", e["total"], sum(int(r["계"]) for r in ri_rows.values()))
        check(f"{e['name']} 65세 이상", e["pop65"], sum(_pop65(r) for r in ri_rows.values()))
    check("공주시 총인구", pop["city_total"], sum(int(r["계"]) for r in stdg))
    check("공주시 65세 이상", pop["city_65plus"], sum(_pop65(r) for r in stdg))
    for dong, v in pop["dong_total"].items():
        check(f"{dong}(행정동) 총인구", v, sum(int(r["계"]) for r in adm if r["읍면동명"] == dong))

    ri_all = {(e["name"], ri): v for e in pop["emds"] for ri, v in e["ri"]}
    emd_name = {x["id"]: x["name"] for x in scenario["emds"]}
    for v in scenario["villages"]:
        check(f"scenario {v['id']}", v["pop"], ri_all.get((emd_name[v["emd"]], v["name"]), -1))

    return {
        "purpose": (
            "계산에 읽은 공주시 인구현황 xlsx의 파생값이 같은 기준일의 행정안전부 공공데이터포털 주민등록 인구와 "
            "같은지 대조한 기록. 앱의 인구 출처 표기 근거"
        ),
        "reference_date": pop["reference_date"],
        "sources": {
            k: {f: m[f] for f in ("publisher", "title", "page_url", "license", "sha256", "local_path")}
            for k, m in (("population_mois_stdg", m1), ("population_mois_admdong", m2))
        },
        "compared": {
            "legal_ri_population": sum(len(e["ri"]) for e in pop["emds"]),
            "emd_total_and_65plus": len(pop["emds"]) * 2,
            "city_total_and_65plus": 2,
            "city_core_admin_dong_total": len(pop["dong_total"]),
            "scenario_demand_points": len(scenario["villages"]),
        },
        "checked": n,
        "mismatches": mism,
        "result": "MATCH" if not mism else "MISMATCH",
    }


def run() -> bool:
    rep = compare(
        read_json(config.DERIVED_DIR / "source_facts.json"), read_json(config.APP_DATA_DIR / "scenario.json")
    )
    write_json(REPORT, rep, pretty=True)
    print(f"check-mois: {rep['checked']}개 값 대조, 불일치 {len(rep['mismatches'])} → {rep['result']}")
    for m in rep["mismatches"]:
        print(f"  {m}")
    return not rep["mismatches"]


def invariants(data_dir: Path) -> list[str]:
    """verify용: 대조가 여전히 맞고, 저장소의 보고서가 지금 대조 결과와 같은지."""
    rep = compare(read_json(config.DERIVED_DIR / "source_facts.json"), read_json(data_dir / "scenario.json"))
    errs = [f"행정안전부 인구 대조: {m}" for m in rep["mismatches"]]
    if not REPORT.exists() or read_json(REPORT) != rep:
        errs.append(
            "reports/mois_crosscheck.json이 지금 대조 결과와 다르다 — `python -m scl_pipeline check-mois`"
        )
    return errs
