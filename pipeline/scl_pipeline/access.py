"""도로망 접근점(access point) 선택 — 규칙 access-v1.

수요점은 마을의 대표 위치이지 주행 중인 차량의 GPS 좌표가 아니다. OSRM의 기본 스냅은 가장
가까운 도로 구간에 붙이므로 고속도로 본선·램프·터널처럼 마을에서 직접 들어갈 수 없는 구간이
출발점이 될 수 있다(r1에서 확인: 고속도로 7곳, 터널 1곳).

access-v1은 "출발·도착 접근점 고르기"와 "그 뒤의 정상 car 경로"를 나눈다.
  1. /nearest?exclude=motorway 로 motorway·motorway_link가 아닌 가까운 구간 후보를 거리순으로 받는다.
     (exclude는 접근점 고르기에만 쓴다. /table 경로 계산에는 쓰지 않아 고속도로를 정상적으로 탄다.)
  2. 후보 구간의 OSM way 태그로 직접 진입할 수 없는 구간을 거른다:
     highway=motorway|motorway_link, motorroad=yes, expressway=yes, tunnel(no·building_passage 제외).
  3. 도로망 본체에 이어진 구간만 쓴다(접근점에서 지소 10곳이 모두 닿아야 한다).
  4. 고속도로 없이도 어느 지소엔가 닿아야 한다(휴게소처럼 고속도로로만 이어진 구간 제외).
  5. 조건을 만족하는 가장 가까운 후보를 hint로 고정해 /table에 넘긴다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ACCESS_RULE_VERSION = "access-v1"
ACCESS_RULE = (
    "OSRM /nearest?exclude=motorway 후보(최대 100개, 거리순) 중 OSM way가 highway=motorway|motorway_link, "
    "motorroad=yes, expressway=yes, tunnel(no·building_passage 외)이 아니고, 도로망 본체에 이어져 지소 10곳에 "
    "모두 닿으며, 고속도로 없이도 한 곳 이상 닿는 가장 가까운 구간. 그 구간을 hint로 고정해 /table을 부른다. "
    "경로 계산에는 exclude를 쓰지 않는다(접근점 이후 고속도로 이용 허용)."
)
NEAREST_N = 100
FORBIDDEN_HIGHWAY = {"motorway", "motorway_link"}
ALLOWED_TUNNEL = {"no", "building_passage"}

_DEC = re.compile(r"%([0-9a-f]+)%")


def _dec(s: str) -> str:
    return _DEC.sub(lambda m: chr(int(m.group(1), 16)), s)


@dataclass(frozen=True)
class Way:
    id: str
    tags: dict[str, str]
    nodes: tuple[int, ...]


def index_ways(opl: Path, wanted: set[int]) -> dict[int, list[Way]]:
    """OPL 한 번 훑기: wanted 노드를 지나는 highway way들."""
    out: dict[int, list[Way]] = {}
    with open(opl, encoding="utf-8") as fh:
        for line in fh:
            i = line.rfind(" N")
            if i < 0:
                continue
            nodes = tuple(int(n[1:]) for n in line[i + 2 :].strip().split(",") if n)
            hit = wanted.intersection(nodes)
            if not hit:
                continue
            head = line[:i]
            wid = head.split(" ", 1)[0]
            tags: dict[str, str] = {}
            j = head.find(" T")
            if j >= 0:
                for kv in head[j + 2 :].split(","):
                    if "=" in kv:
                        k, v = kv.split("=", 1)
                        tags[_dec(k)] = _dec(v)
            w = Way(wid, tags, nodes)
            for n in hit:
                out.setdefault(n, []).append(w)
    return out


def resolve(nodes: list[int], idx: dict[int, list[Way]]) -> list[Way]:
    """OSRM 구간(OSM 노드 쌍) → OSM way. 이웃한 쌍이면 그 way, 아니면 두 노드를 지나는 way 전부."""
    a, b = nodes
    wa = idx.get(a, []) if a else []
    wb = idx.get(b, []) if b else []
    exact = []
    for w in wa:
        for p, q in zip(w.nodes, w.nodes[1:], strict=False):
            if {p, q} == {a, b}:
                exact.append(w)
                break
    if exact:
        return sorted({w.id: w for w in exact}.values(), key=lambda w: int(w.id[1:]))
    both = {w.id: w for w in wa} | {w.id: w for w in wb}
    return sorted(both.values(), key=lambda w: int(w.id[1:]))


def rejection(way: Way) -> str | None:
    t = way.tags
    if t.get("highway") in FORBIDDEN_HIGHWAY:
        return f"highway={t['highway']}"
    if t.get("motorroad") == "yes":
        return "motorroad=yes"
    if t.get("expressway") == "yes":
        return "expressway=yes"
    if "tunnel" in t and t["tunnel"] not in ALLOWED_TUNNEL:
        return f"tunnel={t['tunnel']}"
    return None


@dataclass
class Candidate:
    rank: int
    dist: float
    location: list[float]
    nodes: list[int]
    hint: str
    ways: list[Way] = field(default_factory=list)

    @property
    def reject(self) -> str | None:
        if not self.ways:
            return "OSM way를 찾지 못함"
        for w in self.ways:
            r = rejection(w)
            if r:
                return r
        return None

    def record(self) -> dict[str, Any]:
        w = self.ways[0] if self.ways else None
        return {
            "lon": self.location[0],
            "lat": self.location[1],
            "dist_m": round(self.dist, 1),
            "candidate_rank": self.rank,
            "osm_way": w.id if w else None,
            "highway": w.tags.get("highway") if w else None,
            "ref": w.tags.get("ref", "") if w else "",
            "name": w.tags.get("name", "") if w else "",
            "tags_flag": self.reject,
            "osm_nodes": self.nodes,
        }


def way_record(ways: list[Way]) -> dict[str, Any]:
    w = ways[0] if ways else None
    if not w:
        return {"osm_way": None, "highway": None, "ref": "", "name": "", "tags_flag": "OSM way를 찾지 못함"}
    return {
        "osm_way": w.id,
        "highway": w.tags.get("highway"),
        "ref": w.tags.get("ref", ""),
        "name": w.tags.get("name", ""),
        "tags_flag": next((r for r in map(rejection, ways) if r), None),
    }
