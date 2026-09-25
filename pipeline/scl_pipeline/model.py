"""계산 모델(설계안 4-5, 4-6). 브라우저 엔진(app/src/engine)과 같은 정의를 쓴다.

기호: 리 i(161), 인구 P_i, 지소 j(10), 배분 x_j, 도로망 접근시간 t_ij, 기준 T.
- A_i(T) = min(5, Σ_{t_ij ≤ T} x_j)                      리의 접근 가능 진료일
- S_m = Σ_{i∈m} P_i·A_i / Σ_{i∈m} P_i                   읍·면 서비스 수준
- 운영 지소 = x_j ≥ 1, n_i = min_{운영 j} t_ij             가장 가까운 운영 지소 시간

시간은 0.1분 정수(tenths)로 다룬다. t ≤ T 판정이 부동소수 오차 없이 정확하다.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass
from typing import Any

import numpy as np

from . import config

CAP = config.RESIDENT_CAP_DAYS


@dataclass(frozen=True)
class Scenario:
    pop: np.ndarray  # (161,) int64
    emd: np.ndarray  # (161,) int — 읍·면 인덱스
    tenths: np.ndarray  # (161, 10) int — 0.1분 단위 도로망 접근시간

    @property
    def n_emd(self) -> int:
        return len(config.EMDS)

    def reach(self, t_min: int) -> np.ndarray:
        return (self.tenths <= t_min * 10).astype(np.int64)


def weighted_p90_tenths(n: np.ndarray, w: np.ndarray) -> int:
    """인구 가중 90퍼센타일: 누적 인구가 전체의 90% 이상이 되는 첫 값(정수 비교)."""
    order = np.argsort(n, kind="stable")
    cum = np.cumsum(w[order])
    k = int(np.searchsorted(cum * 10, 9 * cum[-1], side="left"))
    return int(n[order][k])


def round_half_up(v: float) -> int:
    return int(np.floor(v + 0.5))


def kpis(sc: Scenario, x: np.ndarray | list[float], t_min: int) -> dict[str, Any]:
    """배분 하나(소수 허용)의 KPI 1~6과 읍·면별 값."""
    x = np.asarray(x, dtype=np.float64)
    reach = sc.reach(t_min)
    raw = reach @ x
    a = np.minimum(raw, CAP)
    p = sc.pop.astype(np.float64)
    ptot = float(p.sum())
    cov1 = int(sc.pop[a >= 1].sum())
    cov3 = int(sc.pop[a >= 3].sum())
    s = np.zeros(sc.n_emd)
    zero_m = np.zeros(sc.n_emd, dtype=np.int64)
    for m in range(sc.n_emd):
        sel = sc.emd == m
        s[m] = float((p[sel] * a[sel]).sum() / p[sel].sum())
        zero_m[m] = int(sc.pop[sel & (a < 1)].sum())
    worst = _worst_index(s, zero_m)
    best = int(np.argmax(s))
    operating = x >= 1
    if operating.any():
        n = sc.tenths[:, operating].min(1)
        p90 = weighted_p90_tenths(n, sc.pop)
        bands = [
            int(sc.pop[n <= 100].sum()),
            int(sc.pop[(n > 100) & (n <= 150)].sum()),
            int(sc.pop[(n > 150) & (n <= 200)].sum()),
            int(sc.pop[n > 200].sum()),
        ]
    else:
        p90, bands = None, None
    return {
        "mean_days": float((p * a).sum() / ptot),
        "cov1_pop": cov1,
        "cov3_pop": cov3,
        "zero_pop": int(sc.pop.sum()) - cov1,
        "worst_emd": worst,
        "worst_emd_days": float(s[worst]),
        "best_emd": best,
        "gap_days": float(s.max() - s.min()),
        "p90_tenths": p90,
        "time_band_pop": bands,
        "emd_days": [float(v) for v in s],
        "emd_zero_pop": [int(v) for v in zero_m],
        "village_days": [float(v) for v in a],
    }


def _worst_index(s: np.ndarray, zero_m: np.ndarray) -> int:
    """가장 불리한 읍·면: S_m 최소, 동률이면 0일 주민이 많은 곳, 그래도 같으면 앞 순서."""
    lo = s.min()
    cands = [m for m in range(len(s)) if s[m] == lo]
    return max(cands, key=lambda m: (zero_m[m], -m))


# --- 전수 계산(배분 지형도·목표치·참고 배분, 설계안 4-8·7-6·7-7) ------------------------


def all_allocations(budget: int) -> np.ndarray:
    """Σx = budget, x_j ∈ 0..5인 배분 전부. 벡터 사전식 오름차순(= '첫 번째'의 정의)."""
    k = len(config.FACILITY_IDS)
    head_n = 3
    tail = np.array(list(itertools.product(range(6), repeat=k - head_n)), dtype=np.int8)
    tail_sum = tail.sum(1)
    out = []
    for head in itertools.product(range(6), repeat=head_n):
        rest = budget - sum(head)
        if rest < 0:
            continue
        t = tail[tail_sum == rest]
        if len(t):
            out.append(np.hstack([np.tile(np.array(head, np.int8), (len(t), 1)), t]))
    return np.vstack(out)


@dataclass
class Batch:
    x: np.ndarray
    mean_days: np.ndarray
    cov1_pop: np.ndarray
    cov3_pop: np.ndarray
    worst_emd_days: np.ndarray
    worst_emd: np.ndarray
    gap_days: np.ndarray
    p90_tenths: np.ndarray


def p90_by_mask(sc: Scenario) -> np.ndarray:
    k = sc.tenths.shape[1]
    out = np.full(1 << k, -1, dtype=np.int64)
    for mask in range(1, 1 << k):
        cols = [j for j in range(k) if mask >> j & 1]
        out[mask] = weighted_p90_tenths(sc.tenths[:, cols].min(1), sc.pop)
    return out


def evaluate_all(sc: Scenario, x_all: np.ndarray, t_min: int, p90_table: np.ndarray) -> Batch:
    """정수 배분 전부의 KPI. 분자·분모를 정수로 계산하고 마지막에만 나눈다."""
    reach = sc.reach(t_min)
    pat, inv = np.unique(reach, axis=0, return_inverse=True)
    inv = inv.ravel()
    wp = np.bincount(inv, sc.pop, len(pat)).astype(np.int64)
    wpe = np.zeros((len(pat), sc.n_emd), dtype=np.int64)
    np.add.at(wpe, (inv, sc.emd), sc.pop)
    we = wpe.sum(0)
    ptot = int(sc.pop.sum())
    bits = (1 << np.arange(x_all.shape[1])).astype(np.int64)
    parts = {f: [] for f in Batch.__dataclass_fields__ if f != "x"}
    for s in range(0, len(x_all), 200_000):
        xb = x_all[s : s + 200_000].astype(np.int64)
        a = xb @ pat.T
        ac = np.minimum(a, CAP)
        num_s = ac @ wpe
        sm = num_s / we
        zero_m = (a == 0).astype(np.int64) @ wpe
        lo = sm.min(1)
        cand = sm == lo[:, None]
        worst_idx = np.argmax(np.where(cand, zero_m, -1), axis=1)
        mask = ((xb > 0) * bits).sum(1)
        parts["mean_days"].append((ac @ wp) / ptot)
        parts["cov1_pop"].append((a >= 1).astype(np.int64) @ wp)
        parts["cov3_pop"].append((a >= 3).astype(np.int64) @ wp)
        parts["worst_emd_days"].append(lo)
        parts["worst_emd"].append(worst_idx)
        parts["gap_days"].append(sm.max(1) - lo)
        parts["p90_tenths"].append(p90_table[mask])
    return Batch(x=x_all, **{k: np.concatenate(v) for k, v in parts.items()})


def coarse_front(b: Batch, ptot: int) -> list[int]:
    """반증 실험 variants.py coarse_front와 같은 정의(체감 격자 상자의 Pareto).

    축: 평균 진료일(0.5일), 가장 불리한 읍·면(0.5일), 주 3일 이상 인구 비율(5%p).
    상자끼리 비교해 지배되지 않는 상자마다 정규화 합이 가장 큰 배분 하나를 고른다.
    """
    g = config.COARSE_GRID
    k = {
        "mean_days": b.mean_days,
        "worst_emd_days": b.worst_emd_days,
        "cov3_pct": b.cov3_pop / ptot * 100,
    }
    box = np.stack([np.floor(k[a] / d + 1e-9) for a, d in g.items()], 1)
    ub, invb = np.unique(box, axis=0, return_inverse=True)
    invb = invb.ravel()
    order = np.lexsort(ub.T[::-1])[::-1]
    kept: list[np.ndarray] = []
    ids = []
    for i in order:
        if kept and np.any(np.all(np.array(kept) >= ub[i], 1)):
            continue
        kept.append(ub[i])
        ids.append(i)
    reps = []
    for bi in ids:
        idx = np.where(invb == bi)[0]
        score = sum(k[a][idx] / d for a, d in g.items())
        reps.append(int(idx[np.argmax(score)]))
    return reps


def top_share_threshold(values: np.ndarray, share: float) -> float:
    """값이 큰 쪽 상위 share 경계값: 내림차순 ceil(share·N)번째 값."""
    desc = np.sort(values)[::-1]
    k = int(np.ceil(share * len(desc))) - 1
    return float(desc[k])


def rank_thresholds(values: np.ndarray) -> list[float]:
    """'상위 n%' 표를 위한 경계 w_1..w_100.

    n = min{k : v ≥ w_k}, w_k = 내림차순 floor(k·N/100)번째 값. 이렇게 하면
    'v보다 큰 배분의 비율 ≤ k%'와 'v ≥ w_k'가 정확히 같다(브라우저는 표만 읽는다).
    """
    desc = np.sort(values)[::-1]
    n = len(desc)
    return [float(desc[min(n - 1, (k * n) // 100)]) for k in range(1, 101)]


def reference_index(values: np.ndarray, cov1: np.ndarray) -> int:
    """이 지표만 보면 가장 높은 배분 하나: 값 최대 → 0일 주민 적음(cov1 큼) → 첫 번째."""
    best = values.max()
    idx = np.where(values == best)[0]
    c = cov1[idx]
    idx = idx[c == c.max()]
    return int(idx[0])
