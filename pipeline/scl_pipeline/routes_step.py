"""도달 경로 형상: 도로망 20분 안의 (법정리, 보건지소) 쌍마다 OSRM car 최단경로 폴리라인 → derived/osrm_car_routes.json.

화면의 "관계 읽기"(설계안 6-6)를 직선·호가 아니라 **실제 도로망 경로**로 그리기 위한 자료다. 계산(행렬)에는
쓰지 않는다. route 단계와 같은 그래프·이미지·접근점을 쓰고, 출발·도착 좌표는 route 단계가 고른 접근점
(access-v1)이다. 20분 밖 쌍은 어느 기준(10·15·20)에서도 그리지 않으므로 뽑지 않는다.
"""

from __future__ import annotations

import json
import urllib.request
from typing import Any

from . import config
from .route_step import build_graph, osrm_image, osrm_server
from .util import module_sha256, project, read_json, write_json

# 그리는 최대 기준(설계안 4-3의 20분)
ROUTE_MAX_MIN = 20
# 폴리라인 단순화 허용 오차(km). 40 m: 무대 격자(120 m)보다 작고 파일은 1/3 이하로 준다.
SIMPLIFY_KM = 0.04


def _get(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=120) as r:
        return json.load(r)


def rdp(pts: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Ramer–Douglas–Peucker. 끝점은 항상 남긴다."""
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5
    best, bi = 0.0, 0
    for k in range(1, len(pts) - 1):
        px, py = pts[k]
        d = (
            abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
            if norm > 0
            else ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
        )
        if d > best:
            best, bi = d, k
    if best <= tol:
        return [pts[0], pts[-1]]
    return rdp(pts[: bi + 1], tol)[:-1] + rdp(pts[bi:], tol)


def run() -> dict[str, Any]:
    table = read_json(config.DERIVED_DIR / "osrm_car_table.json")
    srcs, dsts, dur = table["sources"], table["destinations"], table["durations_s"]
    pairs = [(i, j) for i in range(len(srcs)) for j in range(len(dsts)) if dur[i][j] <= ROUTE_MAX_MIN * 60]
    build_graph()
    out_routes: list[dict[str, Any]] = []
    mismatch: list[dict[str, Any]] = []
    with osrm_server() as root:
        for i, j in pairs:
            a, b = srcs[i]["access"], dsts[j]["access"]
            url = (
                f"{root}/route/v1/driving/{a['lon']:.7f},{a['lat']:.7f};{b['lon']:.7f},{b['lat']:.7f}"
                "?overview=full&geometries=geojson&steps=false&alternatives=false"
            )
            res = _get(url)
            if res.get("code") != "Ok" or not res.get("routes"):
                raise SystemExit(f"/route 실패 {srcs[i]['id']}→{dsts[j]['id']}: {res.get('code')}")
            route = res["routes"][0]
            # 접근점은 도로 위의 점이라 /route가 같은 구간에 붙는다. 그래도 표의 시간과 견주어 기록한다.
            if abs(route["duration"] - dur[i][j]) > max(3.0, 0.02 * dur[i][j]):
                mismatch.append(
                    {
                        "village": srcs[i]["id"],
                        "facility": dsts[j]["id"],
                        "table_s": dur[i][j],
                        "route_s": route["duration"],
                    }
                )
            km = [project(lon, lat) for lon, lat in route["geometry"]["coordinates"]]
            simp = rdp(km, SIMPLIFY_KM)
            out_routes.append(
                {
                    "i": i,
                    "j": j,
                    "village": srcs[i]["id"],
                    "facility": dsts[j]["id"],
                    "duration_s": round(route["duration"], 1),
                    "distance_m": round(route["distance"], 1),
                    "coords": [[round(x, 3), round(y, 3)] for x, y in simp],
                }
            )
    if len(mismatch) > len(pairs) * 0.02:
        raise SystemExit(f"/route 시간이 /table과 2% 넘게 다른 쌍이 {len(mismatch)}개다: {mismatch[:5]}")
    ref, v = osrm_image()
    out = {
        "provenance": {
            "osrm_image": ref,
            "osrm_digest": v["digest"],
            "graph_input_sha256": table["provenance"]["graph_input_sha256"],
            "access_rule_version": table["provenance"]["access_rule_version"],
            "call": (
                f"GET /route/v1/driving 접근점(법정리)→접근점(보건지소), 도로망 {ROUTE_MAX_MIN}분 안 쌍만, "
                "overview=full geometries=geojson (exclude 없음)"
            ),
            "purpose": "화면의 관계 읽기(설계안 6-6)에 실제 도로망 경로를 그리기 위한 형상. 계산에는 쓰지 않는다",
            "simplify": f"Ramer–Douglas–Peucker {SIMPLIFY_KM * 1000:.0f} m, 좌표는 km 소수 3자리(투영은 geometry.projection)",
            "pairs": len(pairs),
            "table_route_mismatch": mismatch,
            "step_code_sha256": module_sha256(__file__),
        },
        "threshold_min": ROUTE_MAX_MIN,
        "routes": out_routes,
    }
    sha = write_json(config.DERIVED_DIR / "osrm_car_routes.json", out)
    pts = sum(len(r["coords"]) for r in out_routes)
    print(f"routes: {len(out_routes)}개 경로, 점 {pts}개, 표와 다른 쌍 {len(mismatch)}개 ({sha[:12]})")
    return out
