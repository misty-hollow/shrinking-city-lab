# Production 운영 (geoleobom.kr)

기준일: 2026-09-29. 이 문서는 **지금 공개 중인 사이트가 어디서 어떻게 서빙되는지, 새 릴리스와 되돌리기를 어떻게 하는지**를 적습니다.
공개 전 준비 기록은 `RELEASE_READINESS.md`에 있습니다(그 6절의 VPS 배포는 전환 기간에만 썼습니다).

## 1. 구조

| 항목 | 값 |
|---|---|
| 호스팅 | GitHub Pages(무료, 이 저장소). 서버·API·OSRM 없음 |
| 서빙 원본 | `gh-pages` 브랜치 = 빌드 산출물만(`deploy/build_release.sh`의 `dist/`) + 호스팅 파일 3개 |
| 호스팅 파일 | `CNAME`(`geoleobom.kr`), `.nojekyll`(파일을 그대로 서빙), `404.html`(= `index.html`, 깊은 주소 물러섬) |
| 도메인 | `geoleobom.kr`(www 없음). DNS는 호스팅케이알(`ns1~4.hosting.co.kr`) |
| DNS 레코드 | A `185.199.108.153` · `185.199.109.153` · `185.199.110.153` · `185.199.111.153` (TTL 180) |
| HTTPS | GitHub가 발급·갱신하는 인증서, 저장소 Settings → Pages의 **Enforce HTTPS** 켬 |
| 도메인 소유 인증 | 계정 `misty-hollow`에서 `geoleobom.kr` **verified**(2026-09-29). TXT `_github-pages-challenge-misty-hollow.geoleobom.kr`는 **지우지 않습니다**(지우면 인증이 풀려 다른 계정이 이 도메인을 Pages에 걸 수 있습니다) |

GitHub Pages라서 달라지는 점:
- 응답 헤더를 정할 수 없습니다. `noindex`는 `index.html`의 `<meta name="robots">`로 적용됩니다(HSTS·CSP 헤더 없음, 걸어봄 때와 같음).
- 깊은 주소(옛 걸어봄 공유 주소 `/p/...` 등)는 **상태 404**와 함께 앱 HTML을 돌려줍니다. 브라우저에서는 앱이 그대로 뜹니다.
- 모든 파일은 `Cache-Control: max-age=600`입니다. 자산은 해시 이름이라 새 릴리스와 섞이지 않습니다. 전송은 gzip으로 압축됩니다.

## 2. 새 릴리스

전제: 그 커밋이 `origin/main`에 있고 CI가 success. 모든 명령은 Git Bash, 저장소 루트에서 실행합니다.

```
SHA=<main 커밋 40자>
OUT=../scl-release
bash deploy/build_release.sh "$SHA" "$OUT"            # git archive → npm ci → 테스트 → vite build --base=/

git fetch origin gh-pages
git worktree add ../scl-gh-pages origin/gh-pages --detach
cd ../scl-gh-pages
git rm -rq . && cp -r "$OUT/dist/." . && printf 'geoleobom.kr\n' > CNAME && : > .nojekyll && cp index.html 404.html
git add -A && git commit -m "release: Shrinking City Lab $SHA"
git push origin HEAD:gh-pages                          # force push 하지 않는다(이력 = 릴리스 기록)
```

확인(Pages 빌드가 `built`가 된 뒤):
```
gh api repos/misty-hollow/shrinking-city-lab/pages/builds/latest --jq '{status,commit}'
python deploy/smoke_web.py --base-url https://geoleobom.kr --lock "$OUT/data.lock.json" \
    --expect-asset "$(cat "$OUT/MAIN_ASSET")" --probe-path ""
curl -s https://geoleobom.kr/p/36.47130,127.14020 | cmp - "$OUT/dist/index.html"   # 깊은 주소 = 앱 HTML(상태 404)
```
- `--probe-path ""`: smoke의 깊은 주소 검사는 상태 200을 기대합니다(SPA 물러섬 서버용). Pages는 404이므로 위 `cmp`로 따로 봅니다.
- 끝나면 `git worktree remove ../scl-gh-pages`.

## 3. 되돌리기

`gh-pages`의 커밋 하나가 릴리스 하나입니다. 직전 릴리스로 돌아가려면 **새 커밋으로** 되돌립니다.
```
cd ../scl-gh-pages            # 2절처럼 origin/gh-pages 작업트리
git revert --no-edit HEAD && git push origin HEAD:gh-pages
```
- 더 이전 릴리스: `git log --oneline` 에서 고른 커밋의 트리로 `git rm -rq . && git checkout <커밋> -- . && git commit`.
- Pages가 다시 빌드되기까지 1분 안팎 걸립니다. 그다음 2절 확인을 합니다.

## 4. 현재 공개 릴리스

| 항목 | 값 |
|---|---|
| 앱 커밋(main) | `b323c8a86385682fb9d88a1788e4357660e50e9f` (CI success) — RC `01b0da7` + 진료일정 이용조건 표기 수정(PR #9, `data/manifest.json` 한 줄) |
| `gh-pages` 커밋 | `caf9acd` |
| 직전 릴리스(되돌리기 대상) | 앱 `01b0da7` = `gh-pages` `5873af0`. 3절 `git revert HEAD`가 이것으로 돌아갑니다. `67939c5`→`5873af0`은 GitHub가 도메인 재등록 때 CNAME을 지웠다 다시 만든 커밋이고 앱 파일은 같습니다 |
| 주 자산 | `assets/index-0xOS-18U.js` |
| 자료 판본 | `scl01-gongju-r2` (앱 자료 6개 = `pipeline/data.lock.json`) |
| 공개 | 2026-09-29. DNS 전환 21:55 KST, 인증서 발급 22:13 KST(만료 2026-12-28, GitHub 자동 갱신) |
| 공개 뒤 확인 | `01b0da7`: 파일 195개 SHA256 = 빌드, smoke 실패 0, 브라우저 QA 433 PASS / 0 FAIL, 요청 호스트 `geoleobom.kr` 하나(GitHub IP). `b323c8a`: 빌드 차이 `data/manifest.json` 하나, 공개 manifest = 빌드, smoke 실패 0, S8(1440·390 폭)에 새 표기만 보임 |

DNS를 다시 바꿀 때 알아 둘 것(2026-09-29 전환에서 겪음):
- 호스팅케이알의 ns1·ns3은 몇 분 안에 바뀌지만 **ns2·ns4(`43.201.141.93`)는 약 1시간 뒤에** 따라왔습니다(SOA 일련번호는 같았음). 그동안 GitHub는 "GitHub 아닌 IP가 섞여 있다"며 인증서를 내주지 않습니다.
- 네 곳이 모두 맞은 뒤에도 인증서 요청이 자동으로 시작되지 않으면, 도메인을 뺐다가 다시 넣습니다(`gh api -X PUT repos/misty-hollow/shrinking-city-lab/pages -F cname=null` → `-f cname=geoleobom.kr`). 이때 GitHub가 `gh-pages`에 CNAME 삭제·생성 커밋을 만들고 빌드가 실패로 찍힐 수 있으니 `gh api -X POST repos/misty-hollow/shrinking-city-lab/pages/builds`로 다시 빌드합니다.

## 5. 옛 VPS(걸어봄 운영 서버)

- 2026-09-29 DNS 전환 뒤 production 경로가 아닙니다. 앱은 VPS·걸어봄 `/api`·OSRM 어느 것도 부르지 않습니다.
- 전환 기간에는 VPS도 같은 릴리스(`/srv/geoleobom/web/current → scl-01b0da7…`)를 서빙했습니다. 옛 DNS 응답을 캐시한 방문자를 위해서입니다.
- VPS를 종료해도 이 사이트에는 영향이 없습니다. 종료 뒤에는 `RELEASE_READINESS.md` 6절(VPS 배포·되돌리기)을 쓸 수 없습니다. 되돌리기는 3절(`gh-pages`)만으로 됩니다.
- 종료 전 보존 확인(2026-09-29): 서버의 걸어봄 자료 배포본 중 `2026Q3-cc-02`·`2026Q3-cc-03`·`synthetic-cc-01`의 `poi.gpkg`는 개발 PC 빌드와 sha256이 같고, 서버에만 있던 `2026Q3-cc-01`은 개발 PC 백업 폴더에 복사해 대조했습니다(`vps-2026-09-29/`). OSRM 그래프는 원본 pbf에서 다시 만들 수 있고, API 이미지는 GHCR에 있습니다. `/opt/geoleobom/.env*`의 비밀값은 보존하지 않습니다(키는 발급처에서 폐기).
