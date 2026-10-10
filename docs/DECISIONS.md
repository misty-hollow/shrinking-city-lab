# 결정 기록 (DECISIONS)

승인된 결정과 이유만 적는다. 미승인 제안·검토 중인 안은 넣지 않는다.

## 제품 결정의 원본

제품·화면 결정은 이미 아래 문서에 판 번호와 함께 기록되어 있다. 이 파일에 옮겨 적지 않는다(같은 내용을 두 곳에 두지 않는다).

| 범위 | 원본 |
|---|---|
| 제품 정의·계산·데이터·미션·화면 흐름 | `docs/설계안_v0.1.md` (1-1 판정, 6-14~6-17 시각·배치 개정 포함) |
| 화면 UI 표현 | `docs/UI_DESIGN_SYSTEM.md` |
| 공개 범위·남겨 둔 알려진 문제 | `docs/release/RELEASE_READINESS.md` 1·8절 |
| 데이터 이용조건 표기 | `DATA_LICENSE.md` |

위 문서를 바꾸는 결정이 새로 승인되면 그 문서를 고치고, 여기에는 한 줄(날짜·무엇·어디를 고쳤는지)만 남긴다.

## 운영 결정

### D-001 범용 AI 개발 플로우 v1.0 적용 — 2026-10-10

- 결정: 사용자의 범용 AI 개발 플로우 v1.0(`misty-hollow/AI-Dev-Workflow` `d2fa431`)을 이 저장소에 적용한다. 실행 규칙은 `CLAUDE.md`.
- 이유: 사용자 요청(2026-10-10). 기능·데이터·UI·제품 설계는 바꾸지 않고 운영 체계만 더한다.
- 범위: CLAUDE.md, 이 파일, docs/REPORT.md, `.claude/settings.json`, `.claude/agents/`, CI 트리거·동시성 보완.

### D-002 CI를 작업 브랜치 push에서도 돌린다 — 2026-10-10

- 결정: 기존 CI 세 job(repository·pipeline·app)과 검사 내용은 그대로 두고, 트리거에 `gh-pages`를 뺀 모든 브랜치의 push를 더한다.
  main push 실행은 다음 push가 와도 취소하지 않는다.
- 이유: 플로우는 PR 생성 전에 작업 브랜치 head 커밋의 CI를 확인한다(WORKFLOW 3절 9단계). 기존 CI는 main push와 PR에서만 돌았다.
  `gh-pages`는 빌드 산출물만 있는 운영 배포 브랜치라 CI 대상이 아니다.
