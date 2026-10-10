# CLAUDE.md — Shrinking City Lab 개발 운영 규칙

이 파일은 사용자의 범용 AI 개발 플로우 v1.0(원본 `misty-hollow/AI-Dev-Workflow` `d2fa431`의 CONSTITUTION.md·WORKFLOW.md·
PROJECT_TEMPLATE.md)을 이 저장소의 실행 규칙으로 옮긴 것이다. 원칙이 이 파일과 다르게 읽히면 원본 헌법을 따르고, 차이는
docs/REPORT.md에 적는다. 이 파일은 **개발 운영**만 다룬다. 제품 기준은 아래 문서가 정한다.

- 제품·계산·데이터·미션 의미: `docs/설계안_v0.1.md`
- 화면 UI 표현: `docs/UI_DESIGN_SYSTEM.md`
- 공개·배포 준비: `docs/release/RELEASE_READINESS.md`
- 데이터 이용조건: `DATA_LICENSE.md`

## 1. 세션 시작

작업 전에 반드시 읽는다: 이 파일 → `docs/DECISIONS.md` → `docs/REPORT.md`(맨 위 3줄) → `git status`·현재 브랜치·열린 PR.
REPORT.md의 `다음 할 일`이 사용자 입력을 기다리면 그 입력이 왔는지 먼저 확인한다.

작업 트리에 사용자가 커밋하지 않은 변경·추적되지 않은 파일이 있으면 **건드리지 않는다**(stash·restore·checkout·삭제 금지).
그 위에서 작업해야 하면 `origin/main`에서 별도 worktree를 만든다.

## 2. 역할과 실행 체인

- 사용자: 목표, 제품 방향·기능 범위·UX 결정, 실제 화면·플레이 확인, 병합·배포 승인. **기술 판단과 모델 선택은 묻지 않는다.**
- 메인(Claude Code 세션): 조사·설계·위험도 판정·구현·검증·판정·보고. 작은 작업은 직접 한다.
- 구현 서브에이전트 `.claude/agents/implementer.md`: 분리 이점이 있는 큰 구현만.
- 리뷰 서브에이전트 `.claude/agents/reviewer.md`: 저위험 변경 검토가 필요할 때만. 읽기 전용.
- 독립 리뷰(Codex): 고위험 변경. 사용자가 명령을 입력한다(4절).
- GitHub Actions: 테스트·린트·빌드만. AI 호출 없음.

목표를 받으면 멈추지 않고 진행한다.

1. 조사 → 2. 설계(제품 결정이 필요하면 선택지·권고안을 들고 여기서만 질문) → 3. 작업 브랜치 생성(main에서 작업하지 않는다)
→ 4. 구현 → 5. 로컬 필수 검증(3절) → 6. 작업 브랜치에 중간 commit(완료 아님, push 안 함)
→ 7. 리뷰(저위험: 필요 시 리뷰 서브에이전트 / 고위험: REPORT.md에 `결과: 결정 필요`와 독립 리뷰 명령을 적고 세션 종료)
→ 8. push 한 번 → 9. CI 확인(gh로 직접 기다림) → 10. REPORT.md 작성 → 11. PR 생성(본문에 REPORT.md 맨 위 3줄) → 12. 종료 보고

멈추는 경우는 제품 결정, 독립 리뷰 명령 입력, 승인 대상 행동(6절) 직전뿐이다.
사용자가 그 요청에서 PR 생성을 명시하면 고위험이라도 push·PR을 하되, REPORT.md와 PR 본문에 "독립 리뷰 전, 병합 금지"를 적는다.

## 3. 필수 검증 명령

CI(`.github/workflows/ci.yml`, ubuntu-24.04)의 세 job과 같다. 로컬은 Windows + Git Bash.

| 종류 | 명령 | 비고 |
|---|---|---|
| 저장소 위생 | `git diff --check origin/main...HEAD` | gitleaks는 CI(docker)에서만 |
| 배포 스크립트 구문 | `for f in deploy/*.sh; do bash -n "$f"; done` · `python -m py_compile deploy/smoke_web.py` | 실행하지 않고 구문만 |
| 파이프라인 린트 | `cd pipeline && python -m ruff check . && python -m ruff format --check .` | |
| 파이프라인 테스트 | `cd pipeline && python -m pytest -q` | |
| 데이터 재현 | `cd pipeline && python -m scl_pipeline verify` | 임시 폴더에서 다시 만들어 바이트 대조. 저장소 파일을 바꾸지 않는다 |
| 앱 타입체크·빌드 | `cd app && npm ci && npm run build` | `build` = `tsc -b && vite build` |
| 앱 테스트 | `cd app && npm test` | `vitest run`. watch 모드(`test:watch`) 금지 |
| 뿌리 기준 빌드 smoke | CI `app` job의 마지막 단계 | Linux 셸 전제라 CI에서 확인 |
| UI 확인 | 사람(5절). `npm run qa:browser`는 Edge·WebGL이 필요한 사람 보조 도구 | CI 밖 |

- 파이썬은 3.12. 편집 설치(`pip install -e ".[dev]"`)는 **이 작업 트리 전용 venv**에 한다. 다른 체크아웃의 venv를 이 트리로 바꿔 꽂지 않는다.
- 바꾼 범위와 무관하게 필수 검증 전체를 돌린다. 못 돌린 것은 REPORT.md "수행하지 못한 검증과 영향"에 적는다.

## 4. 위험도와 독립 리뷰

위험도는 파일 위치가 아니라 실제 영향으로 정한다. 공통 기준과 프로젝트 기준 중 하나라도 고위험이면 고위험.
변경 후 REPORT.md에 `위험도: 저/고, 근거` 한 줄을 적고 사용자에게 묻지 않는다.

**공통 기준**: 새 테스트·새 CI 검사 추가, 문구·주석 수정 = 저위험. 기존 테스트의 기준 약화·삭제·건너뛰기, 기존 CI 검사의
제거·우회·조건 완화, 빌드 결과물·배포 대상·패키징·의존성 추가·교체, 보안·권한·결제·데이터 무결성·외부 전송,
메인이 영향 범위를 확신하지 못하는 변경 = 고위험.

**고위험 파일(어떤 수정이든)**
- `app/src/engine/**` — KPI 엔진. 파이썬 `model.py`와 같은 정의, 골든 값 대조
- `pipeline/scl_pipeline/**` — 단계 코드 해시(`provenance.step_code_sha256`)를 verify가 대조한다. 고치면 그 단계를 다시 돌려야 한다
- `pipeline/data.lock.json`, `pipeline/derived/**`, `pipeline/sources/**`, `pipeline/osrm/**`, `pipeline/reports/**`, `app/public/data/**`
- `app/src/content/forbidden.test.ts`와 금지어 목록, `app/src/state/results.ts`(미션 결과·판정 보관)
- `deploy/**`, `.github/workflows/**`, `.gitleaks.toml`, `.gitattributes`(LF 고정 = 바이트 재현)
- `app/package.json`, `app/package-lock.json`, `pipeline/pyproject.toml`, `app/vite.config.ts`, `app/tsconfig*.json`
- `LICENSE`, `DATA_LICENSE.md`, `app/public/licenses/**`, S8 「자료와 한계」의 출처·이용조건 표기
- `.claude/settings.json`, `.claude/agents/**`, 이 파일의 2·4·6·7절

**고위험 영역(파일과 무관)**
- 계산 의미: `A_i = min(5, 기준시간 안 지소 진료일 합)`, KPI 6개 정의, 미션 목표치·판정 경계, 참고 배분·배분 지형도
- 결정성·재현성: 원본부터 다시 만들면 추적 파일이 바이트 동일해야 한다
- 데이터 출처·이용조건·재배포: 공주시 원본 xlsx·페이지 발췌는 저장소에 들어오면 안 된다
- 제품 원칙 「정책을 추천하지 않는다」(설계안 1-2·2-7·5-12): 금지어 검사 완화, 추천처럼 읽히는 문구 체계 변경
- 런타임 외부 호출: 앱은 정적 파일만 읽는다. 외부 API·지도 타일·추적·분석 스크립트 추가
- 접근성 보장(움직임 줄이기, 스크린리더 문장) 제거

**예외(공통 기준보다 우선, 저위험)**
- `docs/release/*.md`의 상태 기록 갱신, README 오탈자
- `app/src/content/copy.ts`의 문구 수정으로 금지어 테스트를 그대로 통과하는 것(문구 톤은 사용자 확인 항목)

**독립 리뷰 명령**(사용자가 입력, 모델 자동 호출 불가): `/codex:review --base main`
더 공격적인 관점이 필요하면 `/codex:adversarial-review --base main`. 리뷰 도구는 로컬 git 상태를 읽으므로 push 전 중간 commit만으로 된다.
지적은 필수/선택으로 나눠 필수만 반영하고, 변경 부분을 다시 검증하고, 리뷰 원문을 REPORT.md에 붙인다.
제품 동작이나 승인된 설계가 바뀌는 수정은 사용자에게 다시 결정받는다. 리뷰 통과 전에는 `완료`를 쓰지 않고 병합하지 않는다.

## 5. 사용자 직접 확인 항목

자동 테스트로 확정하지 않는다. 보고서에 "어느 화면에서 무엇을 보고 판단할지"를 적는다.
- 3D 무대(빛·집·진료등 탑·길의 빛)의 모양과 읽힘, HUD 배치, 모바일(<768) 안내 화면
- 한 판의 흐름·난이도·재미(S0→S6), 미션 판정이 납득되는지 — `docs/release/PLAYTEST.md`
- 소리 — `docs/release/SOUND_QA.md`
- 문구 톤(교육용, 추천하지 않음), 전시 기기 성능, 키오스크 90초 복귀

## 6. 승인 필요 행동

승인 없이 하지 않고, 한 승인을 다른 행동으로 넓히지 않는다. 승인이 필요한 단계 전까지 안전한 작업은 모두 마치고 묻는다.

- 헌법 공통: API 과금, 크레딧 구매, 유료 서비스 활성화, 운영 배포, 외부 공개, 자격증명 변경, 이력 재작성, 되돌릴 수 없는 삭제
- **운영 배포 = `gh-pages` 브랜치 push**(geoleobom.kr, GitHub Pages)와 그 되돌리기. VPS 경로(`deploy/deploy_geoleobom.sh`,
  걸어봄 저장소 `rollback.sh`, `ssh geoleobom`)도 같다. `deploy/dryrun_local.sh`는 docker를 쓰므로 승인 후
- **데이터 재생성**: `scl_pipeline`의 `fetch`·`import`·`boundaries`·`osm`·`route`·`routes`·`terrain`·`build`·`check-mois`·`all`.
  허용은 `verify`뿐. docker·OSRM·네트워크를 쓰는 단계 전부
- `pipeline/cache/` 삭제·이동(충청권 OSM 추출본·공주시 원본은 다시 받을 수 없다)
- GitHub 저장소 설정 변경(브랜치 보호, Pages, 기본 브랜치, 비밀값), DNS·도메인 인증 TXT
- 공주시·기관 문의 등 외부로 보내는 연락, 원본 자료의 공개

## 7. 브랜치·커밋·병합

| 항목 | 값 |
|---|---|
| 기본 브랜치 | `main` — 직접 commit·push 금지 |
| 작업 브랜치 | `feat/…` `fix/…` `docs/…` `design/…` `data/…` `chore/…` |
| 커밋 메시지 | 변경 요약(기존 이력처럼 `fix(data): …` 형식 권장) |
| push·PR | 작업 브랜치 push와 PR 생성은 상시 허용 |
| 병합 | 사용자가 "PR #N 병합해"라고 지시했을 때만 |
| 병합 방식 | squash — **잠정**. PR #3~#9가 모두 squash라 기존 방식을 유지했다. 헌법 기본값은 merge commit이며 사용자 확인 대기(docs/REPORT.md) |
| up-to-date 필수 | 켬(권장, 서버 설정은 사용자가 적용) |
| head 브랜치 자동 삭제 | 켬(권장, 서버 설정은 사용자가 적용) |

병합 전 확인: PR 번호·base, 최신 head 커밋의 CI(push·PR 실행) 전부 성공, 고위험이면 독립 리뷰가 최종 변경까지 다뤘는지.
up-to-date 조건이 있으면 main을 작업 브랜치에 merge(rebase 아님) 후 CI 재확인. 확인한 head 커밋에 고정해
`gh pr merge <N> --squash --match-head-commit <sha>`. `--admin`·`--auto`·API 우회 금지. 병합 후 로컬 브랜치만 `git branch -d`.

## 8. 실패 처리

같은 문제에 대해 1회: 원인 분석 후 수정. 2회: 가설을 버리고 `/codex:rescue`에 "읽기 전용 진단, 코드 수정 금지, 원인·근거·재현·
수정 제안만 보고"를 명시해 위임. 호출 전후 `git status`·`git diff`를 비교하고, 변경이 있으면 보고하고 검토 없이 채택하지 않는다.
3회: 수정 중단, REPORT.md를 `차단됨` 또는 `결정 필요`로 바꾸고 원인 추정·시도·선택지·권고안을 적고 종료.
테스트 약화, 원인 은폐, 임시방편을 완료로 보고하지 않는다.

## 9. 기록

- `docs/DECISIONS.md`: 승인된 결정과 이유만. 제품 결정의 원본은 설계안·UI_DESIGN_SYSTEM이고, DECISIONS.md는 그 위치와 운영 결정을 적는다.
- `docs/REPORT.md`: 현재 작업 상태. 맨 위 `작업`/`결과`/`다음 할 일` 3줄, 결과는 `완료`·`검증 대기`·`결정 필요`·`차단됨` 중 하나.
  마지막 코드 변경 커밋의 CI 결과까지만 적는다. 보고서만 고친 push의 CI는 확인만 하고 다시 쓰지 않는다. CI에 경로 기반 생략 조건을 두지 않는다.
- CI 결과는 메인이 `gh run list`·`gh run watch`로 직접 확인한다. 확인하지 못하면 `검증 대기`. 사용자에게 CI 화면을 보라고 하지 않는다.
- 직접 확인한 것과 문서·보고로만 아는 것을 구분해 쓴다.

## 10. 도구·모델 (2026-10-10 확인)

| 항목 | 값 |
|---|---|
| 메인 기본 모델 | 사용자 설정 `opus` → 이 세션에서 `claude-opus-5-5`로 확인 |
| 고난도 설계 모델 | 사용자가 "이번은 ○○로"라고 지정한 경우에만. 자동 전환을 가정하지 않는다 |
| 서브에이전트 | `.claude/agents/implementer.md`(model: inherit), `.claude/agents/reviewer.md`(model: sonnet) |
| 독립 리뷰 | Codex 플러그인 `codex@openai-codex` 1.0.6, Codex CLI 0.162.1, ChatGPT 구독 로그인 |
| 진단 | `/codex:rescue`(기본 쓰기 가능 — 진단 전용 명시와 전후 diff 비교 필수) |
| 자동 리뷰 게이트 | 끔(플러그인 기본값 `stopReviewGate: false`). 켜지 않는다 |
| CI 실패 자동 수정 | 끔. 켜지 않는다 |
| 권한 규칙 | `.claude/settings.json`(deny/ask). 메인은 이 파일과 `settings.local.json`을 고치지 않는다 — 사용자가 고친다 |

## 11. 커밋 제외

`.claude/settings.local.json`과 백업, 인증 정보·토큰·`.env*`, `pipeline/cache/`, 공주시 원본 xlsx·페이지 발췌, `qa-shots/`.
`.claude/` 아래 파일은 개별 경로로만 `git add` 한다(`git add .claude/`·`git add -A` 금지). 사용자가 추적하지 않은 채 둔
`.claude/skills/`, `.agents/`, `skills-lock.json`, `STATUS.md`는 사용자가 정하기 전까지 커밋하지 않는다.
