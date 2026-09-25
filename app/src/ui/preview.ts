/**
 * 놓기 전 미리보기(설계안 6-17). 지소 j에 하루를 놓거나(+1) 빼면(−1) 무엇이 바뀌는지 **실제 행렬로 미리 계산**한다.
 * 화면에 보이는 것: 바뀔 마을(집 테두리 빛), 말풍선 옆 숫자 하나와 한 줄. 계산 의미는 KPI와 같다(새 지표를 만들지 않는다).
 *
 * 숫자 하나는 "주민"으로 말한다: 새로 닿는(또는 닿지 않게 되는) 주민 → 없으면 주 3일 이상으로 두꺼워지는(얇아지는) 주민
 * → 그것도 없으면 진료일이 늘어나는(줄어드는) 마을 수. 원·반경은 쓰지 않는다(10-1 5번).
 */

import { tierChangedVillages } from '../engine/compare'
import { allocDays, people } from '../engine/format'
import { type Kpis, type Model, type Threshold, computeKpis, tierOf } from '../engine/kpi'

export interface PreviewInfo {
  j: number
  dir: 1 | -1
  /** 막힌 조작이면 이유(말풍선 옆 한 줄) */
  blocked: string | null
  /** 단계(창 불빛 3단)가 바뀔 마을 */
  villages: number[]
  big: string
  line: string
  /** 지소 진료일 변화 · 미션 지표 변화 */
  detail: string
  tone: 'gain' | 'loss' | 'same'
}

export interface PreviewText {
  blockedEmpty: string
  blockedMax: string
  blockedNone: string
  blockedTutorial: string
  newly(n: number): string
  thicker(n: number): string
  more(n: number): string
  lost(n: number): string
  thinner(n: number): string
  less(n: number): string
  same: string
  days(fac: string, a: string, b: string): string
}

export interface PreviewInput {
  model: Model
  T: Threshold
  alloc: readonly number[]
  /** 지금 배분의 KPI(같은 T) */
  k: Kpis
  j: number
  dir: 1 | -1
  fac: string
  allowed: boolean
  /** 막힌 까닭을 고른다: 손이 비었나 · 5일인가 · 뺄 것이 없나 · 튜토리얼 규칙 */
  reason: 'empty' | 'max' | 'none' | 'tutorial' | null
  /** 미션 지표 한 줄(없으면 생략): 조작 뒤 배분 → "평균 진료일 주 1.6 → 1.7일" */
  missionLine?: (after: readonly number[]) => string | null
  text: PreviewText
}

export function buildPreview(p: PreviewInput): PreviewInfo {
  const { model, j, dir, text } = p
  if (!p.allowed) {
    const why = p.reason === 'empty' ? text.blockedEmpty : p.reason === 'max' ? text.blockedMax : p.reason === 'tutorial' ? text.blockedTutorial : text.blockedNone
    return { j, dir, blocked: why, villages: [], big: '', line: why, detail: '', tone: 'same' }
  }
  const after = p.alloc.slice()
  after[j] = Math.max(0, Math.min(5, after[j] + dir))
  const k2 = computeKpis(model, after, p.T)
  const before = p.k.villageDays
  const now = k2.villageDays
  const villages = tierChangedVillages(before, now)
  let reachPop = 0
  let reachN = 0
  let thickPop = 0
  let thickN = 0
  let daysN = 0
  for (let i = 0; i < model.nV; i++) {
    const a = before[i]
    const b = now[i]
    if (Math.abs(b - a) < 1e-9) continue
    daysN++
    if ((a < 1) !== (b < 1)) {
      reachPop += model.pop[i]
      reachN++
    } else if (tierOf(a) !== tierOf(b)) {
      thickPop += model.pop[i]
      thickN++
    }
  }
  const sign = dir > 0 ? '+' : '−'
  let big: string
  let line: string
  if (reachN > 0) {
    big = `${sign}${people(reachPop)}`
    line = dir > 0 ? text.newly(reachN) : text.lost(reachN)
  } else if (thickN > 0) {
    big = `${sign}${people(thickPop)}`
    line = dir > 0 ? text.thicker(thickN) : text.thinner(thickN)
  } else if (daysN > 0) {
    big = `${sign}1일`
    line = dir > 0 ? text.more(daysN) : text.less(daysN)
  } else {
    big = '±0'
    line = text.same
  }
  const daysLine = text.days(p.fac, p.alloc[j] <= 0 ? '0일' : allocDays(p.alloc[j]).replace('주 ', ''), after[j] <= 0 ? '0일' : allocDays(after[j]).replace('주 ', ''))
  const m = p.missionLine?.(after)
  return { j, dir, blocked: null, villages, big, line, detail: m ? `${daysLine} · ${m}` : daysLine, tone: daysN === 0 ? 'same' : dir > 0 ? 'gain' : 'loss' }
}
