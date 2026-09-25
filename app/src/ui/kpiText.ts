/**
 * KPI 1~6의 화면 이름과 값·차이 표기(설계안 4-6 표기 규칙). 디브리핑·S6 표가 함께 쓴다.
 */

import { copy } from '../content/copy'
import type { Scenario } from '../data/types'
import type { KpiDelta, KpiKey } from '../engine/compare'
import { days1, minutes, people, signed, weekDays } from '../engine/format'
import type { Kpis } from '../engine/kpi'
import type { MissionId } from '../state/results'

export const KPI_KEYS: readonly KpiKey[] = ['meanDays', 'cov1Pop', 'cov3Pop', 'worstEmdDays', 'gapDays', 'p90Tenths']

export const KPI_NAME: Record<KpiKey, string> = {
  meanDays: copy.kpi.meanDays,
  cov1Pop: copy.kpi.cov1,
  cov3Pop: copy.kpi.cov3,
  worstEmdDays: copy.kpi.worst,
  gapDays: copy.kpi.gap,
  p90Tenths: copy.kpi.p90,
}

/** 미션마다 목표가 되는 KPI */
export const GOAL_KPI: Record<MissionId, KpiKey> = { m1: 'meanDays', m2: 'worstEmdDays', m3: 'cov3Pop' }

export function fmtKpi(key: KpiKey, v: number | null, k?: Kpis, scenario?: Scenario): string {
  if (v === null) return copy.kpi.none
  if (key === 'cov1Pop' || key === 'cov3Pop') return people(v)
  if (key === 'p90Tenths') return minutes(v)
  if (key === 'worstEmdDays' && k && scenario) return `${scenario.emds[k.worstEmd].name} ${weekDays(v)}`
  if (key === 'gapDays') return copy.kpi.gapValue(days1(v))
  return weekDays(v)
}

/** 차이 표기: `+0.7일` `−5,752명` `+1분`, 변화 없음은 단위 없이 `±0`(§4.3) */
export function diffText(d: KpiDelta): string {
  if (d.shown === null) return ''
  const pop = d.key === 'cov1Pop' || d.key === 'cov3Pop'
  const time = d.key === 'p90Tenths'
  // 옆에 적힌 두 값(반올림한 값)의 차이를 적는다(kpiDeltas.shown)
  const s = pop || time ? signed(d.shown, 0) : signed(d.shown)
  if (s === '±0') return s
  const unit = pop ? '명' : time ? '분' : '일'
  return s + unit
}
