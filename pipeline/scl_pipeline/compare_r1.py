"""r1 → r2 (접근점 규칙 access-v1) 영향 비교 → reports/r1_to_r2.json.

r1 = OSRM 기본 스냅(2026-09 반증 실험과 같은 행렬). r2 = access-v1 접근점.
r1 행렬은 보고서 안에 그대로 넣어 r1 스냅숏이 없어도 비교를 다시 계산할 수 있게 한다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from . import build_step, config, model
from .util import sha256_file, write_json


def _load(p: Path) -> Any:
    return json.loads(p.read_text(encoding="utf-8"))


def _kpi_brief(k: dict[str, Any], ptot: int) -> dict[str, Any]:
    return {
        "mean_days": round(k["mean_days"], 3),
        "cov1_pct": round(k["cov1_pop"] / ptot * 100, 2),
        "cov3_pct": round(k["cov3_pop"] / ptot * 100, 2),
        "worst_emd": config.EMD_NAMES[k["worst_emd"]],
        "worst_emd_days": round(k["worst_emd_days"], 3),
        "gap_days": round(k["gap_days"], 3),
        "p90_min": k["p90_tenths"] / 10 if k["p90_tenths"] is not None else None,
    }


def tradeoff(sc: model.Scenario, budget: int, t: int, p90_table: np.ndarray) -> dict[str, Any]:
    """핵심 학습결론 검사.

    - 세 미션 지표(평균·가장 불리한 읍면·주 3일 이상)의 '이 지표만 보면 가장 높은 배분'이 서로 다른가
    - 세 지표를 동시에 최대로 만드는 배분이 하나라도 있는가(있으면 갈등이 없다)
    - 각 참고 배분이 다른 두 지표에서 최댓값보다 얼마나 모자라는가
    - 참고 배분들의 0일 마을 집합이 얼마나 다른가, 우열 없는 배분(체감 격자)이 몇 개인가
    """
    b = model.evaluate_all(sc, model.all_allocations(budget), t, p90_table)
    ptot = int(sc.pop.sum())
    keys = {
        "mean_days": b.mean_days,
        "worst_emd_days": b.worst_emd_days,
        "cov3_pop": b.cov3_pop.astype(float),
    }
    refs = {k: model.reference_index(v, b.cov1_pop) for k, v in keys.items()}
    best = {k: float(v.max()) for k, v in keys.items()}
    all_best = (
        (b.mean_days == best["mean_days"])
        & (b.worst_emd_days == best["worst_emd_days"])
        & (b.cov3_pop == best["cov3_pop"])
    )
    zero = {}
    for k, i in refs.items():
        days = model.kpis(sc, b.x[i], t)["village_days"]
        zero[k] = {j for j, a in enumerate(days) if a < 1}
    shortfall = {
        k: {o: round((best[o] - float(keys[o][i])) / (best[o] or 1), 3) for o in keys if o != k}
        for k, i in refs.items()
    }
    pairs = (("mean_days", "worst_emd_days"), ("mean_days", "cov3_pop"), ("worst_emd_days", "cov3_pop"))
    fr = model.coarse_front(b, ptot)
    return {
        "references": {k: [int(v) for v in b.x[i]] for k, i in refs.items()},
        "references_distinct": len({tuple(int(v) for v in b.x[i]) for i in refs.values()}) == 3,
        "one_allocation_best_in_all_three": bool(all_best.any()),
        "relative_shortfall_of_each_reference_on_other_kpis": shortfall,
        "zero_day_village_counts": {k: len(v) for k, v in zero.items()},
        "zero_day_sets_jaccard": {
            f"{a}|{c}": round(len(zero[a] & zero[c]) / max(1, len(zero[a] | zero[c])), 3) for a, c in pairs
        },
        "coarse_front_size": len(fr),
    }


def run(r1_dir: Path) -> dict[str, Any]:
    r1_table = _load(r1_dir / "derived" / "osrm_car_table.json")
    r1_land = _load(r1_dir / "appdata" / "landscape.json")
    land2 = _load(config.APP_DATA_DIR / "landscape.json")
    inp = build_step.load_inputs()
    _, sc2, current = build_step.build_scenario(inp)
    t1 = build_step.tenths_from_seconds(r1_table["durations_s"])
    t2 = sc2.tenths
    sc1 = model.Scenario(sc2.pop, sc2.emd, t1)
    ptot = int(sc2.pop.sum())
    diff = (t2 - t1).astype(np.int64)
    changed = diff != 0
    absd = np.abs(diff[changed]) / 10
    tab = inp["table"]
    ids = [s["id"] for s in tab["sources"]]
    fids = [d["id"] for d in tab["destinations"]]
    changed_pts = [p["id"] for p in tab["sources"] + tab["destinations"] if p["access_changed"]]

    villages = []
    for p in tab["sources"]:
        if not p["access_changed"]:
            continue
        i = ids.index(p["id"])
        v = inp["villages"][i]
        own = fids.index(v.emd_id)
        villages.append(
            {
                "village": p["id"],
                "name": v.name,
                "emd": v.emd,
                "pop": v.pop,
                "r1_start": {
                    k: p["default_snap"][k] for k in ("dist_m", "highway", "osm_way", "name", "tags_flag")
                },
                "r2_start": {k: p["access"][k] for k in ("dist_m", "highway", "osm_way", "name")},
                "own_facility_min": {"r1": float(t1[i, own]) / 10, "r2": float(t2[i, own]) / 10},
                "nearest_facility_min": {"r1": float(t1[i].min()) / 10, "r2": float(t2[i].min()) / 10},
                "facilities_within_15": {
                    "r1": [fids[j] for j in range(10) if t1[i, j] <= 150],
                    "r2": [fids[j] for j in range(10) if t2[i, j] <= 150],
                },
            }
        )
    # 문제 없던 수요점: 출발 접근점이 그대로인 행에서 바뀐 칸은 도착 접근점이 바뀐 열뿐이어야 한다.
    moved_cols = [fids.index(f) for f in changed_pts if f in fids]
    same_rows = [i for i, s in enumerate(tab["sources"]) if not s["access_changed"]]
    other_cols = [j for j in range(10) if j not in moved_cols]
    stray = int(np.count_nonzero(changed[np.ix_(same_rows, other_cols)]))
    moved_col_changes = {
        fids[j]: {
            "changed_cells": int(np.count_nonzero(changed[:, j])),
            "median_change_min": float(np.median(diff[changed[:, j], j])) / 10
            if changed[:, j].any()
            else 0.0,
        }
        for j in moved_cols
    }

    p90_1, p90_2 = model.p90_by_mask(sc1), model.p90_by_mask(sc2)
    dist = {}
    for name, s, p in (("r1", sc1, p90_1), ("r2", sc2, p90_2)):
        b = model.evaluate_all(s, model.all_allocations(15), 15, p)
        dist[name] = {
            "max_mean_days": round(float(b.mean_days.max()), 3),
            "max_worst_emd_days": round(float(b.worst_emd_days.max()), 3),
            "max_cov3_pct": round(float(b.cov3_pop.max()) / ptot * 100, 2),
            "median_mean_days": round(float(np.median(b.mean_days)), 3),
            "median_p90_min": float(np.median(b.p90_tenths)) / 10,
        }
    report = {
        "what": "접근점 규칙 access-v1 도입 전(r1 = OSRM 기본 스냅, 2026-09 반증 실험과 같은 행렬) → 후(r2) 비교",
        "r1_data_version": "scl01-gongju-r1",
        "r2_data_version": config.DATA_VERSION,
        "r1_table_sha256": sha256_file(r1_dir / "derived" / "osrm_car_table.json"),
        "access_points_changed": {"count": len(changed_pts), "ids": changed_pts},
        "matrix": {
            "cells": int(t1.size),
            "changed_cells": int(changed.sum()),
            "abs_change_min_over_changed_cells": {
                "median": float(np.median(absd)) if absd.size else 0.0,
                "p90": float(np.quantile(absd, 0.9, method="lower")) if absd.size else 0.0,
                "max": float(absd.max()) if absd.size else 0.0,
            },
            "shorter_cells": int((diff < 0).sum()),
            "longer_cells": int((diff > 0).sum()),
            "reach_membership_changes": {
                str(t): int(((t1 <= t * 10) != (t2 <= t * 10)).sum()) for t in config.THRESHOLDS_MIN
            },
            "moved_destination_columns": moved_col_changes,
            "unchanged_rows_changed_outside_moved_columns": stray,
            "r1_tenths": t1.tolist(),
        },
        "changed_villages": villages,
        "current_actual_kpis": {
            str(t): {
                "r1": _kpi_brief(model.kpis(sc1, current, t), ptot),
                "r2": _kpi_brief(model.kpis(sc2, current, t), ptot),
            }
            for t in config.THRESHOLDS_MIN
        },
        "b15_t15_distribution": dist,
        "missions": {
            m: {
                "target": {"r1": r1_land["missions"][m]["target"], "r2": land2["missions"][m]["target"]},
                "reference": {
                    "r1": r1_land["missions"][m]["reference"]["x"],
                    "r2": land2["missions"][m]["reference"]["x"],
                },
                "share_at_or_above_target": {
                    "r1": r1_land["missions"][m]["share_at_or_above_target"],
                    "r2": land2["missions"][m]["share_at_or_above_target"],
                },
            }
            for m in ("m1", "m2", "m3")
        },
        "coarse_fronts": {
            f"B{c1['budget']}_T{c1['threshold_min']}": {
                "r1": len(c1["front"]),
                "r2": len(c2["front"]),
                "same_allocations": [f["x"] for f in c1["front"]] == [f["x"] for f in c2["front"]],
                "r1_front": [f["x"] for f in c1["front"]],
                "r2_front": [f["x"] for f in c2["front"]],
            }
            for c1, c2 in zip(r1_land["combos"], land2["combos"], strict=True)
        },
        "tradeoff_check": {
            f"B{budget}_T{t}": {"r1": tradeoff(sc1, budget, t, p90_1), "r2": tradeoff(sc2, budget, t, p90_2)}
            for budget in (10, 15, 20)
            for t in config.THRESHOLDS_MIN
        },
    }
    write_json(config.REPORTS_DIR / "r1_to_r2.json", report, pretty=True)
    print(f"compare-r1: 접근점 변경 {len(changed_pts)}, 행렬 칸 변경 {int(changed.sum())}/{t1.size}")
    return report
