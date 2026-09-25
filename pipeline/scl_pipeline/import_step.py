"""공주시 원자료(인구 xlsx 2개, 보건소 순회근무 표) → derived/source_facts.json.

원본 파일은 저장소에 두지 않는다. 공주시 저작권정책(https://www.gongju.go.kr/kr/sitemap_04.do, 2026-09-24
확인)은 공공누리 마크가 붙은 저작물만 별도 허락 없이 자유이용할 수 있고, 마크가 없는 자료는
"공공저작물 실무담당자와 사전에 협의하여 이용"하라고 한다. 두 게시물과 첨부에는 공공누리 마크가 없다.
그래서 원본은 공식 URL에서 cache/sources/로 받고(sha256 고정), 저장소에는 계산에 쓰는 값(법정리
인구·읍면 인구·65세 이상·요일표)과 출처만 남긴다.
"""

from __future__ import annotations

import urllib.request
from typing import Any

from . import config, population, schedule
from .sources import registry, require_cached
from .util import module_sha256, sha256_bytes, sha256_file, write_json

FACTS = config.DERIVED_DIR / "source_facts.json"


def fetch_schedule_excerpt() -> None:
    """보건소 진료안내 페이지를 받아 의과 표만 발췌해 cache에 둔다(발췌 sha256 고정)."""
    meta = registry()["clinic_schedule"]
    dest = config.PIPELINE_DIR / meta["cache_path"]
    if dest.exists() and sha256_file(dest) == meta["sha256"]:
        print(f"  있음: {dest.name}")
        return
    req = urllib.request.Request(meta["page_url"], headers={"User-Agent": "Mozilla/5.0 scl-pipeline/0.1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        page = r.read().decode("utf-8")
    excerpt = schedule.extract_excerpt(page).encode("utf-8")
    if sha256_bytes(excerpt) != meta["sha256"]:
        raise SystemExit(
            "보건소 순회근무 표가 고정한 발췌(2026-04-13 기준)와 다르다. 일정이 바뀌었으면 새 판본으로 다시 검토한다. "
            "저장소의 derived/source_facts.json은 그대로 쓸 수 있다."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(excerpt)
    print(f"  받음: {dest.name}")


def run() -> dict[str, Any]:
    p1, m1 = require_cached("population_tongban")
    p2, m2 = require_cached("population_households_age")
    ps, ms = require_cached("clinic_schedule")
    pop = population.read_population(p1, p2)
    sch = schedule.read_schedule(ps)
    facts = {
        "provenance": {
            "note": "원본 파일은 저장소 밖(cache/sources/). 아래 값은 원본에서 그대로 옮긴 계산 입력이다",
            "raw": {
                "population_tongban": {"url": m1["download_url"], "sha256": m1["sha256"]},
                "population_households_age": {"url": m2["download_url"], "sha256": m2["sha256"]},
                "clinic_schedule_excerpt": {"url": ms["page_url"], "sha256": ms["sha256"]},
            },
            "step_code_sha256": {
                "import_step": module_sha256(__file__),
                "population": module_sha256(population.__file__),
                "schedule": module_sha256(schedule.__file__),
            },
        },
        "population": population.to_facts(pop),
        "schedule": schedule.to_facts(sch),
    }
    sha = write_json(FACTS, facts, pretty=True)
    print(f"import: 법정리 {sum(len(v) for v in pop.ri.values())}곳, 일정 {len(sch.rows)}곳 ({sha[:12]})")
    return facts


def load() -> tuple[population.Population, schedule.Schedule]:
    from .util import read_json

    f = read_json(FACTS)
    return population.from_facts(f["population"]), schedule.from_facts(f["schedule"])
