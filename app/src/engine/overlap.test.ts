/**
 * S6 겹쳐 보기 분류(설계안 6-19). 기존 정의(A_i < 1 = 닿지 않음, 기준 안 지소 없음)의 조합이며,
 * 모든 마을이 정확히 한 갈래에 들고 합계가 늘 161곳 · 전체 주민과 같다.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Landscape, Scenario } from '../data/types'
import { overlapCategories, unreachableVillages, zeroOverlap } from './compare'
import { type Kpis, type Model, type Threshold, buildModel, computeKpis } from './kpi'

const dataDir = resolve(__dirname, '../../public/data')
const read = <T>(name: string): T => JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8')) as T
const scenario = read<Scenario>('scenario.json')
const landscape = read<Landscape>('landscape.json')
const model = buildModel(scenario)
const T: Threshold = 15
const ref = (m: 'm1' | 'm2' | 'm3') => landscape.missions[m].reference.x

function check(ks: Kpis[]) {
  const o = overlapCategories(model, ks, T)
  // 분할: 갈래 합 = 161곳 · 전체 주민
  expect(o.counts.reduce((s, c) => s + c.villages, 0)).toBe(model.nV)
  expect(o.counts.reduce((s, c) => s + c.pop, 0)).toBe(model.totalPop)
  const z = zeroOverlap(ks)
  const noFac = new Set(unreachableVillages(model, T))
  for (let i = 0; i < model.nV; i++) {
    const reached = ks.map((k) => k.villageDays[i] >= 1)
    const want = noFac.has(i) ? 3 : reached.every(Boolean) ? 0 : reached.some(Boolean) ? 1 : 2
    expect(o.cat[i], `village ${i}`).toBe(want)
    expect(o.minDays[i]).toBe(Math.min(...ks.map((k) => k.villageDays[i])))
    // 기준 안 지소가 없는 마을은 어느 배분에서도 0일이다
    if (noFac.has(i)) expect(o.hits[i]).toBe(0)
  }
  // 기존 S6 문장(finaleSummary)의 합집합·교집합과 같은 계산이다
  expect(o.counts[0].villages).toBe(model.nV - z.union.length)
  expect(o.counts[2].villages + o.counts[3].villages).toBe(z.all.length)
  return o
}

describe('S6 overlap categories', () => {
  it('partitions every village exactly once (reference allocations, 10 · 15 · 20 minutes)', () => {
    for (const t of [10, 15, 20] as Threshold[]) {
      const ks = (['m1', 'm2', 'm3'] as const).map((m) => computeKpis(model, ref(m), t))
      const o = overlapCategories(model, ks, t)
      expect(o.counts.reduce((s, c) => s + c.villages, 0)).toBe(161)
      expect(o.counts[3].villages).toBe(unreachableVillages(model, t).length)
    }
    check((['m1', 'm2', 'm3'] as const).map((m) => computeKpis(model, ref(m), T)))
  })

  it('matches the A1 design board numbers for the same three allocations', () => {
    // 시안(2026-10-15 사용자 첨부): 미션 1 = 유구 5 · 계룡 3 · 의당 2 · 우성 5, 미션 2·3 = 참고 배분
    const m1 = [5, 0, 0, 3, 0, 2, 0, 5, 0, 0]
    const o = check([computeKpis(model, m1, T), computeKpis(model, ref('m2'), T), computeKpis(model, ref('m3'), T)])
    expect(o.counts.map((c) => c.villages)).toEqual([98, 54, 0, 9])
    expect(o.counts.map((c) => c.pop)).toEqual([26988, 12210, 0, 1006])
  })

  it('handles half days and the one-day boundary like the KPI (A < 1 = not reached)', () => {
    // 마을 4곳 · 지소 1곳짜리 작은 모형. 마지막 마을은 기준 밖(지소 없음)
    const m: Model = {
      nV: 4,
      nF: 1,
      nE: 1,
      pop: Int32Array.from([10, 20, 30, 40]),
      emd: new Uint8Array(4),
      tenths: Int32Array.from([50, 50, 50, 999]),
      emdPop: [100],
      totalPop: 100,
    }
    const fake = (days: number[]): Kpis => ({ villageDays: Float64Array.from(days) }) as Kpis
    const o = overlapCategories(m, [fake([1, 0.5, 0, 0]), fake([1, 1, 0.5, 0]), fake([2.5, 0.5, 0, 0])], T)
    expect([...o.cat]).toEqual([0, 1, 2, 3])
    expect([...o.hits]).toEqual([0b111, 0b010, 0, 0])
    expect([...o.minDays]).toEqual([1, 0.5, 0, 0])
    expect(o.counts.map((c) => c.pop)).toEqual([10, 20, 30, 40])
  })
})
