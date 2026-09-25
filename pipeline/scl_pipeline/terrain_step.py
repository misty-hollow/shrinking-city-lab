"""SRTM 1″ DEM → 지형 높이 격자(app/public/data/terrain.bin) + derived/terrain.json.

시각 표현 전용이다(설계안 4-1 "지형 고도: 계산에 쓰지 않는다"). 원본 DEM은 cache/에만 둔다.
격자 한 칸 안의 SRTM 표본을 평균해(면적 평균) 계단 현상 없이 줄인다.
"""

from __future__ import annotations

import gzip
import math

import numpy as np
import shapely

from . import boundaries_step, config
from .sources import registry, require_dem_tiles
from .util import sha256_bytes, unproject, write_json

N = 3601  # SRTM 1″ 타일 한 변의 표본 수


def _mosaic(tiles: dict) -> tuple[np.ndarray, float, float]:
    """N36E126 + N36E127 → (배열, 서쪽 경도, 북쪽 위도). 행 0 = 북쪽."""
    west = np.frombuffer(gzip.open(tiles["N36E126"]).read(), ">i2").reshape(N, N)
    east = np.frombuffer(gzip.open(tiles["N36E127"]).read(), ">i2").reshape(N, N)
    arr = np.hstack([west[:, :-1], east]).astype(np.float64)
    if (arr == -32768).any():
        raise SystemExit("DEM에 빈 값이 있다(처리 규칙 없음)")
    return arr, 126.0, 37.0


def run() -> dict:
    tiles = require_dem_tiles()
    dem, lon_w, lat_n = _mosaic(tiles)
    step = 1.0 / 3600.0
    outer, _ = boundaries_step.load()
    minx, miny, maxx, maxy = outer.bounds
    m = config.TERRAIN_MARGIN_KM
    cell = config.TERRAIN_CELL_KM
    x0, y0 = math.floor((minx - m) / cell) * cell, math.floor((miny - m) / cell) * cell
    cols = int(math.ceil((maxx + m - x0) / cell)) + 1
    rows = int(math.ceil((maxy + m - y0) / cell)) + 1
    xs = x0 + np.arange(cols) * cell
    ys = y0 + np.arange(rows) * cell

    # 면적 평균: 적분 영상으로 격자점 둘레 한 칸 크기 창의 평균을 구한다.
    integ = np.zeros((dem.shape[0] + 1, dem.shape[1] + 1))
    integ[1:, 1:] = dem.cumsum(0).cumsum(1)
    half = cell / 2
    heights = np.zeros((rows, cols))
    for r, y in enumerate(ys):
        lon_a, lat_a = unproject(xs - half, np.full(cols, y - half))
        lon_b, lat_b = unproject(xs + half, np.full(cols, y + half))
        c0 = np.clip(np.floor((lon_a - lon_w) / step).astype(int), 0, dem.shape[1] - 1)
        c1 = np.clip(np.ceil((lon_b - lon_w) / step).astype(int), 1, dem.shape[1])
        r0 = int(np.clip(math.floor((lat_n - lat_b[0]) / step), 0, dem.shape[0] - 1))
        r1 = int(np.clip(math.ceil((lat_n - lat_a[0]) / step), 1, dem.shape[0]))
        s = integ[r1, c1] - integ[r0, c1] - integ[r1, c0] + integ[r0, c0]
        heights[r] = s / ((r1 - r0) * (c1 - c0))
    h16 = np.round(heights).astype("<i2")

    cx = (xs[:-1] + cell / 2)[None, :].repeat(rows - 1, 0)
    cy = (ys[:-1] + cell / 2)[:, None].repeat(cols - 1, 1)
    mask = shapely.contains_xy(outer, cx.ravel(), cy.ravel()).reshape(rows - 1, cols - 1).astype(np.uint8)

    blob = h16.tobytes() + mask.tobytes()
    config.APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    (config.APP_DATA_DIR / "terrain.bin").write_bytes(blob)
    inside = heights[:-1, :-1][mask.astype(bool)]
    reg = registry()["dem_srtm"]
    header = {
        "file": "terrain.bin",
        "sha256": sha256_bytes(blob),
        "cols": cols,
        "rows": rows,
        "cell_km": cell,
        "x0": round(x0, 3),
        "y0": round(y0, 3),
        "layout": "int16 LE 높이(m) rows×cols(행 0 = 남쪽 y0, 열 0 = 서쪽 x0) 뒤에 uint8 칸 마스크 (rows-1)×(cols-1). 1 = 공주시 경계 안",
        "heights_offset": 0,
        "mask_offset": rows * cols * 2,
        "elevation_m": {"min_inside": int(inside.min()), "max_inside": int(inside.max())},
        "cells_inside": int(mask.sum()),
        "provenance": {
            "source_key": "dem_srtm",
            "tiles": {k: v["sha256"] for k, v in reg["tiles"].items()},
            "method": f"SRTM 1″ 표본을 {cell} km 칸 창으로 면적 평균, 반올림(m)",
        },
    }
    write_json(config.DERIVED_DIR / "terrain.json", header)
    print(f"terrain: {cols}×{rows} 격자, 안쪽 칸 {header['cells_inside']}, 고도 {header['elevation_m']}")
    return header
