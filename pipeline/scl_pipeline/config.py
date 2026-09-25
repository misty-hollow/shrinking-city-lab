"""고정 설정. 값의 근거는 설계안(docs/설계안_v0.1.md) 절 번호로 적는다.

여기 있는 값이 바뀌면 산출물이 바뀐다. 바꿀 때는 DATA_VERSION을 올린다.
경로는 모두 이 저장소 안에서 정해진다. 저장소 밖 파일(OSM 추출본)은 환경변수로만 가리킨다.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final

PIPELINE_DIR: Final = Path(__file__).resolve().parents[1]
# 저장소 루트(app/ · pipeline/ · docs/). 산출물의 상대 경로는 여기를 기준으로 쓴다.
PRODUCT_DIR: Final = PIPELINE_DIR.parent

SOURCES_DIR: Final = PIPELINE_DIR / "sources"
DERIVED_DIR: Final = PIPELINE_DIR / "derived"
REPORTS_DIR: Final = PIPELINE_DIR / "reports"
# 큰 원본·중간 파일(OSM 추출본, OSRM 그래프, DEM 타일, 경계 원본). .gitignore 대상.
CACHE_DIR: Final = PIPELINE_DIR / "cache"
APP_DATA_DIR: Final = PRODUCT_DIR / "app" / "public" / "data"
LOCK_PATH: Final = PIPELINE_DIR / "data.lock.json"

# 데이터 판본. 입력·규칙이 바뀌면 올린다. 생성 시각 대신 이 값과 해시로 재현성을 말한다
# (같은 입력이면 같은 바이트가 나와야 하므로 산출물에 실행 시각을 넣지 않는다).
DATA_VERSION: Final = "scl01-gongju-r2"
DATA_VERSION_DATE: Final = "2026-09-24"
PIPELINE_VERSION: Final = "0.1.0"

# 읍·면 10곳. 순서가 곧 앱의 읍·면 순서다(설계안 4-1).
EMDS: Final[tuple[tuple[str, str], ...]] = (
    ("yugu", "유구읍"),
    ("iin", "이인면"),
    ("tancheon", "탄천면"),
    ("gyeryong", "계룡면"),
    ("banpo", "반포면"),
    ("uidang", "의당면"),
    ("jeongan", "정안면"),
    ("useong", "우성면"),
    ("sagok", "사곡면"),
    ("sinpung", "신풍면"),
)
EMD_NAMES: Final = tuple(name for _, name in EMDS)
# 시내(동 지역). 이번 시나리오 범위 밖이다(설계안 4-1 마지막 행, 6-3).
DONGS: Final = ("중학동", "웅진동", "금학동", "옥룡동", "신관동", "월송동")

# 보건지소 10곳 = 읍·면당 1곳. 열 순서 = 읍·면 순서 = 배분 벡터 순서.
FACILITY_IDS: Final = tuple(slug for slug, _ in EMDS)

# --- OSM · OSRM (설계안 4-1 도로망, 10-2-2 routing profile) ----------------------------
# 2026-09 반증 실험과 같은 추출 범위. 공주시 경계 + 도로 우회 여유.
OSM_BBOX: Final = (126.55, 36.15, 127.55, 36.85)
# 입력 pbf 해시는 sources/sources.json의 osm_extract에 있다. 파일은 Git 밖이다: 기본 위치는
# cache/osm/chungcheong.osm.pbf, 다른 곳에 두었으면 SCL_OSM_PBF로 가리킨다(해시가 같아야 한다).
OSM_PBF: Final = Path(os.environ.get("SCL_OSM_PBF") or PIPELINE_DIR / "cache" / "osm" / "chungcheong.osm.pbf")
# OSRM·osmium 기준 이미지 고정값과 osmium 이미지 정의(이 저장소 소유). 이미지 이름은 SCL_OSMIUM_IMAGE로 바꿀 수 있다.
OSRM_DIR: Final = PIPELINE_DIR / "osrm"
OSRM_VERSIONS: Final = OSRM_DIR / "versions.json"
OSMIUM_DOCKERFILE: Final = OSRM_DIR / "Dockerfile.osmium"
OSMIUM_IMAGE: Final = os.environ.get("SCL_OSMIUM_IMAGE") or "scl-osmium:local"
OSRM_CAR_PROFILE: Final = "/opt/car.lua"
# 걸어봄 개발 foot OSRM(5000)과 겹치지 않는 포트. 행렬을 뽑는 동안만 뜬다.
OSRM_BUILD_PORT: Final = 5071
OSRM_BUILD_CONTAINER: Final = "scl-osrm-car-build"

# 도로 표시(설계안 6-3 "국도·지방도만"). OSM 한국 관례에서 국도·지방도에 쓰는 등급.
ROAD_CLASSES: Final = ("motorway", "trunk", "primary", "secondary")

# --- 수요점 매칭 (반증 실험 build_demand.py와 같은 규칙) ------------------------------
# 법정리 이름과 같은 OSM place=village/hamlet 점 중 읍·면 중심(place=town) 점에 가장
# 가까운 것. 경위도 차의 유클리드 거리(도) 기준.
VILLAGE_MAX_DEG: Final = 0.12
VILLAGE_AMBIGUOUS_DEG: Final = 0.15

# --- 모델 (설계안 4-2, 4-3, 4-5) -----------------------------------------------------
MAX_DAYS_PER_FACILITY: Final = 5
RESIDENT_CAP_DAYS: Final = 5
THRESHOLDS_MIN: Final = (10, 15, 20)
MISSION_THRESHOLD_MIN: Final = 15
CURRENT_TOTAL_DAYS: Final = 10.0
ADDED_ASSUMPTION_DAYS: Final = 5
MISSION_BUDGET: Final = 15
# 배분 지형도(설계안 4-8, 10-2-3: (B, T) 6조합).
LANDSCAPE_BUDGETS: Final = (10, 15)
# 목표치 = 상위 10% 경계값(설계안 7-7).
MISSION_TOP_SHARE: Final = 0.10
# 반증 실험의 "체감 격자"(variants.py AX). "우열 없는 배분 약 6개"가 이 정의에서 나왔다.
COARSE_GRID: Final = {"mean_days": 0.5, "worst_emd_days": 0.5, "cov3_pct": 5.0}
LANDSCAPE_GRID_STEP: Final = 0.05

# --- 지도 투영 ------------------------------------------------------------------------
# 공주시 가운데를 원점으로 한 등장방형 근사(km). 50 km 범위에서 왜곡은 0.1% 미만이다.
PROJ_LON0: Final = 127.05
PROJ_LAT0: Final = 36.46
KM_PER_DEG_LAT: Final = 110.574
KM_PER_DEG_LON_EQUATOR: Final = 111.320

# --- 지형 -----------------------------------------------------------------------------
# 원자료 URL·해시는 sources/sources.json의 admin_boundaries, dem_srtm에 있다.
# 지형 격자 간격(km). 삼각형 예산 20만 이하(설계안 6-3).
TERRAIN_CELL_KM: Final = 0.12
TERRAIN_MARGIN_KM: Final = 1.5
