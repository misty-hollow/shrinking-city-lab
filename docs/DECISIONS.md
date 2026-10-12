# 결정 기록 (DECISIONS)

승인된 결정과 이유, AI에 위임된 기술 결정 중 나중에 참조할 것만 적는다(WORKFLOW 9절). 미승인 제안·검토 중인 안은 넣지 않는다.

## 제품 결정

### 제품 결정의 원본

제품·화면 결정은 이미 아래 문서에 판 번호와 함께 기록되어 있다. 이 파일에 옮겨 적지 않는다(같은 내용을 두 곳에 두지 않는다).

| 범위 | 원본 |
|---|---|
| 제품 정의·계산·데이터·미션·화면 흐름 | `docs/설계안_v0.1.md` (1-1 판정, 6-14~6-17 시각·배치 개정 포함) |
| 화면 UI 표현 | `docs/UI_DESIGN_SYSTEM.md` |
| 공개 범위·남겨 둔 알려진 문제 | `docs/release/RELEASE_READINESS.md` 1·8절 |
| 데이터 이용조건 표기 | `DATA_LICENSE.md` |

위 문서를 바꾸는 결정이 새로 승인되면 그 문서를 고치고, 여기에는 한 줄(날짜·무엇·어디를 고쳤는지)만 남긴다.

### 운영 결정 (사용자 승인)

#### D-001 범용 AI 개발 플로우 v1.0 적용 — 2026-10-10 · 승인: 사용자 요청 · **D-003으로 대체**

- 결정: 사용자의 범용 AI 개발 플로우 v1.0(`misty-hollow/AI-Dev-Workflow` `d2fa431`)을 이 저장소에 적용한다. 실행 규칙은 `CLAUDE.md`.
- 이유: 사용자 요청(2026-10-10). 기능·데이터·UI·제품 설계는 바꾸지 않고 운영 체계만 더한다.
- 범위: CLAUDE.md, 이 파일, docs/REPORT.md, `.claude/settings.json`, `.claude/agents/`, CI 트리거·동시성 보완.

#### D-002 CI를 작업 브랜치 push에서도 돌린다 — 2026-10-10 · **D-005로 대체(2026-10-12)**

- 결정: 기존 CI 세 job(repository·pipeline·app)과 검사 내용은 그대로 두고, 트리거에 `gh-pages`를 뺀 모든 브랜치의 push를 더한다.
  main push 실행은 다음 push가 와도 취소하지 않는다.
- 이유: 플로우는 PR 생성 전에 작업 브랜치 head 커밋의 CI를 확인한다(WORKFLOW 3절 9단계). 기존 CI는 main push와 PR에서만 돌았다.
  `gh-pages`는 빌드 산출물만 있는 운영 배포 브랜치라 CI 대상이 아니다.

#### D-003 공통 AI 개발 플로우 v1.2 적용 — 2026-10-12 · 승인: 사용자 요청

- 결정: 공통 규칙 원본 v1.2(`6eee919`)의 CONSTITUTION·WORKFLOW·PROJECT_TEMPLATE 사본을 `docs/ai-dev-workflow/`에 두고,
  `CLAUDE.md`는 첫 줄 사본 참조 + PROJECT_TEMPLATE A~I절의 프로젝트 값만 담는다. v1.1은 따로 적용하지 않았다.
- 이유: 사용자 요청(2026-10-12). 게임 기능·UI·계산 의미·데이터는 바꾸지 않는다.
- 보존: 제품 설계·UI 디자인 시스템·데이터 이용조건·접근성 기준, 운영 배포(`gh-pages`)·데이터 재생성·`pipeline/cache/`의 승인 규칙, 고위험 파일·영역 목록.
- 없앤 충돌(v1.0 CLAUDE.md → 사본): 리뷰 전 push 금지와 "push 1회", 작업 브랜치 push CI 확인 후 PR 생성, 1·2·3회 실패 처리,
  리뷰 원문을 REPORT.md에 붙이기, "UI 확인 = 사람"(→ ①② AI, ③ 사람), 잠정 squash 병합(D-004).

#### D-004 병합 방식 = merge commit — 2026-10-12 · 승인: 사용자 요청

- 결정: `gh pr merge <N> --merge --match-head-commit <sha>`. v1.0 CLAUDE.md 7절의 「squash — 잠정」(PR #3~#13이 squash였던 것을 유지한 임시 값)을 대체한다.
- 이유: 공통 PROJECT_TEMPLATE v1.2 F절의 병합 방식이 merge commit이고, 사용자가 v1.2에 맞추라고 지시했다.
- 서버: 룰셋 "Protect main"의 허용 병합 방식은 merge·squash·rebase(2026-10-12 조회). merge만 남길지는 사용자 설정 사항이다.

#### D-005 CI 트리거 = PR + main push — 2026-10-12 · 승인: 사용자 요청

- 결정: `pull_request`(base main)와 main `push`, 수동 `workflow_dispatch`에서만 돈다. 작업 브랜치 push 트리거(D-002)를 없앤다.
  세 job과 검사 내용·이름(`repository`·`pipeline`·`app` = 필수 체크)은 그대로, 경로 필터 없음.
- 이유: v1.2는 완료·병합 조건을 "PR 최신 변경의 필수 체크"로 통일하고 작업 브랜치 push CI를 없앴다(원본 CHANGELOG v1.2 "효율").
  PR이 열린 브랜치에 push하면 PR 실행 하나만 돌아 같은 커밋의 중복 실행이 없어진다.
- 영향: PR을 열기 전 작업 브랜치 push에서는 CI가 돌지 않는다. 그 사이의 확인은 B절 로컬 검증이 맡는다.

## 기술 결정 (AI 위임)

#### T-001 기존 브라우저 QA 하네스를 실행 검증 ①②의 수단으로 쓴다 — 2026-10-12

- 결정: `app/scripts/browser-qa.mjs`(`npm run qa:browser`)를 그대로 쓰고, 재현에 필요한 최소 수정만 했다:
  예외로 멈춘 묶음도 FAIL과 `fail-<묶음>.png`를 남기고 `report.json`에 재현 조건(`meta`)을 적는다.
  PR #11·#13의 승인된 문구·화면 변경을 따라가지 못한 기대값 6곳을 현재 문구로 바꿨다(검사 의미 유지, 전후는 REPORT.md).
- 거부한 대안: 다른 프로젝트 하네스 복사, 새 범용 하네스(사용자 지시로 제외). playwright-core를 devDependency로 고정(의존성 추가 = 고위험,
  CI `npm ci` 영향) — 대신 `--no-save` 설치 버전을 CLAUDE.md B절에 고정해 적었다.

#### T-002 독립 리뷰에 목표·기준을 넘기는 방법 — 2026-10-12

- 결정: 고위험 리뷰는 `/codex:adversarial-review --wait --base main --cwd <worktree> <요약>`을 기본으로 한다.
- 이유: 플러그인 1.0.6 소스에서 확인 — 리뷰 입력은 `git log --oneline`(커밋 제목만)과 diff이고 커밋 본문은 넘어가지 않는다.
  `/codex:review`는 focus 문장을 받지 않는다. adversarial-review만 명령 뒤 문장을 프롬프트에 넣는다. 세션 작업 폴더가 main 체크아웃이라 `--cwd`가 필요하다.

#### T-003 로컬 CLI 검증의 필요 조건은 "모든 변경"으로 둔다 — 2026-10-12

- 결정: CLAUDE.md B절의 위생·구문·린트·테스트·verify·빌드 행은 변경 범위와 무관하게 필요하다.
- 이유: v1.0 CLAUDE.md의 "바꾼 범위와 무관하게 필수 검증 전체"보다 약하게 만들지 않는다. 전체 실행이 몇 분이라 비용이 작다.
