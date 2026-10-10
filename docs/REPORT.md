작업: UX 개선 PR B — 결산(S5)·S6 결과를 나아진 주민 / 불리해진 주민으로, 지역 카드 정보 구조, 미리보기·실제/가정 안내 중복, 문체 정리
결과: 완료
다음 할 일: 사용자 — 화면 확인(아래 "사람 확인") 후 병합 여부 결정("PR #N 병합해"). 배포(정식·테스트 사이트)는 별도 승인

## 위험도: 고, S5·S6 결과 화면(판정 결과를 학생에게 읽히는 방식)과 문구 체계(설계안 5-12)를 바꾸고 설계안 5-6·5-7을 고친다. 계산·데이터·미션 목표치·판정·학습 목표는 바꾸지 않았다(`engine/`·`state/`·`app/public`·`pipeline` diff 0)

## 사용자 결정 (2026-10-10)

| 질문 | 결정 |
|---|---|
| S5 결과 | 나아진 주민 / 불리해진 주민 두 칸(PR A 때 결정) |
| 문체 | 해요체 유지 + 라벨·캡션·알림·미리보기는 명사형(PR A 때 결정) |
| "주로 …" 읍·면이 두 칸에 함께 나올 때(예: 미션 2의 정안면) | 그대로 둔다(한 읍·면 안에서도 마을마다 갈린다) |
| 문체 범위 | 지금 범위로 확정. 튜토리얼·소개 본문과 S6 요약 문장은 플레이테스트 뒤 따로 |
| 다음 단계 | 로컬 commit 후 Codex 리뷰 |

## 핵심 변경

| 화면 | 변경 |
|---|---|
| S5 결산(세계 위) | '잃은 것' 한 칸 → 머리 `현재 실제(10일)와 비교` + 두 칸. 나아진 주민 = 새로 닿음 + 하루 이상 늘어남, 불리해진 주민 = 닿지 않게 됨 + 하루 이상 줄어듦(기존 `lostVillages`·±1일 규칙 그대로). 칸마다 `{인구} · 마을 {n}곳`, 갈래(0곳 생략), `주로 {읍·면 3곳}`. 닿지 않게 된 마을 이름은 지도의 빨간 표지와 같은 순서(주민 많은 순)로 1:1. 지도 기준이 현재 실제일 때만 ▲▼ 한 줄. 미션 2·3은 같은 15일 앞 미션 대비 한 줄(늘어난 5일이 섞이지 않는 배분만의 차이) |
| S6 | 6개 지표 표 아래 같은 표에 `현재 실제(10일) 대비 · 늘어난 5일 포함` 두 행(나아진·불리해진 주민, 미션별 `{인구} ({n}곳)`) |
| 지역 카드 | 맨 위 `{n}곳 · {인구} · 읍·면 주민의 {x}%`, 어느 배분으로도 닿지 않는 마을은 수만 작은 글씨로, 마을 목록은 접음 |
| 미리보기 | 말풍선 판의 [미리보기] 태그 삭제(판 머리 "…에 1일 놓으면"이 이미 말함), HUD `미리보기 → 주 0.3일` → `→ 주 0.3일`(화면 낭독기에는 "미리보기"를 읽힘) |
| 문체 | 미리보기 줄·알림·읽는 법·지역 카드 라벨을 명사형으로("마을 43곳에 새로 닿아요" → "새로 닿는 마을 43곳"), S0 진행 순서, 브리핑 두 줄, S1 2장의 "~이에요" 연속, 결산 고정 한 줄을 한 문장으로. 설계안 고정 문장(APPROVED_NEGATIONS·LIMITS)은 그대로 |
| 그 밖 | 결산 판이 길어져 낮은 화면에서 판 안 스크롤(`max-height`) |

남겨 둔 것: S6 보고서의 `지금 실제로 운영하는 주 10일과는 다른 가상 배분이에요`는 줄였다가 되돌렸다(불변식 14를 지키는 기존 테스트 기준을 약화하지 않기 위해).

## 변경 파일

앱: `App.tsx`, `content/copy.ts`, `screens/WorldDebrief.tsx`, `screens/WorldFinale.tsx`, `ui/PlayPanel.tsx`, `ui/Markers.tsx`, `ui/changeSummary.ts`(신규), `styles/app.css`, `styles/world.css`. 테스트: `screens/screens.test.tsx`, `ui/preview.test.ts`(문구만), `ui/changeSummary.test.ts`(신규). 문서: `docs/설계안_v0.1.md`(5-6·5-7·5-12·7-2·개정 이력 등), `docs/UI_DESIGN_SYSTEM.md`, `docs/release/PLAYTEST.md`, 이 보고서.

## 로컬 검증 결과 (Windows, worktree `shrinking-city-lab-ux`, 2026-10-10)

| 종류 | 결과 |
|---|---|
| 저장소 위생 | `git diff --check origin/main` 통과, 신규 2개 공백 통과 |
| 배포 스크립트 구문 | 통과 |
| 파이프라인 린트·테스트 | ruff 통과, `22 passed` |
| 데이터 재현 | `scl_pipeline verify` 불변식·잠금·재현 PASS |
| 앱 타입체크·빌드 | 통과 |
| 앱 테스트 | `Test Files 11 passed`, `Tests 171 passed`(PR A 뒤 163 → 171. 결산 두 칸·완전성·이름-표지 순서, S6 두 행, 지역 카드, `changeSummary` 고정 입력 경계) |
| 브라우저(로컬 미리보기 1440×900) | 미션 1 결산: 나아진 18,444명 · 69곳 / 불리해진 6,713명 · 39곳. 미션 2: 17,040명 · 69곳 / 8,298명 · 31곳, 미션 1 대비 줄(63곳·81곳), 판 높이 681px. S6 두 행 표시. 미리보기 판에 태그 없음 |

## 리뷰

- 리뷰 서브에이전트(읽기 전용) 1회. 3,000개 무작위 배분 × 161개 마을로 분류·▲▼·빨간 표지 일치 0건 불일치를 확인했다. 필수 2건 반영: 결산 문장의 잃은 마을 이름(번호순)과 지도 빨간 표지(주민순)가 달랐다 → 공용 `lostPinOrder`로 맞춤(main에도 있던 불일치) / 설계안 5-6 블록 3이 옛 문구로 남아 있었다 → 다시 씀(7-2·10-x 언급 포함). 선택 반영: HUD 화면 낭독용 "미리보기", 결산 판 `max-height`, S6 소제목 `scope="rowgroup"`, 분류 완전성·0.5일 경계 테스트. 반영하지 않음: 시트·S6 본문·소개의 "얻은 것/잃은 것·좋아진/나빠진" 용어 통일(범위 밖, 사람 확인 항목).
- 독립 리뷰(Codex) 1차: 사용자 지시로 메인이 실행(`codex-companion.mjs review --cwd …/shrinking-city-lab-ux --base origin/main --scope branch`, 2026-10-10, 대상 `813471a`). 원문:

```
# Codex Review

Target: branch diff against origin/main

The new finale rows introduce an unreachable-content regression on short desktop screens because the fixed panel has no scrolling or viewport height constraint.

Review comment:

- [P2] Constrain the taller finale panel to the viewport — C:\Users\sdsdo\Documents\shrinking-city-lab-ux\app\src\screens\WorldFinale.tsx:131-136
  On a short desktop viewport such as 1280×720, the three added rows push the reference allocations' multi-line finale summary below the screen. `.wf-table` remains fixed at `top: 156px` without a height limit or internal scrolling, while `html`, `body`, and `#root` hide overflow, so the clipped explanation cannot be reached. Add viewport-bounded scrolling or a compact layout to the finale panel, as this patch already does for the debrief panel.
```

  조치(필수): `.wf-table`에 `max-height: calc(100vh - {top} - 24px)` + `overflow-y: auto`(기본 156px, ≤1279 146px, ≤1023 168px). 로컬 미리보기에서 확인: 1280×720 판 156~696px(내용 605px, 상자 525px → 스크롤, 마지막 요약 줄 스크롤 뒤 보임), 1024×768 판 146~727px(스크롤 불필요), 가로 넘침 없음. 필수 검증 전체 다시 통과(171 tests).
- 독립 리뷰(Codex) 2차: 같은 명령, 대상 `424eb54`(수정분 포함). 원문:

```
# Codex Review

Target: branch diff against origin/main

No actionable regressions were identified in the changes against the specified merge base. Test execution was attempted but blocked by the environment's spawn EPERM restriction, so runtime validation remains unconfirmed.
```

  조치: 필수 지적 없음. Codex 환경에서 테스트가 막혔다는 부분은 위 로컬 검증(메인 실행, 171 passed)과 push 뒤 CI로 확인한다.

## CI 결과 (push 실행 38056388728, head `609c779` — 마지막 코드 변경 `424eb54` 위에 보고서만 고친 commit)

| job | 결과 |
|---|---|
| repository(위생·gitleaks) | success |
| pipeline(ruff·pytest·verify) | success |
| app(npm ci·build·test·뿌리 기준 빌드 smoke) | success |

이 뒤 commit은 이 보고서만 고친다(그 CI는 확인만 하고 다시 쓰지 않는다).

## 수행하지 못한 검증과 영향

- gitleaks·뿌리 기준 빌드 smoke는 로컬에서 못 돌리고 CI(위)에서 통과했다.
- 사람 확인: 1280×720·1024×768에서 결산 판 길이와 스크롤, 두 칸 줄바꿈(좁은 폭에서 칸당 약 190px), 지역 카드(닿지 않는 마을이 있는 읍·면에서 요약 줄과 접힌 목록 — 로컬 미리보기에서 열어 보지 못했다), 명사형 알림·미리보기의 톤, 시트·S6 본문에 남은 "얻은 것/잃은 것" 용어와의 혼동 여부.

## 미해결 문제

- `shrinking-city-lab-devflow/.claude/launch.json`(미추적, 로컬 미리보기용)은 이 PR 밖이다.

## commit 해시

`813471a`(기능) · `424eb54`(Codex P2 수정) + 보고서만 고친 commit. 기준: `origin/main` `8c1f276cb25df23984b1291c1b7ba37c0868ecc5`.
