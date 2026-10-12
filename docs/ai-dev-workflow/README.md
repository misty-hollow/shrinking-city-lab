# 공통 AI 개발 규칙 사본 (v1.2)

이 폴더의 세 문서는 사용자의 공통 AI 개발 플로우 원본을 **고치지 않고** 옮긴 사본이다. 이 저장소의 프로젝트 값은 `CLAUDE.md`에 있다.
사본을 고치지 않는다. 원본이 개정되면 사본 갱신은 별도 작업으로 하고, 위험도는 개정 내용의 실제 영향으로 정한다(WORKFLOW 8절 끝).

| 항목 | 값 |
|---|---|
| 원본 저장소 | https://github.com/misty-hollow/AI-Dev-Workflow |
| 원본 커밋 | `6eee919d274f936edaa2eb59824cebb5cd23b1bc` (2026-10-12 10:32 +0900) |
| 버전 | v1.2 (원본 CHANGELOG: "v1.2 — 2026-10-12 (잠정 적용)") |
| 사본 날짜 | 2026-10-12 |
| 이전 적용 버전 | v1.0 (`d2fa431`, 2026-10-10, PR #10). v1.1은 이 저장소에 적용하지 않고 v1.2로 건너뛰었다 |

| 사본 | git blob(원본 커밋의 같은 파일과 동일) |
|---|---|
| `CONSTITUTION.md` | `9825e98134d38b0128bf31527b2a0e939e28b7ab` |
| `WORKFLOW.md` | `631d0256e63431c475cebfb2f852ae62af6ae46d` |
| `PROJECT_TEMPLATE.md` | `4817b9df25d81fc996e462535517169dda9dad96` |

대조 방법: `git hash-object docs/ai-dev-workflow/<파일>`의 값이 위 표, 그리고 원본 저장소의 `git rev-parse 6eee919:<파일>`과 같아야 한다.
원본은 LF로 저장돼 있고 이 저장소의 `.gitattributes`(`*.md eol=lf`)도 LF라 바이트가 같다.

원본의 `CHANGELOG.md`(변경 이력과 "검증되지 않은 전제")는 복사하지 않았다. 원본 저장소에서 읽는다.
