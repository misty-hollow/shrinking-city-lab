/**
 * KPI 1~6의 화면 이름과 값·차이 표기(설계안 4-6 표기 규칙). 디브리핑·S6 표가 함께 쓴다.
 */

import { copy } from '../content/copy'
import { getLang } from '../content/lang'
import type { Scenario } from '../data/types'
import type { KpiDelta, KpiKey } from '../engine/compare'
import { dayCount, days1, minUnit, minutes, people, popUnit, signed, weekDays } from '../engine/format'
import type { Kpis } from '../engine/kpi'
import type { MissionId } from '../state/results'

export const KPI_KEYS: readonly KpiKey[] = ['meanDays', 'cov1Pop', 'cov3Pop', 'worstEmdDays', 'gapDays', 'p90Tenths']

/** 화면 언어를 따라가도록 읽을 때마다 문구에서 가져온다 */
export const KPI_NAME: Readonly<Record<KpiKey, string>> = {
  get meanDays() {
    return copy.kpi.meanDays
  },
  get cov1Pop() {
    return copy.kpi.cov1
  },
  get cov3Pop() {
    return copy.kpi.cov3
  },
  get worstEmdDays() {
    return copy.kpi.worst
  },
  get gapDays() {
    return copy.kpi.gap
  },
  get p90Tenths() {
    return copy.kpi.p90
  },
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

/**
 * 차이 표기: `+0.7일` `−5,752명` `+1분`, 변화 없음은 단위 없이 `±0`(§4.3).
 * inTable = 값 바로 옆의 차이 칸(값에 단위가 이미 있다). 영어·베트남어는 단위가 길어(「+13,883 people」) 이 칸에서만 숫자로 적는다.
 * 한국어는 언제나 단위를 붙인다(언어 지원 전과 같다).
 */
export function diffText(d: KpiDelta, inTable = false): string {
  if (d.shown === null) return ''
  const pop = d.key === 'cov1Pop' || d.key === 'cov3Pop'
  const time = d.key === 'p90Tenths'
  // 옆에 적힌 두 값(반올림한 값)의 차이를 적는다(kpiDeltas.shown)
  const s = pop || time ? signed(d.shown, 0) : signed(d.shown)
  if (s === '±0' || (inTable && getLang() !== 'ko')) return s
  return pop ? popUnit(s) : time ? minUnit(s) : dayCount(s)
}
