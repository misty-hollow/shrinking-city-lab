"""배포된 Shrinking City Lab 정적 사이트 확인(파이썬 표준 라이브러리만).

    python deploy/smoke_web.py --base-url https://geoleobom.kr --lock pipeline/data.lock.json \
        [--expect-asset assets/index-XXXX.js] [--probe-path /p/36.47130,127.14020] [--expect-previous-asset /assets/...]

확인하는 것:
  1. `/`가 200 text/html, `<div id="root">`, 주 자산 이름(--expect-asset)
  2. HTML이 가리키는 모든 자산(./assets/·/assets/)이 200, 비어 있지 않음, JS는 javascript·CSS는 css 형식
  3. 앱 자료 6개(data/*.json·terrain.bin)가 200이고 **바이트가 data.lock.json의 sha256과 같다**(SPA 물러섬이
     index.html을 대신 돌려주면 여기서 잡힌다)
  4. 라이선스 고지(licenses/THIRD_PARTY_NOTICES.txt·글꼴 OFL 2개) 200
  5. 깊은 주소(--probe-path, 예: 옛 걸어봄 공유 주소)도 같은 HTML이고, 그 HTML의 자산이 **뿌리 기준(/assets/)**이라
     그 주소에서도 열린다
  6. --expect-previous-asset: 전환 직전 HTML의 자산이 여전히 200(Caddy의 previous 물러섬)
실패가 하나라도 있으면 종료 코드 1.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

APP_DATA = ("scenario.json", "geometry.json", "landscape.json", "golden.json", "manifest.json", "terrain.bin")
LICENSES = ("licenses/THIRD_PARTY_NOTICES.txt", "licenses/Pretendard-OFL.txt", "licenses/Hahmlet-OFL.txt")


def fetch(url: str, accept: str = "*/*") -> tuple[int, str, bytes]:
    req = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": "scl-smoke/1"})
    try:
        with urllib.request.urlopen(req, timeout=30, context=ssl.create_default_context()) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), e.read()


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--lock", type=Path, required=True, help="pipeline/data.lock.json (배포한 커밋의 것)")
    ap.add_argument("--expect-asset", default="")
    ap.add_argument("--probe-path", default="/p/36.47130,127.14020")
    ap.add_argument("--expect-previous-asset", action="append", default=[])
    a = ap.parse_args(argv)
    base = a.base_url.rstrip("/") + "/"
    lock = json.loads(a.lock.read_text(encoding="utf-8"))["files"]
    fails: list[str] = []

    def check(ok: bool, name: str, detail: str = "") -> None:
        print(f"{'PASS' if ok else 'FAIL'} {name}{'  — ' + detail if detail else ''}")
        if not ok:
            fails.append(name)

    st, ct, body = fetch(base, "text/html")
    html = body.decode("utf-8", "replace")
    check(st == 200 and "text/html" in ct, "/ 200 text/html", f"{st} {ct}")
    check('<div id="root">' in html, "/ 앱 뿌리 요소")
    if a.expect_asset:
        check(a.expect_asset in html, f"/ 주 자산 {a.expect_asset}")
    assets = sorted(set(re.findall(r'(?:src|href)="(\.?/assets/[^"]+)"', html)))
    check(bool(assets), "/ HTML이 자산을 가리킨다", ", ".join(assets))
    for ref in assets:
        st2, ct2, b2 = fetch(urllib.parse.urljoin(base, ref))
        kind = "javascript" if ref.endswith(".js") else "css" if ref.endswith(".css") else ""
        check(st2 == 200 and len(b2) > 0 and kind in ct2, f"자산 {ref}", f"{st2} {ct2} {len(b2)}B")

    for name in APP_DATA:
        st3, ct3, b3 = fetch(base + "data/" + name)
        want = lock.get(f"app/public/data/{name}")
        got = hashlib.sha256(b3).hexdigest()
        check(st3 == 200 and got == want, f"자료 data/{name} = data.lock", f"{st3} {ct3} {got[:12]} / {str(want)[:12]}")
    mf = json.loads(fetch(base + "data/manifest.json")[2] or b"{}")
    print(f"     manifest data_version = {mf.get('data_version')}")

    for name in LICENSES:
        st4, _, b4 = fetch(base + name)
        check(st4 == 200 and len(b4) > 200 and not b4.lstrip().startswith(b"<"), f"고지 {name}", f"{st4} {len(b4)}B")

    if a.probe_path:
        st5, ct5, b5 = fetch(urllib.parse.urljoin(base, a.probe_path), "text/html")
        h5 = b5.decode("utf-8", "replace")
        check(st5 == 200 and "text/html" in ct5 and '<div id="root">' in h5, f"깊은 주소 {a.probe_path} → 앱 HTML", f"{st5}")
        rel = [r for r in re.findall(r'(?:src|href)="([^"]+)"', h5) if "assets/" in r and not r.startswith("/")]
        check(not rel, "깊은 주소에서도 자산이 뿌리 기준(/assets/)이다(--base=/ 빌드)", ", ".join(rel))

    for ref in a.expect_previous_asset:
        st6, _, b6 = fetch(urllib.parse.urljoin(base, ref))
        check(st6 == 200 and len(b6) > 0, f"직전 배포 자산 {ref}", f"{st6}")

    print(f"\n{'OK' if not fails else 'FAILED'}: 실패 {len(fails)}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
