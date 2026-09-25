#!/usr/bin/env bash
# geoleobom.kr이 서빙하는 웹을 Shrinking City Lab 릴리스로 바꾼다(운영 배포 — 사용자 승인 뒤에만).
#
#   bash deploy/deploy_geoleobom.sh <SCL main 커밋 40자> --geoleobom-repo <걸어봄 저장소 경로> \
#        [--host geoleobom] [--base-url https://geoleobom.kr] --approved
#
# 걸어봄 운영의 웹 릴리스 방식을 **그대로** 쓴다(걸어봄 deploy/web_release.sh의 함수를 서버로 실어 보낸다):
#   /srv/geoleobom/web/<릴리스 ID>/ 불변 디렉터리 + current/previous 링크, 원자적 전환,
#   Caddy는 손대지 않는다(root /srv/web/current, /assets/* immutable + previous 물러섬, SPA 물러섬).
# 릴리스 ID는 scl-<커밋>이라 걸어봄 릴리스(40자 SHA)와 섞이지 않는다.
#
# 되돌리기(한 번에, 링크만 맞바꾼다): 걸어봄 저장소에서 `bash deploy/rollback.sh web --host geoleobom`
# 그 뒤 확인: 걸어봄 저장소에서 `python deploy/smoke.py --base-url https://geoleobom.kr --pages-only --check-assets`
set -euo pipefail

SHA=""
GB=""
HOST="geoleobom"
BASE_URL="https://geoleobom.kr"
APPROVED=0
WEB_ROOT="/srv/geoleobom/web"
while [[ $# -gt 0 ]]; do
	case "$1" in
	--geoleobom-repo) GB="$2"; shift 2 ;;
	--host) HOST="$2"; shift 2 ;;
	--base-url) BASE_URL="$2"; shift 2 ;;
	--approved) APPROVED=1; shift ;;
	-*) echo "알 수 없는 인자: $1" >&2; exit 2 ;;
	*) SHA="$1"; shift ;;
	esac
done
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "usage: $0 <40자 커밋> --geoleobom-repo <경로> --approved" >&2; exit 2; }
[[ $APPROVED -eq 1 ]] || { echo "운영 배포다. 사용자 승인을 받은 뒤 --approved로 실행한다." >&2; exit 2; }
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB="$GB/deploy/web_release.sh"
test -f "$LIB" || { echo "걸어봄 저장소의 deploy/web_release.sh가 없다: $LIB" >&2; exit 1; }

echo "== 0. 전제: 검증된 main 커밋"
git -C "$REPO" fetch -q origin main
git -C "$REPO" merge-base --is-ancestor "$SHA" origin/main || { echo "origin/main에 없는 커밋이다: $SHA" >&2; exit 1; }
CI="$(gh run list --repo misty-hollow/shrinking-city-lab --commit "$SHA" --workflow CI --json conclusion --jq '.[0].conclusion' 2>/dev/null || true)"
[[ "$CI" == "success" ]] || { echo "이 커밋의 CI가 success가 아니다: '${CI:-없음}'" >&2; exit 1; }
echo "   $SHA (origin/main 조상, CI success)"

echo "== 1. 빌드(git archive → npm ci → 테스트 → vite build --base=/)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
bash "$REPO/deploy/build_release.sh" "$SHA" "$WORK"
DIST="$WORK/dist"
MAIN_ASSET="$(cat "$WORK/MAIN_ASSET")"
# shellcheck source=/dev/null
. "$LIB"
DIGEST="$(release_digest "$DIST")"
RELEASE="scl-$SHA"
echo "   릴리스 $RELEASE, 주 자산 $MAIN_ASSET, 지문 $DIGEST"

echo "== 2. 업로드($WEB_ROOT/.staging-$RELEASE)"
STAGING="$WEB_ROOT/.staging-$RELEASE"
ssh "$HOST" "rm -rf '$STAGING' && mkdir -p '$STAGING'"
tar -C "$DIST" -czf - . | ssh "$HOST" "tar -xzf - -C '$STAGING'"

# 전환 직전 HTML이 가리키던 자산(열어 둔 탭이 전환 뒤에 요청한다 — Caddy가 previous에서 찾아야 한다)
PREVIOUS_ASSETS="$(curl -fsS --max-time 20 "$BASE_URL/" 2>/dev/null | grep -o '/assets/[A-Za-z0-9._-]*' | LC_ALL=C sort -u || true)"
echo "   전환 전 자산: ${PREVIOUS_ASSETS//$'\n'/ }"

echo "== 3. 설치와 current 전환(previous = 지금 서빙 중인 릴리스)"
ssh "$HOST" "bash -s" <<REMOTE
set -euo pipefail
$(cat "$LIB")
test -f '$STAGING/$MAIN_ASSET' || { echo "업로드에 $MAIN_ASSET 이 없다" >&2; exit 1; }
outcome="\$(install_release '$WEB_ROOT' '$RELEASE' '$STAGING' '$DIGEST')"
echo "   릴리스 \$outcome"
switch_current '$WEB_ROOT' '$RELEASE'
cd '$WEB_ROOT' && ls -l current previous
REMOTE

echo "== 4. 공개 사이트 확인"
ARGS=(--base-url "$BASE_URL" --lock "$WORK/data.lock.json" --expect-asset "$MAIN_ASSET" --probe-path /p/36.47130,127.14020)
while IFS= read -r a; do [[ -n "$a" ]] && ARGS+=(--expect-previous-asset "$a"); done <<<"$PREVIOUS_ASSETS"
if ! env MSYS2_ARG_CONV_EXCL='/p/;/assets/' python "$REPO/deploy/smoke_web.py" "${ARGS[@]}"; then
	echo
	echo "확인 실패. 바로 되돌린다: (걸어봄 저장소에서) bash deploy/rollback.sh web --host $HOST" >&2
	exit 1
fi
echo
echo "배포 완료: $RELEASE"
echo "되돌리기: (걸어봄 저장소에서) bash deploy/rollback.sh web --host $HOST"
echo "         → python deploy/smoke.py --base-url $BASE_URL --pages-only --check-assets"
echo "걸어봄 STATUS.md의 web current/previous 기록을 갱신한다."
