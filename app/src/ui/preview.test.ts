/**
 * 놓기 전 미리보기(설계안 6-17). 실제 생성 데이터로 확인한다.
 * - 숫자는 실제 행렬 계산과 같다(새로 닿는 주민 = 조작 전후 KPI의 차이, 새 지표를 만들지 않는다).
 * - 테두리를 켤 마을 = 단계(창 불빛 3단)가 바뀌는 마을 = 빛의 계획이 그 마을에 닿는다.
 * - 막힌 조작은 이유 한 줄만, 늘 +/− 글자로 방향을 말한다(색만이 아니다).
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { copy } from '../content/copy'
import type { Scenario } from '../data/types'
import { tierChangedVillages } from '../engine/compare'
import { people } from '../engine/format'
import { buildModel, computeKpis } from '../engine/kpi'
import { planOp } from '../stage/lightPlan'
import { buildPreview } from './preview'

const dataDir = resolve(__dirname, '../../public/data')
const scenario = JSON.parse(readFileSync(resolve(dataDir, 'scenario.json'), 'utf-8')) as Scenario
const model = buildModel(scenario)
const J = Object.fromEntries(scenario.facilities.map((f, j) => [f.id, j]))
const empty = new Array(10).fill(0)

function pv(alloc: number[], j: number, dir: 1 | -1, allowed = true, reason: 'empty' | 'max' | 'none' | 'tutorial' | null = null) {
  return buildPreview({
    model,
    T: 15,
    alloc,
    k: computeKpis(model, alloc, 15),
    j,
    dir,
    fac: scenario.facilities[j].short,
    allowed,
    reason,
    text: copy.world.preview,
  })
}

describe('preview before placing', () => {
  it('+1: the number is the newly reached residents from the real matrix, the marked villages are the ones whose tier changes', () => {
    const j = J.gyeryong
    const after = empty.slice()
    after[j] = 1
    const b = computeKpis(model, empty, 15)
    const a = computeKpis(model, after, 15)
    const p = pv(empty, j, 1)
    expect(p.blocked).toBeNull()
    expect(p.tone).toBe('gain')
    expect(p.big).toBe(`+${people(a.cov1Pop - b.cov1Pop)}`)
    expect(p.line).toContain('새로 닿아요')
    expect(p.villages).toEqual(tierChangedVillages(b.villageDays, a.villageDays))
    expect(p.detail).toContain('계룡 주 0일 → 1일')
    // 테두리를 켠 마을에는 모두 빛이 닿는다(빛의 계획이 같은 마을을 안다)
    const plan = planOp(model, 1, j, 1, 15, b.villageDays, a.villageDays)
    const reached = new Set(plan.arrivals.map((x) => x.i))
    for (const i of p.villages) expect(reached.has(i)).toBe(true)
  })

  it('−1: the same grammar for losses, with a minus sign', () => {
    const j = J.gyeryong
    const alloc = empty.slice()
    alloc[j] = 1
    const p = pv(alloc, j, -1)
    expect(p.tone).toBe('loss')
    expect(p.big.startsWith('−')).toBe(true)
    expect(p.line).toContain('닿지 않게 돼요')
    expect(p.detail).toContain('계룡 주 1일 → 0일')
    // 거꾸로 하면 같은 크기
    const back = pv(empty, j, 1)
    expect(p.big.slice(1)).toBe(back.big.slice(1))
  })

  it('when nobody is newly reached it speaks of thickening, then of more days', () => {
    // 우성 1일에서 하나 더: 새로 닿는 마을은 없고 진료일이 늘어난다
    const j = J.useong
    const alloc = empty.slice()
    alloc[j] = 1
    const p = pv(alloc, j, 1)
    expect(p.big.startsWith('+')).toBe(true)
    expect(p.line === copy.world.preview.thicker(p.villages.length) || /진료일이 늘어요|주 3일 이상이 돼요/.test(p.line)).toBe(true)
  })

  it('a blocked move shows the reason only and marks no village', () => {
    const p = pv(empty, 0, -1, false, 'none')
    expect(p.blocked).toBe(copy.world.preview.blockedNone)
    expect(p.villages).toEqual([])
    const q = pv(empty, 0, 1, false, 'empty')
    expect(q.blocked).toBe(copy.world.preview.blockedEmpty)
  })
})
