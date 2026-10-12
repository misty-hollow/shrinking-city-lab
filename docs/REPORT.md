작업: AI 개발 운영 체계 v1.0 → v1.2 갱신(공통 규칙 사본·CLAUDE.md 프로젝트 값·CI 트리거·merge commit) + 기존 브라우저 QA 하네스 재실행과 재현용 최소 수정
결과: 결정 필요
다음 할 일: 사용자 — 독립 리뷰 명령 입력(고위험): `/codex:adversarial-review --wait --base main --cwd C:/Users/sdsdo/Documents/shrinking-city-lab-v12 목표: AI 개발 운영 체계 v1.0을 v1.2로 갱신하고 기존 브라우저 QA를 실행 검증에 연결. 게임 기능·UI·계산 의미·데이터 불변. 기준: docs/ai-dev-workflow 세 사본이 원본 6eee919과 바이트 동일, CLAUDE.md는 첫 줄 사본 참조와 프로젝트 값만 담고 사본과 충돌하지 않으며 제품 설계·UI·데이터 이용조건·접근성·gh-pages 배포·데이터 재생성 승인 규칙을 잃지 않음, CI 세 job과 검사·이름 유지하고 트리거만 PR과 main push, 병합 방식 merge commit, browser-qa.mjs 수정이 기존 검사 기준을 약화하지 않음(기대값 6곳은 PR 11·13 승인 문구 추종, 나머지는 실패 기록 보존). 검증 공백: gitleaks와 뿌리 기준 빌드 smoke는 CI에서만, 브라우저 QA는 CI에 없음, HUD 겹침·판 안 잘림 자동 검사 수단 없음. docs/REPORT.md와 docs/DECISIONS.md D-003~D-005·T-001~T-003을 먼저 읽을 것`

## 위험도: 고, `CLAUDE.md` B·C·E·F·H절, `.github/workflows/ci.yml`(트리거), `.claude/agents/**`, `docs/ai-dev-workflow/**`가 바뀌고 검증·승인·병합 기준이 바뀐다(PROJECT_TEMPLATE C절 "운영 규칙 변경 중 검증·승인·권한 기준이 바뀌는 것")

## 영향: 화면·입력·상태 영향 없음, `app/src/**`·`app/public/**`·설정 파일 변경 0. QA 하네스(`app/scripts/browser-qa.mjs`)만 바뀌어 그 하네스로 한 판 전체를 다시 돌렸다. 전환 기간 카운트 대상 아님(0/5)

## 핵심 변경

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

## 변경 파일

`CLAUDE.md`, `docs/DECISIONS.md`, `docs/REPORT.md`, `docs/ai-dev-workflow/{README,CONSTITUTION,WORKFLOW,PROJECT_TEMPLATE}.md`(신규), `.github/workflows/ci.yml`, `.claude/agents/implementer.md`, `.claude/agents/reviewer.md`, `app/scripts/browser-qa.mjs`.
바꾸지 않음: `app/src/**`, `app/public/**`, `app/package*.json`, `pipeline/**`, `deploy/**`, `.claude/settings.json`, GitHub 설정, `gh-pages`.

## 검증 (로컬 = Windows 11, worktree `shrinking-city-lab-v12`, 전용 venv Python 3.12.10·`npm ci`, 2026-10-12)

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

## 실행 검증 ①

- 기준선(하네스 수정 전, 현재 main `5e7b936`): 51초 뒤 `browser-qa.mjs:513` `.wr-lost` 대기 시간 초과로 프로세스가 죽음. `report.json` 없음, 그때까지의 PASS/FAIL 유실, 종료 코드 1(잡히지 않은 예외).
- 실패 기록 보존만 넣은 실행: 428 PASS / 18 FAIL = 위 표의 기대값 6곳 × 세 화면 크기. 18건 모두 앱이 설계안·승인 PR과 일치하고 하네스가 낡은 것.
- 최종 실행(이 브랜치 하네스, 작업 트리 = 커밋 내용): 1440×900 전체 한 판 147건, 1024×768 143건, 1280×800 움직임 줄이기 154건, 390×844 2건 → **446 PASS / 0 FAIL**, 종료 코드 0, 약 99초.
- 재현 조건(`report.json` meta): base `http://127.0.0.1:5199/?kiosk=0`, msedge 155.0.4283.45, playwright-core 1.63.0(`--no-save`), Node 24.14.1, 2026-10-12T12:44:31Z. 명령은 CLAUDE.md B절 「QA 실행」.
- 결과 파일은 `app/qa-shots/`(커밋 제외)에 있다.

## 직접 검토 ②

본 결과물: 1440 `s0-start`·`s2-moved`·`s4-play`·`s4-m2-play`·`s5-world`·`s5-debrief`·`s5-m2-compare`·`s6-world`·`s6-three`·`s8-data`, 1024 `s4-play`·`s5-world`, 1280 `s4-play`, `390x844-mobile`(14장, 상한 16).
나머지는 이상 없음. 아래 4건은 **이번 변경 전부터 main에 있는 화면**이고, 이번 작업은 UI를 바꾸지 않으므로 고치지 않았다.

1. 의심 — S4 「지표 자세히」와 지역 카드(반포면)를 연 상태에서 무대가 옮겨지며 3D 말풍선(유구·신풍·우성)·마을 이름·「+1일」 알림이 왼쪽 HUD(미션 카드·지표 표) 위에 겹쳐 글자를 가린다. 1440·1280·1024 모두(`*-s4-play.png`). ①의 가로 넘침 검사는 겹침을 보지 않아 통과했다.
2. 의심 — S6 세계 표: 1440·1280에서 표(467px)가 판 `.wf-table`(`overflow-x:auto`)보다 11~32px 넓어 미션 3 칸 끝이 판 안 가로 스크롤 뒤로 잘린다(예: "15,544명 (57곳"). 1024는 맞는다. 임시 스크립트로 DOM 폭을 재서 확인.
3. 의심(경미) — 390×844 「자료와 한계」 시트가 가로로 넘쳐(scrollWidth 401 > clientWidth 342) 분류 배지가 잘려 보인다.
4. 확인 불가 — 1024 S5 결과 화면에서 무대 서쪽(유구·신풍 말풍선)이 화면 왼쪽 끝에 걸려 잘린다. 의도된 구도인지 판단 근거가 없다.

## 검증 공백

| 항목 | 종류 | 영향 | 해소 방법 |
|---|---|---|---|
| 브라우저 QA(①)가 CI에서 돌지 않는다 | 수단 없음(프로젝트 수준, 이번 변경의 필요 검증은 로컬로 수행) | PR 필수 체크만으로는 플레이 경로가 확인되지 않는다. 메인이 로컬에서 돌려야 한다 | CLAUDE.md B절 수단 확보 계획(CI 실행 = 의존성·CI 변경, 고위험 별도 작업) |
| HUD와 3D 말풍선 겹침, 판 안 가로 잘림, 기준 스크린샷 비교 | 수단 없음(①) | 위 ② 1·2·3을 ①이 놓쳤다. 지금은 ②로만 잡힌다 | 하네스에 DOM 기하 검사 추가(새 검사, 저위험) — 별도 작업 제안 |
| gitleaks, 뿌리 기준 빌드 smoke | 로컬 수단 없음 → CI에서 수행 | PR CI 결과로 판정 | 아래 PR CI |
| 독립 리뷰 도구가 실제로 focus 문장·`--cwd`를 받는지 | 소스 확인만, 실행 전 | 리뷰가 목표·기준 없이 돌 수 있다 | 리뷰 출력 첫머리에서 대상 브랜치·파일 목록 확인 |
| Claude Code 권한 규칙이 새 세션에서 로드되는지 | 선택 미수행 | `.claude/settings.json`은 바꾸지 않았다(v1.2 8절 4 요구 — main push·파괴적 명령 deny, 병합 ask, 우회 deny — 는 기존 파일에 있다) | 다음 새 세션에서 확인 |

## 세 수준 확인 (2026-10-12 조회)

- 운영 원칙: 사본 v1.2 + CLAUDE.md 첫 줄 참조(이 브랜치).
- 도구 권한: `.claude/settings.json` deny(main push·force·reset --hard·우회 옵션·`gh pr merge --admin/--auto`)·ask(`gh pr merge`·gh-pages push·데이터 재생성·docker·ssh) 존재. 이번 작업으로 바꿀 것 없음.
- 서버 보호: 룰셋 "Protect main" active, `~DEFAULT_BRANCH`, PR 필수(승인 0), 필수 체크 `repository`·`pipeline`·`app`, strict(up-to-date) 켬, 삭제·강제 push 금지, bypass 없음. classic 브랜치 보호 없음(404). 허용 병합 방식 merge·squash·rebase. `delete_branch_on_merge: false`.
- 워크플로: `CI`(PR·main push·수동), `pages-build-deployment`(GitHub 관리, `gh-pages` push에만). 외부 업로드 없음.
- 실행 검증 데이터 분리: 화면 크기마다 새 브라우저·새 컨텍스트(CLAUDE.md H절).

## PR CI

[PR #14](https://github.com/misty-hollow/shrinking-city-lab/pull/14), 마지막 코드 변경 커밋 `5061bd0`, 실행 38252128337(`pull_request`):

| 필수 체크 | 결과 |
|---|---|
| repository(위생·gitleaks·배포 스크립트 구문) | success |
| pipeline(ruff·pytest·verify) | success |
| app(npm ci·build·test·뿌리 기준 빌드 smoke) | success |

새 트리거 확인: 작업 브랜치 push(`5061bd0`)로는 실행이 생기지 않았고 PR 실행 하나만 돌았다. 이 뒤 보고서만 고친 push의 CI는 확인만 하고 다시 쓰지 않는다. 사용한 CI 실행 예산 2/6(보고서 push 포함).

## 독립 리뷰

리뷰 전(사용자 명령 대기). 원문은 PR 코멘트에 둔다.

## 사용자 확인 기록

없음.

## 미해결

- 세션 시작 때 main 체크아웃의 REPORT.md는 "PR #8 병합 결정 대기"였지만 git에서는 PR #8이 이미 병합됨(`5e7b936`). 이 보고서로 대체.
- GitHub 설정(사용자): head 브랜치 자동 삭제 켜기. D-004를 서버에서도 강제하려면 룰셋 허용 병합 방식을 merge만으로(선택).
- ② 1~3의 화면 수정과 ① 겹침·잘림 검사 추가는 별도 작업.
- 원본 CHANGELOG v1.2가 "잠정 적용"이다. 원본이 바뀌면 사본 갱신은 별도 작업.

## commit

`5061bd0`(전체 변경, 리뷰 전 commit — 본문에 목표·기준·검증 공백), 이후 보고서 갱신 커밋.
