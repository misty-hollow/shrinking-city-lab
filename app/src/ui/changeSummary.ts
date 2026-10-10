/**
 * 결산(S5)·S6에서 "누가 나아지고 누가 불리해졌나"를 주민 수·마을 수·읍·면으로 묶는다. 표시용 순수 함수.
 * 마을 분류는 설계안 4-7의 ±1일 규칙과 lostVillages(엔진)를 그대로 쓴다. 계산을 새로 정의하지 않는다.
 * - 나아진 마을: 새로 닿음(기준선 주 1일 미만 → 1일 이상) + 닿던 마을 중 하루 이상 늘어남
 * - 불리해진 마을: 닿지 않게 됨(1일 이상 → 1일 미만) + 닿기는 하지만 하루 이상 줄어듦
 */

import { lostVillages } from '../engine/compare'
import type { Kpis, Model } from '../engine/kpi'

export interface ChangeSide {
  /** 이 쪽에 든 마을(오름차순) */
  villages: number[]
  pop: number
  /** 이 쪽 주민이 많은 읍·면 순(같으면 번호순) */
  emds: { m: number; pop: number }[]
}

export interface ChangeSummary {
  better: ChangeSide & { newly: number[]; more: number[] }
  worse: ChangeSide & { lost: number[]; thinner: number[] }
}

function side(villages: number[], model: Model): ChangeSide {
  const byEmd = new Map<number, number>()
  let pop = 0
  for (const i of villages) {
    pop += model.pop[i]
    byEmd.set(model.emd[i], (byEmd.get(model.emd[i]) ?? 0) + model.pop[i])
  }
  const emds = [...byEmd.entries()].map(([m, p]) => ({ m, pop: p })).sort((a, b) => b.pop - a.pop || a.m - b.m)
  return { villages, pop, emds }
}

export function changeSummary(now: Kpis, base: Kpis, model: Model): ChangeSummary {
  const l = lostVillages(now, base, model.pop)
  const newly: number[] = []
  const more: number[] = []
  for (let i = 0; i < now.villageDays.length; i++) {
    const a = now.villageDays[i]
    const b = base.villageDays[i]
    if (b < 1 && a >= 1) newly.push(i)
    else if (b >= 1 && a - b >= 1) more.push(i)
  }
  const better = [...newly, ...more].sort((x, y) => x - y)
  const worse = [...l.lost, ...l.thinner].sort((x, y) => x - y)
  return {
    better: { ...side(better, model), newly, more },
    worse: { ...side(worse, model), lost: l.lost, thinner: l.thinner },
  }
}

/**
 * 닿지 않게 된 마을을 이름·지도 표지에 올리는 순서: 주민이 많은 순(같으면 마을 번호순).
 * 결산 문장의 이름과 세계의 빨간 표지가 이 순서를 함께 써서 1:1로 맞는다(UI_DESIGN_SYSTEM §9.4).
 */
export function lostPinOrder(lost: readonly number[], pop: Int32Array): number[] {
  return [...lost].sort((a, b) => pop[b] - pop[a] || a - b)
}
