작업: 범용 AI 개발 플로우 v1.0을 저장소에 적용(운영 문서·권한 규칙·서브에이전트·CI 트리거 보완)
결과: 결정 필요
다음 할 일: `chore/dev-flow-ci`가 체크아웃된 폴더(현재 worktree `C:\Users\sdsdo\Documents\shrinking-city-lab-devflow`)에서 연 Claude Code 세션에 `/codex:review --base main` 입력 — 독립 리뷰 전 병합 금지. 그와 별개로 아래 "사용자가 할 일" 1~3

## 위험도: 고, `.claude/settings.json`(권한 규칙)과 CI 트리거·동시성 변경이 공통 기준 "보안·권한", CLAUDE.md 4절 고위험 파일(`.github/workflows/**`, `.claude/**`)에 해당

## 핵심 변경

- `CLAUDE.md` 신설: 세션 시작 순서, 실행 체인, 필수 검증 명령(CI 세 job과 동일), 이 프로젝트의 고위험 파일·영역·예외,
  사용자 확인 항목, 승인 필요 행동(gh-pages 운영 배포, 데이터 재생성 단계, `pipeline/cache/` 삭제, GitHub 설정), 병합·실패 처리, 도구·모델 기록
- `docs/DECISIONS.md` 신설: 제품 결정의 원본(설계안·UI_DESIGN_SYSTEM·RELEASE_READINESS·DATA_LICENSE) 위치와 운영 결정 D-001·D-002
- `.claude/settings.json` 신설(기존 프로젝트 권한 설정 없음): deny = main push·강제 push·브랜치 삭제 push·`--no-verify`·`reset --hard`·
  `gh pr merge --admin/--auto`·`pipeline/cache` 삭제·권한 우회 옵션·설정 파일 편집·인증 파일 읽기, `disableBypassPermissionsMode`.
  ask = `gh pr merge`, gh-pages push, 배포·예행연습·롤백 스크립트, `ssh`, `docker`, `scl_pipeline`의 재생성 단계(`verify` 제외), 이력·작업 트리 변경 git 명령, `gh api` 쓰기
- `.claude/agents/implementer.md`(model: inherit), `.claude/agents/reviewer.md`(읽기 전용, model: sonnet)
- CI: 세 job·검사 내용 그대로. 트리거에 `gh-pages`를 뺀 모든 브랜치 push 추가, `cancel-in-progress`를 main 외에서만
- `.gitignore`: `.claude/settings.local.json` 제외. `README.md`: 운영 문서 위치 한 줄

기능·데이터·UI·제품 설계·테스트는 바꾸지 않았다.

## 변경 파일

`CLAUDE.md`(신규) · `docs/DECISIONS.md`(신규) · `docs/REPORT.md`(신규) · `.claude/settings.json`(신규) · `.claude/agents/implementer.md`(신규) ·
`.claude/agents/reviewer.md`(신규) · `.github/workflows/ci.yml` · `.gitignore` · `README.md`

## 로컬 검증 결과 (Windows, 별도 worktree, 커밋 `35b74ce`의 내용)

| 검사 | 결과 |
|---|---|
| `git diff --check` | 통과 |
| `bash -n deploy/*.sh` · `py_compile deploy/smoke_web.py` | 통과 |
| `ruff check .` · `ruff format --check .` | 통과(23 files already formatted) |
| `pytest -q` | 21 passed |
| `python -m scl_pipeline verify` | 불변식·잠금(12개)·재현 PASS. WARN 2건은 기존 `manifest.known_issues` |
| `npm ci` · `npm run build` | 통과 |
| `npm test` | 9 files, 134 passed |
| `ci.yml` YAML 파싱 | 통과(트리거·concurrency·job 이름 repository/pipeline/app 확인) |

## CI 결과 (커밋 `35b74ce32d17cb0ccda7e33c3a5757fa808f0056`)

- push 실행 [38018443978](https://github.com/misty-hollow/shrinking-city-lab/actions/runs/38018443978): success — repository · pipeline · app 모두 success.
  새 트리거(작업 브랜치 push)가 실제로 동작함을 이 실행으로 확인했다.

## 수행하지 못한 검증과 영향

- **권한 규칙이 새 세션에서 실제로 로드되는지 미확인.** 이 세션은 main 체크아웃에서 시작해 worktree의 `.claude/settings.json`을 읽지 않는다.
  병합 후 새 세션에서 `/permissions`로 deny·ask 목록이 보이는지 확인해야 한다. `PowerShell(...)` 규칙의 와일드카드 동작도 같은 방법으로 확인 필요.
- **gh-pages 제외 동작 미확인.** 다음 운영 릴리스 push 때 CI가 돌지 않는지 확인한다(돌면 실패로 보일 뿐 배포에는 영향 없음).
- 뿌리 기준 빌드 smoke는 CI에서만 확인(로컬 미실행). gitleaks도 CI에서만.
- 서브에이전트 정의가 다음 세션에서 로드·호출되는지 미확인(헌법 CHANGELOG의 "검증되지 않은 전제"와 같음).

## 독립 리뷰 원문과 조치 결과

아직 없음. 고위험이므로 `/codex:review --base main` 결과를 받은 뒤 여기에 원문과 필수/선택 조치를 적는다.

## 미해결 문제

1. **GitHub 브랜치 보호 없음**(2026-10-10 `gh api` 조회): `branches/main/protection` → 404 "Branch not protected", 룰셋 0개,
   `deleteBranchOnMerge: false`. 서버 수준 보호가 비어 있다. 설정 명령은 아래 "사용자가 할 일" 1.
2. **병합 방식 충돌**: 헌법 기본값은 merge commit, 이 저장소는 PR #3~#9 모두 squash. CLAUDE.md 7절에 squash를 잠정 값으로 두었다. 사용자 확인 필요.
3. **기본 모델**: 헌법은 "실용 모델 하나를 기본"으로 두지만 사용자 설정은 `opus`(= claude-opus-5-5)다. 사용자 설정을 그대로 기록했고 바꾸지 않았다.
4. **main 체크아웃의 진행 중 작업**: 수정 18개 파일, 추적 안 된 `STATUS.md`·`.claude/skills/`·`.agents/`·`skills-lock.json`·`app/src/ui/feedback*.ts`.
   이번 작업은 건드리지 않았다. `STATUS.md`의 "확정" 항목(교육 대상 등)을 DECISIONS.md로 옮길지는 그 파일이 커밋된 뒤 사용자가 정한다.
   이 PR이 병합된 뒤 main 체크아웃에서 `git pull`하면 `.claude/settings.json`·`.claude/agents/`가 기존 추적 안 된 `.claude/skills/` 옆에 생긴다(같은 이름 파일이 없어 충돌 없음).
5. draft PR #8(`docs/production-pages`)은 그대로 두었다.

## 사용자가 할 일

1. main 보호 적용(직접 실행 — 메인은 GitHub 설정을 바꾸지 않는다). Git Bash에서:
   ```
   gh api -X PUT repos/misty-hollow/shrinking-city-lab/branches/main/protection --input - <<'EOF'
   {"required_status_checks":{"strict":true,"checks":[{"context":"repository"},{"context":"pipeline"},{"context":"app"}]},
    "enforce_admins":true,"required_pull_request_reviews":{"required_approving_review_count":0},
    "restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
   EOF
   gh repo edit misty-hollow/shrinking-city-lab --delete-branch-on-merge
   ```
2. `/codex:review --base main` 입력 — main 체크아웃이 아니라 worktree `shrinking-city-lab-devflow`에서 연 세션에서(리뷰 도구는 로컬 git 상태를 읽는다).
3. 병합 방식(squash 유지 / merge commit) 답변.
4. 병합 후 새 세션에서 `/permissions`로 권한 규칙 로드 확인.

## commit 해시

- `35b74ce` 운영 규칙·권한·서브에이전트·CI 트리거(마지막 코드 변경 커밋)
- 이 보고서 커밋은 CI 확인만 하고 여기에 다시 적지 않는다
