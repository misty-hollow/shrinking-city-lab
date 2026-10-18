# CLAUDE.md — Shrinking City Lab

진료일을 나누다(공주 보건지소 편). 공개 저장소 `misty-hollow/shrinking-city-lab`, 기본 브랜치 main, 운영 사이트 geoleobom.kr(GitHub Pages `gh-pages`).
앱은 React 18 + TypeScript + Vite + three.js(WebGL), Node 24이고, 파이프라인은 Python 3.12다(OSRM·docker는 데이터 재생성 때만 쓴다).
배포 형태는 웹 하나다. 전시 키오스크도 같은 빌드(`?kiosk=1`)이고, `deploy/`의 VPS 경로는 예비다.

이 파일은 개발 방식만 다룬다. 제품 기준은 아래 문서에 있다.

- 제품·계산·데이터·미션 의미: `docs/설계안_v0.1.md` · 화면 표현: `docs/UI_DESIGN_SYSTEM.md`
- 데이터 이용조건: `DATA_LICENSE.md` · 운영 배포: `docs/release/PRODUCTION.md` · 공개 준비·알려진 문제: `docs/release/RELEASE_READINESS.md`
- 결정과 이유: `docs/DECISIONS.md` · 지금 상태·열린 문제·다음 작업: `docs/WORKLOG.md`

## 1. 협업 방식

- 사용자는 개발 지식이 많지 않다. 조사, 요구사항 구체화, 기술 판단, 구현, 실행, 검증, 오류 수정, PR, 병합은 Claude가 주도한다.
- 기술 선택은 근거를 갖고 Claude가 정하며 사용자에게 묻지 않는다. 사용자에게 묻는 것은 제품·UX 결정과 6절의 승인 대상뿐이다. 물을 때는 추천 기본안을 붙이고, 가능하면 직접 볼 수 있는 작은 결과(스크린샷, 임시 실행)도 함께 보여 준다.
- 작업 범위 안에서는 단계마다 승인을 기다리지 않는다.
- 직접 확인한 것과 추정한 것을 구분해서 보고한다. 하지 못한 검증은 PR 본문과 보고에 드러낸다.
- 실패하면 원인과 새 증거(로그, 재현, 범위 축소)를 찾아 진행한다. 같은 가설을 되풀이하지 않는다. 풀 수 없는 장애는 상태·시도한 것·추천하는 다음 행동을 `docs/WORKLOG.md`에 남기고 사용자에게 알린다.
- 테스트 기준을 낮추거나 검사를 건너뛰어 통과시키지 않는다. 브라우저 QA 하네스도 마찬가지다.
  승인된 화면·문구 변경을 따라 기대값만 바꿀 때는 근거(설계안·커밋)와 전후 문구를 PR 본문에 적는다.
  기존 검사로 충분하면 테스트를 억지로 추가하거나 고치지 않고, 부족할 때만 보강한다.
- 서브에이전트(`.claude/agents/implementer.md` 구현, `reviewer.md` 읽기 전용 리뷰)와 다른 모델의 검토는 필요할 때 쓰는 선택 수단이다.
  다른 모델 검토로 Claude가 직접 부를 수 있는 것은 `codex:codex-rescue` 에이전트(Codex 플러그인 1.0.6)뿐이다. 이 에이전트는 Codex `task`를 호출한다.
  - `--write`를 붙이면 Codex 샌드박스가 `workspace-write`, 빼면 `read-only`다(`scripts/codex-companion.mjs`). 에이전트는 기본으로 `--write`를 붙이고, 요청이 읽기 전용·진단·리뷰일 때만 뺀다.
  - 그래서 검토만 맡길 때는 요청 맨 앞에 "읽기 전용 진단, 코드 수정 금지(do not pass --write)"를 쓴다. 호출 뒤에는 작업 기록 `~/.claude/plugins/data/codex-openai-codex/state/<저장소>-*/jobs/task-*.json`에서 `"write":false`인지 확인한다.
  - 이 문구와 기록 확인은 쓰기를 막는 장치가 아니다. 실제 제한은 Codex의 `read-only` 샌드박스에 달려 있다. 그래서 호출 전후에 `git status --porcelain`·`git diff`·미추적 파일 해시를 비교하고, 바뀐 것이 있으면 보고하며 검토 없이 채택하지 않는다.
  - `/codex:review`·`/codex:adversarial-review`는 플러그인이 모델 호출을 막아 둔(`disable-model-invocation`) 사용자 명령이다. 사용자가 원할 때만 쓰고, 사람이 명령을 옮겨 주는 단계를 필수 절차로 만들지 않는다.
- 추가 API 과금 없이 기존 구독 범위에서 운영한다. CI는 AI를 부르지 않는다.

## 2. 프로젝트 제약

다음은 바꾸지 않는다. 바꿔야 한다면 제품 결정이므로 사용자에게 묻는다.

- **계산 의미**: `A_i = min(5, 기준시간 안 지소 진료일 합)`, KPI 6개 정의, 미션 목표치와 판정 경계, 참고 배분, 배분 지형도. 정의는 설계안을 따른다.
  앱 엔진(`app/src/engine/**`)은 파이썬 `pipeline/scl_pipeline/model.py`와 정의가 같아야 하고, 골든 값(`app/public/data/golden.json`)으로 대조한다. 미션 결과와 판정은 `app/src/state/results.ts`에 보관한다.
- **재현성**: 원본부터 다시 만들면 추적 파일이 바이트 단위로 같아야 한다. `scl_pipeline verify`가 이것을 대조하고, `pipeline/data.lock.json`이 해시를 잠근다. 줄 끝은 `.gitattributes`로 LF에 고정한다.
  각 단계 코드의 해시는 `provenance.step_code_sha256`에 기록된다. 그래서 `pipeline/scl_pipeline/**`를 고치면 그 단계를 다시 돌려야 하고, 이것은 데이터 재생성이라 6절의 승인 대상이다.
  파이프라인 산출물(`pipeline/derived/**`, `pipeline/reports/**`, `pipeline/data.lock.json`, `app/public/data/**`)은 손으로 고치지 않고 해당 단계로만 만든다.
  입력(`pipeline/sources/**`)을 바꾸면 영향받는 단계를 다시 돌리고 `verify`로 대조한다.
- **정책을 추천하지 않는다**(설계안 1-2·2-7·5-12). 금지어 검사 `app/src/content/forbidden.test.ts`와 금지어 목록을 완화하지 않는다. 화면 문구는 `app/src/content/copy.ts`에 있다.
- **실제 자료·계산값·게임 가정을 구분해 표기한다**(설계안 4-1, README 「데이터 의미와 출처」, S8 「자료와 한계」). 출처·이용조건 표기는 `DATA_LICENSE.md`·`app/public/licenses/**`와 맞춘다.
- **런타임 외부 호출 없음**: 앱은 정적 파일만 읽는다. 외부 API, 지도 타일, 추적·분석 스크립트를 넣지 않는다.
- **접근성**: 움직임 줄이기, 스크린리더 문장(라이브 영역), 키보드 조작을 없애지 않는다.
- **원자료**: 공주시 원본 xlsx와 페이지 발췌는 저장소에 넣지 않는다. `pipeline/cache/`(충청권 OSM 추출본·공주시 원본, 다시 받을 수 없음)는 지우거나 옮기지 않는다.

## 3. 작업 순서

1. **시작**: `git status`, 브랜치, 열린 PR, `docs/WORKLOG.md`를 본다. 기록과 실제 git 상태가 다르면 git을 믿고 차이를 알린다.
   본 체크아웃(`shrinking-city-lab`)에는 사용자가 추적하지 않은 파일이 있다. 이 파일들은 건드리지 않는다(stash·restore·checkout·삭제·커밋 금지).
   작업은 `origin/main`에서 만든 worktree(`../shrinking-city-lab-<작업명>`)에서 한다.
2. **작업 브랜치**(`feat/` `fix/` `docs/` `design/` `data/` `chore/`)에서 구현한다. main에 직접 commit하거나 push하지 않는다.
3. **검증**(4절)은 변경 영향에 맞춰 한다. 그다음 commit(`fix(data): …` 같은 형식의 요약), push, PR 순서로 진행한다. PR 본문에는 무엇을 왜 바꿨는지, 실제 검증 결과, 검증 공백을 적는다.
4. **CI**: PR 최신 head의 필수 체크를 확인하고, 실패하면 원인을 찾아 고친다. 결과를 모르면 끝난 것이 아니다.
5. **병합**(5절)도 Claude가 한다. `docs/WORKLOG.md`는 같은 PR 안에서 병합 뒤의 상태로 짧게 고쳐 둔다. 병합 커밋 해시는 git에 남는다.

## 4. 검증

변경 영향에 맞춰 고른다. 전체 플레이 검사를 기계적으로 반복하지 않는다. 다만 필요한 검증을 빼거나 기준을 낮추지도 않는다.

| 변경 | 로컬에서 할 것 |
|---|---|
| 코드·데이터·의존성·빌드 설정(`app/`·`pipeline/`·`deploy/`·`.github/`) | 아래 CLI 검사 전부(몇 분) |
| 화면·입력·상태에 영향(아래 목록) | CLI 검사 + 브라우저 QA + 스크린샷 직접 검토 |
| 무대·렌더러·에셋 | 위 + 성능(`node scripts/perf-probe.mjs`, 운영 빌드, 저사양 흉내 포함, `qa-shots/perf/`) |
| 소리 | 위 + `node scripts/sound-audition.mjs`(청취 파일 `qa-shots/sound/`, 판단은 사용자) |
| 문서만(주석만 바꾼 설정·에이전트 정의 포함) | `git diff --check`, 문서 속 경로·명령·참조가 실제와 맞는지 확인, 주석만 바뀌었는지 확인. 나머지는 PR CI가 맡는다 |

CLI 검사(로컬은 Windows + Git Bash, 저장소 루트에서 실행. 줄마다 따로 돌려도 되고, 괄호 안에서 폴더를 옮기므로 끝나면 루트로 돌아온다):

```
git diff --check origin/main...HEAD
for f in deploy/*.sh; do bash -n "$f"; done; python -m py_compile deploy/smoke_web.py
(cd pipeline && python -m ruff check . && python -m ruff format --check . && python -m pytest -q && python -m scl_pipeline verify)
(cd app && npm ci && npm run build && npm test)      # build = tsc -b && vite build, test = vitest run(watch 금지)
```

- 파이썬 편집 설치(`pip install -e ".[dev]"`)는 그 작업 트리 전용 `pipeline/.venv`에 한다. 다른 체크아웃의 venv는 쓰지 않는다.
- 개발 서버를 켠 채로 `npm ci`를 하면 rolldown 바이너리가 잠겨 EPERM이 난다. 서버를 멈추고 실행한다.
- CI(`.github/workflows/ci.yml`, ubuntu-24.04)는 PR(base main)·main push·수동 실행에서 세 job을 돈다. 이 세 job이 main의 필수 체크다.
  - repository: 바뀐 줄 공백, Git 이력 gitleaks, 배포 스크립트 구문
  - pipeline: ruff, pytest, verify
  - app: npm ci, build, vitest, 뿌리 기준 빌드(`--base=/`)와 정적 smoke(`deploy/smoke_web.py`)

  gitleaks와 뿌리 기준 smoke는 CI에서만 확인한다. 깊은 주소(SPA 물러섬)는 `deploy/dryrun_local.sh`로 확인하는데, docker를 쓰므로 6절 승인 대상이다.

**화면·입력·상태 영향**이 있는 곳: `app/src/**`, `app/index.html`, `app/public/**`, `app/vite.config.ts`, 그리고 앱 데이터를 바꾸는 파이프라인 산출물(`pipeline/derived/**` → `app/public/data/**`). 하네스(`app/scripts/browser-qa.mjs`·`qa-geometry.mjs`)를 바꿨으면 그 하네스로 한 판을 다시 돌린다.

### 브라우저 QA (로컬 전용, Edge·WebGL 필요, CI에서는 돌지 않음)

`app/`에서 실행한다:

```
npx vite --port 5199 --strictPort --host 127.0.0.1          # 개발 서버. 소리·무대 성능 창은 개발 서버에서만 있다. 5199가 쓰이고 있으면 다른 포트 + QA_BASE_URL
npm i --no-save --no-fund --no-audit playwright-core@1.63.0  # 의존성에 넣지 않는다. 버전 고정
npm run qa:browser                                           # QA_BASE_URL, QA_BROWSER_CHANNEL(기본 msedge). 약 100초
```

- 결과는 `app/qa-shots/report.json`과 체크포인트 PNG로 남는다. `meta`에는 커밋·주소·브라우저·playwright 버전·시각이 들어간다. FAIL이 하나라도 있으면 종료 코드는 1이다.
  예외로 멈춘 묶음(화면 크기 단위)은 FAIL「실행 중단」과 `fail-<묶음>.png`를 남기고 다음 묶음으로 넘어간다. 입력 순서는 고정이고 무작위는 없다. 재현은 `meta`와 같은 명령으로 한다.
- `qa-shots/`는 이전 결과를 지우지 않는다. 새로 돌리기 전에 `*.png`·`report.json`을 비우거나 시각으로 구분한다(`sound/`·`perf/`는 다른 스크립트 결과다). 실패한 실행의 결과는 원인을 밝히기 전까지 남겨 둔다.
- 대표 경로(하네스가 매번 돈다):
  - 1440×900 한 판: S0 → S1 3장 → S2 튜토리얼 → S3 → S4 키보드 15일 배분(미리보기·되돌리기·위에서 보기) → S5 → S8 → 미션 2·3(목표 경계 미달→달성, 10·20분에서도 15분 판정) → S6
  - 1024×768과 1280×800(움직임 줄이기)은 같은 경로의 축약이다.
  - 전시: 건너뛰기 판 → S6 참고 배분, 90초 무입력 → 시작 화면
  - 390×844: 모바일 안내, 자료와 한계
- 객관 검사(같은 실행에서 함께 돈다):
  - KPI·판정 경계(`golden.json`), 결과 보존, 풀 제한, 금지어
  - WebGL canvas, 콘솔·페이지 오류 0, 소리, GPU 프레임
  - 가로 넘침과 DOM 기하(`scripts/qa-geometry.mjs`): HUD 판(`data-occlude`)과 세계 라벨의 겹침, 기준 변경 소식과 HUD 판·말풍선·잃은 마을 표지의 겹침, 화면 끝에 걸린 라벨, 전체 시점의 흐린 말풍선 0, 판 안 가로 잘림
  - 시간 축: 빛 도착 전·후 지표(`light-until`), 움직임 줄이기, 키오스크 90초 복귀(가짜 시계). 측정값 위주로 보고, 시작·중간·끝 스크린샷은 감상 화면(`s5-appreciate`)에서만 찍는다
- 디버그 핸들은 상태를 읽고 관찰하는 데만 쓴다: `data-testid="game-state"`, `light-until`, 개발 서버의 `window.__sclSound.debug()`·`window.__sclStage.info()/bench()`, 가짜 시계. 검증 대상 행동은 키보드·클릭·hover로 한다.
- 스크린샷 직접 검토: 기본 체크포인트는 다음과 같고, 실행당 16장까지 본다.
  - 1440: `s0-start`·`s2-moved`·`s4-play`·`s4-m2-play`·`s5-world`·`s5-debrief`·`s5-m2-compare`·`s6-world`·`s6-three`·`s8-data`
  - 1024: `s4-play`·`s5-world` · 1280: `s4-play` · `390x844-mobile`
  - 실패했으면 `fail-*.png`도 본다.

  화면을 바꿨으면 바뀐 화면 주변에서 하네스 밖 조작 2~3가지를 임시 스크립트(작업 폴더 밖)나 내장 브라우저로 해 본다.
- 확인된 환경(2026-10-12): Windows 11, Edge 155.0.4283.45, playwright-core 1.63.0, Node 24.14.1.

알려진 검증 공백(아직 수단이 없다):
- 기준 스크린샷 비교. 무대가 WebGL·애니메이션이라 마스크 설계가 필요하다.
- 기준 변경 소식과 마을 이름·도로망 시간 태그의 겹침.
- 지형에 새긴 읍·면 이름(캔버스), 3D 깃발·탑과 HUD의 겹침. 이것들은 DOM 밖에 그려진다.
- CI에서 브라우저 QA를 돌리는 것. GPU 없는 러너용 WebGL 대체와 브라우저 설치가 필요하다.
- 저사양 실제 기기(통합 GPU)에서 적응 화질이 내려가 조작이 끊기지 않는지. 그래픽 기준 기기는 RX 9070 데스크톱이고 고정 사양 상한은 없다(설계안 6-23).

수단 확보 후보로는 위 공백들과 playwright-core devDependency 고정(의존성 추가)이 있다. 필요할 때 별도 작업으로 한다.

사람만 판단할 수 있는 것은 사용자에게 보여 주고, 어느 화면에서 무엇을 볼지와 스크린샷 경로를 함께 적는다. 겹침·잘림·빈 화면·콘솔 오류처럼 도구로 확인할 수 있는 것은 Claude가 확인하고 사용자에게 넘기지 않는다.
- 3D 무대(빛·집·진료등 탑·길의 빛)의 분위기와 읽힘: `qa-shots/1440x900-s0-start.png`·`-s4-play.png`·`-s6-world.png`
- 한 판의 흐름·난이도·재미, 미션 판정이 납득되는지: `docs/release/PLAYTEST.md`
- 소리: `docs/release/SOUND_QA.md`
- 문구 톤(교육용, 추천하지 않음)과 모바일 안내 화면의 말투
- 전시 기기의 체감 성능과 키오스크 90초 복귀의 체감

## 5. 병합 (Claude가 한다)

조건은 세 가지다. 필요한 로컬 검증이 통과했고, PR 최신 head의 필수 체크 `repository`·`pipeline`·`app`이 success이고, 검증 공백이 PR에 적혀 있어야 한다.

1. 최신 main이 작업 브랜치에 들어 있는지 확인한다. 룰셋이 up-to-date를 요구한다. 뒤처졌으면 main을 merge한다(rebase는 쓰지 않는다).
   통합으로 코드가 바뀌었으면 영향받는 검증을 다시 하고, 새 head의 체크를 기다린다.
2. 병합 직전에 `git fetch`를 하고, PR head와 `origin/main`이 확인했을 때 그대로인지 다시 본다.
3. `gh pr merge <N> --merge --match-head-commit <확인한 head sha>`로 병합한다(merge commit, DECISIONS D-004).
   권한 설정의 병합 확인 창은 그대로 둔다. `--admin`·`--auto`·API 직접 병합 같은 우회는 쓰지 않는다.
4. 병합 뒤에 두 가지를 확인한다.
   - 병합 커밋의 트리가 확인한 head의 트리와 같은지: `git rev-parse origin/main^{tree}`와 `<head>^{tree}`를 비교한다.
   - main에서 도는 CI 결과. 실패하면 바로 다음 작업으로 잡는다.
5. 정리한다.
   - 로컬 브랜치만 `git branch -d`로 지운다. 원격 브랜치 자동 삭제는 서버 설정(현재 꺼짐)에 맡긴다.
   - 본 체크아웃의 main은 `git merge --ff-only origin/main`으로 맞춘다. 추적 파일에 변경이 없을 때만 하고, 그래야 다음 세션이 최신 지침을 읽는다.

PR 병합은 운영 배포가 아니다. push·PR·병합으로 실행되는 배포는 없다.

## 6. 승인이 필요한 행동

먼저 사용자에게 묻는다. 한 승인을 다른 행동으로 넓히지 않는다. 승인 전에 할 수 있는 준비와 검증은 미리 해 둔다.

- **운영 배포**: `gh-pages` push(geoleobom.kr)와 그 되돌리기(절차는 `docs/release/PRODUCTION.md` 2·3절). VPS 경로(`deploy/deploy_geoleobom.sh`, 걸어봄 저장소의 `rollback.sh`, `ssh geoleobom`)와 docker를 쓰는 `deploy/dryrun_local.sh`도 포함한다.
- **데이터 재생성**: `scl_pipeline`의 `fetch`·`import`·`boundaries`·`osm`·`route`·`routes`·`terrain`·`build`·`check-mois`·`all`. docker·OSRM·네트워크를 쓰는 단계는 전부 해당한다. 승인 없이 돌려도 되는 것은 `verify`뿐이다.
- `pipeline/cache/` 삭제·이동.
- **GitHub 설정**: 룰셋·브랜치 보호, Pages, 기본 브랜치, 병합 방식, 비밀값, 공개 여부. DNS와 도메인 인증 TXT도 포함한다.
- **외부로 나가는 것**: 공주시·기관 문의 같은 연락, 원본 자료 공개, QA 스크린샷·보고서의 외부 업로드(CI 아티팩트 추가 포함).
- 비용이 드는 일(API 과금, 유료 서비스), 자격증명 변경, 이력 재작성(force push), 되돌릴 수 없는 삭제.

## 7. 보호 장치 (2026-10-14 조회)

문서의 금지 문장은 지시일 뿐이다. 실제로 막는 것은 아래 두 장치다.

- **서버**: 룰셋 "Protect main"(active)
  - PR 필수(승인 0명), 필수 체크 `repository`·`pipeline`·`app`, up-to-date 필수, 삭제·강제 push 금지, 우회자 없음
  - 허용 병합 방식은 merge·squash·rebase이고, 이 저장소는 merge commit을 쓴다
  - head 브랜치 자동 삭제는 꺼져 있다
- **Claude Code 권한**: `.claude/settings.json`
  - deny: main push, force push, `reset --hard`, `gh pr merge --admin/--auto`, 권한 우회 옵션, 이 파일 편집
  - ask: `gh pr merge`, gh-pages push, 데이터 재생성, docker, ssh, `gh api` 쓰기

권한 파일은 사용자가 고친다. 권한 때문에 막히면 다른 도구로 우회하지 않는다. 막힌 항목과 필요한 조치만 사용자에게 알린다.
워크플로는 `CI`와 `pages-build-deployment`(GitHub 관리, `gh-pages` push에만 반응) 두 개다. CI는 외부로 아무것도 올리지 않는다.

## 8. 커밋하지 않는 것

- `.claude/settings.local.json`과 그 백업, 인증 정보·토큰·`.env*`, `pipeline/cache/`, 공주시 원본 xlsx·페이지 발췌, `qa-shots/`, `pipeline/.venv/`
- `.claude/` 아래 파일은 개별 경로로만 `git add`한다(`git add .claude/`·`git add -A` 금지).
- 사용자가 추적하지 않은 채 둔 `.claude/skills/`·`.agents/`·`skills-lock.json`·`STATUS.md`는 사용자가 정하기 전까지 커밋하지 않는다.
- 브라우저 QA는 화면 크기 묶음마다 새 브라우저·새 컨텍스트를 쓰므로 실제 Edge 프로필과 섞이지 않는다. 앱 데이터(`app/public/data/**`)는 읽기만 한다.

## 9. 기록

- `docs/WORKLOG.md`: 지금 상태, 열린 문제, 다음 작업만 짧게 적는다. 작업마다 고쳐 쓰고, 지난 내용은 git에 맡긴다.
- `docs/DECISIONS.md`: 제품 결정이 어디에 있는지, 운영·기술 결정과 그 이유.
- PR 본문: 변경 내용, 실제 검증 결과, 검증 공백. 별도의 긴 보고서는 쓰지 않는다.
- 배포 이력: `docs/release/PRODUCTION.md` 4절.
