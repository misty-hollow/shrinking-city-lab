작업: 범용 AI 개발 플로우 v1.0을 저장소에 적용(운영 문서·권한 규칙·서브에이전트·CI 트리거 보완) + Codex P2 조치 2회
결과: 결정 필요
다음 할 일: worktree `C:\Users\sdsdo\Documents\shrinking-city-lab-devflow`에서 연 세션에 `/codex:review --base main` 재입력(2차 수정분 `60cf91c`까지 독립 리뷰가 덮도록) — 그 전 병합 금지. 병합 방식(squash/merge commit) 답변도 필요

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
- Codex 2차 P2 조치(`60cf91c`): 승인 필요 작업의 PowerShell 대응 규칙(ask 38개 복제 + PowerShell 고유 삭제 형태 5개), `gh api` 옵션 선두 형태(양쪽 셸 5개씩),
  Bash 전용 deny 12개의 PowerShell 복제. 추가만(deny 60→72, ask 43→91, 삭제 0). 적용 방식은 1차와 같다(사용자 승인 후 직접 복사)
- `.claude/agents/implementer.md`(model: inherit), `.claude/agents/reviewer.md`(읽기 전용, model: sonnet)
- CI: 세 job·검사 내용 그대로. 트리거에 `gh-pages`를 뺀 모든 브랜치 push 추가, `cancel-in-progress`를 main 외에서만
- `.gitignore`: `.claude/settings.local.json` 제외. `README.md`: 운영 문서 위치 한 줄

기능·데이터·UI·제품 설계·테스트는 바꾸지 않았다.

## 변경 파일

`CLAUDE.md`(신규) · `docs/DECISIONS.md`(신규) · `docs/REPORT.md`(신규) · `.claude/settings.json`(신규) · `.claude/agents/implementer.md`(신규) ·
`.claude/agents/reviewer.md`(신규) · `.github/workflows/ci.yml` · `.gitignore` · `README.md`

## 로컬 검증 결과 (Windows, 별도 worktree, 커밋 `60cf91c`의 내용 — `35b74ce`·`82b5e11` 때와 같은 결과)

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

## CI 결과 (커밋 `60cf91c1cf37c0424a19c3b23cc588379940af4c`, 마지막 코드 변경)

- push 실행 [38021441831](https://github.com/misty-hollow/shrinking-city-lab/actions/runs/38021441831): success — repository · pipeline · app 모두 success
- PR 실행 [38021443382](https://github.com/misty-hollow/shrinking-city-lab/actions/runs/38021443382): success
- 이전 코드 커밋 `82b5e11`(push 38019601010 · PR 38019603842), `35b74ce`(push 38018443978)도 success였다(작업 브랜치 push 트리거 동작 확인)

## 수행하지 못한 검증과 영향

- **ask 규칙의 매칭은 미확인 — 기본 권한 모드의 새 세션에서 재확인 필요.** 이 세션은 auto 모드라 ask 규칙이 승인 창 대신 자동 판정된다.
  1차(gh-pages, `git -C … push`)·2차(PowerShell `ssh`·`docker`·`scl_pipeline build`·`gh repo edit`·`gh api --method`) 모두 ask 대상 명령이 승인 창 없이 실행됐고,
  수정 전부터 있던 ask 규칙도 같았으므로 새 규칙이 걸렸는지 이 세션에서는 구분할 수 없다.
  확인 방법(무해): 기본 권한 모드 새 세션에서 `git push --dry-run nosuchremote HEAD:refs/heads/gh-pages`, PowerShell `ssh -V`, PowerShell `gh repo edit --help`가 승인 창을 띄우는지 본다.
  **auto 모드에서는 ask가 사람 승인을 보장하지 않는다.** 이때 배포·재생성·설정 변경의 승인은 CLAUDE.md 6절(운영 원칙)에만 기대고, 서버 보호는 main만 지킨다.
- deny 규칙은 두 차례 모두 이 세션에서 실측했다(아래 독립 리뷰 절). 다만 문자열 패턴이라 모든 변형을 막는다고 단정하지 않는다. 패턴으로 보장할 수 없는 경로:
  - 간접 실행: `bash -c "ssh …"`, `cmd /c …`, `Invoke-Expression`, `& $변수`, `Start-Process`, 파일에 써 둔 스크립트, `npm run`·Makefile 안의 명령,
    `python -c "from scl_pipeline import build_step; …"`, `python pipeline/scl_pipeline/__main__.py build`(`scl_pipeline build`가 붙어 있지 않음)
  - 표기 변형: PowerShell은 대소문자를 가리지 않지만 규칙은 가린다(`SSH geoleobom`, `GH repo edit`). `ssh.exe`·`docker.exe`·절대경로 실행, Remove-Item의 다른 별칭 `ri`·`del`·`erase`,
    공백 두 개(`scl_pipeline  build`), `gh api -fk=v`처럼 값을 붙인 `-f`
  - 셸 밖: MCP 도구(GitHub·브라우저)로 설정 페이지 조작, 서브에이전트, `gh alias`·git alias·git hook, Codex rescue의 쓰기 모드
  - 설정 파일 자체: `Edit`은 막혀 있지만 Bash `cp`·`>`로는 덮어쓸 수 있다(이번에 사용자가 적용한 방법). 운영 원칙(CLAUDE.md 10절)으로만 막힌다
  - 인자 없는 `git push`(현재 브랜치의 upstream으로). 원격을 뺀 `git push main`·`git push HEAD:main`은 git이 첫 인자를 저장소 이름으로 보고 실패하는 것을 실측했으므로 우회가 아니다
  - 매처는 `*`가 공백을 접지 않는다(`git push * +*`가 `git push +HEAD:… --repo …`를 통과시킨 것으로 실측). 옵션 순서가 다른 형태는 규칙마다 따로 적어야 한다
  이 규칙들은 실수를 줄이는 장치이고, **main은 GitHub 서버 보호(룰셋 "Protect main", 2026-10-10 적용)가 지킨다.**
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

### 2차 — `/codex:review --base main` (2026-10-10, 대상: `45cc397`까지)

원문:

```
# Codex Review

Target: branch diff against main

The CI changes appear sound, but the new permission configuration leaves approval-required operations unprotected when invoked through PowerShell.

Review comment:

- [P2] Mirror approval-required commands in PowerShell rules — C:\Users\sdsdo\Documents\shrinking-city-lab-devflow\.claude\settings.json:81-85
  When a session otherwise permits PowerShell execution, commands such as `python -m scl_pipeline build`, `ssh geoleobom`, and `gh repo edit` match none of these Bash-only approval rules. The supported PowerShell tool can therefore regenerate tracked data, access deployment infrastructure, or change repository settings without the configured approval gate. Add equivalent PowerShell rules for the approval-required operations specified in [CLAUDE.md:107–112](CLAUDE.md#L107-L112), rather than protecting only Git push and PR merge in both shells.
```

판정: **필수**(사용자 지시). 선택 지적 없음. 대조 결과 ask 규칙 38개 중 PowerShell 대응이 있는 것은 5개뿐이었다 — 지적 그대로.

조치(`60cf91c`, 사용자가 A+B+C 묶음을 승인, 기존 규칙 삭제 없음):

| 묶음 | 추가 규칙 | 종류 |
|---|---|---|
| A (P2 범위) | Bash 전용 ask 38개를 `PowerShell(...)`로 복제: 배포 스크립트 4·`ssh *`·`docker *`·`scl_pipeline` 9단계·git 7·`rm -rf`/`-fr`·`gh api` 쓰기 5·`gh repo edit`/`secret`/`workflow run`/`pr close` | ask |
| A | PowerShell 고유 삭제 형태: `Remove-Item *-Recurse*`·`Remove-Item *-r *`·`rm *-r*`·`rmdir *`·`rd *` (PowerShell에서 `rm -rf`는 문법 오류라 실제 삭제는 이 형태) | ask |
| C (검사 중 발견) | Bash·PowerShell 각 `gh api *-X*`·`*--method*`·`*--input*`·`*-f *`·`*-F *` — 옵션이 `api` 바로 뒤에 오는 `gh api --method PUT …`가 기존 `gh api * --method *`에 걸리지 않던 것 | ask |
| B (같은 성격) | Bash 전용 deny 11개 복제(`stash drop/clear`·`filter-branch/repo`·`update-ref -d`·`gh repo/release delete`·권한 우회 옵션 3·`refs/heads/main`) + `rm *pipeline*cache*` | deny |

정적 검사: 적용 파일 = 승인 수정안(바이트 동일, SHA-256 `d27fa43b…`), JSON 유효, 삭제 0·순서 유지·중복 0·deny/ask 겹침 0, Bash ask 43개 전부 PowerShell 대응 있음.
대표 명령 50개 시뮬레이션에서 PowerShell 불일치 0. `npm test`·`pytest`·`scl_pipeline verify`·작업 브랜치 push·`gh api`(읽기)는 그대로 통과.

실측(실제 배포·재생성·삭제·GitHub 설정 변경·위험한 git 명령 없음):

| 명령(PowerShell) | 결과 |
|---|---|
| `rm -r pipeline/cache -WhatIf`(걸리지 않아도 WhatIf는 삭제하지 않음) | **거부** |
| `gh repo delete --help` · `git filter-repo -h` · `echo --dangerously-skip-permissions` | **거부** |
| `ssh -V` · `docker --version` · `python -m scl_pipeline build --help`(argparse가 단계 실행 전 종료) · `gh repo edit --help` · `gh api --method GET repos/… --jq .name` | 거부 없이 실행 — ask 매칭은 auto 모드라 관측 불가(위 "수행하지 못한 검증") |

결과: P2의 deny 부분은 **해결, 실측 확인**. ask 부분은 **규칙 추가 완료, 매칭은 새 세션에서 재확인 필요**.
수정분도 고위험 파일이므로, 최종 변경까지 독립 리뷰가 덮도록 `/codex:review --base main` 재실행을 다음 할 일로 둔다.

## 미해결 문제

1. **GitHub 브랜치 보호 — 적용됨**(사용자가 2026-10-10 12:29 룰셋 "Protect main" 생성, `gh api rulesets/24828814`로 조회): 대상 기본 브랜치, enforcement active,
   삭제 금지·non-fast-forward(강제 push) 금지·PR 필수(승인 0명)·필수 체크 `repository`·`pipeline`·`app`(strict = up-to-date 필수), 우회 주체 없음. CI job 이름과 일치.
   classic 보호(`branches/main/protection`)는 404 그대로이며 룰셋 한 곳에만 있다(헌법 CHANGELOG의 "한 곳으로 모으는 것이 유리"와 일치).
   **남은 것**: head 브랜치 자동 삭제 `deleteBranchOnMerge: false`(아래 "사용자가 할 일" 1).
2. **병합 방식 충돌**: 헌법 기본값은 merge commit, 이 저장소는 PR #3~#9 모두 squash. CLAUDE.md 7절에 squash를 잠정 값으로 두었다. 사용자 확인 필요.
3. **기본 모델**: 헌법은 "실용 모델 하나를 기본"으로 두지만 사용자 설정은 `opus`(= claude-opus-5-5)다. 사용자 설정을 그대로 기록했고 바꾸지 않았다.
4. **main 체크아웃의 진행 중 작업**: 수정 18개 파일, 추적 안 된 `STATUS.md`·`.claude/skills/`·`.agents/`·`skills-lock.json`·`app/src/ui/feedback*.ts`.
   이번 작업은 건드리지 않았다. `STATUS.md`의 "확정" 항목(교육 대상 등)을 DECISIONS.md로 옮길지는 그 파일이 커밋된 뒤 사용자가 정한다.
   이 PR이 병합된 뒤 main 체크아웃에서 `git pull`하면 `.claude/settings.json`·`.claude/agents/`가 기존 추적 안 된 `.claude/skills/` 옆에 생긴다(같은 이름 파일이 없어 충돌 없음).
5. draft PR #8(`docs/production-pages`)은 그대로 두었다.

## 사용자가 할 일

1. (main 보호는 룰셋으로 적용됨) head 브랜치 자동 삭제만 남았다. Git Bash에서:
   ```
   gh repo edit misty-hollow/shrinking-city-lab --delete-branch-on-merge
   ```
2. `/codex:review --base main` 재입력(2차 수정분 `60cf91c` 확인용) — main 체크아웃이 아니라 worktree `shrinking-city-lab-devflow`에서 연 세션에서(리뷰 도구는 로컬 git 상태를 읽는다).
3. 병합 방식(squash 유지 / merge commit) 답변.
4. 기본 권한 모드의 새 세션에서 `/permissions`로 규칙 로드 확인, 그리고 ask 승인 창 확인(위 "수행하지 못한 검증" 첫 항목의 무해한 명령 3개).

## commit 해시

- `35b74ce` 운영 규칙·권한·서브에이전트·CI 트리거
- `82b5e11` Codex 1차 P2 조치 — fully qualified refspec
- `60cf91c` Codex 2차 P2 조치 — PowerShell 대응·gh api 옵션 선두 형태(마지막 코드 변경 커밋)
- 이 보고서 커밋은 CI 확인만 하고 여기에 다시 적지 않는다
