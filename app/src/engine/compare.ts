/**
 * 기준선 대비 변화(설계안 4-7)와 미션 판정(3-4, 7-7). 순수 함수.
 */

import type { LandscapeCombo, MissionData, MissionKpi } from '../data/types'
import { type Kpis, tierOf } from './kpi'

export type Change = 'better' | 'same' | 'worse'

/** 리 단위 변화: +1일 이상 좋아짐 / -1일 이상 나빠짐 / 그 밖은 같음. */
export function villageChange(now: number, base: number): Change {
  const d = now - base
  return d >= 1 ? 'better' : d <= -1 ? 'worse' : 'same'
}

/** 증감 글리프 크기 3단: |Δ| 1일 / 2일 / 3일 이상. 변화 없음은 0. */
export function glyphSize(now: number, base: number): 0 | 1 | 2 | 3 {
  const d = Math.abs(now - base)
  return d < 1 ? 0 : d < 2 ? 1 : d < 3 ? 2 : 3
}

/** 이번 조작으로 상태(3단)가 바뀐 마을 — 한 번 깜빡인다(설계안 4-7 마지막 줄, 6-9). */
export function tierChangedVillages(before: Float64Array, after: Float64Array): number[] {
  const out: number[] = []
  for (let i = 0; i < after.length; i++) if (tierOf(before[i]) !== tierOf(after[i])) out.push(i)
  return out
}

export interface LostSummary {
  /** 기준선에서 주 1일 이상이었는데 지금 닿지 않는 마을 */
  lost: number[]
  lostPop: number
  /** 닿기는 하지만 기준선보다 1일 이상 줄어든 마을 */
  thinner: number[]
  thinnerPop: number
  /** 기준선에서 닿지 않다가 지금 닿는 마을 */
  gained: number[]
}

export function lostVillages(now: Kpis, base: Kpis, pop: Int32Array): LostSummary {
  const lost: number[] = []
  const thinner: number[] = []
  const gained: number[] = []
  let lostPop = 0
  let thinnerPop = 0
  for (let i = 0; i < now.villageDays.length; i++) {
    const a = now.villageDays[i]
    const b = base.villageDays[i]
    if (b >= 1 && a < 1) {
      lost.push(i)
      lostPop += pop[i]
    } else if (a >= 1 && b - a >= 1) {
      thinner.push(i)
      thinnerPop += pop[i]
    } else if (b < 1 && a >= 1) {
      gained.push(i)
    }
  }
  return { lost, lostPop, thinner, thinnerPop, gained }
}

/** 두 배분 사이에서 좋아진·나빠진 마을 수(리 단위, ±1일 규칙 4-7). */
export function villageChangeCounts(now: Kpis, base: Kpis): { better: number; worse: number } {
  let better = 0
  let worse = 0
  for (let i = 0; i < now.villageDays.length; i++) {
    const c = villageChange(now.villageDays[i], base.villageDays[i])
    if (c === 'better') better++
    else if (c === 'worse') worse++
  }
  return { better, worse }
}

export interface EmdChange {
  m: number
  delta: number
  change: Change
}

/** 읍·면 평균 진료일 변화(소수 1자리 표시 기준 0.05일). 변화 큰 순. */
export function emdChanges(now: Kpis, base: Kpis): EmdChange[] {
  return now.emdDays
    .map((v, m) => {
      const delta = v - base.emdDays[m]
      return { m, delta, change: (delta >= 0.05 ? 'better' : delta <= -0.05 ? 'worse' : 'same') as Change }
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.m - b.m)
}

/** 닿지 않는(주 1일 미만) 마을 목록. */
export function zeroVillages(k: Kpis): number[] {
  const out: number[] = []
  for (let i = 0; i < k.villageDays.length; i++) if (k.villageDays[i] < 1) out.push(i)
  return out
}

/** 여러 배분의 닿지 않는 마을: 한 번이라도(합집합) / 모두에서(교집합). */
export function zeroOverlap(ks: readonly Kpis[]): { union: number[]; all: number[] } {
  const sets = ks.map((k) => new Set(zeroVillages(k)))
  const union = [...new Set(sets.flatMap((s) => [...s]))].sort((a, b) => a - b)
  return { union, all: union.filter((i) => sets.every((s) => s.has(i))) }
}

export function missionValue(k: Kpis, kpi: MissionKpi): number {
  return kpi === 'mean_days' ? k.meanDays : kpi === 'worst_emd_days' ? k.worstEmdDays : k.cov3Pop
}

/**
 * '가능한 배분 중 상위 n%' (n = 그 지표가 내 배분보다 높은 배분 비율의 올림, 최소 1).
 * 전처리가 만든 경계표 w_1..w_100에서 v ≥ w_k를 만족하는 가장 작은 k.
 */
export function topPercent(value: number, thresholds: readonly number[]): number {
  for (let k = 0; k < thresholds.length; k++) if (value >= thresholds[k]) return k + 1
  return 100
}

export interface MissionStatus {
  value: number
  target: number
  achieved: boolean
  /** 목표까지 남은 양(진료일은 0.1일 올림, 인구는 정수). 달성이면 0 */
  remaining: number
  topPercent: number
  /** 0..1 진행 막대 */
  progress: number
}

export function missionStatus(k15: Kpis, mission: MissionData, combo: LandscapeCombo): MissionStatus {
  const value = missionValue(k15, mission.kpi)
  const target = mission.target
  const achieved = value >= target
  let remaining = 0
  if (!achieved) {
    remaining = mission.kpi === 'cov3_pop' ? target - value : Math.ceil((target - value) * 10 - 1e-9) / 10
  }
  return {
    value,
    target,
    achieved,
    remaining,
    topPercent: topPercent(value, combo.rank_thresholds[mission.kpi]),
    progress: target > 0 ? Math.max(0, Math.min(1, value / target)) : 1,
  }
}

export type KpiKey = 'meanDays' | 'cov1Pop' | 'cov3Pop' | 'worstEmdDays' | 'gapDays' | 'p90Tenths'

/** 값이 클수록 좋은가. 격차·90% 접근시간은 작을수록 좋다. */
export const HIGHER_IS_BETTER: Record<KpiKey, boolean> = {
  meanDays: true,
  cov1Pop: true,
  cov3Pop: true,
  worstEmdDays: true,
  gapDays: false,
  p90Tenths: false,
}

export interface KpiDelta {
  key: KpiKey
  now: number | null
  base: number | null
  delta: number | null
  /** 좋아짐(▲) / 나빠짐(▼) / 같음 */
  change: Change
}

export function kpiDeltas(now: Kpis, base: Kpis): KpiDelta[] {
  const keys: KpiKey[] = ['meanDays', 'cov1Pop', 'cov3Pop', 'worstEmdDays', 'gapDays', 'p90Tenths']
  return keys.map((key) => {
    const a = now[key]
    const b = base[key]
    if (a === null || b === null) return { key, now: a, base: b, delta: null, change: 'same' }
    const d = a - b
    const eps = key === 'cov1Pop' || key === 'cov3Pop' || key === 'p90Tenths' ? 0.5 : 0.05
    const good = HIGHER_IS_BETTER[key] ? d : -d
    return { key, now: a, base: b, delta: d, change: good >= eps ? 'better' : good <= -eps ? 'worse' : 'same' }
  })
}

/**
 * 디브리핑 '얻은 것'(설계안 5-6 블록 2): 기준선 대비 가장 많이 좋아진 지표 2개.
 * 단위가 다른 지표를 견주려고 각 지표의 범위로 나눈다(진료일 5일, 인구 전체, 시간은 기준선 값).
 */
export function topGains(deltas: KpiDelta[], totalPop: number): KpiDelta[] {
  const scale = (d: KpiDelta): number => {
    if (d.delta === null || d.base === null) return 0
    const good = HIGHER_IS_BETTER[d.key] ? d.delta : -d.delta
    if (d.key === 'cov1Pop' || d.key === 'cov3Pop') return good / totalPop
    if (d.key === 'p90Tenths') return good / Math.max(d.base, 1)
    return good / 5
  }
  return deltas
    .filter((d) => d.change === 'better')
    .map((d) => ({ d, s: scale(d) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map((v) => v.d)
}
