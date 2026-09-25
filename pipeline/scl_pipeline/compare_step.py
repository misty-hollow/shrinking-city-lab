"""2026-09 반증 실험 산출물과의 1회 대조(설계안 10-2-1, 10-7).

실험 폴더는 개발 PC 임시 디렉터리에만 있다. 이 단계는 그 폴더가 있을 때 한 번 돌려
결과를 reports/experiment_comparison.json에 남긴다. 제품·빌드·검사는 이 폴더에 의존하지 않는다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from . import build_step, config, model
from .util import read_json, sha256_file, write_json

SHORT = [name[:2] for _, name in config.EMDS]


def _load(p: Path) -> Any:
    return json.loads(p.read_text(encoding="utf-8"))


def run(exp2: Path) -> dict[str, Any]:
    scratch = exp2.parent
    files = {
        "matrix": exp2 / "matrix.json",
        "demand": scratch / "demand.json",
        **{f"var_tau{t}": exp2 / f"var_tau{t}_cap1_bo0.json" for t in config.THRESHOLDS_MIN},
    }
    missing = [k for k, p in files.items() if not p.exists()]
    if missing:
        raise SystemExit(f"실험 산출물이 없다: {missing}")

    inp = build_step.load_inputs()
    scenario, sc, current = build_step.build_scenario(inp)
    tab = inp["table"]
    m = _load(files["matrix"])
    th = np.asarray(m["TH"], dtype=np.float64)
    ours_s = np.asarray(tab["durations_s"], dtype=np.float64)
    report: dict[str, Any] = {
        "experiment": {
            "what": "2026-09 반증 실험(Compact City Lab 실험 2) 산출물. 개발 PC 임시 폴더 scratchpad/exp2",
            "file_sha256": {k: sha256_file(p) for k, p in files.items()},
        },
        "data_version": config.DATA_VERSION,
    }

    # 1) 수요점·시설 좌표
    exp_demand = _load(files["demand"])["ri"]
    same_pts = sum(
        1
        for v, e in zip(inp["villages"], exp_demand, strict=True)
        if (v.emd, v.name, v.pop, v.lon, v.lat) == (e["emd"], e["ri"], e["pop"], e["lon"], e["lat"])
    )
    same_fac = [(f.lon, f.lat) == (h[1], h[2]) for f, h in zip(inp["facilities"], m["H"], strict=True)]
    report["demand_points"] = {"identical": same_pts, "of": len(exp_demand)}
    report["facilities"] = {"identical": int(sum(same_fac)), "of": len(same_fac)}

    # 2) 161×10 행렬
    diff = np.abs(ours_s / 60 - th)
    member = {}
    for t in config.THRESHOLDS_MIN:
        a = sc.tenths <= t * 10
        b = th <= t
        member[str(t)] = int((a != b).sum())
    report["matrix"] = {
        "shape": list(th.shape),
        "max_abs_diff_minutes_raw": float(diff.max()),
        "reach_membership_mismatches_after_ceil_0_1min": member,
        "note": "원시 OSRM 초 값은 실험과 같다. 앱은 0.1분 올림 정수로 저장해 t ≤ T 판정이 원시 값과 같다",
    }

    # 3) 현재 실제 배분 KPI (실험 variants.py cap=1, bo=0)
    cur_cmp = {}
    for t in config.THRESHOLDS_MIN:
        e = _load(files[f"var_tau{t}"])["current2026"]
        k = model.kpis(sc, current, t)
        ptot = int(sc.pop.sum())
        ours = {
            "mean_days": round(k["mean_days"], 2),
            "worst_emd_days": round(k["worst_emd_days"], 2),
            "worst_emd": config.EMD_NAMES[k["worst_emd"]],
            "cov1_pct": round(k["cov1_pop"] / ptot * 100, 2),
            "cov3_pct": round(k["cov3_pop"] / ptot * 100, 2),
            "p90_min": k["p90_tenths"] / 10,
            "gap_days": round(k["gap_days"], 2),
        }
        theirs = {
            "mean_days": e["eff"],
            "worst_emd_days": e["worst"],
            "worst_emd": e["worst_em"],
            "cov1_pct": e["cov1"],
            "cov3_pct": e["cov3"],
            "p90_min": round(e["p90t"], 1),
            "gap_days": e["gap"],
        }
        cur_cmp[str(t)] = {
            "ours": ours,
            "experiment": theirs,
            "numbers_equal": all(ours[k2] == theirs[k2] for k2 in ours if k2 != "worst_emd"),
            "worst_emd_equal": ours["worst_emd"] == theirs["worst_emd"],
        }
    report["current_actual_kpis"] = cur_cmp

    # 4) 체감 격자 Pareto(우열 없는 배분) 수와 구성
    p90_table = model.p90_by_mask(sc)
    fronts = {}
    for t in config.THRESHOLDS_MIN:
        e = _load(files[f"var_tau{t}"])["budgets"]
        for budget in config.LANDSCAPE_BUDGETS:
            b = model.evaluate_all(sc, model.all_allocations(budget), t, p90_table)
            fr = model.coarse_front(b, int(sc.pop.sum()))
            ours_x = [[int(v) for v in b.x[i]] for i in fr]
            exp_x = [[f["x"][s] for s in SHORT] for f in e[str(budget)]["front"]]
            fronts[f"B{budget}_T{t}"] = {
                "ours": len(fr),
                "experiment": e[str(budget)]["n_coarse_front"],
                "same_allocations_same_order": ours_x == exp_x,
            }
    report["coarse_front"] = fronts

    ok = (
        same_pts == len(exp_demand)
        and all(same_fac)
        and float(diff.max()) == 0.0
        and all(v == 0 for v in member.values())
        and all(c["numbers_equal"] for c in cur_cmp.values())
        and all(f["same_allocations_same_order"] for f in fronts.values())
    )
    report["summary"] = {
        "identical": ok,
        "differences": [
            "가장 불리한 읍·면이 동률(주 0일)일 때 설계안 4-6의 동률 규칙(0일 주민이 많은 곳)을 적용한다. "
            "실험은 앞 순서를 골랐다. 값은 같고 이름만 다를 수 있다"
        ]
        + [
            f"T={t}: 가장 불리한 읍·면 이름 {c['ours']['worst_emd']}(제품) / {c['experiment']['worst_emd']}(실험)"
            for t, c in cur_cmp.items()
            if not c["worst_emd_equal"]
        ],
    }
    write_json(config.REPORTS_DIR / "experiment_comparison.json", report, pretty=True)
    print(f"compare: 동일 = {ok}")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=1))
    return report


def load_report() -> dict[str, Any] | None:
    p = config.REPORTS_DIR / "experiment_comparison.json"
    return read_json(p) if p.exists() else None
