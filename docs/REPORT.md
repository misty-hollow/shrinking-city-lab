작업: PR #8(draft) PRODUCTION.md를 2026-10-10 정식 릴리스(앱 `2ee1431` = `gh-pages` `e388749`)에 맞추고 main과 최신화
결과: 완료
다음 할 일: 사용자 — PR #8의 draft 해제·병합 여부 결정("PR #8 병합해"). 이 PR은 문서만 바꾼다

## 위험도: 저, `docs/release/*.md`의 상태 기록 갱신과 README 안내 두 줄(CLAUDE.md 4절 예외). 앱·파이프라인·배포 스크립트·CI 변경 없음

## 핵심 변경

- `docs/release/PRODUCTION.md`
  - 4절 "현재 공개 릴리스"를 2026-10-10 릴리스로: 앱 `2ee1431`(PR #12·#13), `gh-pages` `e388749`, 주 자산 `assets/index-n64CaXCs.js`, 되돌리기 대상 `caf9acd`(앱 `b323c8a`), 공개 뒤 확인 결과. 이전 릴리스(`b323c8a`·`01b0da7`)는 아래 기록 표로 옮김.
  - 2절 새 릴리스 절차의 `printf 'geoleobom.kr\n' > CNAME`을 `git checkout origin/gh-pages -- CNAME`으로 바꾸고, 커밋 전에 바뀐 파일 목록을 보는 줄을 더함. 기존 CNAME은 GitHub가 만든 줄바꿈 없는 파일이라 절차대로 새로 쓰면 바이트가 바뀐다(2026-10-10 릴리스 때 발견, 그 릴리스는 기존 파일을 그대로 썼다).
  - 머리 기준일 2026-10-10.
- main(`2ee1431`)을 이 브랜치에 merge(rebase 아님, CLAUDE.md 7절). 충돌 없음. PR #8의 기존 변경(README의 production 안내 두 줄, RELEASE_READINESS 6절 머리 안내)은 그대로.

## 변경 파일 (main 대비)

`docs/release/PRODUCTION.md`(신규), `README.md`(안내 두 곳), `docs/release/RELEASE_READINESS.md`(6절 머리 한 줄), `docs/REPORT.md`(이 보고서).

## 로컬 검증 결과 (Windows, worktree `shrinking-city-lab-prod-docs`, 2026-10-10)

| 종류 | 결과 |
|---|---|
| 저장소 위생 | `git diff --check origin/main` 통과 |
| 배포 스크립트 구문 | `bash -n deploy/*.sh`·`py_compile deploy/smoke_web.py` 통과 |
| 앱·파이프라인 | 이 브랜치의 `app/`·`pipeline/`은 origin/main(`2ee1431`)과 diff 0. 이 worktree 전용 venv·`npm ci`는 만들지 않았고, 전체 검증(ruff·pytest·verify·build·vitest·gitleaks)은 push CI로 확인한다. 참고로 ruff·pytest(22 passed)를 다른 worktree(`shrinking-city-lab-ux`) venv로 돌렸는데, 그 venv는 그쪽 코드(내용 동일)를 읽으므로 이 트리의 검증으로 세지 않는다 |

## 리뷰

저위험 문서 변경이라 독립 리뷰 대상이 아니다. 표의 해시·시각은 `git log origin/gh-pages`, `gh api …/pages/builds/latest`, main CI 실행에서 직접 확인한 값이다.

## CI 결과

push 뒤 확인.

## 수행하지 못한 검증과 영향

- 없음(문서 변경).

## commit 해시

main merge `88034c5` + 이 문서 갱신 commit. 브랜치 `docs/production-pages`.
