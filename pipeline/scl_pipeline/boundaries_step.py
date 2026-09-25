"""읍·면 10곳 + 시내(동 6곳) 경계 → derived/boundaries.json.

원자료: 통계청 SGIS 행정동 경계(admdongkor 가공, 커밋 고정). 공주시 16개 행정동 중
읍·면 10곳은 그대로, 동 6곳은 합쳐 `시내`로 둔다. 인접 경계가 어긋나지 않도록
커버리지 단순화(shapely.coverage_simplify)를 쓴다.
"""

from __future__ import annotations

import json
from typing import Any

import shapely
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import polylabel, transform, unary_union

from . import config
from .sources import require_cached
from .util import module_sha256, project, write_json

SIMPLIFY_KM = 0.03


def _proj(geom):
    return transform(lambda x, y, z=None: project(x, y), geom)


def _rings(geom) -> list[list[list[list[float]]]]:
    """(Multi)Polygon → [[외곽 링, 구멍...], ...] km 좌표, 1 m 반올림."""
    polys = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]
    out = []
    for p in polys:
        rings = [p.exterior, *p.interiors]
        out.append([[[round(x, 3), round(y, 3)] for x, y in r.coords] for r in rings])
    return out


def _largest(geom) -> Polygon:
    if isinstance(geom, MultiPolygon):
        return max(geom.geoms, key=lambda g: g.area)
    return geom


def run() -> dict[str, Any]:
    src_path, src = require_cached("admin_boundaries")
    data = json.loads(src_path.read_text(encoding="utf-8"))
    prefix = "충청남도 공주시 "
    feats = {}
    for f in data["features"]:
        nm = f["properties"].get("adm_nm", "")
        if nm.startswith(prefix):
            feats[nm[len(prefix) :]] = f
    want = (*config.EMD_NAMES, *config.DONGS)
    if sorted(feats) != sorted(want):
        raise SystemExit(f"공주시 행정동 구성이 예상과 다르다: {sorted(feats)}")

    names = list(want)
    geoms = [_proj(shape(feats[n]["geometry"])).buffer(0) for n in names]
    simplified = shapely.coverage_simplify(geoms, SIMPLIFY_KM, simplify_boundary=True)
    by_name = dict(zip(names, simplified, strict=True))

    emds = []
    for slug, name in config.EMDS:
        g = by_name[name]
        label = polylabel(_largest(g), tolerance=0.05)
        emds.append(
            {
                "id": slug,
                "name": name,
                "adm_cd2": feats[name]["properties"]["adm_cd2"],
                "area_km2": round(geoms[names.index(name)].area, 2),
                "label": [round(label.x, 3), round(label.y, 3)],
                "polygons": _rings(g),
            }
        )
    city_core = unary_union([by_name[d] for d in config.DONGS])
    core_label = polylabel(_largest(city_core), tolerance=0.05)
    outer = unary_union(list(by_name.values()))
    outer_raw = unary_union(geoms)
    out = {
        "provenance": {
            "source_key": "admin_boundaries",
            "source_sha256": src["sha256"],
            "features": {n: feats[n]["properties"]["adm_cd2"] for n in names},
            "method": f"경위도 → 로컬 km 투영 후 coverage_simplify(허용오차 {SIMPLIFY_KM} km)",
            "step_code_sha256": module_sha256(__file__),
        },
        "emds": emds,
        "city_core": {
            "name": "공주 시내(동 지역)",
            "members": list(config.DONGS),
            "label": [round(core_label.x, 3), round(core_label.y, 3)],
            "polygons": _rings(city_core),
        },
        "outer": {"polygons": _rings(outer), "area_km2": round(outer_raw.area, 2)},
    }
    sha = write_json(config.DERIVED_DIR / "boundaries.json", out)
    print(f"boundaries: 읍·면 {len(emds)} + 시내, 외곽 면적 {out['outer']['area_km2']} km² ({sha[:12]})")
    return out


def polys_to_geom(polys) -> MultiPolygon:
    return MultiPolygon([Polygon(p[0], p[1:]) for p in polys])


def load() -> tuple[MultiPolygon, dict[str, Any]]:
    """(외곽 경계 km, boundaries.json 내용)."""
    d = json.loads((config.DERIVED_DIR / "boundaries.json").read_text(encoding="utf-8"))
    return polys_to_geom(d["outer"]["polygons"]), d
