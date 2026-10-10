/**
 * 결산 두 칸의 마을 분류(설계안 5-6, 4-7 ±1일 규칙). 손으로 만든 작은 입력으로 경계를 고정한다.
 */

import { describe, expect, it } from 'vitest'

import type { Kpis, Model } from '../engine/kpi'
import { changeSummary, lostPinOrder } from './changeSummary'

// 마을 9곳, 읍·면 둘(0·1). 기준선(base)과 지금(now)의 주당 닿는 진료일
const base = [0, 0, 0.5, 1, 1, 2, 3, 1, 4]
const now = [1, 0.5, 1, 0.5, 2, 1, 2.5, 1, 4]
const pop = new Int32Array([100, 50, 70, 200, 30, 80, 60, 40, 90])
const emd = new Int32Array([0, 0, 0, 1, 1, 1, 0, 1, 0])
const model = { pop, emd } as unknown as Model
const k = (d: number[]) => ({ villageDays: Float64Array.from(d) }) as unknown as Kpis

describe('changeSummary', () => {
  const ch = changeSummary(k(now), k(base), model)

  it('better = newly reached (below 1 → 1 or more) + reached villages that gained a day or more', () => {
    // 0 → 1(새로 닿음), 0.5 → 1(새로 닿음, 늘어난 폭은 0.5), 1 → 2(하루 늘어남)
    expect(ch.better.newly).toEqual([0, 2])
    expect(ch.better.more).toEqual([4])
    expect(ch.better.villages).toEqual([0, 2, 4])
    expect(ch.better.pop).toBe(100 + 70 + 30)
  })

  it('worse = lost access (1 or more → below 1) + still reached but a day or more fewer', () => {
    // 1 → 0.5(닿지 않게 됨), 2 → 1(하루 줄어듦). 3 → 2.5는 반나절이라 어느 쪽도 아니다
    expect(ch.worse.lost).toEqual([3])
    expect(ch.worse.thinner).toEqual([5])
    expect(ch.worse.villages).toEqual([3, 5])
  })

  it('leaves out villages that stay unreached, change by less than a day, or do not change', () => {
    // 0 → 0.5(여전히 닿지 않음), 3 → 2.5, 1 → 1, 4 → 4
    for (const i of [1, 6, 7, 8]) {
      expect(ch.better.villages).not.toContain(i)
      expect(ch.worse.villages).not.toContain(i)
    }
  })

  it('groups residents by 읍·면, most affected first', () => {
    expect(ch.better.emds).toEqual([
      { m: 0, pop: 170 },
      { m: 1, pop: 30 },
    ])
    expect(ch.worse.emds).toEqual([{ m: 1, pop: 280 }])
  })
})

describe('lostPinOrder', () => {
  it('orders by residents, then by village number, so names and map pins match', () => {
    const p = new Int32Array([10, 50, 50, 5])
    expect(lostPinOrder([3, 2, 1, 0], p)).toEqual([1, 2, 0, 3])
  })
})
