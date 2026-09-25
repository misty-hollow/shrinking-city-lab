/**
 * 빛의 순서(설계안 6-16 "숫자보다 땅이 먼저 바뀐다"). 계산은 조작 순간에 끝나 있다. 이 파일은 **보이는 순서**만 정한다.
 *
 *   +1: 불씨가 풀에서 지소로 날아가(EMBER_MS) 등칸이 켜지고, 빛이 길을 따라 나간다.
 *       마을 i에는 행렬의 도로망 시간 t_ij 순서로 도착한다(도로망 1분 = MS_PER_MIN).
 *   −1: 맨 위 등칸이 바로 꺼지고, 빛이 먼 마을부터 거둬진다.
 *   기준 T 변경: 운영 중인 지소들의 빛 끝이 길을 따라 늘거나 준다(원은 그리지 않는다).
 *
 * 무대와 지표(HUD)가 같은 계획을 따른다. 움직임 줄이기에서는 모든 시각이 0이다.
 */

import type { Model, Threshold } from '../engine/kpi'

export const MS_PER_MIN = 38
export const EMBER_MS = 380
/** −1: 등칸이 꺼진 뒤 빛이 거둬지기 시작할 때까지 */
export const RETRACT_DELAY_MS = 90
/** 기준 변경: 빛 끝이 옮겨 가는 시간 */
export const T_CHANGE_MS = 620

export interface Arrival {
  i: number
  /** 계획 시작에서 몇 ms 뒤 이 마을의 표시가 바뀌나 */
  at: number
  /** 진료일이 늘었나(true) 줄었나 */
  gain: boolean
  /** 주민 × |진료일 변화| — 지표를 빛에 맞춰 올릴 때의 무게 */
  w: number
}

export interface LightPlan {
  seq: number
  kind: 'op' | 'threshold'
  /** 조작한 지소(기준 변경이면 null) */
  j: number | null
  dir: 1 | -1
  /** 빛을 보여 줄 지소들 */
  clinics: number[]
  /** 등칸이 바뀌는 시각(ms) */
  chamberMs: number
  /** 빛의 끝(도로망 분)이 startMs부터 durMs 동안 from → to */
  front: { from: number; to: number; startMs: number; durMs: number }
  arrivals: Arrival[]
  endMs: number
  totalW: number
}

function changed(before: Float64Array, after: Float64Array, model: Model): { i: number; gain: boolean; w: number }[] {
  const out: { i: number; gain: boolean; w: number }[] = []
  for (let i = 0; i < model.nV; i++) {
    const d = after[i] - before[i]
    if (Math.abs(d) < 1e-9) continue
    out.push({ i, gain: d > 0, w: model.pop[i] * Math.abs(d) })
  }
  return out
}

function finish(p: Omit<LightPlan, 'endMs' | 'totalW'>, reduced: boolean): LightPlan {
  if (reduced) {
    return {
      ...p,
      chamberMs: 0,
      front: { ...p.front, startMs: 0, durMs: 0 },
      arrivals: p.arrivals.map((a) => ({ ...a, at: 0 })),
      endMs: 0,
      totalW: p.arrivals.reduce((s, a) => s + a.w, 0),
    }
  }
  const last = p.arrivals.reduce((m, a) => Math.max(m, a.at), 0)
  return {
    ...p,
    arrivals: [...p.arrivals].sort((a, b) => a.at - b.at || a.i - b.i),
    endMs: Math.max(last, p.front.startMs + p.front.durMs, p.chamberMs),
    totalW: p.arrivals.reduce((s, a) => s + a.w, 0),
  }
}

/** 지소 j에 +1(dir 1) 또는 −1(dir −1). before/after = 조작 전후의 마을 진료일(A_i). */
export function planOp(
  model: Model,
  seq: number,
  j: number,
  dir: 1 | -1,
  T: Threshold,
  before: Float64Array,
  after: Float64Array,
  reduced = false,
): LightPlan {
  const ch = changed(before, after, model)
  const arrivals: Arrival[] = ch.map(({ i, gain, w }) => {
    const m = model.tenths[i * model.nF + j] / 10
    const at = dir > 0 ? EMBER_MS + m * MS_PER_MIN : RETRACT_DELAY_MS + Math.max(0, T - m) * MS_PER_MIN
    return { i, at, gain, w }
  })
  return finish(
    {
      seq,
      kind: 'op',
      j,
      dir,
      clinics: [j],
      chamberMs: dir > 0 ? EMBER_MS : 0,
      front: dir > 0 ? { from: 0, to: T, startMs: EMBER_MS, durMs: T * MS_PER_MIN } : { from: T, to: 0, startMs: RETRACT_DELAY_MS, durMs: T * MS_PER_MIN },
      arrivals,
    },
    reduced,
  )
}

/** 기준 T 변경. alloc = 지금 배분(빛이 있는 지소 = 진료일 > 0). */
export function planThreshold(
  model: Model,
  seq: number,
  from: Threshold,
  to: Threshold,
  alloc: readonly number[],
  before: Float64Array,
  after: Float64Array,
  reduced = false,
): LightPlan {
  const lit: number[] = []
  for (let j = 0; j < model.nF; j++) if (alloc[j] > 0) lit.push(j)
  const ext = to > from
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const arrivals: Arrival[] = changed(before, after, model).map(({ i, gain, w }) => {
    // 이 마을의 상태를 바꾼 지소들 가운데 빛 끝이 먼저 지나는 쪽
    let tau = ext ? Infinity : -Infinity
    for (const j of lit) {
      const m = model.tenths[i * model.nF + j] / 10
      if (m <= lo || m > hi) continue
      tau = ext ? Math.min(tau, m) : Math.max(tau, m)
    }
    if (!Number.isFinite(tau)) tau = ext ? hi : lo
    const at = ext ? ((tau - from) / (to - from)) * T_CHANGE_MS : ((from - tau) / (from - to)) * T_CHANGE_MS
    return { i, at: Math.max(0, at), gain, w }
  })
  return finish(
    { seq, kind: 'threshold', j: null, dir: ext ? 1 : -1, clinics: lit, chamberMs: 0, front: { from, to, startMs: 0, durMs: T_CHANGE_MS }, arrivals },
    reduced,
  )
}

/** 계획 시작 뒤 t ms에 도착을 마친 무게의 비율(0..1). 지표 숫자가 빛을 따라 오르는 정도. */
export function progressAt(plan: LightPlan, t: number): number {
  if (t >= plan.endMs) return 1
  if (plan.totalW <= 0) return 0
  let w = 0
  for (const a of plan.arrivals) {
    if (a.at > t) break
    w += a.w
  }
  return w / plan.totalW
}

/** 빛의 끝(도로망 분) t ms 시점 */
export function frontAt(plan: LightPlan, t: number): number {
  const f = plan.front
  if (f.durMs <= 0) return f.to
  const k = Math.min(1, Math.max(0, (t - f.startMs) / f.durMs))
  return f.from + (f.to - f.from) * k
}
