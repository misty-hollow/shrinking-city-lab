#!/usr/bin/env bash
# geoleobom.kr 교체 배포의 로컬 예행연습(운영 서버·DNS를 건드리지 않는다).
#
#   bash deploy/dryrun_local.sh <SCL 커밋 40자> --geoleobom-repo <걸어봄 저장소 경로> [--port 8787] [--keep]
#
# 운영과 같은 것: 걸어봄 deploy/Caddyfile(주소만 :8080, api upstream만 닫힌 포트로 바꾼다 — 걸어봄 caddy_check.py와
# 같은 방식), 운영과 같은 Caddy 이미지(compose.yaml의 고정값), 걸어봄 deploy/web_release.sh의 install_release·
# switch_current·atomic_link, /srv/web 아래 불변 릴리스 + current/previous 링크(도커 볼륨 안의 진짜 리눅스 링크).
# 지금의 걸어봄 릴리스는 자산 하나짜리 대역(stub)으로 둔다.
#
# 순서: 대역을 current로 → SCL 설치·전환(previous = 대역) → smoke_web.py → 되돌리기(링크 맞바꿈, rollback.sh web과
# 같은 두 줄) → 대역 확인 → 다시 앞으로 → smoke_web.py. --keep이면 끝난 뒤 Caddy를 띄워 둔다(브라우저 QA용).
set -euo pipefail

SHA=""
GB=""
PORT=8787
KEEP=0
while [[ $# -gt 0 ]]; do
	case "$1" in
	--geoleobom-repo) GB="$2"; shift 2 ;;
	--port) PORT="$2"; shift 2 ;;
	--keep) KEEP=1; shift ;;
	-*) echo "알 수 없는 인자: $1" >&2; exit 2 ;;
	*) SHA="$1"; shift ;;
	esac
done
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "usage: $0 <40자 커밋> --geoleobom-repo <경로>" >&2; exit 2; }
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test -f "$GB/deploy/web_release.sh" && test -f "$GB/deploy/Caddyfile" && test -f "$GB/deploy/compose.yaml" ||
	{ echo "걸어봄 저장소 경로가 아니다: $GB" >&2; exit 1; }
# Git Bash: 컨테이너 안 경로(/srv/web 등)가 Windows 경로로 바뀌지 않게 docker 호출에만 끈다(git·python 인자는 그대로 둔다).
_DOCKER="$(command -v docker.exe || command -v docker)"
dk() { MSYS_NO_PATHCONV=1 "$_DOCKER" "$@"; }
# python 인자 중 /p/·/assets/로 시작하는 URL 경로만 변환에서 뺀다(걸어봄 deploy_web.sh와 같은 규율).
py() { MSYS2_ARG_CONV_EXCL='/p/;/assets/' python "$@"; }
winpath() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
CADDY_IMAGE="$(grep -o 'caddy:[^ ]*@sha256:[0-9a-f]*' "$GB/deploy/compose.yaml" | head -1)"
BASH_IMAGE="debian:bookworm-slim@sha256:88200866dfff7ea7f5cbcb6ec7c8a701889efe6fe859fe64d6990e4b07ea4171"
VOL="scl-dryrun-web"
NAME="scl-dryrun-caddy"

WORK="$(mktemp -d)"
cleanup() {
	if [[ $KEEP -eq 0 ]]; then dk rm -f "$NAME" >/dev/null 2>&1 || true; dk volume rm "$VOL" >/dev/null 2>&1 || true; fi
	rm -rf "$WORK"
}
trap cleanup EXIT

echo "== 1. 빌드"
bash "$REPO/deploy/build_release.sh" "$SHA" "$WORK/build"
MAIN_ASSET="$(cat "$WORK/build/MAIN_ASSET")"
RELEASE="scl-$SHA"

echo "== 2. 걸어봄 대역 릴리스와 Caddyfile"
mkdir -p "$WORK/stub/assets"
printf '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/index-GBSTUB01.js"></script></body></html>\n' >"$WORK/stub/index.html"
printf 'console.log("geoleobom stub")\n' >"$WORK/stub/assets/index-GBSTUB01.js"
sed -e 's/^geoleobom\.kr {/:8080 {/' -e 's/reverse_proxy api:8000/reverse_proxy 127.0.0.1:9/' "$GB/deploy/Caddyfile" >"$WORK/Caddyfile"
grep -q '^:8080 {' "$WORK/Caddyfile" || { echo "Caddyfile 사이트 주소를 바꾸지 못했다" >&2; exit 1; }
cp "$GB/deploy/web_release.sh" "$WORK/web_release.sh"

dk rm -f "$NAME" >/dev/null 2>&1 || true
dk volume rm "$VOL" >/dev/null 2>&1 || true
dk volume create "$VOL" >/dev/null
# 서버에서 도는 것과 같은 함수를 리눅스 컨테이너 안에서 돌린다(대역 → current, SCL → current, 대역 → previous).
in_root() { dk run --rm -v "$VOL:/srv/web" -v "$(winpath "$WORK"):/w:ro" "$BASH_IMAGE" bash -c "set -euo pipefail; . /w/web_release.sh; cd /srv/web; $1"; }
in_root "mkdir -p .staging-stub && cp -a /w/stub/. .staging-stub/ && install_release /srv/web gb-stub /srv/web/.staging-stub \"\$(release_digest /srv/web/.staging-stub)\" && switch_current /srv/web gb-stub"
. "$WORK/web_release.sh"
DIGEST="$(release_digest "$WORK/build/dist")"
in_root "mkdir -p .staging-$RELEASE && cp -a /w/build/dist/. .staging-$RELEASE/ && echo \"   릴리스 \$(install_release /srv/web $RELEASE /srv/web/.staging-$RELEASE $DIGEST)\" && switch_current /srv/web $RELEASE && ls -l current previous"

echo "== 3. 운영 Caddyfile로 서빙($CADDY_IMAGE)"
dk run -d --name "$NAME" -p "127.0.0.1:$PORT:8080" -v "$VOL:/srv/web:ro" -v "$(winpath "$WORK/Caddyfile"):/etc/caddy/Caddyfile:ro" "$CADDY_IMAGE" >/dev/null
for _ in $(seq 1 40); do curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null && break; sleep 0.25; done
BASE="http://127.0.0.1:$PORT"

echo "== 4. 전환 뒤 확인"
py "$REPO/deploy/smoke_web.py" --base-url "$BASE" --lock "$WORK/build/data.lock.json" --expect-asset "$MAIN_ASSET" \
	--probe-path /p/36.47130,127.14020 --expect-previous-asset /assets/index-GBSTUB01.js
HDR="$(curl -fsSI "$BASE/$MAIN_ASSET")"
grep -qi 'cache-control: public, max-age=31536000, immutable' <<<"$HDR" || { echo "FAIL 자산 캐시 헤더"; exit 1; }
grep -qi 'cache-control: no-cache' <<<"$(curl -fsSI "$BASE/")" || { echo "FAIL index.html no-cache"; exit 1; }
echo "PASS 캐시 헤더(자산 immutable, index.html no-cache)"

echo "== 5. 되돌리기 연습(rollback.sh web과 같은 링크 맞바꿈)"
in_root 'P="$(readlink previous)"; C="$(readlink current)"; test "$P" != "$C"; test -f "$P/index.html"; atomic_link "$C" /srv/web/previous; atomic_link "$P" /srv/web/current; ls -l current previous'
curl -fsS "$BASE/" | grep -q 'index-GBSTUB01.js' && echo "PASS 되돌린 뒤 / = 걸어봄 대역" || { echo "FAIL 되돌리기"; exit 1; }
curl -fsS -o /dev/null "$BASE/$MAIN_ASSET" && echo "PASS 되돌린 뒤에도 SCL 자산(열어 둔 탭) 200" || { echo "FAIL previous 물러섬"; exit 1; }

echo "== 6. 다시 앞으로"
in_root 'P="$(readlink previous)"; C="$(readlink current)"; atomic_link "$C" /srv/web/previous; atomic_link "$P" /srv/web/current; ls -l current previous'
py "$REPO/deploy/smoke_web.py" --base-url "$BASE" --lock "$WORK/build/data.lock.json" --expect-asset "$MAIN_ASSET" --probe-path /p/36.47130,127.14020 >/dev/null &&
	echo "PASS 다시 앞으로 간 뒤 smoke" || { echo "FAIL 다시 앞으로"; exit 1; }

echo
echo "예행연습 통과: $RELEASE ($MAIN_ASSET)"
[[ $KEEP -eq 1 ]] && echo "Caddy를 띄워 둔다: $BASE  (정리: docker rm -f $NAME && docker volume rm $VOL)"
