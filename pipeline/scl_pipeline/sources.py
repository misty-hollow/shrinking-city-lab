"""원자료 목록(sources/sources.json) 읽기와 해시 확인."""

from __future__ import annotations

import urllib.request
from pathlib import Path
from typing import Any

from . import config
from .util import read_json, sha256_file

SOURCES_JSON = config.SOURCES_DIR / "sources.json"


def registry() -> dict[str, Any]:
    return read_json(SOURCES_JSON)


def _check(path: Path, expected: str, what: str) -> None:
    if not path.exists():
        raise SystemExit(f"{what}: 파일이 없다 ({path}). `python -m scl_pipeline fetch`를 먼저 실행해라.")
    actual = sha256_file(path)
    if actual != expected:
        raise SystemExit(f"{what}: sha256이 다르다\n  기대 {expected}\n  실제 {actual}\n  경로 {path}")


def require_local(key: str) -> tuple[Path, dict[str, Any]]:
    meta = registry()[key]
    path = config.PIPELINE_DIR / meta["local_path"]
    _check(path, meta["sha256"], key)
    return path, meta


def require_cached(key: str) -> tuple[Path, dict[str, Any]]:
    meta = registry()[key]
    path = config.PIPELINE_DIR / meta["cache_path"]
    _check(path, meta["sha256"], key)
    return path, meta


def require_dem_tiles() -> dict[str, Path]:
    tiles = registry()["dem_srtm"]["tiles"]
    out = {}
    for name, meta in tiles.items():
        path = config.PIPELINE_DIR / meta["cache_path"]
        _check(path, meta["sha256"], f"dem_srtm/{name}")
        out[name] = path
    return out


def require_osm_pbf() -> Path:
    """충청권 OSM 추출본(Git 밖). 위치는 config.OSM_PBF(SCL_OSM_PBF), 내용은 sources.json의 sha256으로 확인한다."""
    meta = registry()["osm_extract"]
    _check(config.OSM_PBF, meta["sha256"], "osm_extract")
    return config.OSM_PBF


def _download(url: str, dest: Path, expected: str) -> None:
    if dest.exists() and sha256_file(dest) == expected:
        print(f"  있음: {dest.name}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "scl-pipeline/0.1"})
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    actual = sha256_file(tmp)
    if actual != expected:
        tmp.unlink()
        raise SystemExit(
            f"{url}\n  sha256이 고정값과 다르다(원본이 바뀌었을 수 있다)\n  기대 {expected}\n  실제 {actual}"
        )
    tmp.replace(dest)
    print(f"  받음: {dest.name}")


def fetch() -> None:
    """Git 밖 원자료를 cache/에 받는다. 이미 같은 해시로 있으면 건너뛴다."""
    reg = registry()
    for key in ("population_tongban", "population_households_age"):
        m = reg[key]
        _download(m["download_url"], config.PIPELINE_DIR / m["cache_path"], m["sha256"])
    from .import_step import fetch_schedule_excerpt

    fetch_schedule_excerpt()
    b = reg["admin_boundaries"]
    _download(b["download_url"], config.PIPELINE_DIR / b["cache_path"], b["sha256"])
    for meta in reg["dem_srtm"]["tiles"].values():
        _download(meta["download_url"], config.PIPELINE_DIR / meta["cache_path"], meta["sha256"])
