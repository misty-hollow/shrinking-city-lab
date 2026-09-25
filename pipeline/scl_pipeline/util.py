"""공통 도구: 해시, 결정론적 JSON, 투영, docker 호출."""

from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from . import config


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def dumps(obj: Any) -> str:
    """같은 값이면 같은 바이트. 키 순서는 코드가 정한 삽입 순서를 따른다."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"


def write_json(path: Path, obj: Any, *, pretty: bool = False) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    if pretty:
        text = json.dumps(obj, ensure_ascii=False, indent=1, allow_nan=False) + "\n"
    else:
        text = dumps(obj)
    data = text.encode("utf-8")
    path.write_bytes(data)
    return sha256_bytes(data)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def rel(path: Path) -> str:
    """저장소 기준 상대 경로(POSIX). 산출물에 개인 절대경로를 남기지 않는다."""
    try:
        return path.resolve().relative_to(config.PRODUCT_DIR).as_posix()
    except ValueError:
        return path.name


def module_sha256(module_file: str) -> str:
    """한 단계 모듈의 코드 식별자(파생 파일이 어떤 코드로 만들어졌는지)."""
    return sha256_bytes(Path(module_file).read_bytes().replace(b"\r\n", b"\n"))


def code_sha256() -> str:
    """생성 코드 식별자. 커밋 전에도 같은 코드인지 가릴 수 있게 파일 내용으로 만든다."""
    h = hashlib.sha256()
    root = Path(__file__).resolve().parent
    for p in sorted(root.glob("*.py")):
        h.update(p.name.encode())
        h.update(p.read_bytes().replace(b"\r\n", b"\n"))
    return h.hexdigest()


# --- 투영 ---------------------------------------------------------------------------

_COS0 = math.cos(math.radians(config.PROJ_LAT0))


def project(lon: float, lat: float) -> tuple[float, float]:
    """경위도 → 공주 중심 기준 km (x 동쪽, y 북쪽)."""
    x = (lon - config.PROJ_LON0) * config.KM_PER_DEG_LON_EQUATOR * _COS0
    y = (lat - config.PROJ_LAT0) * config.KM_PER_DEG_LAT
    return x, y


def unproject(x: float, y: float) -> tuple[float, float]:
    lon = config.PROJ_LON0 + x / (config.KM_PER_DEG_LON_EQUATOR * _COS0)
    lat = config.PROJ_LAT0 + y / config.KM_PER_DEG_LAT
    return lon, lat


def projection_record() -> dict[str, Any]:
    return {
        "kind": "equirectangular_local_km",
        "lon0": config.PROJ_LON0,
        "lat0": config.PROJ_LAT0,
        "km_per_deg_lat": config.KM_PER_DEG_LAT,
        "km_per_deg_lon": round(config.KM_PER_DEG_LON_EQUATOR * _COS0, 6),
        "axes": "x=동쪽 km, y=북쪽 km",
    }


# --- docker -------------------------------------------------------------------------


def docker_exe() -> str:
    # Windows의 Docker Desktop bin에는 확장자 없는 셸 스크립트 docker도 있어 실행 파일(.exe)을 먼저 찾는다.
    found = shutil.which("docker.exe") if os.name == "nt" else shutil.which("docker")
    if found:
        return found
    fallback = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs/DockerDesktop/resources/bin/docker.exe"
    if fallback.exists():
        return str(fallback)
    raise SystemExit("docker를 찾지 못했다. Docker Desktop을 실행하고 PATH를 확인해라.")


def host_path(path: Path) -> str:
    """docker -v에 넘길 호스트 경로. Windows에서도 C:/... 형태로 준다."""
    return path.resolve().as_posix()


def docker(*args: str, capture: bool = False) -> str:
    exe = docker_exe()
    env = dict(os.environ)
    # Git Bash에서 파이썬을 띄워도 컨테이너 안 경로(/work)가 바뀌지 않게 한다.
    env["MSYS_NO_PATHCONV"] = "1"
    env["PATH"] = str(Path(exe).parent) + os.pathsep + env.get("PATH", "")
    res = subprocess.run(
        [exe, *args],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if res.returncode != 0:
        raise SystemExit(f"docker {' '.join(args[:3])} 실패 ({res.returncode}):\n{res.stderr[-3000:]}")
    return res.stdout if capture else ""
