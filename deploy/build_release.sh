#!/usr/bin/env bash
# 커밋 하나에서 사이트 뿌리 배포용 정적 빌드를 만든다(작업트리가 아니라 git archive).
#
#   bash deploy/build_release.sh <40자 커밋 SHA> <출력 폴더>
#
# - app/을 그 커밋 그대로 꺼내 npm ci → 테스트 → `vite build --base=/`
#   (geoleobom.kr은 SPA 물러섬을 쓰므로 /p/... 같은 깊은 주소에서도 자산·자료를 뿌리에서 찾아야 한다)
# - 출력: <출력 폴더>/dist, <출력 폴더>/data.lock.json(그 커밋의 잠금 — smoke가 자료 바이트를 대조한다),
#         <출력 폴더>/MAIN_ASSET(주 자산 경로)
set -euo pipefail

SHA="${1:-}"
OUT="${2:-}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "usage: $0 <40자 커밋 SHA> <출력 폴더>" >&2; exit 2; }
[[ -n "$OUT" ]] || { echo "출력 폴더가 없다" >&2; exit 2; }
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
git -C "$REPO" cat-file -e "$SHA^{commit}" 2>/dev/null || { echo "커밋이 없다: $SHA (git fetch 먼저)" >&2; exit 1; }

rm -rf "$OUT" && mkdir -p "$OUT/src"
git -C "$REPO" archive "$SHA" app pipeline/data.lock.json | tar -x -C "$OUT/src"
cp "$OUT/src/pipeline/data.lock.json" "$OUT/data.lock.json"

(
	cd "$OUT/src/app"
	npm ci --no-fund --no-audit
	npm test
	npm run build -- --base=/
)
mv "$OUT/src/app/dist" "$OUT/dist"
rm -rf "$OUT/src"

DIST="$OUT/dist"
test -f "$DIST/index.html" || { echo "dist/index.html 없음" >&2; exit 1; }
test -f "$DIST/licenses/THIRD_PARTY_NOTICES.txt" || { echo "라이선스 고지 없음" >&2; exit 1; }
for f in scenario.json geometry.json landscape.json golden.json manifest.json terrain.bin; do
	test -s "$DIST/data/$f" || { echo "앱 자료 없음: data/$f" >&2; exit 1; }
done
# 뿌리 기준 빌드인지: 자산 경로가 /assets/로 시작해야 한다(./assets/면 깊은 주소에서 깨진다).
MAIN="$(grep -o '"/assets/index-[A-Za-z0-9_-]*\.js"' "$DIST/index.html" | head -1 | tr -d '"')"
[[ -n "$MAIN" ]] || { echo "index.html이 /assets/index-*.js를 가리키지 않는다(--base=/ 빌드가 아니다)" >&2; exit 1; }
if grep -q '"\./assets/' "$DIST/index.html"; then echo "상대 자산 경로가 남아 있다" >&2; exit 1; fi
echo "${MAIN#/}" >"$OUT/MAIN_ASSET"
echo "빌드 완료: $SHA → $DIST (주 자산 $MAIN, $(find "$DIST" -type f | wc -l) 파일)"
