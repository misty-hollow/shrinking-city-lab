"""sources/facilities.json의 HIRA 값을 원본 zip(병원정보서비스 xlsx)과 대조한다(선택)."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

import openpyxl

from . import config
from .util import read_json


def run(zip_path: Path) -> bool:
    meta = read_json(config.SOURCES_DIR / "facilities.json")
    member = meta["hira_source"]["member"]
    with zipfile.ZipFile(zip_path) as z:
        data = z.read(member)
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = list(next(rows))
    col = {name: header.index(name) for name in ("요양기관명", "종별코드명", "주소", "좌표(X)", "좌표(Y)")}
    found = {}
    for r in rows:
        if r[col["종별코드명"]] == "보건지소" and str(r[col["요양기관명"]]).startswith("공주시"):
            found[r[col["요양기관명"]]] = (r[col["주소"]], float(r[col["좌표(X)"]]), float(r[col["좌표(Y)"]]))
    wb.close()
    ok = True
    for f in meta["facilities"]:
        h = f["hira"]
        got = found.get(h["name"])
        same = got is not None and got == (h["address"], h["lon"], h["lat"])
        ok &= same
        print(f"{'PASS' if same else 'FAIL'} {h['name']}: {got}")
    return ok
