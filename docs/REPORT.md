작업: 후속 2 — CLAUDE.md B절 「실행 검증 ① 객관 검사」의 수단 없음(HUD 겹침·판 안 잘림)을 구현된 DOM 기하 검사에 맞게 갱신
결과: 완료
다음 할 일: 사용자 — 병합 여부("PR #19 병합해"). PR #18을 먼저 병합하면 소식↔말풍선 검사가 생겨 B절을 다시 갱신해야 한다(고위험, 재리뷰) — 아래 미해결

## 위험도: 고, `CLAUDE.md` B절(C절 고위험 파일 목록 「이 파일의 B·C·E·F·H절」). 검증 수단 기술이 바뀐다. 독립 리뷰 전 병합 금지

## 영향: 화면·입력·상태 영향 없음(문서만). 앱·하네스·CI·설정 파일 변경 0

## 핵심 변경

- B절 표 「실행 검증 ① 객관 검사」 비고:
  - 전: 「… **수단 없음**: HUD와 3D 말풍선 겹침, 판 안 가로 잘림, 기준 스크린샷 비교」
  - 후: 구현된 검사를 적는다 — DOM 기하(`scripts/qa-geometry.mjs`): HUD 판(`data-occlude`)과 세계 라벨(말풍선 머리·미리보기·결과 판·잃은 마을 표지·마을 이름·시간 태그) 겹침, 기준 변경 소식과 HUD 판의 겹침·화면 좌우 끝, 화면 끝에 걸린 세계 라벨, 전체 시점에서 흐린 말풍선 0, 판 안 가로 잘림. 하네스 본문(`scripts/browser-qa.mjs`): 가까이 보기에서 흐린 말풍선 포커스 복귀. 소식 검사는 그 순간 떠 있는 소식만 잰다. **수단 없음**: 기준 스크린샷 비교, 기준 변경 소식과 세계 라벨(말풍선 머리·결과 판 등)의 겹침, 지형에 새긴 읍·면 이름(캔버스)·3D 깃발·탑과 HUD의 겹침(DOM 밖)
  - 독립 리뷰 지적 반영(`090d547`): 처음 문구 「기준 변경 소식의 겹침」이 소식↔말풍선까지 검사하는 것처럼 읽혔다. main의 `qa-geometry.mjs`는 소식을 HUD 판·화면 좌우 끝과만 비교한다 → 「소식과 HUD 판의 겹침·화면 좌우 끝」으로 한정하고 「소식과 세계 라벨의 겹침」을 수단 없음에 넣음
- B절 「수단 확보 계획」에서 끝난 항목(HUD 겹침·판 안 잘림 검사 추가, PR #15 `c094d33`) 한 줄 삭제. 나머지 셋(기준 스크린샷·playwright 고정·CI에서 ①)과 머리 문장 그대로
- 바꾸지 않음: B절의 다른 행(필요 조건·명령·②·시간 축·성능), QA 실행 절차, 디버그 핸들 범위, 대표 경로, 예산, 영향 파일, A·C~I절

## 근거 대조 (main `ac4fe8e` 기준)

| B절 문구 | 코드 |
|---|---|
| HUD 판과 세계 라벨 겹침(말풍선 머리·미리보기·결과 판·표지·마을 이름·시간 태그) | `qa-geometry.mjs` worldSel = `.mk-head`·`.mk-preview`·`.marker-pop`·`.vpin > span`·`.stage-labels .stage-label`(마을 이름 `village-label`, 시간 `time-label`) ↔ `[data-occlude]` |
| 기준 변경 소식과 HUD 판의 겹침·화면 좌우 끝 | 같은 파일 toasts: `.toasts .toast` ↔ `[data-occlude]`, `r.left < 0`·`r.right > vw`(위아래 끝은 보지 않음) |
| 수단 없음: 소식과 세계 라벨의 겹침 | main에는 소식↔말풍선 비교가 없다(1440 S4 M2 소식이 정안 말풍선을 덮는 일이 PR #15 ②에서 사람 눈으로만 잡혔다). PR #18의 새 검사는 미병합이라 이 브랜치의 근거가 아니다 |
| 화면 끝에 걸린 세계 라벨 / 전체 시점에서 흐린 말풍선 0 / 판 안 가로 잘림 | 같은 파일 edges·occluded(`overview`)·clips |
| 포커스 복귀 | `browser-qa.mjs` 「HUD 뒤에 흐려 둔 말풍선(j=…)에 포커스하면 다시 보인다」 |
| 소식은 떠 있는 것만 | `seen()`이 불투명도·visibility로 거른다. 하네스는 S4 기준 변경 직후(PR #18은 소식이 떠 있는지도 검사) |
| 수단 없음: 캔버스 지명·3D 깃발·탑 | 세 가지는 WebGL에 그려져 DOM 기하로 재지 못한다(`stage/engraved.ts`, 깃발·탑은 three.js 메시) |

## 검증 (B절) — 로컬, worktree `C:/Users/sdsdo/Documents/shrinking-city-lab-claude-b`(전용 venv·`npm ci`)

| 종류 | 필요 | 수행 상태 | 결과 |
|---|---|---|---|
| 저장소 위생·배포 스크립트 구문 | 필요 | 수행 | 통과 |
| 린트·파이프라인 테스트·데이터 재현 | 필요 | 수행 | 통과(ruff, pytest 22, verify PASS 3) |
| 타입체크·빌드·앱 테스트 | 필요 | 수행 | 통과(build, vitest 11 files · 171) |
| 배포 형태별 실행 확인 | 필요 | PR CI | (PR CI) |
| ①② | 해당 없음(문서만, 하네스 변경 없음) | — | — |

## 검증 공백

- 문서 기술의 정확성은 테스트로 확인할 수 없다 → 독립 리뷰(위 명령)가 대조한다.

## PR CI

- 리뷰 전: head `0c0b7c3` 실행 38393620428 success.
- 리뷰 반영 뒤: head `090d547` `pull_request` 실행 38394649924 — repository · pipeline · app success. 이 뒤 보고서만 고친 push의 CI는 확인만 한다.

## 독립 리뷰

1회차(Codex adversarial, 2026-10-13, 대상 `d2d0138`): **needs-attention**, 필수 1건 — [medium] 「기준 변경 소식의 겹침」이 소식↔말풍선 검사까지 있는 것처럼 과장, 그 공백이 수단 없음에서 빠짐. 다른 B절 행·보호·승인·병합 절차는 바뀌지 않았다고 확인. 원문은 [PR #19 코멘트](https://github.com/misty-hollow/shrinking-city-lab/pull/19#issuecomment-6145127775).
- 조치: 권고대로 문구 한정 + 수단 없음에 추가(위 핵심 변경), 이 보고서 근거 표 수정.

2회차(반영분 재검토, 대상 `febd83f`): **approve, No material findings** — 소식 문구가 HUD 판·화면 좌우 끝 비교와 일치, 소식↔세계 라벨 겹침이 수단 없음에 명시, 반영분은 객관 검사 행만 변경, B절 추가 변경은 끝난 계획 한 줄 삭제뿐, 다른 절 그대로. 원문은 [PR #19 코멘트](https://github.com/misty-hollow/shrinking-city-lab/pull/19#issuecomment-6145246560). 리뷰 뒤 변경은 이 보고서뿐이라 재검토하지 않는다.

## 사용자 확인 기록

없음.

## 미해결

- PR #18(후속 1·3)과 이 PR은 둘 다 이 보고서를 바꿔, 나중에 병합하는 쪽에서 `docs/REPORT.md`가 충돌한다(앱 동기화 도구로 main merge 후 양쪽 기록 보존).
- PR #18이 병합되면 소식↔말풍선 검사가 생긴다. 그때 B절의 「소식과 세계 라벨의 겹침」을 수단 없음에서 빼고 객관 검사로 옮기는 갱신이 필요하다(B절 = 고위험, 그 변경도 독립 리뷰). #18을 먼저 병합하면 이 PR에서 함께 고친 뒤 재검토하는 것이 리뷰 한 번으로 끝난다.

## commit

이 PR의 첫 커밋(B절 변경, 리뷰 전 commit — 본문에 목표·기준·검증 공백)

---

## 이전 작업 기록 — 2026-10-13 정식 배포(PR #17 병합, main `ac4fe8e`)

- 작업: 정식 사이트(geoleobom.kr) 배포 — main `9672e23`(PR #15 화면 수정 + PR #16 확인 기록)을 `gh-pages` `fc0cd22`로 공개하고 실제 사이트에서 확인
- 결과: 완료
- 다음 할 일: 사용자 — 이 기록 PR 병합 여부("PR #N 병합해"). 배포·되돌리기 추가 조치 없음(되돌리기 대상 `gh-pages` `e388749`)

### 위험도: 저(이 기록 PR), `docs/release/*.md` 상태 기록 갱신과 이 보고서(C절 예외). 배포 자체는 E절 승인 행동으로 사용자 승인(2026-10-13)을 받아 수행

### 영향: 이 PR은 화면·입력·상태 영향 없음(문서만). 공개된 앱 = main `9672e23` = PR #15에서 ①②·사용자 확인을 마친 앱 코드(`4b6accd`와 `app/` 동일)

### 핵심 변경

- 배포(승인 행동, 2026-10-13): `deploy/build_release.sh 9672e23…` → `gh-pages` 작업트리(스크래치 폴더) → `git push origin HEAD:gh-pages`. `e388749` → `fc0cd22` fast-forward, force 없음. `PRODUCTION.md` 2절 절차 그대로(작업 폴더 위치만 세션 스크래치)
- 이 PR: `docs/release/PRODUCTION.md` 4절(현재 공개 릴리스·이전 기록 표)과 이 보고서

### 배포 전 확인

| 항목 | 결과 |
|---|---|
| main 상태 | `9672e23` = PR #16 병합, main CI 38264362490 success |
| 검증된 코드와 같은지 | `4b6accd`(PR #15 ① 627 PASS / 0 FAIL, CI success) → `9672e23` 차이는 `CLAUDE.md`·`docs/REPORT.md`뿐 |
| 데이터·계산 | 직전 배포 `2ee1431` 대비 `app/src/engine`·`app/public/data`·`pipeline/data.lock.json`·`pipeline/derived`·`pipeline/scl_pipeline` 변경 없음 |
| 릴리스 빌드 | `build_release.sh`: npm ci → vitest 171 통과 → `--base=/` 빌드, 195 파일, 주 자산 `assets/index-BH6zpSAS.js` |
| `gh-pages` 차이 | 바뀐 파일 4개(`index.html`·`404.html`·주 JS·CSS). 자료·라이선스·`CNAME`(줄바꿈 없는 기존 파일)·`.nojekyll` 그대로. 커밋 파일 SHA256 = `dist` 195개, `404.html` = `index.html` |

### 배포 뒤 확인 (실제 사이트)

| 항목 | 결과 | 증거 |
|---|---|---|
| Pages 빌드 | built `fc0cd22`(2026-10-13 19:48 KST), cname `geoleobom.kr`, HTTPS 강제 켬 | `gh api …/pages/builds/latest`, `…/pages` |
| smoke | 실패 0: 새 주 자산·CSS·three 200, 자료 6개 = 잠금 해시, 고지 3개 | `deploy/smoke_web.py --base-url https://geoleobom.kr` |
| 깊은 주소 | 상태 404 + 본문 = 앱 `index.html`(설계대로) | `curl … /p/36.47130,127.14020 | cmp` |
| 실제 사이트 브라우저 QA 1회차 | 613 PASS / 1 FAIL — 「390x844 모바일에서도 자료와 한계」 | `qa-prod.log`(세션 스크래치), meta.commit `9672e23`, base `https://geoleobom.kr/?kiosk=0` |
| 1회차 FAIL 조사 | 사이트 문제 아님으로 판단: 이 검사는 클릭 직후 `#s8-title`을 기다리지 않고 센다. 같은 실행의 스크린샷(350ms 뒤)과 그 뒤 기하 검사(판 안 잘림 0)에서 시트가 열려 있었다. 임시 탐침(작업 폴더 밖) 2회: 클릭 직후 열림, 약 100ms, 기하 검사 통과. 첫 방문(빈 캐시) 때 늦게 열린 것으로 추정 | 아래 미해결 |
| 실제 사이트 브라우저 QA 2회차(바꾼 것 없이 재실행) | **614 PASS / 0 FAIL**. 개발 서버 전용 소리·GPU 검사 13개는 운영 빌드에 창이 없어 빠짐 | `app/qa-shots/report.json`(meta.commit `9672e23`) |
| 요청 항목 | S0→S6 한 판(1440 전체, 1024·1280 축약, 건너뛰기 판, 키오스크 90초 복귀), HUD와 말풍선 겹침 0·흐린 말풍선 포커스 복귀(세 크기), S6 표 판 안 잘림 0(세 크기), 390 모바일 안내·자료와 한계 잘림 0, 콘솔 오류 0 — 모두 PASS | 같은 실행 |
| 직접 검토 ② | 실제 사이트 스크린샷 1440 `s0-start`·`s4-play`·`s6-world`, 1024 `s5-world`, 390 자료와 한계 — PR #15 검증 화면과 같고 이상 없음 | `app/qa-shots/*.png` |

### 이 PR 검증

| 종류 | 필요 | 수행 상태 | 결과 |
|---|---|---|---|
| 저장소 위생·배포 스크립트 구문·린트·파이프라인 테스트·데이터 재현·빌드·앱 테스트 | 필요(모든 변경) | 수행(로컬) | 통과 — diff --check, bash -n·py_compile, ruff, pytest 22, verify PASS 3, npm ci·build, vitest 171 |
| 배포 형태별 실행 확인 | 필요 | PR CI | (PR CI) |
| ①② | 해당 없음(문서만) | — | — |

### 검증 공백

- 실제 사이트의 1회차 FAIL은 하네스 검사가 기다리지 않아 생긴 시간 문제로 판단했다(재실행 0 FAIL). 하네스를 고치지 않았다(배포 작업에서 추가 변경하지 않음). 별도 작업 제안: 이 검사가 `#s8-title`을 기다리게 — 기존 검사의 기다림 추가라 기준 약화 아님
- 전시 기기(통합 GPU) 체감과 실제 모니터 프레임은 D절 사용자 판단(이번 배포로 무대 그리기 비용은 바뀌지 않음, PR #15 perf-probe 비교)

### PR CI

PR #17, head `ae2ec50` `pull_request` 실행 38386673284 — repository · pipeline · app success(뿌리 기준 빌드 smoke 포함). MERGEABLE · CLEAN. 이 뒤 보고서만 고친 push의 CI는 확인만 한다.

### 사용자 확인 기록

- 2026-10-13: 정식 배포 승인(「문제가 없다면 https://geoleobom.kr 에 정식 배포하는 것을 승인」).

### 미해결

- 1회차 FAIL 검사의 기다림 보강(위 검증 공백)
- `CLAUDE.md` B절 「수단 없음: HUD와 3D 말풍선 겹침, 판 안 가로 잘림」 갱신(고위험 절, 별도 작업)
- 1440 S4 M2 기준 변경 소식 두 줄이 정안 말풍선 일부를 3.2초 덮음(기존)

### commit

배포 `gh-pages` `fc0cd22`(앱 `9672e23`), 이 기록 PR 브랜치 `docs/release-9672e23`

---

### 이전 작업 기록 — PR #15(병합됨, main `c094d33`) · PR #16(병합됨, main `9672e23`)

PR #15 보고서 원문(머리 세 줄은 목록으로, 절 머리는 한 단계 낮춤). 그 안의 「이전 작업 기록」은 PR #14 보고서다.

- 작업: 스크린샷 검토(②)에서 찾은 기존 배치 문제 4건 수정(HUD 위 3D 말풍선·S6 표 잘림·모바일 자료와 한계 잘림·1024 결산 말풍선 잘림) + 브라우저 QA에 DOM 기하 검사 추가
- 결과: 완료
- 다음 할 일: 없음 — PR #15 병합(main `c094d33`, 2026-10-12 14:30, main CI 38263445429 success), 사용자 확인 3건 완료(2026-10-12). 정식 사이트 배포(gh-pages)는 하지 않았다 — 하려면 사용자가 별도 승인

#### 위험도: 저, 새 QA 검사 추가(기존 검사 기준 그대로)와 무대 라벨 배치·CSS 배치 수정. `app/src/engine/**`·데이터·문구(`copy.ts`)·금지어·CI·배포·의존성·외부 호출 변경 없음. S8 「자료와 한계」는 CSS 줄바꿈만 바꾸고 출처·이용조건 글은 그대로

#### 영향: 화면·입력·상태 영향 있음, `app/src/stage/StageController.ts`·`app/src/styles/*.css`(CLAUDE.md v1.2 B절 영향 영역). 전환 기간 1/5(v1.2 기준 첫 화면 영향 작업)

#### 공통 규칙 사본

작업 시작 때 CLAUDE.md v1.2와 `docs/ai-dev-workflow/`는 PR #14(미병합)에만 있었고, 사용자 지시(2026-10-12)대로 그 사본(WORKFLOW v1.2)을 따랐다. 작업 중 PR #14가 병합돼(main `dff9f60`) 이 브랜치에 main을 merge했다(`4b6accd`). 이제 브랜치의 CLAUDE.md도 v1.2다.

main 동기화(2026-10-12): 앱 `sync_with_base_branch`가 처음엔 보호 파일(`.claude/agents/*`, #14가 바꿈) 때문에 출처 확인을 요구했고, 사용자가 고정된 Git 원격 저장소를 확인한 뒤에는 커밋 단계에서 작성자 정보가 없어 멈췄다(호스트 git이 저장소 로컬 설정을 읽지 않음). 사용자 승인으로 전역 git 작성자(`misty-hollow`, `misty-hollow@users.noreply.github.com`)를 설정한 뒤 merge했다. 충돌은 `docs/REPORT.md` 하나 — 이 작업의 보고를 위에 두고 PR #14 보고서 원문을 아래 「이전 작업 기록」으로 보존했다. `browser-qa.mjs`는 자동 병합(이 브랜치 검사 호출 + #14의 기대값 정정·`stage()`·`meta`). merge 뒤 main 대비 차이는 이 작업의 7개 파일뿐이고, `app/src`·`app/public`·`app/package*.json`은 `8b133c9`와 같다.

#### 핵심 변경

1. **HUD 위 3D 말풍선**(S4 지표 자세히 + 지역 카드, 1440·1280·1024) — 원인: 무대는 화면 밖으로 나간 말풍선만 숨겼고, 배경 없는 HUD 판(`data-occlude`) 자리는 몰랐다. 읍·면으로 다가가면 둘레 말풍선·마을 이름·결과 판이 HUD 글자 위에 그려졌다.
   - 전체 시점 맞춤(`fitCamera`/`fitFor`/`anchorHeads`): 섬 윤곽과 함께 말풍선·잃은 마을 표지의 머리까지 HUD 판과 화면 끝을 피한다. 맞출 수 없으면 예전처럼 윤곽만.
   - `updateLabels`: HUD 판 자리를 처음부터 차지된 자리로 본다. 마을 이름·도로망 시간 태그는 HUD 자리·화면 끝에서 컬링. 결과 판(`.marker-pop`)은 HUD·화면 끝에 걸리면 옆으로 비켜 놓는다(`--pop-dx`, 줄기는 말풍선을 가리킴), 자리가 없으면 숨김.
   - 전체 시점을 벗어나면(읍·면 초점·확대·끌기) 머리가 HUD 판 뒤나 화면 끝에 걸린 말풍선을 흐려 숨긴다(`.anchor.is-occluded`, 불투명도 0). Tab으로는 그대로 닿고, 포커스가 오면 다시 보인다(`focusin`/`focusout`에서 다시 그림). 전체 시점에서는 흐리지 않는다(리뷰 필수 지적 반영).
2. **S6 세계 표 잘림**(1440·1280) — `.wf-table`의 `min-width: min-content`가 ≤1279에만 있었다. 모든 폭으로 올림. 판이 표 폭(약 470px)까지 넓어진다.
3. **390 자료와 한계 잘림** — 출처 열의 긴 낱말(`행정안전부_지역별(법정동)`, 영문 출처), 재현 정보의 해시, SGIS 이용조건 문장의 긴 주소가 시트를 밀었다. <768에서만 시트 여백 32→20px, 폭 화면−24px, 해당 칸 줄바꿈 허용. 기준일·분류 열은 한 덩어리 그대로.
4. **1024 S5 세계 서쪽 말풍선 잘림**(불확실 항목) — 스크린샷이 감상 → 결과로 옮겨 가는 카메라 600ms 도중에 찍혔다(정지 화면에서는 섬이 다 들어와 있었다). 하네스가 결과 화면에서 카메라 이동을 기다린 뒤 찍는다. 1번의 머리 맞춤도 같은 방향으로 작용한다.
5. **②에서 추가로 찾은 것: 1024 지표 자세히 열림에서 가운데 위 소식 한 줄이 시트 밑으로 잘림** — 시트가 열리면 소식을 왼쪽 위 HUD와 시트 사이 빈자리의 가운데에 둔다(≥1280은 사실상 그대로).
6. **QA 하네스** — `app/scripts/qa-geometry.mjs`(새 파일)와 `browser-qa.mjs`의 호출 19줄. 기존 단언은 바꾸지 않았다. 새 검사: HUD 판↔세계 라벨(말풍선 머리·미리보기·결과 판·표지·마을 이름·시간 태그) 겹침, 소식 한 줄↔HUD 판 겹침, 화면 끝에 걸린 세계 라벨, 전체 시점에서 흐린 말풍선 0, 판(`[data-occlude]`·`.data-sheet`·`.mobile`) 안 가로 잘림(말줄임·`.sr-only` 제외), S4 가까이 보기에서 흐린 말풍선 포커스 → 다시 보임. 호출 위치: 기존 `noHorizontalOverflow` 안(S4·S5·S6 전부), S4 지역 카드, S4 위에서 보기, S5 세계, S8, 390 자료와 한계. 결과 화면 진입(`toSummary`)과 지역 카드 뒤에 카메라 이동 700ms 대기를 넣었다.
7. **문서** — `docs/UI_DESIGN_SYSTEM.md` §8.1(소식 위치), §8.2(HUD 판과의 겹침 규칙), §8.3(결과 판 비켜 놓기), §12.4(S6 표 판 모든 폭·<768 자료와 한계·2026-10-12 확인), §13·§15.

#### 변경 파일

`app/src/stage/StageController.ts`, `app/src/styles/world.css`, `app/src/styles/app.css`, `app/scripts/qa-geometry.mjs`(신규), `app/scripts/browser-qa.mjs`, `docs/UI_DESIGN_SYSTEM.md`, `docs/REPORT.md`

#### 검증 (B절 행마다: 필요 · 수행 상태 · 결과 · 증거) — 로컬 Windows 11, worktree `quirky-kirch-06c899`, main merge 뒤 head `4b6accd`에서 다시 수행

| 종류 | 필요 | 수행 상태 | 결과 | 증거 |
|---|---|---|---|---|
| 저장소 위생 | 필요 | 수행 | 통과 | `git diff --check origin/main...HEAD` |
| 배포 스크립트 구문 | 필요 | 수행 | 통과 | `bash -n deploy/*.sh`, `py_compile deploy/smoke_web.py` |
| 린트 | 필요 | 수행 | 통과 | 이 트리 전용 `pipeline/.venv`(Python 3.12.10): ruff check·format --check |
| 테스트(파이프라인) | 필요 | 수행 | 통과 | pytest 22 passed |
| 데이터 재현 | 필요 | 수행 | 통과 | `scl_pipeline verify`: 불변식·잠금 12개·재현 바이트 동일 |
| 타입체크·빌드 | 필요 | 수행 | 통과 | `npm ci && npm run build` |
| 테스트(앱) | 필요 | 수행 | 통과 | vitest 11 files · 171 tests |
| 배포 형태별 실행 확인 | 필요 | CI | (PR CI) | CI `app` job 「Root-base build and static smoke」 |
| 실행 검증 ① 플레이 경로 | 필요 | 수행(병합된 실제 하네스 `npm run qa:browser`) | 통과 | 627 PASS / 0 FAIL, 종료 코드 0, `report.json` meta.commit `4b6accd` |
| 실행 검증 ① 객관 검사 | 필요 | 같은 실행 | 통과 | 위와 같음. 새 DOM 기하 검사 포함 |
| 직접 검토 ② | 필요 | 수행 | 이상 없음(아래 ②) | `app/qa-shots/*.png` |
| 시간 축 | 필요(결과 화면 카메라 대기·흐림 전환) | 같은 실행 | 통과 | 빛 도착 전·후 지표, 움직임 줄이기(1280 reduce), 키오스크 90초 복귀 검사 PASS |
| 성능 | 필요(무대 변경) | 수행(`8b133c9`에서. merge가 앱 코드를 바꾸지 않아 다시 재지 않음) | 통과 | `perf-probe.mjs` 4개 프로필, main 빌드와 번갈아 비교: 프레임 간격 같음(gpu 5.6ms, swiftshader 중앙 94.5ms 양쪽 같음), 첫 조작 가능 gpu 949 vs 943~968ms, CPU 4배 2807 vs 2738~2771ms(편차 안), 콘솔 오류 0 |

#### 실행 검증 ①

- 최종(main merge 뒤 `4b6accd`, 2026-10-12T14:19Z): 병합된 실제 하네스로 **627 PASS / 0 FAIL**, 종료 코드 0. 사용자가 짚은 네 가지 — HUD와 말풍선 겹침(1440·1024·1280 S4 지역 카드), S6 표 마지막 열(1440·1024·1280 S6 세계 판 안 가로 잘림), 작은 화면 자료와 한계(390), 키보드 포커스 시 말풍선 복귀(세 크기 j=8·0·0) — 모두 PASS. 결과 `app/qa-shots/report.json`·`qa-merged.log`.
- 그 전(`8b133c9`): main 하네스가 PR #13 이후 낡은 기대값 때문에 1440 S5 `.wr-lost`에서 멈춰서, `git merge-file`로 이 브랜치 하네스와 PR #14 하네스를 3-way 병합한 임시 파일(충돌 0, 커밋 안 함)로 돌렸다: 627 PASS / 0 FAIL. merge 뒤 실제 하네스 결과와 검사 수·결과가 같다.
- 경로: 하네스 대표 경로 전부(1440 한 판 S0→S6, 1024·1280 reduce 축약, 건너뛰기 판·키오스크 90초·390 모바일·소리 끄기).
- 수정 전 같은 하네스 결과(새 검사만 실패, 12건): 1440·1280·1024 S4 지역 카드 겹침·화면 끝, 1024 S5 M2·M3 반포 말풍선↔결과 시트, 1280 S4 M2 정안 결과 판↔오른쪽 위 도구, 1440·1280 S6 `.wf-table` 470>456/435, 390 `.data-sheet` 400>342. 수정 후 627 PASS / 0 FAIL.
- 변경 주변 탐색(임시 스크립트, 커밋하지 않음): 1280 마지막 읍·면 지역 카드에서 흐린 말풍선에 포커스 → 다시 보임·`+`로 풀 15→14(이 탐색에서 포커스만 바뀌면 다시 그리지 않는 문제를 찾아 `c724079`로 고침), 1440 휠 확대·끌기에서 마을 이름 14개와 HUD 겹침 0, 1280×720·1366×768 S4 전체 시점(지표 자세히 닫힘·열림) 겹침·흐림 0, 1366×768·1100×800 S6 세계 기하 검사 통과.
- 재현 조건: `report.json` meta = commit `4b6accd`, base `http://127.0.0.1:5299/?kiosk=0`(5199는 다른 프로세스가 쓰고 있어 5299), msedge 155.0.4283.45, playwright-core 1.63.0. 같은 순서·무작위 없음.

#### 직접 검토 ②

main merge 뒤 다시 본 것: `1440x900-s4-play`·`-s6-world`, `1024x768-s4-play`·`-s5-world`, `390x844-mobile` — merge 전과 같고 이상 없음.

merge 전에 본 것(1440 기준 10장 + 1024·1280·390): `1440x900-s0-start`·`-s2-moved`(수정 전과 섬 위치·크기 같음)·`-s4-play`·`-s4-top`·`-s4-m2-play`·`-s5-world`·`-s5-debrief`·`-s6-world`·`-s6-three`·`-s8-data`, `1024x768-s4-play`·`-s5-world`, `1280x800-s4-play`, `390x844-mobile`.

- 의심→수정: 1024 S4 소식 한 줄이 시트 밑으로 잘림(핵심 변경 5).
- 이상 없음: 4건 모두 해소. S4 지역 카드에서 HUD 위 말풍선·결과 판 없음, 1024 S5 서쪽 말풍선 화면 안, S6 미션 3 열 전체, 390 분류 배지 전체·표 시트 안.
- 관찰(수정 안 함, 미해결 참조): 1440 S4 M2에서 기준 변경 소식 두 줄(3.2초)이 정안 말풍선 일부를 덮는다. 수정 전과 같다.

#### 검증 공백

- 지형에 새긴 읍·면 이름(캔버스)과 3D 깃발·탑은 DOM이 아니라 기하 검사가 재지 못한다. 가까이 본 상태에서 HUD 글자 뒤로 밝은 시내 지형이 지나갈 때 읽힘은 사람 판단(아래 확인 1).
- 소식 한 줄 검사는 그 순간 떠 있는 소식만 잰다(3.2초). 1024 위치 수정은 이번 실행의 지역 카드 상태(20분→15분 직후라 소식이 떠 있음)와 스크린샷으로 확인했다.
- 전체 시점 머리 맞춤은 시점을 다시 맞출 때(HUD 판 배치·창 크기 변경)만 말풍선 크기를 잰다. S5에서 잃은 마을 표지가 나중에 생기는 경우도 이번 실행의 S5 기하 검사는 통과했다.

#### 사용자에게 — 확인 요청 3건 (전환 기간 1/5, ①② 통과 항목 병행 확인 포함)

스크린샷: `C:\Users\sdsdo\Documents\shrinking-city-lab\.claude\worktrees\quirky-kirch-06c899\app\qa-shots\`

1. **가까이 본 상태의 흐림(제품 규칙 변경, §8.2)** — `1440x900-s4-play.png`, `1280x800-s4-play.png`, `1024x768-s4-play.png`: 읍·면을 고르면 HUD 뒤로 들어간 말풍선이 사라진다(이전엔 HUD 글자 위에 그려졌다). 이 동작이 괜찮은지, 그리고 HUD 글자가 밝은 지형 위에서 읽히는지.
2. **병행 확인(①② 통과)** — `1440x900-s6-world.png`(미션 3 열 「15,544명 (57곳)」까지 보이는지), `390x844-mobile.png`(분류 배지가 잘리지 않는지), `1024x768-s5-world.png`(유구·신풍 말풍선이 화면 안인지, 섬이 작아 보이지 않는지).
3. **병행 확인(①② 통과)** — `1024x768-s4-play.png` 위쪽 소식 한 줄 「기준 20분 → 15분 …」이 HUD와 시트 사이에 다 보이는지.

#### PR CI

- main merge 전: head `146a016`(코드 `8b133c9`) push 실행 38258029038 — repository·pipeline·app success.
- main merge 뒤: head `2f724cb`(코드 = `4b6accd`) `pull_request` 실행 38262398610 — repository success · pipeline success · app success(뿌리 기준 빌드 smoke 포함). PR 상태 MERGEABLE · CLEAN(2026-10-12 조회).
- CI 실행 예산: 이 PR 3/6(이 보고서 push 포함). 이 뒤 보고서만 고친 push의 CI는 확인만 하고 다시 쓰지 않는다.

#### 독립 리뷰

저위험이라 Codex 독립 리뷰 대상 아님. 리뷰 서브에이전트(읽기 전용, `4abf92e`·`c724079`):
- 필수 1건 반영(`8b133c9`): 전체 시점에서 머리를 HUD 밖에 못 놓거나 줄기를 든 말풍선이 HUD에 닿으면 주 조작 말풍선이 흐려지고 눌리지 않을 수 있다 → 전체 시점에서는 흐리지 않음. 1280×720·1366×768에서 다시 확인.
- 선택(반영 안 함): 마우스로 누른 뒤 남은 포커스도 흐림 예외가 된다(`:focus-visible` 기준 제안 — 프로그램 포커스·키보드 판정이 브라우저 휴리스틱이라 보류), 흐린 말풍선의 결과 판도 함께 안 보인다(값은 HUD 지표·라이브 문장에 있음, 문서에 적음), 소식 검사의 시간 의존(검증 공백에 적음), 표지가 나중에 생길 때 재맞춤 없음(검증 공백), 섬 크기·확대 문턱 체감(확인 1·2).

#### 사용자 확인 기록

2026-10-12, 사용자 메시지 「PR #15에서 요청한 화면 확인 3건 모두 문제없어」 — 범위를 항목별로 짚음:

| 항목 | 확인 범위 | 결과 |
|---|---|---|
| 1. 가까이 본 상태의 말풍선 흐림(§8.2 규칙 변경, ③ 판단) | 읍·면 선택 시 HUD 뒤 말풍선이 흐려지는 동작 | 문제없음(승인) |
| 2. 병행 확인 — S5·S6·모바일 잘림 | S6 미션 3 열, 390 자료와 한계 분류 배지, 1024 S5 서쪽 말풍선 | 문제없음 |
| 3. 병행 확인 — 1024 상단 소식 | 지표 자세히 열림에서 「기준 20분 → 15분 …」 한 줄 | 문제없음 |

검증 행은 수행·통과 그대로 두고(①②로 이미 통과), 위 확인은 전환 기간 1/5 병행 확인으로 CLAUDE.md D절 표에 적었다. 놓침 없음(AI 소견과 사용자 확인 결과가 같다).

#### 미해결

- CLAUDE.md B절 「수단 없음: HUD와 3D 말풍선 겹침, 판 안 가로 잘림」을 「qa-geometry.mjs로 수행」으로 고쳐야 한다(B절은 고위험이라 별도 작업).
- 1440 S4 M2 기준 변경 소식 두 줄이 정안 말풍선 일부를 3.2초 덮는다(기존, 이번 범위 밖).
- 마우스로 누른 말풍선은 포커스가 남아 가까이 보기에서 HUD 위에 남을 수 있다(리뷰 선택 지적).

#### commit

`4abf92e` 수정·검사 추가 → `c724079` 포커스 다시 그리기 → `8b133c9` 전체 시점 흐림 제외·포커스 검사 → `146a016`·`a3666fa` 보고서 → `4b6accd` main(`dff9f60`, PR #14) merge → 이 보고서

---

#### 이전 작업 기록 — PR #14(병합됨, main `dff9f60`, 2026-10-12 13:10)

이 브랜치에 main을 merge하며 옮겨 둔 PR #14의 최종 보고서 원문이다(머리 세 줄은 목록으로, 절 머리는 한 단계 낮춤). 그 작업의 ② 의심 1~3·4번이 이 PR #15의 대상이다.

- 작업: AI 개발 운영 체계 v1.0 → v1.2 갱신(공통 규칙 사본·CLAUDE.md 프로젝트 값·CI 트리거·merge commit) + 기존 브라우저 QA 하네스 재실행과 재현용 최소 수정
- 결과: 완료
- 다음 할 일: 사용자 — 병합 여부 결정("PR #14 병합해"). 확인 요청 0건(화면 변경 없음). 별도로 GitHub 설정에서 head 브랜치 자동 삭제 켜기(선택: 룰셋 허용 병합 방식을 merge만)

##### 위험도: 고, `CLAUDE.md` B·C·E·F·H절, `.github/workflows/ci.yml`(트리거), `.claude/agents/**`, `docs/ai-dev-workflow/**`가 바뀌고 검증·승인·병합 기준이 바뀐다(PROJECT_TEMPLATE C절 "운영 규칙 변경 중 검증·승인·권한 기준이 바뀌는 것")

##### 영향: 화면·입력·상태 영향 없음, `app/src/**`·`app/public/**`·설정 파일 변경 0. QA 하네스(`app/scripts/browser-qa.mjs`)만 바뀌어 그 하네스로 한 판 전체를 다시 돌렸다. 전환 기간 카운트 대상 아님(0/5)

##### 핵심 변경

- `docs/ai-dev-workflow/` — 원본 `misty-hollow/AI-Dev-Workflow` `6eee919`(v1.2, 2026-10-12)의 CONSTITUTION·WORKFLOW·PROJECT_TEMPLATE 사본. git blob이 원본과 같다(`9825e98…`·`631d025…`·`4817b9d…`). `README.md`에 출처·버전·대조 방법
- `CLAUDE.md` — 첫 줄 "작업 전에 docs/ai-dev-workflow/CONSTITUTION.md와 WORKFLOW.md(v1.2)를 읽고 따른다." + PROJECT_TEMPLATE A~I절 값만.
  없앤 v1.0 조항: 실행 체인 12단계(중간 commit·push 1회·리뷰 전 push 금지), 작업 브랜치 push CI 확인, 1·2·3회 실패 처리, 리뷰 원문 REPORT 첨부, "UI 확인 = 사람", 잠정 squash.
  보존: 제품 기준 문서 4개, 고위험 파일·영역 목록 전부, E절 승인(gh-pages·VPS·데이터 재생성·cache·GitHub 설정·외부 연락), 커밋 제외, worktree 규칙, 금지어·접근성 영역.
  새 값: B절 검증 행(필요 조건·①②·시간 축·배포 형태별), QA 실행 방법과 재현 조건, 디버그 핸들 범위, 대표 플레이 경로, 수단 확보 계획, 예산(4시간·PR CI 6회), D절 ③과 전환 기간(5), G절 리뷰 명령(`--cwd`·focus), H절 데이터 분리
- `docs/DECISIONS.md` — WORKFLOW 9절 구성(제품 결정 / 기술 결정). D-003 v1.2 적용, D-004 merge commit(잠정 squash 대체), D-005 CI 트리거(D-002 대체), T-001~T-003
- `.github/workflows/ci.yml` — 트리거만 `pull_request`(main) + `push`(main) + `workflow_dispatch`. job·단계·이름·동시성 그대로. 주석 갱신
- `.claude/agents/implementer.md`·`reviewer.md` — 절 참조만 "CLAUDE.md 3절/4절" → "B절/C절"
- `app/scripts/browser-qa.mjs` — (1) 묶음(화면 크기)별 `stage()`: 예외로 멈춰도 FAIL「실행 중단」·`fail-<묶음>.png`를 남기고 다음 묶음, 종료 코드 1 (2) `report.json` = `{ meta: 커밋·주소·브라우저·playwright·시각, results }` (3) 승인된 화면·문구 변경을 따라가지 못한 기대값 6곳(아래 표)

| 검사 | 전 | 후 | 근거 |
|---|---|---|---|
| S5 세계: 잃은 마을 표지 | `.wr-lost` 줄에 '닿지 않게 된 마을' → 표지 1~3 | `.wr-change p` 중 '닿지 않게 된 마을' 줄이 있으면 '지도의 빨간 표지'도 있고 표지 1~3, 없으면 표지 0 | PR #13(`2ee1431`) 결산 두 칸. 조건 하나 추가(강화) |
| S4 놓기 전 미리보기 | '새로 닿아요' | `/새로 닿는 마을 \d+곳/` | #13 미리보기 명사형(`copy.ts` preview.newly) |
| S4 되돌리기 미리보기 | '닿지 않게 돼요' | `/닿지 않게 되는 마을 \d+곳/` | #13(preview.lost) |
| S3 M2·M3 결과 보관 안내 | '앞 미션의 배분은 그대로 보관돼요' | '확정한 배분은 마지막 「세 개의 공주」에서 나란히 다시 봐요' | #13(briefing.kept) |
| S6 세계 6개 지표 행 | `.wf-kpis tbody tr` = 6 | `.wf-kpis tbody:not(.wf-change) tr` = 6 | #13 S6 나아진·불리해진 주민 두 행(별도 tbody) |
| S6 마지막 문장 | '같은 자원이라도 목표에 따라 좋은 배분이 달라요' | '같은 15일이라도 어느 지표를 끝까지 높이느냐에 따라 배분이 달라져요' | #11(`4de1431`), 설계안 444행 |

##### 변경 파일

`CLAUDE.md`, `docs/DECISIONS.md`, `docs/REPORT.md`, `docs/ai-dev-workflow/{README,CONSTITUTION,WORKFLOW,PROJECT_TEMPLATE}.md`(신규), `.github/workflows/ci.yml`, `.claude/agents/implementer.md`, `.claude/agents/reviewer.md`, `app/scripts/browser-qa.mjs`.
바꾸지 않음: `app/src/**`, `app/public/**`, `app/package*.json`, `pipeline/**`, `deploy/**`, `.claude/settings.json`, GitHub 설정, `gh-pages`.

##### 검증 (로컬 = Windows 11, worktree `shrinking-city-lab-v12`, 전용 venv Python 3.12.10·`npm ci`, 2026-10-12)

| 행 | 필요 | 수행 상태 | 결과 | 증거 |
|---|---|---|---|---|
| 저장소 위생 | 필요 | 수행(로컬, `git diff --cached --check origin/main`) | 통과 | 출력 없음. gitleaks는 PR CI `repository` |
| 배포 스크립트 구문 | 필요 | 수행(로컬) | 통과 | `bash -n deploy/*.sh`, `py_compile deploy/smoke_web.py` |
| 린트 | 필요 | 수행(로컬) | 통과 | ruff "All checks passed", format "23 files already formatted" |
| 테스트(파이프라인) | 필요 | 수행(로컬) | 통과 | `22 passed` |
| 데이터 재현 | 필요 | 수행(로컬) | 통과 | "PASS 잠금: 12개 파일 해시 일치", "PASS 재현: … 바이트 단위로 같다" |
| 타입체크·빌드 | 필요 | 수행(로컬) | 통과 | `tsc -b && vite build` 성공 |
| 테스트(앱) | 필요 | 수행(로컬) | 통과 | `11 files, 171 tests passed` |
| 배포 형태별 실행 확인 | 필요 | 수행(PR CI `app` 마지막 단계에서만) | 통과 | 실행 38252128337 `app` success. 로컬 미수행(Linux 셸 전제) |
| 실행 검증 ① 플레이 경로 | 필요(하네스 변경) | 수행(로컬) | 통과 | 446 PASS / 0 FAIL, 종료 코드 0 |
| 실행 검증 ① 객관 검사 | 해당 없음(앱 화면 변경 없음). 하네스 검사는 같은 실행에서 수행 | 수행 | 통과 | 콘솔 오류 0(세 크기), 페이지 오류 0, GPU 0.46~0.49ms |
| 직접 검토 ② | 해당 없음(앱 화면 변경 없음). 사용자 요청으로 수행 | 수행(14장) | 의심 4건(기존 main, 아래) | 아래 ② |
| 시간 축 | 해당 없음 | — | — | 하네스의 빛 도착·움직임 줄이기·90초 복귀 검사는 통과 |
| 성능 | 해당 없음 | — | — | |
| 하네스 실패 기록(음성 확인) | 필요(하네스 변경) | 수행(로컬, 없는 주소 `:5198`) | 통과 | 4 FAIL「실행 중단」, `fail-*.png` 4장, `report.json` 생성, 종료 코드 1 |

##### 실행 검증 ①

- 기준선(하네스 수정 전, 현재 main `5e7b936`): 51초 뒤 `browser-qa.mjs:513` `.wr-lost` 대기 시간 초과로 프로세스가 죽음. `report.json` 없음, 그때까지의 PASS/FAIL 유실, 종료 코드 1(잡히지 않은 예외).
- 실패 기록 보존만 넣은 실행: 428 PASS / 18 FAIL = 위 표의 기대값 6곳 × 세 화면 크기. 18건 모두 앱이 설계안·승인 PR과 일치하고 하네스가 낡은 것.
- 최종 실행(이 브랜치 하네스, 작업 트리 = 커밋 내용): 1440×900 전체 한 판 147건, 1024×768 143건, 1280×800 움직임 줄이기 154건, 390×844 2건 → **446 PASS / 0 FAIL**, 종료 코드 0, 약 99초.
- 재현 조건(`report.json` meta): base `http://127.0.0.1:5199/?kiosk=0`, msedge 155.0.4283.45, playwright-core 1.63.0(`--no-save`), Node 24.14.1, 2026-10-12T12:44:31Z. 명령은 CLAUDE.md B절 「QA 실행」.
- 결과 파일은 `app/qa-shots/`(커밋 제외)에 있다.

##### 직접 검토 ②

본 결과물: 1440 `s0-start`·`s2-moved`·`s4-play`·`s4-m2-play`·`s5-world`·`s5-debrief`·`s5-m2-compare`·`s6-world`·`s6-three`·`s8-data`, 1024 `s4-play`·`s5-world`, 1280 `s4-play`, `390x844-mobile`(14장, 상한 16).
나머지는 이상 없음. 아래 4건은 **이번 변경 전부터 main에 있는 화면**이고, 이번 작업은 UI를 바꾸지 않으므로 고치지 않았다.

1. 의심 — S4 「지표 자세히」와 지역 카드(반포면)를 연 상태에서 무대가 옮겨지며 3D 말풍선(유구·신풍·우성)·마을 이름·「+1일」 알림이 왼쪽 HUD(미션 카드·지표 표) 위에 겹쳐 글자를 가린다. 1440·1280·1024 모두(`*-s4-play.png`). ①의 가로 넘침 검사는 겹침을 보지 않아 통과했다.
2. 의심 — S6 세계 표: 1440·1280에서 표(467px)가 판 `.wf-table`(`overflow-x:auto`)보다 11~32px 넓어 미션 3 칸 끝이 판 안 가로 스크롤 뒤로 잘린다(예: "15,544명 (57곳"). 1024는 맞는다. 임시 스크립트로 DOM 폭을 재서 확인.
3. 의심(경미) — 390×844 「자료와 한계」 시트가 가로로 넘쳐(scrollWidth 401 > clientWidth 342) 분류 배지가 잘려 보인다.
4. 확인 불가 — 1024 S5 결과 화면에서 무대 서쪽(유구·신풍 말풍선)이 화면 왼쪽 끝에 걸려 잘린다. 의도된 구도인지 판단 근거가 없다.

##### 검증 공백

| 항목 | 종류 | 영향 | 해소 방법 |
|---|---|---|---|
| 브라우저 QA(①)가 CI에서 돌지 않는다 | 수단 없음(프로젝트 수준, 이번 변경의 필요 검증은 로컬로 수행) | PR 필수 체크만으로는 플레이 경로가 확인되지 않는다. 메인이 로컬에서 돌려야 한다 | CLAUDE.md B절 수단 확보 계획(CI 실행 = 의존성·CI 변경, 고위험 별도 작업) |
| HUD와 3D 말풍선 겹침, 판 안 가로 잘림, 기준 스크린샷 비교 | 수단 없음(①) | 위 ② 1·2·3을 ①이 놓쳤다. 지금은 ②로만 잡힌다 | 하네스에 DOM 기하 검사 추가(새 검사, 저위험) — 별도 작업 제안 |
| gitleaks, 뿌리 기준 빌드 smoke | 로컬 수단 없음 → CI에서 수행 | PR CI 결과로 판정 | 아래 PR CI |
| Claude Code 권한 규칙이 새 세션에서 로드되는지 | 선택 미수행 | `.claude/settings.json`은 바꾸지 않았다(v1.2 8절 4 요구 — main push·파괴적 명령 deny, 병합 ask, 우회 deny — 는 기존 파일에 있다) | 다음 새 세션에서 확인 |

##### 세 수준 확인 (2026-10-12 조회)

- 운영 원칙: 사본 v1.2 + CLAUDE.md 첫 줄 참조(이 브랜치).
- 도구 권한: `.claude/settings.json` deny(main push·force·reset --hard·우회 옵션·`gh pr merge --admin/--auto`)·ask(`gh pr merge`·gh-pages push·데이터 재생성·docker·ssh) 존재. 이번 작업으로 바꿀 것 없음.
- 서버 보호: 룰셋 "Protect main" active, `~DEFAULT_BRANCH`, PR 필수(승인 0), 필수 체크 `repository`·`pipeline`·`app`, strict(up-to-date) 켬, 삭제·강제 push 금지, bypass 없음. classic 브랜치 보호 없음(404). 허용 병합 방식 merge·squash·rebase. `delete_branch_on_merge: false`.
- 워크플로: `CI`(PR·main push·수동), `pages-build-deployment`(GitHub 관리, `gh-pages` push에만). 외부 업로드 없음.
- 실행 검증 데이터 분리: 화면 크기마다 새 브라우저·새 컨텍스트(CLAUDE.md H절).

##### PR CI

[PR #14](https://github.com/misty-hollow/shrinking-city-lab/pull/14), 마지막 코드 변경 커밋 `5061bd0`, 실행 38252128337(`pull_request`):

| 필수 체크 | 결과 |
|---|---|
| repository(위생·gitleaks·배포 스크립트 구문) | success |
| pipeline(ruff·pytest·verify) | success |
| app(npm ci·build·test·뿌리 기준 빌드 smoke) | success |

새 트리거 확인: 작업 브랜치 push(`5061bd0`)로는 실행이 생기지 않았고 PR 실행 하나만 돌았다. 이 뒤 보고서만 고친 push의 CI는 확인만 하고 다시 쓰지 않는다. 사용한 CI 실행 예산 2/6(보고서 push 포함).

##### 독립 리뷰

Codex adversarial review(사용자 입력, 2026-10-12, 대상 `9de662b` main 대비 branch diff): **approve, No material findings**. 원문은 [PR #14 코멘트](https://github.com/misty-hollow/shrinking-city-lab/pull/14#issuecomment-6124902579).

- 필수 지적 없음. Next steps 1건(사본 바이트 대조)을 수행: 원본 저장소를 새로 받아 `6eee919`의 세 blob과 이 브랜치 사본을 `git rev-parse`·`cmp`로 대조 — 모두 동일(원본 main도 `6eee919`).
- 도구 동작 확인: `--cwd`로 worktree의 branch diff를 대상으로 잡았고(출력 "Target: branch diff against main"), focus 문장대로 REPORT·DECISIONS를 먼저 읽었다(진행 로그). 이 항목은 검증 공백에서 뺐다.
- 리뷰 뒤 변경은 이 보고서뿐이라(검증·권한·승인 기준 불변) 재검토하지 않는다(WORKFLOW 3절 7).

##### 사용자 확인 기록

없음.

##### 미해결

- 세션 시작 때 main 체크아웃의 REPORT.md는 "PR #8 병합 결정 대기"였지만 git에서는 PR #8이 이미 병합됨(`5e7b936`). 이 보고서로 대체.
- GitHub 설정(사용자): head 브랜치 자동 삭제 켜기. D-004를 서버에서도 강제하려면 룰셋 허용 병합 방식을 merge만으로(선택).
- ② 1~3의 화면 수정과 ① 겹침·잘림 검사 추가는 별도 작업.
- 원본 CHANGELOG v1.2가 "잠정 적용"이다. 원본이 바뀌면 사본 갱신은 별도 작업.

##### commit

`5061bd0`(전체 변경, 리뷰 전 commit — 본문에 목표·기준·검증 공백), `9de662b`(PR CI 기록, 리뷰 대상 head), 이후 리뷰 결과 기록 커밋.
