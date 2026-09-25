"""법정리 161곳의 대표점(수요점)과 보건지소 10곳의 좌표를 정한다.

수요점 규칙(반증 실험 build_demand.py와 같다, 설계안 4-1 "리 대표점 1개"):
  법정리 이름과 같은 OSM place=village/hamlet 점 중에서 그 읍·면 place=town 점에 가장
  가까운 것. 가장 가까운 후보가 0.12° 넘게 떨어지면 매칭 실패로 멈춘다. 둘째 후보도
  0.15° 안에 있으면 '모호'로 기록한다(선택은 가장 가까운 점).
리 주민 전체가 이 한 점에 있다고 본다(설계안 4-9 한계 4).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from . import config
from .population import Population
from .util import read_json


@dataclass(frozen=True)
class Village:
    id: str
    emd_id: str
    emd: str
    name: str
    pop: int
    lon: float
    lat: float
    osm: str
    ambiguous: bool
    town_distance_deg: float


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def match_villages(pop: Population, osm: dict[str, Any]) -> list[Village]:
    places = osm["places"]
    towns = {}
    for p in places:
        if p["place"] == "town" and p["name"] in config.EMD_NAMES:
            if p["name"] in towns:
                raise SystemExit(f"{p['name']}: place=town 점이 둘 이상이다")
            towns[p["name"]] = (p["lon"], p["lat"])
    missing = [e for e in config.EMD_NAMES if e not in towns]
    if missing:
        raise SystemExit(f"읍·면 중심 place=town 점이 없다: {missing}")
    cands_by_name: dict[str, list[dict[str, Any]]] = {}
    for p in places:
        if p["place"] in ("village", "hamlet"):
            cands_by_name.setdefault(p["name"], []).append(p)

    out: list[Village] = []
    failed = []
    for slug, em in config.EMDS:
        town = towns[em]
        for k, (ri, n) in enumerate(pop.ri[em], start=1):
            cands = sorted(cands_by_name.get(ri, []), key=lambda q: _dist((q["lon"], q["lat"]), town))
            if not cands or _dist((cands[0]["lon"], cands[0]["lat"]), town) > config.VILLAGE_MAX_DEG:
                failed.append((em, ri, n))
                continue
            c = cands[0]
            amb = (
                len(cands) > 1
                and _dist((cands[1]["lon"], cands[1]["lat"]), town) < config.VILLAGE_AMBIGUOUS_DEG
            )
            out.append(
                Village(
                    id=f"{slug}-{k:02d}",
                    emd_id=slug,
                    emd=em,
                    name=ri,
                    pop=n,
                    lon=c["lon"],
                    lat=c["lat"],
                    osm=c["osm"],
                    ambiguous=amb,
                    town_distance_deg=round(_dist((c["lon"], c["lat"]), town), 6),
                )
            )
    if failed:
        raise SystemExit(f"대표점을 찾지 못한 법정리: {failed}")
    return out


@dataclass(frozen=True)
class Facility:
    id: str
    name: str
    emd_id: str
    emd: str
    lon: float
    lat: float
    coordinate_method: str
    coordinate_note: str


def resolve_facilities(osm: dict[str, Any]) -> list[Facility]:
    src = read_json(config.SOURCES_DIR / "facilities.json")["facilities"]
    by_emd = {name: slug for slug, name in config.EMDS}
    out = []
    for f in src:
        c = f["coordinate"]
        if c["method"] == "hira":
            lon, lat, note = f["hira"]["lon"], f["hira"]["lat"], c.get("note", "HIRA 좌표")
        else:
            m = osm["facility_matches"][f["id"]]
            lon, lat, note = m["lon"], m["lat"], f"{c['reason']} (OSM {m['osm']})"
        out.append(Facility(f["id"], f["name"], by_emd[f["emd"]], f["emd"], lon, lat, c["method"], note))
    if [f.id for f in out] != list(config.FACILITY_IDS):
        raise SystemExit("facilities.json 순서는 읍·면 순서와 같아야 한다")
    return out
