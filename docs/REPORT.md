작업: 범용 AI 개발 플로우 v1.0을 저장소에 적용(운영 문서·권한 규칙·서브에이전트·CI 트리거 보완) + Codex P2 조치
결과: 결정 필요
다음 할 일: worktree `C:\Users\sdsdo\Documents\shrinking-city-lab-devflow`에서 연 세션에 `/codex:review --base main` 재입력(P2 수정분 `82b5e11`까지 독립 리뷰가 덮도록) — 그 전 병합 금지. 별개로 아래 "사용자가 할 일" 1(main 보호, 미완료)

## 위험도: 고, `.claude/settings.json`(권한 규칙)과 CI 트리거·동시성 변경이 공통 기준 "보안·권한", CLAUDE.md 4절 고위험 파일(`.github/workflows/**`, `.claude/**`)에 해당

## 핵심 변경

- `CLAUDE.md` 신설: 세션 시작 순서, 실행 체인, 필수 검증 명령(CI 세 job과 동일), 이 프로젝트의 고위험 파일·영역·예외,
  사용자 확인 항목, 승인 필요 행동(gh-pages 운영 배포, 데이터 재생성 단계, `pipeline/cache/` 삭제, GitHub 설정), 병합·실패 처리, 도구·모델 기록
- `docs/DECISIONS.md` 신설: 제품 결정의 원본(설계안·UI_DESIGN_SYSTEM·RELEASE_READINESS·DATA_LICENSE) 위치와 운영 결정 D-001·D-002
- `.claude/settings.json` 신설(기존 프로젝트 권한 설정 없음): deny = main push·강제 push·브랜치 삭제 push·`--no-verify`·`reset --hard`·
  `gh pr merge --admin/--auto`·`pipeline/cache` 삭제·권한 우회 옵션·설정 파일 편집·인증 파일 읽기, `disableBypassPermissionsMode`.
  ask = `gh pr merge`, gh-pages push, 배포·예행연습·롤백 스크립트, `ssh`, `docker`, `scl_pipeline`의 재생성 단계(`verify` 제외), 이력·작업 트리 변경 git 명령, `gh api` 쓰기
- Codex P2 조치(`82b5e11`): `.claude/settings.json`에 fully qualified refspec·전역 옵션 push 형태를 추가만 했다(deny 46→60, ask 39→43, 삭제 0).
  설정 파일은 deny `Edit(.claude/settings.json)` 때문에 메인이 고치지 못해, 메인이 수정본을 만들고 사용자가 직접 복사해 적용했다(우회하지 않음)
- `.claude/agents/implementer.md`(model: inherit), `.claude/agents/reviewer.md`(읽기 전용, model: sonnet)
- CI: 세 job·검사 내용 그대로. 트리거에 `gh-pages`를 뺀 모든 브랜치 push 추가, `cancel-in-progress`를 main 외에서만
- `.gitignore`: `.claude/settings.local.json` 제외. `README.md`: 운영 문서 위치 한 줄

기능·데이터·UI·제품 설계·테스트는 바꾸지 않았다.

## 변경 파일

`CLAUDE.md`(신규) · `docs/DECISIONS.md`(신규) · `docs/REPORT.md`(신규) · `.claude/settings.json`(신규) · `.claude/agents/implementer.md`(신규) ·
`.claude/agents/reviewer.md`(신규) · `.github/workflows/ci.yml` · `.gitignore` · `README.md`

## 로컬 검증 결과 (Windows, 별도 worktree, 커밋 `82b5e11`의 내용 — `35b74ce` 때와 같은 결과)

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
| `.claude/settings.json` JSON 파싱·기존 규칙 보존 비교 | 통과(삭제·약화 0, deny·ask 중복 0) |

## CI 결과 (커밋 `82b5e11a9eff07d6c11ed8d9b889ab6ffade3290`, 마지막 코드 변경)

- push 실행 [38019601010](https://github.com/misty-hollow/shrinking-city-lab/actions/runs/38019601010): success — repository · pipeline · app 모두 success
- PR 실행 [38019603842](https://github.com/misty-hollow/shrinking-city-lab/actions/runs/38019603842): success
- 이전 코드 커밋 `35b74ce`의 push 실행 38018443978도 success였다(작업 브랜치 push 트리거 동작 확인)

## 수행하지 못한 검증과 영향

- **ask 규칙(gh-pages 승인, `git -C … push`)의 매칭은 미확인 — 새 세션 재확인 필요.** 이 세션은 auto 모드라 ask 규칙이 승인 창 대신 자동 판정된다.
  수정 전부터 있던 ask 규칙(`git push * gh-pages`)도 승인 창 없이 실행돼서, 새 ask 규칙이 걸렸는지 이 세션에서는 구분할 수 없다.
  기본 권한 모드의 새 세션에서 `git push --dry-run nosuchremote HEAD:refs/heads/gh-pages`가 승인 창을 띄우는지 확인해야 한다(존재하지 않는 원격이라 승인해도 배포되지 않는다).
  **auto 모드에서는 ask가 사람 승인을 보장하지 않는다.** 이때 배포 승인은 CLAUDE.md 6절(운영 원칙)에 기대고, 서버 보호는 main만 지킨다.
- deny 규칙은 이 세션에서 실측했다(아래 독립 리뷰 절). 다만 문자열 패턴이라 모든 변형을 막는다고 단정하지 않는다:
  인자 없는 `git push`(현재 브랜치가 main을 추적할 때), 셸 별칭·스크립트 안의 push, `git -c … push origin main`(ask로만 처리)은 남는다. **GitHub 서버의 main 보호가 따로 필요하다.**
- **gh-pages 제외 동작 미확인.** 다음 운영 릴리스 push 때 CI가 돌지 않는지 확인한다(돌면 실패로 보일 뿐 배포에는 영향 없음).
- 뿌리 기준 빌드 smoke는 CI에서만 확인(로컬 미실행). gitleaks도 CI에서만.
- 서브에이전트 정의는 이 세션 목록에 로드된 것을 확인했지만 실제 호출은 하지 않았다.

## 독립 리뷰 원문과 조치 결과

### 1차 — `/codex:review --base main` (2026-10-10, 대상: `c654ad8`까지, Codex 스레드 01a123bf-b188-7132-b4ef-04099f683db1)

원문:

```
# Codex Review

Target: branch diff against main

The permission configuration misses standard fully qualified push refspecs, leaving the intended main protection and deployment approval gates incomplete. The CI changes otherwise appear sound.

Review comment:

- [P2] Cover fully qualified destination refs in push permissions — C:\Users\sdsdo\Documents\shrinking-city-lab-devflow\.claude\settings.json:9-10
  Commands such as `git push origin HEAD:refs/heads/main` and `git push origin HEAD:refs/heads/gh-pages` match none of the deny or ask rules. Consequently, a session that otherwise permits Git pushes can update main directly or deploy without the intended approval gate. Add matching rules for fully qualified destination refspecs in both shell rule sets, preserving the restrictions in [CLAUDE.md:107–108](CLAUDE.md#L107-L108) and [CLAUDE.md:119](CLAUDE.md#L119).
```

판정: **필수**(사용자 지시). 선택 지적 없음.

조치(`82b5e11`, 기존 규칙 삭제 없음):

| 추가 규칙 | 종류 | 막는 형태 |
|---|---|---|
| `Bash/PowerShell(git push *refs/heads/main)` · `(… *refs/heads/main *)` | deny | `HEAD:refs/heads/main`, `main:refs/heads/main`, 뒤에 옵션이 붙은 형태 |
| `Bash/PowerShell(git push * *:main *)`, `PowerShell(git push * main *)` · `(* HEAD:main *)` | deny | 뒤에 옵션이 붙은 `HEAD:main` 등 |
| `PowerShell(git push *-f)` · `*--mirror*` · `* :*` · `* +*` · `*--no-verify*`, `PowerShell(git commit *--no-verify*)` | deny | Bash에만 있던 규칙을 PowerShell에 맞춤 |
| `Bash/PowerShell(git push *gh-pages*)` | ask | `HEAD:refs/heads/gh-pages`를 포함한 gh-pages refspec 전부 |
| `Bash/PowerShell(git -* push*)` | ask | `git -C <경로> push …`, `git -c … push …`(열거로 막을 수 없는 전역 옵션 형태) |

검증(실제 원격 push·배포 없음 — 모든 probe는 존재하지 않는 원격 `nosuchremote`에 `--dry-run`. 규칙을 통과해도 git이 네트워크 없이 실패한다):

| 명령 | 수정 전 | 수정 후 |
|---|---|---|
| Bash `git push --dry-run nosuchremote HEAD:refs/heads/main` | 통과(git까지 도달) — 지적 재현 | **거부** |
| Bash `… main:refs/heads/main` · `… HEAD:refs/heads/main --verbose` | — | **거부** |
| Bash `… main` · `--force … chore/probe`(기존 규칙 유지 확인) | 거부 | **거부** |
| Bash `… HEAD:refs/heads/maintenance`(오탐 확인) | — | 통과(의도대로) |
| PowerShell `… HEAD:refs/heads/main` · `… HEAD:main --verbose` · `… +chore/probe` | — | **거부** |
| PowerShell `… HEAD:refs/heads/maintenance` | — | 통과(의도대로) |
| Bash·PowerShell `… HEAD:refs/heads/gh-pages`, Bash `git -C . push …` | — | 승인 창 없이 실행 — auto 모드 자동 판정이라 매칭 미확인(위 "수행하지 못한 검증") |

결과: P2의 main 부분은 **해결, 실측 확인**. gh-pages 부분은 **규칙 추가 완료, 매칭은 새 세션에서 재확인 필요**.
수정분도 고위험 파일이므로, 최종 변경까지 독립 리뷰가 덮도록 `/codex:review --base main` 재실행을 다음 할 일로 둔다.

## 미해결 문제

1. **GitHub 브랜치 보호 없음 — 미완료**(2026-10-10 `gh api`로 두 번 조회, P2 조치 뒤에도 그대로): `branches/main/protection` → 404 "Branch not protected", 룰셋 0개,
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
2. `/codex:review --base main` 재입력(P2 수정분 확인용) — main 체크아웃이 아니라 worktree `shrinking-city-lab-devflow`에서 연 세션에서(리뷰 도구는 로컬 git 상태를 읽는다).
3. 병합 방식(squash 유지 / merge commit) 답변.
4. 기본 권한 모드의 새 세션에서 `/permissions`로 규칙 로드 확인, 그리고 gh-pages ask 승인 창 확인(위 "수행하지 못한 검증" 첫 항목).

## commit 해시

- `35b74ce` 운영 규칙·권한·서브에이전트·CI 트리거
- `82b5e11` Codex P2 조치 — 권한 규칙 보완(마지막 코드 변경 커밋)
- 이 보고서 커밋은 CI 확인만 하고 여기에 다시 적지 않는다
