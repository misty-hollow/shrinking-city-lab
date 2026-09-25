"""OSM 추출(docker osmium) → derived/osm_features.json.

1. 충청권 추출본에서 반증 실험과 같은 bbox를 잘라낸다(osrm car 그래프 입력도 이것).
2. 필요한 객체만 tags-filter → geojsonseq로 내보낸다.
3. 법정리 대표점 후보(place 점), 지소 좌표 보정 객체, 표시용 도로·하천을 정리해 저장한다.

도로·하천은 시각 표현 전용이다(설계안 6-3). 계산에는 OSRM 행렬만 쓴다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from shapely.geometry import LineString, MultiLineString, Polygon, shape
from shapely.ops import linemerge, transform, unary_union

from . import boundaries_step, config
from .sources import require_osm_pbf
from .util import docker, host_path, module_sha256, project, read_json, sha256_file, write_json

OSM_CACHE = config.CACHE_DIR / "osm"
BBOX_PBF = "gongju_bbox.osm.pbf"
SIMPLIFY_KM = 0.03
CLIP_BUFFER_KM = 1.0


def osmium_image() -> str:
    """osmium 실행 이미지. `docker build -t scl-osmium:local -f pipeline/osrm/Dockerfile.osmium pipeline/osrm`"""
    return config.OSMIUM_IMAGE


def _osmium(work: Path, src_dir: Path, *args: str, capture: bool = False) -> str:
    return docker(
        "run", "--rm",
        "-v", f"{host_path(src_dir)}:/in:ro",
        "-v", f"{host_path(work)}:/work",
        osmium_image(), *args, capture=capture,
    )  # fmt: skip


def _facility_filters() -> list[str]:
    facs = read_json(config.SOURCES_DIR / "facilities.json")["facilities"]
    exprs = []
    for f in facs:
        c = f["coordinate"]
        if c["method"] == "osm_feature":
            k, v = next((k, v) for k, v in c["match"].items() if v != "*")
            exprs.append(f"nwr/{k}={v}")
    return exprs


def _features(path: Path):
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip().lstrip("\x1e")
            if line:
                yield json.loads(line)


def _proj(geom):
    return transform(lambda x, y, z=None: project(x, y), geom)


def _merge(geoms):
    """선들을 이어 붙인다. 교차 결과에 점·면이 섞여 와도 선만 남긴다."""
    lines = []
    for g in geoms:
        for part in getattr(g, "geoms", [g]):
            if isinstance(part, LineString):
                lines.append(part)
            elif isinstance(part, MultiLineString):
                lines.extend(part.geoms)
    u = unary_union(lines)
    return linemerge(u) if isinstance(u, MultiLineString) else u


def _lines_out(geom) -> list[list[list[float]]]:
    parts = list(geom.geoms) if isinstance(geom, MultiLineString) else [geom]
    out = []
    for g in parts:
        if not isinstance(g, LineString) or g.length < 0.2:
            continue
        out.append([[round(x, 3), round(y, 3)] for x, y in g.coords])
    return out


def run() -> dict[str, Any]:
    pbf = require_osm_pbf()
    OSM_CACHE.mkdir(parents=True, exist_ok=True)
    info = json.loads(_osmium(OSM_CACHE, pbf.parent, "fileinfo", "-e", "-j", f"/in/{pbf.name}", capture=True))
    last_ts = info["data"]["timestamp"]["last"]

    b = ",".join(str(v) for v in config.OSM_BBOX)
    _osmium(
        OSM_CACHE, pbf.parent, "extract", "-b", b, f"/in/{pbf.name}", "-o", f"/work/{BBOX_PBF}", "--overwrite"
    )
    classes = ",".join(config.ROAD_CLASSES)
    filters = [
        "n/place=town,village,hamlet",
        f"w/highway={classes}",
        "w/waterway=river",
        "wr/natural=water",
        *_facility_filters(),
    ]
    _osmium(
        OSM_CACHE,
        OSM_CACHE,
        "tags-filter",
        f"/in/{BBOX_PBF}",
        *filters,
        "-o",
        "/work/scl_filtered.osm.pbf",
        "--overwrite",
    )
    _osmium(
        OSM_CACHE, OSM_CACHE, "export", "/in/scl_filtered.osm.pbf", "-f", "geojsonseq",
        "--add-unique-id=type_id", "-o", "/work/scl_filtered.geojsonseq", "--overwrite",
    )  # fmt: skip

    outer, _ = boundaries_step.load()
    clip = outer.buffer(CLIP_BUFFER_KM)
    places, roads, rivers, waters, fac_candidates = [], {c: [] for c in config.ROAD_CLASSES}, [], [], []
    for f in _features(OSM_CACHE / "scl_filtered.geojsonseq"):
        p, gtype = f["properties"], f["geometry"]["type"]
        fid = f.get("id") or p.get("@id") or ""
        if gtype == "Point" and p.get("place") in ("town", "village", "hamlet") and p.get("name"):
            lon, lat = f["geometry"]["coordinates"]
            places.append({"osm": fid, "place": p["place"], "name": p["name"], "lon": lon, "lat": lat})
        if p.get("highway") in roads and gtype in ("LineString", "MultiLineString"):
            g = _proj(shape(f["geometry"])).intersection(clip)
            if not g.is_empty:
                roads[p["highway"]].append(g)
        if p.get("waterway") == "river" and gtype in ("LineString", "MultiLineString"):
            g = _proj(shape(f["geometry"])).intersection(clip)
            if not g.is_empty:
                rivers.append((p.get("name", ""), g))
        if p.get("natural") == "water" and gtype in ("Polygon", "MultiPolygon"):
            g = _proj(shape(f["geometry"])).buffer(0).intersection(clip)
            if not g.is_empty:
                waters.append(g)
        fac_candidates.append((fid, gtype, p, f["geometry"]))

    places.sort(key=lambda r: (r["osm"][0], int(r["osm"][1:])))
    fac_matches = _match_facilities(fac_candidates)

    road_out = []
    for cls in config.ROAD_CLASSES:
        if not roads[cls]:
            continue
        merged = _merge(roads[cls])
        for coords in _lines_out(merged.simplify(SIMPLIFY_KM)):
            road_out.append({"class": cls, "coords": coords})
    river_out = []
    by_name: dict[str, list] = {}
    for name, g in rivers:
        by_name.setdefault(name, []).append(g)
    for name in sorted(by_name):
        merged = _merge(by_name[name])
        for coords in _lines_out(merged.simplify(SIMPLIFY_KM)):
            river_out.append({"name": name, "coords": coords})
    water_out = []
    if waters:
        wu = unary_union(waters).simplify(SIMPLIFY_KM)
        for poly in list(getattr(wu, "geoms", [wu])):
            if isinstance(poly, Polygon) and poly.area >= 0.02:
                rings = [poly.exterior, *poly.interiors]
                water_out.append([[[round(x, 3), round(y, 3)] for x, y in r.coords] for r in rings])
    water_out.sort(key=lambda r: (-len(r[0]), r[0][0]))

    out = {
        "provenance": {
            "source_key": "osm_extract",
            "pbf_sha256": sha256_file(pbf),
            "osm_latest_object_timestamp": last_ts,
            "bbox": list(config.OSM_BBOX),
            "bbox_pbf_sha256": sha256_file(OSM_CACHE / BBOX_PBF),
            "osmium": f"{osmium_image()} (debian bookworm osmium-tool, pipeline/osrm/Dockerfile.osmium)",
            "commands": [
                f"osmium extract -b {b} chungcheong.osm.pbf -o {BBOX_PBF}",
                f"osmium tags-filter {BBOX_PBF} {' '.join(filters)}",
                "osmium export -f geojsonseq --add-unique-id=type_id",
            ],
            "display_simplify_km": SIMPLIFY_KM,
            "step_code_sha256": module_sha256(__file__),
        },
        "places": places,
        "facility_matches": fac_matches,
        "roads": road_out,
        "rivers": river_out,
        "water_polygons": water_out,
    }
    sha = write_json(config.DERIVED_DIR / "osm_features.json", out)
    print(
        f"osm: place 점 {len(places)}, 도로 {len(road_out)}, 하천 {len(river_out)}, "
        f"수면 {len(water_out)}, 지소 보정 {len(fac_matches)} ({sha[:12]})"
    )
    return out


def _match_facilities(cands) -> dict[str, Any]:
    facs = read_json(config.SOURCES_DIR / "facilities.json")["facilities"]
    out = {}
    for f in facs:
        c = f["coordinate"]
        if c["method"] != "osm_feature":
            continue
        hits = []
        for fid, gtype, p, geom in cands:
            if all((k in p) if v == "*" else (p.get(k) == v) for k, v in c["match"].items()):
                hits.append((fid, gtype, geom))
        polys = [h for h in hits if h[1] in ("Polygon", "MultiPolygon")]
        chosen = polys or hits
        ids = sorted({h[0] for h in chosen})
        if len(ids) != 1:
            raise SystemExit(f"{f['name']}: OSM 보정 객체가 하나가 아니다 {ids}")
        fid, gtype, geom = next(h for h in chosen if h[0] == ids[0])
        cen = shape(geom).centroid
        out[f["id"]] = {
            "osm": fid,
            "geometry_type": gtype,
            "lon": round(cen.x, 6),
            "lat": round(cen.y, 6),
            "rule": "일치 객체 중 면(건물)을 우선하고 경위도 중심점을 소수 6자리로 반올림",
        }
    return out
