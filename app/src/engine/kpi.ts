/**
 * 계산 엔진(설계안 4-5, 4-6). 파이썬 전처리 scl_pipeline/model.py와 같은 정의다.
 * 화면과 분리된 순수 함수라 같은 입력이면 항상 같은 결과가 나온다.
 *
 *   A_i(T) = min(5, Σ_{t_ij ≤ T} x_j)          리의 접근 가능 진료일
 *   S_m    = Σ_{i∈m} P_i·A_i / Σ_{i∈m} P_i     읍·면 서비스 수준
 *   운영 지소 = x_j ≥ 1,  n_i = min_{운영 j} t_ij
 *
 * 합은 정수(또는 0.5 단위)라 부동소수 누적 오차가 없고, 나눗셈은 마지막에 한 번만 한다.
 * 그래서 전처리가 만든 경계값(목표치·상위 n% 표)과 같은 비트로 비교된다.
 */

import type { Scenario } from '../data/types'

export const CAP_DAYS = 5

export interface Model {
  nV: number
  nF: number
  nE: number
  pop: Int32Array
  emd: Uint8Array
  /** 0.1분 정수, 행 우선 nV×nF */
  tenths: Int32Array
  emdPop: number[]
  totalPop: number
}

export function buildModel(s: Scenario): Model {
  const nV = s.villages.length
  const nF = s.facilities.length
  const emdIndex = new Map(s.emds.map((e, i) => [e.id, i]))
  const pop = new Int32Array(nV)
  const emd = new Uint8Array(nV)
  const tenths = new Int32Array(nV * nF)
  const emdPop = new Array<number>(s.emds.length).fill(0)
  s.villages.forEach((v, i) => {
    pop[i] = v.pop
    const m = emdIndex.get(v.emd)
    if (m === undefined) throw new Error(`unknown emd ${v.emd}`)
    emd[i] = m
    emdPop[m] += v.pop
    for (let j = 0; j < nF; j++) tenths[i * nF + j] = s.matrix.tenths[i][j]
  })
  return { nV, nF, nE: s.emds.length, pop, emd, tenths, emdPop, totalPop: emdPop.reduce((a, b) => a + b, 0) }
}

export type Threshold = 10 | 15 | 20

export interface Kpis {
  /** 리별 접근 가능 진료일 A_i */
  villageDays: Float64Array
  meanDays: number
  cov1Pop: number
  cov3Pop: number
  /** 주 1일 미만(=닿지 않는) 주민 */
  zeroPop: number
  worstEmd: number
  worstEmdDays: number
  bestEmd: number
  gapDays: number
  /** 운영 지소가 없으면 null */
  p90Tenths: number | null
  /** 가장 가까운 운영 지소까지 ≤10, 10~15, 15~20, >20분 인구 */
  timeBandPop: [number, number, number, number] | null
  emdDays: number[]
  emdZeroPop: number[]
  /** 리별 가장 가까운 운영 지소 시간(0.1분). 운영 지소가 없으면 -1 */
  nearestTenths: Int32Array
}

export function reaches(m: Model, i: number, j: number, t: Threshold): boolean {
  return m.tenths[i * m.nF + j] <= t * 10
}

export function computeKpis(m: Model, x: readonly number[], t: Threshold): Kpis {
  const lim = t * 10
  const villageDays = new Float64Array(m.nV)
  const emdNum = new Array<number>(m.nE).fill(0)
  const emdZero = new Array<number>(m.nE).fill(0)
  let num = 0
  let cov1 = 0
  let cov3 = 0
  for (let i = 0; i < m.nV; i++) {
    let raw = 0
    for (let j = 0; j < m.nF; j++) if (m.tenths[i * m.nF + j] <= lim) raw += x[j]
    const a = Math.min(raw, CAP_DAYS)
    villageDays[i] = a
    const p = m.pop[i]
    num += p * a
    emdNum[m.emd[i]] += p * a
    if (a >= 1) cov1 += p
    else emdZero[m.emd[i]] += p
    if (a >= 3) cov3 += p
  }
  const emdDays = emdNum.map((v, k) => v / m.emdPop[k])
  const worstEmd = worstIndex(emdDays, emdZero)
  let bestEmd = 0
  for (let k = 1; k < m.nE; k++) if (emdDays[k] > emdDays[bestEmd]) bestEmd = k
  const lo = emdDays[worstEmd]
  const hi = emdDays[bestEmd]

  const nearest = new Int32Array(m.nV).fill(-1)
  const operating: number[] = []
  for (let j = 0; j < m.nF; j++) if (x[j] >= 1) operating.push(j)
  let p90: number | null = null
  let bands: Kpis['timeBandPop'] = null
  if (operating.length > 0) {
    bands = [0, 0, 0, 0]
    for (let i = 0; i < m.nV; i++) {
      let best = Infinity
      for (const j of operating) best = Math.min(best, m.tenths[i * m.nF + j])
      nearest[i] = best
      const b = best <= 100 ? 0 : best <= 150 ? 1 : best <= 200 ? 2 : 3
      bands[b] += m.pop[i]
    }
    p90 = weightedP90(nearest, m.pop)
  }
  return {
    villageDays,
    meanDays: num / m.totalPop,
    cov1Pop: cov1,
    cov3Pop: cov3,
    zeroPop: m.totalPop - cov1,
    worstEmd,
    worstEmdDays: lo,
    bestEmd,
    gapDays: hi - lo,
    p90Tenths: p90,
    timeBandPop: bands,
    emdDays,
    emdZeroPop: emdZero,
    nearestTenths: nearest,
  }
}

/** 가장 불리한 읍·면: S_m 최소, 동률이면 0일 주민이 많은 곳, 그래도 같으면 앞 순서. */
export function worstIndex(emdDays: number[], emdZero: number[]): number {
  let lo = Infinity
  for (const v of emdDays) lo = Math.min(lo, v)
  let best = -1
  for (let k = 0; k < emdDays.length; k++) {
    if (emdDays[k] !== lo) continue
    if (best < 0 || emdZero[k] > emdZero[best]) best = k
  }
  return best
}

/** 인구 가중 90퍼센타일: 누적 인구가 전체의 90% 이상이 되는 첫 값(정수 비교). */
export function weightedP90(values: Int32Array, w: Int32Array): number {
  const idx = Array.from(values.keys()).sort((a, b) => values[a] - values[b] || a - b)
  let total = 0
  for (let i = 0; i < w.length; i++) total += w[i]
  let cum = 0
  for (const i of idx) {
    cum += w[i]
    if (cum * 10 >= total * 9) return values[i]
  }
  return values[idx[idx.length - 1]]
}

export type VillageTier = 0 | 1 | 2

/** 마을 상태 3단(설계안 6-4): 0일(빈 고리) / 주 1~2일(반 채움) / 주 3~5일(가득). */
export function tierOf(days: number): VillageTier {
  return days < 1 ? 0 : days < 3 ? 1 : 2
}

/** 읍·면 면 채움 3단(설계안 6-6): 같은 경계(1일, 3일)를 쓴다. */
export const emdTierOf = tierOf

/** 읍·면마다 접근 가능 진료일이 minDays 이상인 주민의 비율(0..1). */
export function emdShareAtLeast(m: Model, villageDays: Float64Array, minDays: number): number[] {
  const num = new Array<number>(m.nE).fill(0)
  for (let i = 0; i < m.nV; i++) if (villageDays[i] >= minDays) num[m.emd[i]] += m.pop[i]
  return num.map((v, k) => v / m.emdPop[k])
}

/** 지소 j가 기준 T 안에 닿는 마을 목록. */
export function villagesReachedBy(m: Model, j: number, t: Threshold): number[] {
  const out: number[] = []
  for (let i = 0; i < m.nV; i++) if (m.tenths[i * m.nF + j] <= t * 10) out.push(i)
  return out
}

/** 마을 i에서 기준 T 안에 있는 지소 목록(시간 오름차순). */
export function facilitiesReaching(m: Model, i: number, t: Threshold): { j: number; tenths: number }[] {
  const out: { j: number; tenths: number }[] = []
  for (let j = 0; j < m.nF; j++) {
    const v = m.tenths[i * m.nF + j]
    if (v <= t * 10) out.push({ j, tenths: v })
  }
  return out.sort((a, b) => a.tenths - b.tenths || a.j - b.j)
}

/** 분 표시(정수, 반올림 = 0.5 올림). 전처리와 같은 규칙. */
export function tenthsToMinutes(tenths: number): number {
  return Math.floor(tenths / 10 + 0.5)
}
