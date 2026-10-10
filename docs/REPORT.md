작업: 2026-10-09 미커밋 개선(학습 설계 정정·S6 반응형·도입부/튜토리얼·오류 2건·문서)을 별도 worktree로 옮겨 검증하고 기준점으로 확정 준비
결과: 완료
다음 할 일: 사용자 — PR 화면 확인 후 병합 여부 결정("PR #N 병합해"). 병합 뒤 본 체크아웃 정리는 별도 승인. 배포(정식·테스트 사이트)는 범위 밖

## 위험도: 고, `app/src/engine/compare.ts`·`engine.test.ts`가 CLAUDE.md 4절 고위험 파일(`app/src/engine/**`)이고, S6·설계안의 학습 문장(미션 의미 서술) 변경이 제품 원칙 영역에 걸친다

KPI 정의·접근성 식·미션 목표치·판정·참고 배분·데이터는 바뀌지 않았다(아래 "바뀌지 않은 것"). 그래도 파일 기준 고위험이라 독립 리뷰 대상이다.

## 출처와 보존

- 원본: 본 체크아웃 `C:\Users\sdsdo\Documents\shrinking-city-lab`(main `b323c8a`)의 미커밋 변경. 2026-10-09 세션들에서 만들었고 commit하지 않았다.
- 옮긴 방법: 원본 `git diff --binary`를 `origin/main`(`18af0f2`)에서 만든 새 worktree에 `git apply`, 새 파일 2개는 복사. 원본은 읽기만 했다.
- 옮긴 결과: 20개 파일 모두 원본과 SHA256 동일. 원본 diff 해시 `6eeafc03…` = 팀원용 테스트 사이트(`misty-hollow/scl-playtest` `c8aa0b2`)를 빌드할 때 기록한 해시와 같다. 이 worktree의 빌드 주 자산 `index-CNcoRxGs.js`도 그 사이트와 같은 이름이다.
- PR #10(`18af0f2`)이 바꾼 9개 파일과 겹치는 파일은 없다. 그래서 `b323c8a` 기준 diff가 그대로 적용됐다.
- 옮기지 않은 것(CLAUDE.md 11절): `STATUS.md`, `.agents/`, `.claude/`(skills), `skills-lock.json`. 사용자가 정하기 전까지 커밋하지 않는다.

## 핵심 변경 (2026-10-09 작업 묶음)

| 묶음 | 내용 | 주요 파일 |
|---|---|---|
| 학습 설계 정정 | r2 전수 재검증(앱 엔진·파이프라인·독립 구현 세 경로 일치)으로 설계안의 사실 오류 정정: "세 목표 동시 만족 배분 없음" → 2,457개 있음, "우열 없는 배분 약 6개"를 격자 대표(7)와 정확한 수(148)로 구분, "늘 희생"·"집중해야 미션 1 달성" 일반화 제거. S6 문장을 데이터 조건부로(같은 배분 확정, 결과 같음), 어느 배분으로도 닿지 않는 마을(15분 기준 9곳·1,006명)을 S6·지역 카드에서 따로 표시 | 설계안, `engine/compare.ts`(`unreachableVillages`·`overlapOf` 표시용 함수), `Finale.tsx`, `PlayPanel.tsx`, `copy.ts`, `engine.test.ts`, `pipeline/tests/test_pipeline.py` |
| 입력·문구 정리 | 키보드 ↑↓·Home·End가 화면 밖 숨은 말풍선에서 멈추던 결함 수정. "상위 10% 경계" 문구를 "경계를 내림한 값"으로 정정(달성 화면의 "상위 18%"와 모순 해소) | `Markers.tsx`, `play.test.tsx`, `copy.ts` |
| S6 반응형 | 768~1099 폭에서 S6 표를 가리던 말풍선 7 → 0, 나란히 보기 2·3열이 보고서 밑에 숨던 문제, 768에서 기준 스위치가 제목을 가리던 문제 | `Stage.tsx`(`withEdgeInsets`), `WorldFinale.tsx`, `App.tsx`, `app.css`, `world.css` |
| 도입부·튜토리얼 | S0 "진료는 지금 주 10일", S1-2 보건지소 성격·격주 0.5일, S1-3 "공주의 진료자원" 오해 정정, S2-1 계산 기본 개념·지표 6개 숨김, S2-2 누를 곳, S2-3 미션으로 잇는 한 줄 | `copy.ts`, `Cards.tsx`, `App.tsx`, 설계안 5-2·5-3 |
| 튜토리얼 알림 수정 | 앞 단계 알림이 다음 단계에 늦게 뜨던 결함 수정(단계 키로 오래된 알림 차단) | `ui/feedback.ts`(신규), `feedback.test.ts`(신규), `App.tsx` |
| 문서 | UI_DESIGN_SYSTEM §9.4·§12.2·§12.4·§15를 구현에 맞춤(시트형 배치는 남은 과제로 명시). PLAYTEST.md를 3~5명 파일럿 진행·기록·채점·발표 표현 기준으로 확장 | `UI_DESIGN_SYSTEM.md`, `release/PLAYTEST.md` |

**바뀌지 않은 것**(`git diff origin/main` 0줄 확인): `engine/kpi.ts`, `engine/allocation.ts`, `app/src/state/`, `app/public/`, `pipeline/scl_pipeline/`, `pipeline/derived/`. forbidden 목록·테스트도 그대로.

## 변경 파일

수정 18개(+816 / −166), 신규 2개. 이 보고서(`docs/REPORT.md`)를 더하면 21개.

## 로컬 검증 결과 (Windows, worktree `shrinking-city-lab-1009`, 미커밋 상태 — 2026-10-10)

| 종류 | 결과 |
|---|---|
| 저장소 위생 | `git diff --check origin/main` 통과, 신규 2개 공백 검사 통과, 바뀐 파일 CRLF 0 |
| 배포 스크립트 구문 | `bash -n deploy/*.sh` 통과, `py_compile deploy/smoke_web.py` 통과 |
| 파이프라인 린트 | `ruff check` All checks passed, `ruff format --check` 23 files already formatted |
| 파이프라인 테스트 | `22 passed`(새 테스트 `test_r2_design_claims_about_missions` 포함) |
| 데이터 재현 | `scl_pipeline verify`: 불변식 PASS · 잠금 12개 해시 일치 · 재현 바이트 동일. WARN 2건은 `manifest.known_issues`의 기존 한계 |
| 앱 타입체크·빌드 | `npm ci && npm run build` 통과 |
| 앱 테스트 | `Test Files 10 passed (10)`, `Tests 155 passed (155)` |

venv는 이 worktree 전용(`pipeline/.venv`, Python 3.12.10)으로 새로 만들었다.

## CI 결과 (push 실행 38050959697, head `1c6279d3ebce2ba88d9bd4481c4326cdd2dd0a0a`)

마지막 코드 변경 커밋은 `fbb0aa5`다. `1c6279d`는 그 위에 `docs/REPORT.md`만 고쳤으므로 이 실행이 코드 전체를 덮는다.

| job | 결과 |
|---|---|
| repository(위생·gitleaks) | success |
| pipeline(ruff·pytest·verify) | success |
| app(npm ci·build·test·뿌리 기준 빌드 smoke) | success |

## 수행하지 못한 검증과 영향

- gitleaks와 뿌리 기준 빌드 smoke는 로컬에서 못 돌리고 CI(위)에서 통과했다.
- 사람 확인(CLAUDE.md 5절): 바뀐 화면의 시각 품질, 문구 톤, 플레이 흐름. 2026-10-09 자동 브라우저 확인(헤드리스 Edge, 768×1024·900×768·1024×768·1440×900)은 그날 세션 보고로만 알고, 이번에 다시 돌리지 않았다.
- 학습 효과: 플레이테스트 전이라 미검증(PLAYTEST.md 9절 표현 기준).

## 독립 리뷰

필요(고위험). 로컬 `main`은 `b323c8a`에 머물러 있어 `--base main`이면 이미 병합된 PR #10이 대상이 되므로 `origin/main` 기준으로 리뷰했다.

### 1차 — Codex review (2026-10-10, 대상: `fbb0aa5`, `origin/main` `18af0f2` 기준 branch diff 21개 파일, Codex 스레드 01a125b2-d788-7ba2-a891-d2e5f6388106)

실행: `codex-companion.mjs review --cwd C:/Users/sdsdo/Documents/shrinking-city-lab-1009 --base origin/main --scope branch`(사용자 지시로 메인이 실행)

```
# Codex Review

Target: branch diff against origin/main

No actionable bugs were identified in the changes relative to the supplied merge base. The comparison logic, feedback lifecycle, and responsive layout changes appear consistent with their callers and added tests; tests were not executed during this review.
```

조치: 필수 지적 없음, 코드 변경 없음. 리뷰는 테스트를 돌리지 않았다고 적었다. 테스트는 위 "로컬 검증 결과"에서 메인이 돌렸다(155·22 통과). 리뷰 전후 작업 트리 변경 0을 확인했다.

## 권장 commit·PR 구성

- **PR 1개, commit 1개**를 권한다. 브랜치 `fix/learning-design-1009` → `main`.
- 이유: 여섯 묶음이 `copy.ts`·`App.tsx`·설계안·`screens.test.tsx`를 함께 고쳐서, 나누려면 같은 파일 안을 조각내야 한다. 그렇게 만든 중간 상태는 한 번도 테스트·배포되지 않았다. 지금 검증한 상태는 팀원용 테스트 사이트와 같은 하나의 상태다. 병합 방식도 squash(잠정)라 PR 안의 commit 분할은 main에 남지 않는다.
- 묶음별 설명은 commit 메시지 본문과 PR 본문에 위 표로 남긴다.
- 새 UX 피드백 작업(8건)은 이 PR에 넣지 않는다. 이 PR이 병합된 뒤 새 `main`에서 별도 브랜치로 시작한다.

## 미해결 문제

- 본 체크아웃 정리: 이 변경이 main에 병합된 뒤에도 본 체크아웃에는 같은 내용이 미커밋으로 남아 `main`을 fast-forward할 수 없다. 병합 후 병합 커밋과 20개 파일이 바이트 동일한지 대조하고, 같을 때만 그 20개를 되돌리고(`git restore`, 신규 2개 삭제) fast-forward하는 방법을 권한다. 되돌리기는 승인 대상이다. 그 전까지 본 체크아웃은 그대로 두어 백업으로 쓴다.
- `STATUS.md`(미추적): 5절 "첫 화면·튜토리얼 개선 착수 안 함"이 그 뒤 같은 날 작업과 맞지 않는다. 커밋 여부와 갱신은 사용자 결정.
- 팀원용 테스트 사이트 `misty-hollow/scl-playtest`: 그대로 둔다. 테스트 후 처리는 사용자 결정.

## 사용자가 할 일

1. ~~작업 브랜치에 중간 commit 1개 승인(push 없음)~~ — 2026-10-10 승인, commit과 리뷰에만 적용.
2. ~~리뷰~~ — 1차 Codex review "No actionable bugs", 반영할 것 없음.
3. ~~보고서 commit, push·CI·PR 생성 승인~~ — 2026-10-10 승인(이 범위까지만).
4. 병합 지시("PR #N 병합해"), 병합 후 본 체크아웃 정리 승인.
5. 정식 사이트 반영(`gh-pages`)은 별도 승인. 이번 범위 밖.

## commit 해시

- `fbb0aa5` — 10월 9일 변경 20개 + 이 보고서 초판(중간 commit)
- `1c6279d` — 이 보고서에 Codex 리뷰 원문·승인 범위 기록(문서만)
- 그 뒤 commit — 이 보고서에 CI 결과 기록(문서만, 그 CI는 확인만 하고 여기 다시 쓰지 않는다)

기준: `origin/main` `18af0f284b583a7dacc4e9899203d23bdf0865ae`.
