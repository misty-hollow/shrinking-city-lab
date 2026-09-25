# Shrinking City Lab — 진료일을 나누다 (공주 보건지소 편)

실제 공주시 자료를 단순화한 **교육용 공간 배분 시뮬레이션**. 보건지소 10곳에 주당 진료일(clinic-day)을
나누고, 자동차 도로망 접근시간 행렬로 어느 마을에 진료가 닿는지·누가 잃는지를 바로 본다.

- 제품 기준: `docs/설계안_v0.1.md` (구현 기준)
- 화면 UI 기준: `docs/UI_DESIGN_SYSTEM.md` (색·타이포·버튼·HUD·Sheet 등 보이는 모양)
- 독립 저장소다. 다른 저장소의 코드·빌드·배포에 기대지 않는다. 데이터 재생성(PC 전용)에 쓰는 OSRM·osmium 이미지
  고정값과 osmium 이미지 정의는 `pipeline/osrm/`에 있고, 충청권 OSM 추출본은 Git 밖 파일로 경로를 설정한다(아래).
- 런타임은 정적 파일뿐이다. 서버·OSRM·지도 타일·외부 API 호출이 없다.

## 구현 범위

| 화면 | 상태 |
|---|---|
| S0 시작(회전 무대·헤드라인·한계 한 줄·90초 무입력 복귀) | 구현 |
| S1 소개 3장 | 구현(1장 = 창 없는 집만·탑은 낮춤, 2장 = 진료등 탑이 솟는다, 3장 = 풀 칸) |
| S2 튜토리얼 3단계(기준 변경 필수, 의당 하루 옮기기, 실제 계산 문장) | 구현 |
| S3 브리핑 미션 1·2·3(실제 10일 + 가정 5일, 두 배지, 가정 설명, [건너뛰기]. 풀 연출은 미션 1만) | 구현 |
| S4 플레이(미션 깃발·풀·지소 도크(서→동)·KPI 6·읍면 서랍·지역 카드·점검 카드·소식 한 줄·증감·기준선) | 구현. 미션 2 깃발 = 읍·면 10곳 막대 + 목표선 + 격차, 미션 3 깃발 = 주민 진료 두께 막대 + 목표선. 땅에 새긴 읍·면 이름 아래 줄에 미션 값. `직전 확정 배분(미션 n)과 비교` |
| S5 디브리핑 미션 1·2·3(블록 1~8, 배분 지형도에 다른 미션 ●, 참고 배분 유령 탑, 미션 2·3은 앞 미션과 15일 대 15일 비교 + 무대 비교) | 구현 |
| S6 세 개의 공주(위에서 본 지도 3장·지소 탑 줄·세 목표 사실, 6지표·배분·읍면 표, 데이터 문장, 열 크게 보기 + 증감 기준 선택) | 구현. 건너뛴 미션은 참고 배분 + `참고 배분` 칩 |
| S8 자료와 한계(manifest에서 읽음) · <768 안내 화면 | 구현 |
| S7 실험실, 768~1023 하단 시트, [이 배분 저장] | **아직 없음** |

시각·상호작용·소리는 설계안 6-16 「불빛이 닿는 골짜기」(v0.4): 9월 해질녘의 섬 디오라마(어두운 액자, 흙 받침, 미리 구운
능선 그늘·골짜기 AO, 논·밭·숲·나무는 고도·경사로 만든 **풍경 표현이며 토지이용 자료가 아님** — `stage/world.ts`·`terrainBake.ts`),
마을 = 집 묶음(**집 한 채 ≈ 주민 50명**, 808채) + 빛 3단(창·빛 번짐), 보건지소 = 건물 + 진료등 탑(등칸 = 진료일),
관계 읽기·조작 = **실제 도로망 경로**(`geometry.routes`)를 합친 빛의 나무(같은 길은 한 줄, `stage/lightTree.ts`).
**계산은 조작 즉시**, 무대와 6개 지표의 **표시**는 같은 빛의 순서(`stage/lightPlan.ts`: 불씨 0.38초 → 도로망 1분 = 38 ms)를
따른다. 스크린리더 문장·판정·확정 가능 여부는 늦지 않는다. 움직임 줄이기 설정에서는 전부 즉시. 소리는 저녁 디오라마의
부드러운 합성음(칼림바·오르골·펠트 종·나무 말렛·얇은 패드의 질감, D장조 5음 음계, 수식으로 만든 방 울림 — 외부 음원 없음):
소리의 순서는 빛의 계획에서 나오고(`src/audio/cues.ts`, 마을 음은 조작당 많아야 4개), 목소리는 `voices.ts`, 예약·습관화·
거두기는 `sound.ts`. 첫 입력에서만 열리고 [소리] 버튼으로 끈다. 소리 없이도 모든 정보가 화면에 있다. 빛은 실제 의료진·차량의 이동이 아니라
도로망 접근성 변화의 시각적 은유다. 서비스권 원·버퍼는 여전히 그리지 않는다(설계안 6-6). 글꼴 Pretendard·Hahmlet(OFL-1.1)은
빌드에 들어가며 라이선스는 `app/public/licenses/`.

화면 배치와 조작은 설계안 6-17 「세계가 먼저」(v0.5): 상시 HUD는 세 덩이(왼쪽 위 목표·6개 지표, 아래 가운데 손, 오른쪽
위 둥근 도구)뿐이고 배경판이 없다. 지소는 세계 속 말풍선(`src/ui/Markers.tsx`) — 누르면 손의 진료일이 날아가 앉고, − 손잡이로
하루를 가져온다. 놓기 전에는 바뀔 마을의 집 테두리와 실제 계산 숫자가 미리 보인다(`src/ui/preview.ts`, 놓은 뒤 결과와 같다).
되돌리기(↶·Ctrl+Z), 위에서 보기는 같은 원근 세계를 높이 올린 것, 결산·세 개의 공주도 같은 세계 위에서 읽는다.

미션 결과는 세션 안에서 미션마다 따로 보관한다(`src/state/results.ts`: 배분 10곳 · 15분 기준 KPI·읍면·마을 결과 · 판정).
다시 배분하면 그 미션 칸만 바뀐다. 디브리핑·S6의 숫자는 확정한 15분 결과라 기준 스위치를 잠근다.

## 구조

```
(저장소 루트)
  docs/                     설계안_v0.1.md(제품 기준) · UI_DESIGN_SYSTEM.md(화면 UI 기준)
  pipeline/                 Python 3.12 전처리(PC 전용)
    osrm/                   OSRM·osmium 이미지 고정값(versions.json) + osmium 이미지 정의(Dockerfile.osmium)
    sources/                원자료(작은 공식 파일·발췌·큐레이션) + sources.json(URL·기준일·sha256·라이선스)
    derived/                무거운 단계(OSM·OSRM·경계·지형)의 결과. 저장소에 둔다
    cache/                  큰 원본·중간 파일(OSM 추출·OSRM car 그래프·DEM·경계 원본). Git 밖
    reports/                2026-09 반증 실험과의 1회 대조 기록
    data.lock.json          파생·앱 데이터 sha256
    scl_pipeline/           단계별 모듈(아래 명령)
  app/                      React 18 + TypeScript + Vite + three.js 정적 앱
    public/data/            앱이 읽는 정적 데이터(파이프라인 출력) + manifest.json(provenance)
    src/engine/             KPI 엔진(순수 함수, 파이썬 model.py와 같은 정의)
    src/stage/              3D 디오라마 무대(세계 생성·지형 굽기·집·지소·길의 빛·라벨)
    src/audio/              합성 효과음(소리의 순서 cues · 목소리 voices · 방 울림 room · 엔진 sound)
    src/content/copy.ts     화면 문구(금지어 검사 대상)
    scripts/browser-qa.mjs  실제 브라우저로 한 판 끝까지 도는 QA
    scripts/sound-audition.mjs  모든 소리를 실제 빛의 계획으로 렌더링한 청취 파일(qa-shots/sound/)
```

## 실행

```
cd app
npm ci
npm run dev                 # http://localhost:5173  (?kiosk=0 이면 90초 복귀를 끈다)
npm run build && npm run preview   # 정적 빌드 확인(dist/, 상대 경로라 어느 하위 경로에 올려도 된다)
```

## 검사

```
# 파이프라인: 린트 + 데이터·계산 회귀검사 + 앱 데이터 재현(바이트 대조) + 잠금 대조
cd pipeline
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -e ".[dev]"
.venv/Scripts/python.exe -m ruff check . ; .venv/Scripts/python.exe -m ruff format --check .
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m scl_pipeline verify

# 앱: 타입검사·빌드 + 엔진=골든 값(10·15·20분) + 미션 경계 판정 + 금지어 + 흐름·결과 보관 + 패널 키보드 플레이 + S6
cd app
npm run build && npm test

# 브라우저 QA(사람 보조, CI 밖). vite(dev 5199 또는 preview)를 띄운 뒤
npm i --no-save playwright-core@1.63.0
npm run qa:browser          # QA_BASE_URL, QA_BROWSER_CHANNEL(기본 msedge). 결과 qa-shots/

# 소리 청취(사람이 듣고 판단, CI 밖). dev 서버(5199)를 띄운 뒤
node scripts/sound-audition.mjs   # qa-shots/sound/index.html — 장면 17개 WAV(음량 정규화 없음)
```

CI는 `.github/workflows/ci.yml`의 `shrinking-city-lab` job이 위 파이프라인·앱 검사를 돈다(네트워크·docker 없음).

## 데이터 재생성 (판본 `scl01-gongju-r2`)

```
cd pipeline
.venv/Scripts/python.exe -m scl_pipeline all
#  fetch      공주시 인구 xlsx 2개·보건소 순회근무 표(발췌 대조), 행정동 경계, SRTM DEM → cache/ (sha256 고정)
#  import     공주시 원자료 → derived/source_facts.json (계산에 쓰는 값만. 원본 파일은 저장소에 두지 않는다)
#  boundaries 읍·면 10 + 시내 경계 → derived/boundaries.json
#  osm        docker osmium: 충청권 추출본에서 반증 실험과 같은 bbox(126.55,36.15,127.55,36.85)
#             → place 점·도로·하천·지소 보정 객체 → derived/osm_features.json
#  route      docker OSRM v5.27.1 stock car.lua(MLD)를 127.0.0.1:5071에 잠깐 띄워 접근점(access-v1)을 고르고
#             /table 161×10 → derived/osrm_car_table.json
#             같은 입력으로 만든 그래프가 있으면(cache/osrm_car/graph.stamp.json) 다시 만들지 않는다
#  routes     같은 OSRM car 그래프·접근점으로 도로망 20분 안 쌍(469개)의 최단경로 폴리라인 → derived/osrm_car_routes.json
#             (화면의 관계 읽기에 실제 도로 경로를 그리기 위한 형상. 계산은 여전히 행렬)
#  terrain    DEM → app/public/data/terrain.bin
#  build      앱 JSON + manifest + 골든 값(현재·참고 배분 3·임의 5·미션 경계 6) + 전수 계산(B=10·15 × T=10·15·20) → data.lock.json
#  verify     불변식(접근점 포함) + 재현 + 잠금
```

필요한 것(osm·route·routes 단계만):

| 무엇 | 설정 |
|---|---|
| Docker Desktop(엔진은 WSL2) | — |
| 충청권 OSM 추출본 `chungcheong.osm.pbf` (sha256 `fe454e43…`, 2026-09-11 Geofabrik south-korea-latest에서 충청권 경계로 자른 것, Git 밖) | 기본 위치 `pipeline/cache/osm/chungcheong.osm.pbf`. 다른 곳이면 `SCL_OSM_PBF=<경로>`. 해시가 다르면 멈춘다 |
| osmium 이미지 | `docker build -t scl-osmium:local -f pipeline/osrm/Dockerfile.osmium pipeline/osrm` (이름을 바꾸면 `SCL_OSMIUM_IMAGE`) |
| OSRM 이미지 | `pipeline/osrm/versions.json`의 `ghcr.io/project-osrm/osrm-backend:v5.27.1`(digest 대조) |

인터넷은 fetch 단계만 쓴다. 저장소의 `derived/`만으로 `build`·`verify`는 언제든 다시 된다(CI가 이것을 돈다).

재현 규칙: 원본부터 `all`을 다시 돌리면 추적 파일이 바이트 단위로 같아야 한다. 그래서 산출물에는 결정적인 값만 둔다.
OSRM 그래프 파일 자체는 만들 때마다 다르다(`osrm-partition`이 비결정적). 그래도 `/table` duration, `/nearest` 접근점,
`/route` 형상은 같게 나온다. `/table` distance는 0.1 m씩 흔들리고 계산에 쓰지 않아 받지 않는다. 산출물에는 로컬 이미지
이름·절대경로·시각을 넣지 않는다. 각 파생 파일의 `provenance.step_code_sha256`은 그 단계 코드의 해시이고, `verify`가
지금 코드와 대조한다. 단계 코드를 고쳤으면 그 단계를 다시 돌려야 한다.

### 도로망 접근점 규칙 access-v1 (r2)

수요점은 마을의 대표 위치이지 차량 GPS가 아니다. r1(= 2026-09 반증 실험)은 OSRM 기본 스냅을 그대로 써서
고속도로 본선·램프 7곳, 전용구간 표시(`expressway=yes`)·터널 구간 2곳, 보건지소 1곳이 그 위에서 출발·도착했다.
r2는 **접근점 고르기**(`/nearest?exclude=motorway` 후보 중 `motorroad/expressway=yes`·터널이 아니고, 도로망
본체에 이어지고, 고속도로 없이도 지소에 닿는 가장 가까운 구간)와 **경로 계산**(그 구간을 hint로 고정한
`/table`, exclude 없음 → 고속도로 이용 가능)을 나눈다. 대표점 좌표는 그대로다. 규칙은 `scl_pipeline/access.py`,
점마다 원본 좌표·기본 스냅·접근점·OSM way·highway·거절된 후보는 `derived/osrm_car_table.json`,
요약은 `manifest.access_points`, r1과의 차이는 `pipeline/reports/r1_to_r2.json`.

## 데이터 의미와 출처 (자세한 값은 `app/public/data/manifest.json`)

| 항목 | 분류 | 출처·기준일 |
|---|---|---|
| 법정리 161곳 인구(통·반 합산) | 실제 자료 | 공주시 2026년 8월 인구현황 xlsx, 2026-08-31 |
| 읍·면 65세 이상 | 실제 자료 | 같은 자료(리 단위 추정치는 앱 데이터에 넣지 않는다) |
| 보건지소 10곳 | 실제 자료 | HIRA 2026.6 좌표, 공식 주소와 다른 유구·정안은 OSM 객체 |
| 현재 진료일(합 주 10일) | 실제 자료 | 공주시보건소 순회근무 현황 2026-04-13, ○=1일·격주=0.5일 |
| 도로망 | 실제 자료 | OSM(최신 객체 2026-09-10T14:58:34Z) |
| 161×10 도로망 접근시간 | 계산값 | OSRM car, 접근점 access-v1, 혼잡·대기 없음. 초 → 0.1분 **올림** 정수 |
| 수요점 | 계산값 | 법정리 이름과 같은 OSM 마을 점 중 읍·면 중심에 가장 가까운 것 |
| 읍·면 경계 | 실제 자료 | 통계청 SGIS(공공누리 1유형) 가공 admdongkor(CC BY 4.0), 2026-07-01 |
| 지형 | 실제 자료 | SRTM 1″(퍼블릭 도메인), 시각 표현 전용 |
| 목표치·참고 배분·배분 지형도 | 계산값 | B=15·T=15 전수 831,204개에서 규칙으로 산출(손으로 정하지 않는다) |
| 진료일 단위·5일 상한·10/15/20 기준·추가 5일 | 게임 가정 | 설계안 4-1 |

### 공주시 원자료의 재배포

공주시 저작권정책(https://www.gongju.go.kr/kr/sitemap_04.do, 2026-09-24 확인)은 공공누리 마크가 붙은 저작물만
별도 허락 없이 자유이용할 수 있다고 하고, 마크가 없는 자료는 "공공저작물 실무담당자와 사전에 협의"하라고 한다.
인구현황 게시물·첨부 xlsx·진료안내 페이지에는 공공누리 마크가 없다. 그래서 **원본 xlsx와 페이지 발췌는
저장소에 넣지 않고** 공식 URL·기준일·sha256·재현 단계(fetch → import)만 둔다(`pipeline/sources/sources.json`의
`redistribution`). 계산에 쓰는 값(법정리 인구 등)은 `derived/source_facts.json`과 앱 데이터에 들어간다 — 이 값의
공개 배포에 대한 공주시 입장은 **확인하지 않았다.**

## 반증 실험과의 대조

- r1(`pipeline/reports/experiment_comparison.json`): 원자료에서 다시 만든 결과가 2026-09 실험 산출물과 **같다**
  (수요점 161/161, 지소 10/10, 행렬 차이 0.0초, 현재 배분 KPI, B=15·15분 우열 없는 배분 6개와 구성).
- r2(`pipeline/reports/r1_to_r2.json`): 접근점 규칙으로 **의도적으로 달라졌다.** 계산 의미는 브라우저·파이썬 검사가
  r1 행렬에서 실험 값을 다시 재현하는 것으로 계속 확인한다.

## 알려진 데이터 한계 (`manifest.known_issues`)

- 정안 상룡리: OSM 마을 점에서 가장 가까운 일반 도로가 910 m(고속도로 건너편). 마을 점 위치나 OSM 도로 수록의 한계일 수 있다.
- 유구 신영리·의당 가산리·정안 북계리: 가장 가까운 일반 도로가 OSM에서 도로망 본체와 이어지지 않은 조각이라 다음으로
  가까운 이어진 도로에서 출발한다(가산리·북계리는 r1에서도 OSRM이 같은 이유로 다른 도로로 넘어갔다. 신영리는 r1에서
  고속도로에 붙었고, 고속도로가 아닌 가장 가까운 도로들이 이 조각이었다).
- 전시 기기(통합 GPU)에서 60fps·첫 상호작용 5초는 아직 재지 않았다. 개발 PC(AMD RX 9070, Edge)에서 1080p 한 장면 GPU 약 0.6~0.8 ms,
  35~40 드로우·약 50만 삼각형, 무대 준비 약 0.65초. 느린 GPU에서는 적응 화질(픽셀 비율 → 나무 절반)이 먼저 내려간다.
