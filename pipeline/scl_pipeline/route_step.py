"""OSRM car 도로망 접근시간 161×10 → derived/osrm_car_table.json.

오프라인에서 한 번만 돈다(설계안 10-5: "런타임 OSRM은 없다").
  osrm-extract -p /opt/car.lua → osrm-partition → osrm-customize (MLD)
  osrm-routed를 127.0.0.1의 임시 포트에 잠깐 띄워 접근점을 고르고(access.py, access-v1)
  /table 한 번 → 컨테이너 정지

걸어봄의 foot 그래프·개발 컨테이너(geoleobom-osrm-dev, 5000)와 파일·포트·이름을 공유하지 않는다.
"""

from __future__ import annotations

import contextlib
import json
import shutil
import time
import urllib.request
from collections.abc import Iterator
from typing import Any

from . import access, config, demand, import_step
from .util import docker, host_path, module_sha256, read_json, sha256_file, write_json

GRAPH_DIR = config.CACHE_DIR / "osrm_car"
BBOX_PBF = config.CACHE_DIR / "osm" / "gongju_bbox.osm.pbf"
HIGHWAYS_OPL = config.CACHE_DIR / "osm" / "highways.opl"


def osrm_image() -> tuple[str, dict[str, Any]]:
    v = read_json(config.OSRM_VERSIONS)["osrm"]
    return f"{v['image']}:{v['tag']}", v


def _check_image(ref: str, digest: str) -> None:
    out = docker("image", "inspect", ref, "--format", "{{index .RepoDigests 0}}", capture=True).strip()
    if not out.endswith(digest):
        raise SystemExit(f"OSRM 이미지 digest가 versions.json과 다르다: {out}")


GRAPH_STAMP = GRAPH_DIR / "graph.stamp.json"


def _graph_key(ref: str, digest: str) -> dict[str, str]:
    return {
        "input_sha256": sha256_file(BBOX_PBF),
        "image": ref,
        "digest": digest,
        "profile": config.OSRM_CAR_PROFILE,
    }


def _graph_is_current(key: dict[str, str]) -> bool:
    if not GRAPH_STAMP.exists() or not (GRAPH_DIR / "gongju_bbox.osrm.mldgr").exists():
        return False
    return read_json(GRAPH_STAMP) == key and sha256_file(GRAPH_DIR / BBOX_PBF.name) == key["input_sha256"]


def build_graph() -> None:
    """같은 입력·이미지·프로필로 이미 만든 그래프가 있으면 다시 만들지 않는다(graph.stamp.json)."""
    ref, v = osrm_image()
    _check_image(ref, v["digest"])
    key = _graph_key(ref, v["digest"])
    if _graph_is_current(key):
        print("  OSRM car 그래프: 같은 입력으로 만든 그래프가 있어 다시 만들지 않는다")
        return
    GRAPH_DIR.mkdir(parents=True, exist_ok=True)
    GRAPH_STAMP.unlink(missing_ok=True)
    shutil.copyfile(BBOX_PBF, GRAPH_DIR / BBOX_PBF.name)
    vol = f"{host_path(GRAPH_DIR)}:/work"
    docker(
        "run", "--rm", "-v", vol, ref, "osrm-extract", "-p", config.OSRM_CAR_PROFILE, f"/work/{BBOX_PBF.name}"
    )
    base = f"/work/{BBOX_PBF.name.replace('.osm.pbf', '.osrm')}"
    docker("run", "--rm", "-v", vol, ref, "osrm-partition", base)
    docker("run", "--rm", "-v", vol, ref, "osrm-customize", base)
    write_json(GRAPH_STAMP, key, pretty=True)


def build_way_index_source() -> None:
    """접근점 판정용: 같은 bbox 추출본의 highway way(태그·노드 목록)를 OPL로 내보낸다."""
    osm = BBOX_PBF.parent
    vol = f"{host_path(osm)}:/w"
    docker("run", "--rm", "-v", vol, config.OSMIUM_IMAGE, "tags-filter", f"/w/{BBOX_PBF.name}",
           "w/highway", "-R", "-o", "/w/highways.osm.pbf", "--overwrite")  # fmt: skip
    docker("run", "--rm", "-v", vol, config.OSMIUM_IMAGE, "cat", "/w/highways.osm.pbf",
           "-t", "way", "-f", "opl", "-o", "/w/highways.opl", "--overwrite")  # fmt: skip


def _meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """공주 위도에서 경위도 차 → m (짧은 거리 근사)."""
    dx = (lon1 - lon2) * 89_500
    dy = (lat1 - lat2) * 110_574
    return (dx * dx + dy * dy) ** 0.5


def _get(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)


@contextlib.contextmanager
def osrm_server() -> Iterator[str]:
    ref, _ = osrm_image()
    base = f"/work/{BBOX_PBF.name.replace('.osm.pbf', '.osrm')}"
    docker("rm", "-f", config.OSRM_BUILD_CONTAINER, capture=True)
    docker(
        "run", "-d", "--rm", "--name", config.OSRM_BUILD_CONTAINER,
        "-p", f"127.0.0.1:{config.OSRM_BUILD_PORT}:5000",
        "-v", f"{host_path(GRAPH_DIR)}:/work:ro", ref,
        "osrm-routed", "--algorithm", "mld", "--max-table-size", "1000",
        "--max-nearest-size", str(access.NEAREST_N), base,
        capture=True,
    )  # fmt: skip
    root = f"http://127.0.0.1:{config.OSRM_BUILD_PORT}"
    try:
        for _ in range(120):
            try:
                if _get(f"{root}/nearest/v1/driving/127.05,36.46").get("code") == "Ok":
                    break
            except OSError:
                time.sleep(0.5)
        else:
            raise SystemExit("OSRM car 서버가 뜨지 않았다")
        yield root
    finally:
        docker("stop", config.OSRM_BUILD_CONTAINER, capture=True)


def _table(
    root: str, pts: list[tuple[float, float]], ns: int, hints: list[str] | None, exclude: str = ""
) -> dict:
    coords = ";".join(f"{x:.7f},{y:.7f}" for x, y in pts)
    url = (
        f"{root}/table/v1/driving/{coords}"
        f"?sources={';'.join(map(str, range(ns)))}"
        f"&destinations={';'.join(map(str, range(ns, len(pts))))}"
        # duration만 받는다. MLD /table의 distance는 osrm-partition 결과(그래프를 만들 때마다 다르다)에 따라
        # 0.1 m씩 흔들리고 계산에 쓰지 않는다. duration(0.1초 정수 합)은 분할과 무관하게 같다.
        "&annotations=duration"
    )
    if hints:
        url += "&hints=" + ";".join(hints)
    if exclude:
        url += f"&exclude={exclude}"
    res = _get(url)
    if res.get("code") != "Ok":
        raise SystemExit(f"/table 실패: {res.get('code')} {res.get('message')}")
    return res


def select_access(root: str, pts: list[tuple[float, float]], ns: int) -> tuple[list[access.Candidate], dict]:
    """접근점 선택(access-v1). 반환: 점마다 고른 후보, 진단 기록."""
    cands: list[list[access.Candidate]] = []
    for lon, lat in pts:
        r = _get(f"{root}/nearest/v1/driving/{lon},{lat}?number={access.NEAREST_N}&exclude=motorway")
        cands.append(
            [
                access.Candidate(k, w["distance"], w["location"], w["nodes"], w["hint"])
                for k, w in enumerate(r["waypoints"])
            ]
        )
    # r1과 같은 기본 스냅(hint 없는 /table)도 기록한다: 무엇이 바뀌었는지 추적용.
    default = _table(root, pts, ns, None)
    default_wp = default["sources"] + default["destinations"]
    default_edges = [
        _get(f"{root}/nearest/v1/driving/{w['location'][0]},{w['location'][1]}?number=1")["waypoints"][0][
            "nodes"
        ]
        for w in default_wp
    ]
    wanted = {n for cs in cands for c in cs for n in c.nodes if n} | {
        n for e in default_edges for n in e if n
    }
    idx = access.index_ways(HIGHWAYS_OPL, wanted)
    for cs in cands:
        for c in cs:
            c.ways = access.resolve(c.nodes, idx)

    pos = [0] * len(pts)
    rejected: list[list[dict]] = [[] for _ in pts]

    def advance(i: int, why: str) -> None:
        c = cands[i][pos[i]]
        rejected[i].append(
            {"rank": c.rank, "dist_m": round(c.dist, 1), "why": why, **access.way_record(c.ways)}
        )
        pos[i] += 1
        if pos[i] >= len(cands[i]):
            raise SystemExit(f"점 {i}: 조건을 만족하는 접근점이 {access.NEAREST_N}개 후보 안에 없다")

    def connected(i: int, c: access.Candidate) -> str | None:
        """후보 한 점을 hint로 고정하고 반대편(수요점이면 지소 10곳, 지소면 수요점 161곳)에 닿는지 본다.
        hint는 만든 입력 좌표와 같은 좌표로 보내야 유효하다(OSRM이 입력 좌표를 hint와 대조한다)."""
        other = list(range(ns, len(pts))) if i < ns else list(range(ns))
        order = [i, *other]
        coords = [pts[k] for k in order]
        hints = [c.hint] + [""] * len(other)
        for exclude in ("", "motorway"):
            res = _table(root, coords, 1, hints, exclude) if i < ns else None
            if i >= ns:
                # 지소는 도착점: 수요점 전체 → 이 지소 한 곳
                coords2 = [pts[k] for k in other] + [pts[i]]
                res = _table(root, coords2, len(other), [""] * len(other) + [c.hint], exclude)
                vals = [row[0] for row in res["durations"]]
            else:
                vals = res["durations"][0]
            if exclude == "" and any(v is None for v in vals):
                return "도로망 본체와 떨어진 구간(지소·마을에 닿지 않음)"
            if exclude == "motorway" and all(v is None for v in vals):
                return "고속도로 없이 닿을 수 없음(고속도로로만 이어진 구간)"
        return None

    for i in range(len(pts)):
        failed_ways: set[str] = set()
        while True:
            c = cands[i][pos[i]]
            why = c.reject
            if why is None and c.ways and c.ways[0].id in failed_ways:
                why = "같은 way의 앞 후보가 도로망 본체와 떨어짐"
            if why is None:
                why = connected(i, c)
                if why and c.ways:
                    failed_ways.update(w.id for w in c.ways)
            if why is None:
                break
            advance(i, why)
    chosen = [cands[i][pos[i]] for i in range(len(pts))]
    diag = {
        "default": [
            {
                "lon": w["location"][0],
                "lat": w["location"][1],
                "dist_m": round(w["distance"], 1),
                **access.way_record(access.resolve(e, idx)),
            }
            for w, e in zip(default_wp, default_edges, strict=True)
        ],
        "rejected": rejected,
    }
    return chosen, diag


def run() -> dict[str, Any]:
    pop, _ = import_step.load()
    osm = read_json(config.DERIVED_DIR / "osm_features.json")
    villages = demand.match_villages(pop, osm)
    facilities = demand.resolve_facilities(osm)
    if sha256_file(BBOX_PBF) != osm["provenance"]["bbox_pbf_sha256"]:
        raise SystemExit("cache의 bbox 추출본이 osm_features.json과 다르다. osm 단계를 다시 돌려라.")

    build_graph()
    build_way_index_source()
    pts = [(v.lon, v.lat) for v in villages] + [(f.lon, f.lat) for f in facilities]
    ns = len(villages)
    with osrm_server() as root:
        chosen, diag = select_access(root, pts, ns)
        res = _table(root, pts, ns, [c.hint for c in chosen])
        # 확인용: 같은 접근점에서 고속도로를 빼고 잰 표. 정상 표가 더 짧은 칸 = 고속도로를 실제로 쓴 경로.
        nomw = _table(root, pts, ns, [c.hint for c in chosen], exclude="motorway")["durations"]
    wps = res["sources"] + res["destinations"]
    for c, w in zip(chosen, wps, strict=True):
        # OSRM 출력은 소수 6자리 반올림이라 1e-6°(약 0.1 m) 흔들린다. 0.5 m 안이면 같은 접근점이다.
        if _meters(*w["location"], *c.location) > 0.5:
            raise SystemExit(f"/table이 고른 접근점을 지키지 않았다: {c.location} → {w['location']}")
    dur = res["durations"]
    if any(d is None for row in dur for d in row):
        raise SystemExit("도달 불가 쌍이 있다(null duration)")
    ref, v = osrm_image()

    def point(obj_id: str, lon: float, lat: float, k: int) -> dict[str, Any]:
        c = chosen[k]
        dflt = diag["default"][k]
        return {
            "id": obj_id,
            "lon": lon,
            "lat": lat,
            "access": c.record(),
            "default_snap": dflt,
            "access_changed": _meters(dflt["lon"], dflt["lat"], *c.location) > 1.0,
            "rejected_candidates": diag["rejected"][k],
        }

    out = {
        "provenance": {
            "osrm_image": ref,
            "osrm_digest": v["digest"],
            "profile": f"stock {config.OSRM_CAR_PROFILE} (osrm-backend {v['tag']} 이미지 내장)",
            "algorithm": "MLD",
            "graph_input_sha256": sha256_file(GRAPH_DIR / BBOX_PBF.name),
            "way_index": "같은 bbox 추출본의 highway way(osmium tags-filter w/highway, cat -f opl)",
            "access_rule_version": access.ACCESS_RULE_VERSION,
            "access_rule": access.ACCESS_RULE,
            "call": (
                "GET /table/v1/driving sources=161 법정리 접근점 destinations=10 보건지소 접근점 "
                "hints=접근점 구간 annotations=duration (exclude 없음)"
            ),
            "conditions": "자유류(free-flow) 도로망 시간. 혼잡·신호 대기·주차·진료 대기 없음",
            "motorway_used_cells": sum(
                1
                for i in range(ns)
                for j in range(len(dur[0]))
                if nomw[i][j] is None or dur[i][j] < nomw[i][j] - 0.05
            ),
            "step_code_sha256": {
                "route_step": module_sha256(__file__),
                "access": module_sha256(access.__file__),
            },
        },
        "sources": [point(vi.id, vi.lon, vi.lat, k) for k, vi in enumerate(villages)],
        "destinations": [point(f.id, f.lon, f.lat, ns + k) for k, f in enumerate(facilities)],
        "durations_s": dur,
    }
    sha = write_json(config.DERIVED_DIR / "osrm_car_table.json", out)
    changed = sum(p["access_changed"] for p in out["sources"] + out["destinations"])
    print(f"route: {len(dur)}×{len(dur[0])} 행렬, 접근점 변경 {changed}곳 ({sha[:12]})")
    return out
