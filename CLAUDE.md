작업 전에 docs/ai-dev-workflow/CONSTITUTION.md와 WORKFLOW.md(v1.2)를 읽고 따른다.

# CLAUDE.md — Shrinking City Lab 프로젝트 값

이 파일은 공통 규칙 사본(`docs/ai-dev-workflow/`, 출처·버전은 그 폴더의 README.md)을 이 저장소에 적용하는 **프로젝트 값**만 담는다.
절 기호 A~I는 PROJECT_TEMPLATE v1.2를 따른다. 실행 순서·검증 상태·실패 처리·리뷰·병합 절차는 사본이 정하고, 여기에 다시 쓰지 않는다.

제품 기준은 아래 문서가 정한다(이 파일은 개발 운영만 다룬다).

- 제품·계산·데이터·미션 의미: `docs/설계안_v0.1.md`
- 화면 UI 표현: `docs/UI_DESIGN_SYSTEM.md`
- 공개·배포 준비: `docs/release/RELEASE_READINESS.md`, 운영 기록 `docs/release/PRODUCTION.md`
- 데이터 이용조건: `DATA_LICENSE.md`

## A. 식별

| 항목 | 값 |
|---|---|
| 프로젝트명 | Shrinking City Lab — 진료일을 나누다(공주 보건지소 편) |
| 저장소 | `misty-hollow/shrinking-city-lab` (공개) |
| 스택·언어 | 앱: React 18 + TypeScript + Vite + three.js(WebGL), Node 24. 파이프라인: Python 3.12(OSRM·docker는 데이터 재생성 때만) |
| 기본 브랜치 | main |
| 배포 형태 (전부) | 웹 하나. 운영 = GitHub Pages `gh-pages` 브랜치(geoleobom.kr, 뿌리 기준 빌드 `--base=/`). 전시 키오스크도 같은 웹 빌드(`?kiosk=1`). VPS 경로(`deploy/`)는 예비 |
| 배포·외부 공개 자동화 | push·PR·병합으로 실행되는 배포 없음. `pages-build-deployment`(GitHub 관리)는 `gh-pages` push에만 반응하고, `gh-pages` push는 사람이 승인하는 운영 배포다(E절). CI는 외부로 아무것도 올리지 않는다 |
| 프로젝트 고정 제약 | 앱은 정적 파일만 읽는다(런타임 외부 호출 없음). 원본부터 다시 만들면 추적 파일이 바이트 동일. 공주시 원본 xlsx·페이지 발췌는 저장소 밖. 정책을 추천하지 않는다(설계안 1-2·2-7·5-12) |

세션 시작 추가 값: 작업 트리에 사용자가 커밋하지 않은 변경·추적되지 않은 파일이 있으면 건드리지 않는다(stash·restore·checkout·삭제 금지).
그 위에서 작업해야 하면 `origin/main`에서 별도 worktree(`../shrinking-city-lab-<작업명>`)를 만든다.

## B. 검증 명령과 필요 조건

CI 러너 OS: ubuntu-24.04(`.github/workflows/ci.yml`, job `repository`·`pipeline`·`app` = main 필수 체크). 로컬: Windows + Git Bash.
파이썬은 3.12. 편집 설치(`pip install -e ".[dev]"`)는 **그 작업 트리 전용 venv**(`pipeline/.venv`)에 한다. 다른 체크아웃의 venv를 쓰지 않는다.

| 종류 | 명령 | 필요 조건 | 비고 |
|---|---|---|---|
| 저장소 위생 | `git diff --check origin/main...HEAD` | 모든 변경 | gitleaks(비밀값)는 CI `repository`에서만(docker) |
| 배포 스크립트 구문 | `for f in deploy/*.sh; do bash -n "$f"; done` · `python -m py_compile deploy/smoke_web.py` | 모든 변경 | 실행하지 않고 구문만 |
| 린트 | `cd pipeline && python -m ruff check . && python -m ruff format --check .` | 모든 변경 | |
| 테스트(파이프라인) | `cd pipeline && python -m pytest -q` | 모든 변경 | |
| 데이터 재현 | `cd pipeline && python -m scl_pipeline verify` | 모든 변경 | 임시 폴더에서 다시 만들어 바이트 대조. 저장소 파일을 바꾸지 않는다 |
| 타입체크·빌드 | `cd app && npm ci && npm run build` | 모든 변경 | `build` = `tsc -b && vite build` |
| 테스트(앱) | `cd app && npm test` | 모든 변경 | `vitest run`(엔진 골든 값·금지어·흐름·jsdom 패널). watch(`test:watch`) 금지 |
| 배포 형태별 실행 확인 | CI `app` job 「Root-base build and static smoke」(`--base=/` 빌드 + 정적 서버 + `deploy/smoke_web.py`) | 모든 변경 | Linux 셸 전제라 CI에서 확인. 깊은 주소(SPA 물러섬)는 `deploy/dryrun_local.sh`(docker, E절 승인) |
| 실행 검증 ① 플레이 경로 | 아래 「QA 실행」 | 화면·입력·상태 영향 변경 | 실제 키보드·클릭 → `game-state` → 화면. 로컬 전용(Edge·WebGL). CI에서 돌지 않는다 |
| 실행 검증 ① 객관 검사 | 같은 실행의 검사(`qa-shots/report.json`) | 화면 영향 변경 | KPI·판정 경계(`golden.json`)·결과 보존·풀 제한·가로 넘침(DOM 기하)·WebGL canvas·콘솔/페이지 오류 0·금지어·소리·GPU 프레임. DOM 기하(`scripts/qa-geometry.mjs`): HUD 판(`data-occlude`)과 세계 라벨(말풍선 머리·미리보기·결과 판·잃은 마을 표지·마을 이름·시간 태그) 겹침, 기준 변경 소식과 HUD 판의 겹침·화면 좌우 끝, 화면 끝에 걸린 세계 라벨, 전체 시점에서 흐린 말풍선 0, 판 안 가로 잘림. 하네스 본문(`scripts/browser-qa.mjs`): 가까이 보기에서 흐린 말풍선에 포커스하면 다시 보임. 소식 검사는 그 순간 떠 있는 소식만 잰다(하네스가 기준을 바꾼 직후에 부른다). **수단 없음**: 기준 스크린샷 비교, 기준 변경 소식과 세계 라벨(말풍선 머리·결과 판 등)의 겹침, 지형에 새긴 읍·면 이름(캔버스)·3D 깃발·탑과 HUD의 겹침(DOM 밖) |
| 직접 검토 ② | 같은 실행의 `app/qa-shots/*.png` | 화면 영향 변경 | 실행당 16장 상한. 기본: 1440 `s0-start`·`s2-moved`·`s4-play`·`s4-m2-play`·`s5-world`·`s5-debrief`·`s5-m2-compare`·`s6-world`·`s6-three`·`s8-data`, 1024 `s4-play`·`s5-world`, 1280 `s4-play`, `390x844-mobile`, 실패 시 `fail-*.png` |
| 시간 축 | 같은 실행: 빛 도착 전·후 지표(`light-until`), 움직임 줄이기, 키오스크 90초 복귀(가짜 시계) | 애니메이션·전환 변경 | 측정값 위주. 시작·중간·끝 스크린샷은 감상(`s5-appreciate`)만 |
| 성능 | `node scripts/perf-probe.mjs`(운영 빌드, 저사양 흉내, `qa-shots/perf/`) | 무대·렌더러·에셋 변경 | 전시 기기(통합 GPU) 체감은 D절 |

**QA 실행**(로컬, `app/`에서):

```
npx vite --port 5199 --strictPort --host 127.0.0.1          # 개발 서버(소리·무대 성능 창은 개발 서버에서만 있다)
npm i --no-save --no-fund --no-audit playwright-core@1.63.0  # 의존성에 넣지 않는다. 버전 고정
npm run qa:browser                                           # QA_BASE_URL, QA_BROWSER_CHANNEL(기본 msedge)
```

- 결과: `app/qa-shots/report.json`(`meta` = 커밋·주소·브라우저·playwright 버전·시각, `results` = PASS/FAIL 목록), 체크포인트 PNG. `.gitignore` 대상.
- 종료 코드: FAIL이 하나라도 있으면 1. 예외로 멈춘 묶음(화면 크기 단위)은 FAIL「실행 중단」과 `fail-<묶음>.png`를 남기고 다음 묶음을 돈다.
- 실패 재현 조건: `report.json`의 `meta`(커밋·주소·브라우저) + 같은 명령. 입력 순서는 스크립트에 고정돼 있고 무작위가 없다. 실패한 실행의 `qa-shots/`는 보고 전에 지우지 않는다.
- `qa-shots/`는 이전 실행 파일을 지우지 않는다. 새 실행 전에 `qa-shots/*.png`·`report.json`을 비우거나 시각으로 구분한다(`sound/`·`perf/`는 다른 스크립트 결과).
- 확인된 환경(2026-10-12): Windows 11, Edge 155.0.4283.45, playwright-core 1.63.0, Node 24.14.1. 한 번 실행 약 100초.

디버그 핸들·내부 API 사용 범위: `data-testid="game-state"`(상태 읽기), `light-until`(빛 도착 대기), `window.__sclSound.debug()`·`window.__sclStage.info()/bench()`(개발 서버 전용, 관찰만), 가짜 시계(키오스크 복귀).
검증 대상 행동은 키보드·클릭·hover로 한다. 상태를 직접 바꾸는 핸들은 쓰지 않는다.

대표 플레이 경로(①에서 매번, 하네스가 수행):
- 1440×900 한 판: S0 시작 → S1 3장 → S2 튜토리얼(기준 10분↔15분, 의당 −·신풍 +) → S3 → S4 키보드 15일 배분(미리보기·되돌리기·위에서 보기) → 확정 → S5 감상·결과·자세히 → S8 → 미션 2·3(목표 경계 미달→달성, 10·20분에서도 15분 판정, 다시 배분) → S6 세 개의 공주. 1024×768·1280×800(움직임 줄이기)은 같은 경로의 축약
- 전시: 건너뛰기만 한 판 → S6 참고 배분, 90초 무입력 → 시작 화면, 390×844 모바일 안내·자료와 한계

변경 주변 탐색: 변경된 화면·입력에서 하네스 밖 조작 2~3가지를 임시 스크립트(작업 폴더 밖) 또는 내장 브라우저로 시도한다.

수단 확보 계획(모두 별도 작업으로 제안, 아직 없음):
- 기준 스크린샷 비교 — 무대가 WebGL·애니메이션이라 마스크 설계가 필요하다. 새 검사라 저위험이나 허용 오차·마스크 설계는 C절 공통 표를 따른다
- playwright-core를 devDependency로 고정 — 의존성 추가라 고위험
- CI에서 ① 실행 — GPU 없는 러너의 WebGL 대체와 브라우저 설치가 필요하다. 의존성·CI 변경이라 고위험

실패 처리 예산: 작업당 4시간, PR CI 실행 6회(보고서만 고친 push로 도는 실행 포함). 조사·증거 수집 포함, 가설이 바뀌어도 초기화하지 않는다.
CI 한 번 = 세 job 약 1분(공개 저장소 표준 러너, 무료). 상한에 닿기 전에 REPORT.md와 사용자에게 알린다.

화면·입력·상태 영향 파일·영역(해당하면 영향 "있음"):
- `app/src/**`(screens·ui·stage·state·content·styles·engine), `app/index.html`, `app/public/**`(data·fonts·licenses), `app/vite.config.ts`
- 앱 데이터를 바꾸는 파이프라인 산출물(`pipeline/derived/**` → `app/public/data/**`)
- `app/scripts/browser-qa.mjs`는 앱 화면을 바꾸지 않는다. 하네스를 바꾸면 그 하네스로 한 판을 다시 돌려 ①을 확인한다

## C. 고위험 기준

공통 표는 PROJECT_TEMPLATE v1.2 C절. 아래 프로젝트 목록을 더하고, 하나라도 해당하면 고위험. 메인은 변경 후 REPORT.md에 위험도와 근거를 한 줄 적고 사용자에게 묻지 않는다.

프로젝트별 고위험 파일(어떤 수정이든):
- `app/src/engine/**` — KPI 엔진. 파이썬 `model.py`와 같은 정의, 골든 값 대조
- `pipeline/scl_pipeline/**` — 단계 코드 해시(`provenance.step_code_sha256`)를 verify가 대조한다. 고치면 그 단계를 다시 돌려야 한다
- `pipeline/data.lock.json`, `pipeline/derived/**`, `pipeline/sources/**`, `pipeline/osrm/**`, `pipeline/reports/**`, `app/public/data/**`
- `app/src/content/forbidden.test.ts`와 금지어 목록, `app/src/state/results.ts`(미션 결과·판정 보관)
- `deploy/**`, `.github/workflows/**`, `.gitleaks.toml`, `.gitattributes`(LF 고정 = 바이트 재현)
- `app/package.json`, `app/package-lock.json`, `pipeline/pyproject.toml`, `app/vite.config.ts`, `app/tsconfig*.json`
- `LICENSE`, `DATA_LICENSE.md`, `app/public/licenses/**`, S8 「자료와 한계」의 출처·이용조건 표기
- `.claude/settings.json`, `.claude/agents/**`, `docs/ai-dev-workflow/**`, 이 파일의 B·C·E·F·H절

프로젝트별 고위험 영역(파일과 무관):
- 계산 의미: `A_i = min(5, 기준시간 안 지소 진료일 합)`, KPI 6개 정의, 미션 목표치·판정 경계, 참고 배분·배분 지형도
- 결정성·재현성: 원본부터 다시 만들면 추적 파일이 바이트 동일해야 한다
- 데이터 출처·이용조건·재배포: 공주시 원본 xlsx·페이지 발췌는 저장소에 들어오면 안 된다
- 제품 원칙 「정책을 추천하지 않는다」(설계안 1-2·2-7·5-12): 금지어 검사 완화, 추천처럼 읽히는 문구 체계 변경
- 런타임 외부 호출: 앱은 정적 파일만 읽는다. 외부 API·지도 타일·추적·분석 스크립트 추가
- 접근성 보장(움직임 줄이기, 스크린리더 문장) 제거
- QA 하네스(`app/scripts/browser-qa.mjs`)의 기존 검사 기준 약화·삭제·건너뛰기(공통 표 "기존 테스트 기준 약화"). 승인된 화면·문구 변경을 따라 기대값만 바꾸는 것은 근거(설계안·커밋)와 전후 문구를 REPORT.md에 적는다

프로젝트별 예외(공통 기준보다 우선, 저위험):
- `docs/release/*.md`의 상태 기록 갱신, README 오탈자
- `app/src/content/copy.ts`의 문구 수정으로 금지어 테스트를 그대로 통과하는 것. 화면 영향 변경이므로 ①②는 그대로 필요하고 문구 톤은 D절

독립 리뷰 명령(사용자가 입력, 모델 자동 호출 불가)은 G절.

## D. 사용자 판단 항목 (③층)

메인은 "어느 화면에서 무엇을 보고 판단할지"와 스크린샷 경로를 적는다.
- 3D 무대(빛·집·진료등 탑·길의 빛)의 분위기와 읽힘 — `app/qa-shots/1440x900-s0-start.png`, `-s4-play.png`, `-s6-world.png`
- 한 판의 흐름·난이도·재미(S0→S6), 미션 판정이 납득되는지 — `docs/release/PLAYTEST.md`
- 소리 — `docs/release/SOUND_QA.md`(`scripts/sound-audition.mjs` 청취 파일)
- 문구 톤(교육용, 추천하지 않음), 모바일(<768) 안내 화면의 말투
- 전시 기기(통합 GPU) 체감 성능, 키오스크 90초 복귀의 체감

HUD 배치의 겹침·잘림, 모바일 안내 화면이 뜨는지, 콘솔 오류는 ①②로 AI가 본다.

전환 기간: 실행 검증 도입 후 처음 5개 화면 영향 작업. 메인은 ①② 통과 항목도 "병행 확인"으로 다음 할 일에 넣고 n/5를 적는다.

| n | 작업 | ② 소견 | 사용자 확인 결과 | 놓침 |
|---|---|---|---|---|
| 1 | PR #15 HUD 겹침·판 안 잘림 수정 + DOM 기하 검사(2026-10-12) | 보고된 4건 해소, 1024 소식 잘림 추가 발견·수정, 1440 S4 M2 소식이 정안 말풍선을 3.2초 덮음(기존·범위 밖) | 3건 문제없음(흐림 동작 승인 포함, 2026-10-12) | 없음 |

## E. 승인 필요 행동 (헌법 2-12항에 추가)

- **운영 배포 = `gh-pages` 브랜치 push**(geoleobom.kr)와 그 되돌리기. VPS 경로(`deploy/deploy_geoleobom.sh`, 걸어봄 저장소 `rollback.sh`, `ssh geoleobom`)도 같다. `deploy/dryrun_local.sh`는 docker를 쓰므로 승인 후
- **데이터 재생성**: `scl_pipeline`의 `fetch`·`import`·`boundaries`·`osm`·`route`·`routes`·`terrain`·`build`·`check-mois`·`all`. 허용은 `verify`뿐. docker·OSRM·네트워크를 쓰는 단계 전부
- `pipeline/cache/` 삭제·이동(충청권 OSM 추출본·공주시 원본은 다시 받을 수 없다)
- GitHub 저장소 설정 변경(룰셋·브랜치 보호, Pages, 기본 브랜치, 병합 방식, 비밀값), DNS·도메인 인증 TXT
- 공주시·기관 문의 등 외부로 보내는 연락, 원본 자료의 공개
- QA 스크린샷·trace·보고서의 외부 업로드 추가(CI 아티팩트 포함)

## F. 브랜치·커밋·병합

| 항목 | 값 |
|---|---|
| 작업 브랜치 명명 | `feat/…` `fix/…` `docs/…` `design/…` `data/…` `chore/…` |
| 커밋 메시지 | 변경 요약(`fix(data): …` 형식). 고위험 리뷰 전 마지막 commit 본문에 목표·기준·검증 공백 요약 |
| 병합 방식 | merge commit — `gh pr merge <N> --merge --match-head-commit <확인한 head sha>` (DECISIONS D-004) |
| up-to-date 필수 | 켬(룰셋 "Protect main" `strict_required_status_checks_policy: true`, 2026-10-12 조회) |
| head 브랜치 자동 삭제 | 켬(권장). 2026-10-12 조회 결과 서버 설정은 꺼져 있다 — 사용자가 켠다 |

병합 후 로컬 브랜치만 `git branch -d`.

## G. 도구·모델 (2026-10-12 확인)

| 항목 | 값 | 확인일 |
|---|---|---|
| 메인 기본 모델 별칭 / 실제 버전 | 사용자 설정 `opus` → `claude-opus-5-5` | 2026-10-12 |
| 상위 모델 (서브에이전트에 지정 가능한지) | Agent 도구에 `model` 인자(opus·sonnet·haiku·fable)가 있다. 실제 지정 호출은 미검증 | 2026-10-12 |
| 서브에이전트 정의 위치 | `.claude/agents/implementer.md`(model: inherit), `.claude/agents/reviewer.md`(model: sonnet, 읽기 전용) | 2026-10-10 |
| 독립 리뷰 명령 | 목표·기준을 넘겨야 하는 고위험 기본: `/codex:adversarial-review --wait --base main --cwd <작업 worktree 절대경로> <목표·기준·검증 공백 요약>`. 단순 확인: `/codex:review --wait --base main --cwd <경로>` | 2026-10-12 |
| 독립 리뷰가 읽는 것 | 플러그인 소스 확인: adversarial-review는 `git log --oneline`(커밋 제목만) + diff(작으면 본문 포함, 크면 Codex가 직접 조회) + 명령 뒤 focus 문장, read-only 샌드박스. `/codex:review`는 focus 문장을 받지 않는다. 둘 다 커밋 본문은 넘기지 않는다 | 2026-10-12 |
| 진단 명령과 읽기 전용 지원 | `/codex:rescue`. 요청에 "읽기 전용 진단, 코드 수정 금지"를 쓰면 `--write` 없이 read-only 샌드박스로 돈다(기본은 쓰기 가능) | 2026-10-12 |
| 도구 버전 | Codex 플러그인 `codex@openai-codex` 1.0.6, Codex CLI 0.162.1, ChatGPT 구독 로그인 | 2026-10-12 |
| 자동 리뷰 게이트 / CI 자동 수정 | 끔 / 끔. 켜지 않는다 | 2026-10-10 |
| 권한 규칙 | `.claude/settings.json`(deny/ask). 메인은 이 파일과 `settings.local.json`을 고치지 않는다 — 사용자가 고친다 | 2026-10-10 |
| 공통 규칙 사본 버전 | `docs/ai-dev-workflow/` v1.2 (`6eee919`) | 2026-10-12 |

`--cwd`는 세션 작업 폴더가 리뷰 대상 worktree가 아닐 때 필요하다(본 체크아웃은 main에 있다).

## H. 데이터 분리와 커밋 제외

실행 검증의 격리:
- 브라우저: 하네스는 화면 크기 묶음마다 새 브라우저를 띄우고 `browser.newPage()`로 새 컨텍스트를 만든다. localStorage(소리 끄기 선택)는 실제 Edge 프로필과 섞이지 않는다
- 데스크톱: 해당 없음(배포 형태가 웹뿐)
- 실제 세이브·에셋 경로를 쓰지 않는다. 앱 데이터(`app/public/data/**`)는 읽기만 한다. `pipeline/cache/`는 건드리지 않는다

절대 커밋하지 않는다: `.claude/settings.local.json`과 백업, 인증 정보·토큰·`.env*`, `pipeline/cache/`, 공주시 원본 xlsx·페이지 발췌, `qa-shots/`, `pipeline/.venv/`.
`.claude/` 아래 파일은 개별 경로로만 `git add` 한다(`git add .claude/`·`git add -A` 금지). 사용자가 추적하지 않은 채 둔
`.claude/skills/`, `.agents/`, `skills-lock.json`, `STATUS.md`는 사용자가 정하기 전까지 커밋하지 않는다.

## I. 기록

- `docs/DECISIONS.md`: WORKFLOW 9절 구성. 제품 결정의 원본은 설계안·UI_DESIGN_SYSTEM이고, DECISIONS.md는 그 위치와 운영·기술 결정을 적는다.
- `docs/REPORT.md`: WORKFLOW 5절 형식. 독립 리뷰 원문은 PR 코멘트에 두고 REPORT.md에는 요약만 적는다.
