# 데이터 출처와 이용조건

이 문서는 저장소의 **데이터**에 적용되는 조건입니다.
코드·스크립트·문서에는 `LICENSE`(MIT)가 적용되고, 데이터에는 이 문서가 적용됩니다.

- 적용 대상: `pipeline/sources/`, `pipeline/derived/`, `pipeline/reports/`, `app/public/data/`
- 원칙:
  - 팀은 아래 원자료의 권리자가 아닙니다. 원자료 부분에는 원 기관의 이용조건이 그대로 이어집니다.
  - 팀은 원자료에 팀 명의 라이선스를 새로 붙이지 않습니다.
- 앱 안에서는 「자료와 한계」 화면(S8)이 같은 출처·기준일·이용조건을 보여 줍니다(값은 `app/public/data/manifest.json`의 `sources`).
- 조사 근거: 2026-09-25에 공주시 홈페이지·보건소·공공데이터포털·법령 원문을 조사한 기록이 있습니다(저장소 밖 문서).
- 이 문서는 법률 판단이 아닙니다.

## 1. 인구·65세 이상 인구 (기준일 2026-08-31)

| | |
|---|---|
| 출처 | 행정안전부, 「지역별(법정동) 성별 연령별 주민등록 인구수」, 「지역별(행정동) 성별 연령별 주민등록 인구수」(2026-08-31 기준), 공공데이터포털 https://www.data.go.kr/data/15099158/fileData.do , https://www.data.go.kr/data/15097972/fileData.do |
| 이용조건 | 이용허락범위 **제한 없음**(공공데이터포털 표시, 2026-09-25 확인). 원본 CSV를 `pipeline/sources/mois/`에 바이트 그대로 둡니다 |
| 범위 | 주민등록 인구(외국인 제외). 법정리 161곳 인구, 읍·면 10곳 총인구·65세 이상, 공주시 전체, 시내 행정동 6곳 총인구 |
| 계산에 읽은 파일 | 공주시 스마트정보과 「2026년 8월 인구현황」 xlsx(https://www.gongju.go.kr/bbs/BBSMSTR_000000000697/view.do?nttId=B000000336750Xz4qT4b). 공공누리 표시가 없고, 공주시 저작권정책상 사전 협의 대상입니다. 그래서 **파일은 저장소에 넣지 않습니다** |
| 대조 | 위 xlsx에서 계산한 값 350개(법정리 161, 읍·면 20, 시 전체 2, 시내 동 6, 앱 수요점 161)가 행정안전부 자료와 **모두 같습니다**. `python -m scl_pipeline check-mois`, 결과는 `pipeline/reports/mois_crosscheck.json`, CI의 `verify`가 매번 대조합니다 |

법정리별 65세 이상 인구는 읍·면 비율로 나눈 추정값이라 앱 데이터에 넣지 않습니다.

## 2. 보건지소 의과 순회진료 일정 (기준일 2026-04-13)

| | |
|---|---|
| 출처 | 공주시보건소 「진료안내」 — 공주시보건소 순회근무 현황(2026. 4. 13. 기준), 의과 표. https://www.gongju.go.kr/health/sub02_01.do |
| 이용조건 | **별도 확인 필요. 확정된 이용허락이 아닙니다.** 게시물에서 공공누리 유형 표시를 찾지 못했습니다. 공주시 저작권정책은 이런 자료를 사전 협의 대상으로 둡니다. 개별 이용조건·재배포 허용 여부는 별도로 확인하지 못했습니다(기관 문의·회신 없음) |
| 쓰는 값 | 보건지소 10곳의 요일별 운영 여부만 씁니다(○ = 주 1일, 격주 = 주 0.5일). 담당자 성명 등 개인정보는 없습니다. 페이지 발췌(HTML)는 저장소에 넣지 않습니다 |
| 안내 | 진료 운영 여부는 수시로 바뀝니다. **방문 전 해당 보건(지)소에 문의하세요.** 이 값은 기준일 시점을 재구성한 교육용 자료이며, 현재 운영 안내가 아닙니다 |
| 확인한 뒤 | 기관에서 확인한 내용을 이 절, `pipeline/sources/sources.json`의 `clinic_schedule.usage_status`, 앱 S8에 그대로 반영합니다(`docs/release/RELEASE_READINESS.md` 7절) |

이 일정 값이 들어 있는 파일은 다음과 같습니다.
- `pipeline/derived/source_facts.json`의 `schedule`
- `app/public/data/scenario.json`의 `current_allocation`, `facilities[].schedule_*`
- `app/public/data/manifest.json`의 `sources.schedule.rows`
- 현재 배분에서 계산한 `golden.json`·`landscape.json`의 해당 값

## 3. 보건지소 10곳 위치

| | |
|---|---|
| 좌표 | 건강보험심사평가원 「전국 병의원 및 약국 현황 2026.6」 병원정보서비스, 공공데이터포털 https://www.data.go.kr/data/15051059/fileData.do. **공공누리 제1유형(출처표시)**(데이터셋 페이지 표시, 2026-09-25 확인). 원본 zip은 저장소에 넣지 않습니다 |
| 보정 | 공식 주소와 HIRA 주소가 다른 유구·정안은 OpenStreetMap 객체 중심점을 씁니다(4절 조건) |
| 공식 주소 대조 | 공주시보건소 「보건기관안내」 https://www.gongju.go.kr/health/sub01_05.do (주소 사실 대조에만 사용) |

## 4. 도로망과 도로망 계산값 — OpenStreetMap, ODbL 1.0

- 출처: © OpenStreetMap contributors (Geofabrik 배포, 최신 객체 2026-09-10T14:58:34Z)
- 이용조건: Open Database License 1.0 (https://opendatacommons.org/licenses/odbl/1-0/)
- OSM에서 파생된 부분(아래 목록)만 ODbL 1.0을 따릅니다. 같은 파일 안의 인구·진료일정 값에는 1·2절 조건이 그대로 적용됩니다.
- OSM에서 파생된 데이터베이스는 ODbL 1.0을 따릅니다. 이용할 때 "© OpenStreetMap contributors" 표기가 필요하고, 파생 데이터베이스를 공개할 때도 같은 조건을 유지해야 합니다.
  - `pipeline/derived/osm_features.json`
  - `pipeline/derived/osrm_car_table.json`(161×10 접근시간·접근점)
  - `pipeline/derived/osrm_car_routes.json`(경로 형상)
  - `app/public/data/scenario.json`의 수요점 좌표·접근점·`matrix`
  - `app/public/data/geometry.json`의 도로·하천·수면·경로
  - `pipeline/reports/r1_to_r2.json`·`experiment_comparison.json`의 행렬 비교
- 접근시간은 OSRM(v5.27.1, stock car 프로필)으로 계산한 자유류 시간입니다. 혼잡·신호·대기는 포함하지 않습니다.

## 5. 읍·면 경계 — CC BY 4.0

- 출처: 통계청 통계지리정보서비스(SGIS) 행정동 경계(공공누리 제1유형), 가공 vuski/admdongkor `ver20260701`
- 이용조건: CC BY 4.0. 출처 표기 문구: "본 데이터는 통계청 통계지리정보서비스(SGIS)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor), CC BY 4.0(https://creativecommons.org/licenses/by/4.0/)으로 배포된다. Shrinking City Lab이 이를 투영·단순화하고 시내 동 6곳을 하나로 합쳤다."
- 변경: 이 저장소가 경계를 평면 좌표로 투영하고 단순화(0.03 km)했으며, 공주 시내 동 6곳을 하나로 합쳤습니다(`pipeline/scl_pipeline/boundaries_step.py`).
- 들어 있는 파일: `pipeline/derived/boundaries.json`, `app/public/data/geometry.json`의 경계

## 6. 지형 — 퍼블릭 도메인

- 출처: NASA/USGS SRTM 1 arc-second, Mapzen/Tilezen Terrain Tiles(AWS Open Data)
- 이용조건: SRTM은 미국 정부 저작물(퍼블릭 도메인)이며, 출처 표기 "Mapzen/Tilezen, SRTM(NASA)"를 유지합니다.
- 들어 있는 파일: `app/public/data/terrain.bin`, `pipeline/derived/terrain.json`. 시각 표현에만 쓰고 계산에는 쓰지 않습니다.

## 7. 팀이 계산한 값

KPI, 배분 지형도, 미션 목표치, 참고 배분, 골든 값(`golden.json`·`landscape.json`)은 위 자료로 만든 계산 결과입니다.

- 이 값들은 쓰인 원자료의 조건을 함께 따릅니다. 특히 4절의 OSM 파생 행렬과 2절의 일정 값이 해당합니다.
- 원 기관은 이 값의 정확성을 보증하지 않습니다.
- 교육용 단순화 모델의 결과이며, 실제 정책 권고나 행정 평가가 아닙니다.
- 게임 가정(진료일 단위, 주민 1인 주 5일 상한, 10·15·20분 기준, 추가 5일)은 팀이 정한 가정입니다. `manifest.json`의 `classification`에 `SIMULATION_ASSUMPTION`으로 표시되어 있습니다.

## 8. 저장소에 넣지 않는 원본

아래 원본은 저장소에 넣지 않습니다.
- 위치: 개발 PC의 `pipeline/cache/`(Git 밖)와 그 백업
- 식별: 공식 URL·기준일·sha256을 `pipeline/sources/sources.json`에 둡니다

| 원본 | 이유 |
|---|---|
| 공주시 인구현황 xlsx 2개 | 공공누리 표시 없음, 공주시 사전 협의 대상 |
| 보건소 진료안내 페이지 발췌(HTML) | 같은 이유. 이용조건 별도 확인 필요 |
| 충청권 OSM 추출본(`chungcheong.osm.pbf`)과 OSRM 그래프 | 크기(수백 MB). 추출 방법은 `sources.json`의 `osm_extract.extract`에 있습니다 |
| HIRA 병원정보서비스 zip | 크기. 공공데이터포털에서 받을 수 있습니다 |

## 출처 표기 문구 (앱 S8 「데이터 출처 표기」와 같은 내용)

- 인구: 행정안전부, 「지역별(법정동)·(행정동) 성별 연령별 주민등록 인구수」(2026-08-31 기준), 공공데이터포털 — 이용허락범위 제한 없음(공공데이터포털 표시)
- 진료일정: 공주시보건소 「진료안내」 순회근무 현황(2026-04-13 기준) — 이용조건 별도 확인 필요. 게시물에서 공공누리 유형 표시를 찾지 못했고, 공주시 저작권정책은 공공누리가 없는 자료를 사전 협의 대상으로 둔다. 개별 이용조건·재배포 허용 여부는 별도로 확인하지 못했다. 확정된 이용허락이 아니다
- 보건지소 위치: 건강보험심사평가원 「전국 병의원 및 약국 현황 2026.6」 병원정보서비스 — 공공누리 제1유형(출처표시) — 공공데이터포털 데이터셋 페이지 표시, 2026-09-25 확인
- 도로망: ODbL 1.0 (© OpenStreetMap contributors, https://www.openstreetmap.org/copyright)
- 경계: 본 데이터는 통계청 통계지리정보서비스(SGIS)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor), CC BY 4.0(https://creativecommons.org/licenses/by/4.0/)으로 배포된다. Shrinking City Lab이 이를 투영·단순화하고 시내 동 6곳을 하나로 합쳤다.
- 지형: SRTM은 미국 정부 저작물(퍼블릭 도메인). Terrain Tiles 출처 표기: Mapzen/Tilezen, SRTM(NASA).
