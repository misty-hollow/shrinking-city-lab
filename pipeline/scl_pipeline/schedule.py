"""공주시보건소 순회근무 현황(의과진료) 표 → 지소별 주당 진료일.

원자료는 공주시보건소 진료안내 페이지의 HTML 표다. 저장소에는 페이지 전체가 아니라
제목(기준일)과 의과 표만 잘라 둔 발췌본을 둔다(`sources/clinic_schedule/`).

환산 규칙(설계안 4-1, 4-2): 요일 칸 `○` = 주 1일, `격주` = 주 0.5일(격주 평균), 빈 칸 = 0.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from pathlib import Path

from . import config

DAY_NAMES = ("월", "화", "수", "목", "금")
CELL_DAYS = {"○": 1.0, "격주": 0.5, "": 0.0}


@dataclass(frozen=True)
class ScheduleRow:
    facility_id: str
    source_name: str
    cells: tuple[str, ...]  # 월~금 원문
    note: str
    weekly_days: float


@dataclass(frozen=True)
class Schedule:
    heading: str
    reference_date: str
    rows: tuple[ScheduleRow, ...]


def extract_excerpt(page_html: str) -> str:
    """전체 페이지에서 순회근무 제목(h2)과 의과 표를 잘라낸다."""
    h2 = re.search(r"<h2[^>]*>[^<]*순회근무 현황[^<]*</h2>", page_html)
    if not h2:
        raise ValueError("순회근무 현황 제목을 찾지 못했다")
    start = page_html.find("<table", page_html.find("의과 진료", h2.end()))
    end = page_html.find("</table>", start) + len("</table>")
    if start < 0 or end <= start:
        raise ValueError("의과 진료 표를 찾지 못했다")
    return h2.group(0) + "\n" + page_html[start:end] + "\n"


def _text(cell: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", cell)).strip()


def parse_excerpt(excerpt: str) -> Schedule:
    h2 = re.search(r"<h2[^>]*>([^<]*)</h2>", excerpt)
    heading = _text(h2.group(1)) if h2 else ""
    m = re.search(r"\((\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*기준\)", heading)
    if not m:
        raise ValueError(f"기준일을 읽지 못했다: {heading!r}")
    ref = f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    body = excerpt[excerpt.find("<tbody") :]
    rows = []
    by_short = {name[:2]: slug for slug, name in config.EMDS}
    for tr in re.findall(r"<tr>(.*?)</tr>", body, flags=re.S):
        tds = [_text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S)]
        if not tds or not tds[0].endswith("보건지소"):
            continue
        name, cells, note = tds[0], tuple(tds[1:6]), tds[6] if len(tds) > 6 else ""
        unknown = [c for c in cells if c not in CELL_DAYS]
        if unknown:
            raise ValueError(f"{name}: 해석 규칙이 없는 칸 {unknown}")
        slug = by_short[name[:2]]
        days = sum(CELL_DAYS[c] for c in cells)
        rows.append(ScheduleRow(slug, name, cells, note, days))
    order = {slug: i for i, slug in enumerate(config.FACILITY_IDS)}
    rows.sort(key=lambda r: order[r.facility_id])
    if [r.facility_id for r in rows] != list(config.FACILITY_IDS):
        raise ValueError("보건지소 10곳이 표에 모두 있어야 한다")
    return Schedule(heading=heading, reference_date=ref, rows=tuple(rows))


def read_schedule(path: Path) -> Schedule:
    return parse_excerpt(path.read_text(encoding="utf-8"))


def to_facts(s: Schedule) -> dict:
    return {
        "heading": s.heading,
        "reference_date": s.reference_date,
        "rows": [
            {
                "facility": r.facility_id,
                "source_name": r.source_name,
                "cells": list(r.cells),
                "note": r.note,
                "weekly_days": r.weekly_days,
            }
            for r in s.rows
        ],
    }


def from_facts(f: dict) -> Schedule:
    rows = []
    for r in f["rows"]:
        cells = tuple(r["cells"])
        days = sum(CELL_DAYS[c] for c in cells)
        if days != r["weekly_days"]:
            raise ValueError(f"{r['facility']}: 요일 칸과 주당 진료일이 맞지 않는다")
        rows.append(ScheduleRow(r["facility"], r["source_name"], cells, r["note"], days))
    return Schedule(heading=f["heading"], reference_date=f["reference_date"], rows=tuple(rows))
