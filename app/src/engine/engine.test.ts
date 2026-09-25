/**
 * 브라우저 엔진 = 파이썬 전처리(골든 값) 일치 검사(설계안 10-7 "엔진 일치").
 * 픽스처가 아니라 저장소에 들어 있는 실제 생성 데이터(public/data)를 읽는다.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Golden, Landscape, Scenario } from '../data/types'
import { canDecrement, canIncrement, decrement, increment, remaining } from './allocation'
import { kpiDeltas, lostVillages, missionStatus, topGains, topPercent } from './compare'
import { allocDays, people, signed, weekDays } from './format'
import { type Threshold, buildModel, computeKpis, tierOf } from './kpi'

const dataDir = resolve(__dirname, '../../public/data')
const read = <T>(name: string): T => JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8')) as T
const scenario = read<Scenario>('scenario.json')
const golden = read<Golden>('golden.json')
const landscape = read<Landscape>('landscape.json')
const model = buildModel(scenario)

describe('engine matches pipeline golden values', () => {
  it('covers current, references and arbitrary allocations at 10/15/20', () => {
    const names = new Set(golden.cases.map((c) => c.name))
    expect(names).toContain('current_actual')
    expect(names).toContain('reference_m1')
    for (const m of ['m1', 'm2', 'm3']) {
      expect(names).toContain(`boundary_${m}_below`)
      expect(names).toContain(`boundary_${m}_at`)
    }
    expect(new Set(golden.cases.map((c) => c.threshold_min))).toEqual(new Set([10, 15, 20]))
    // 현재 1 + 참고 배분 3 + 임의 5 + 미션 경계 6 = 15개 배분 × 기준 3
    expect(golden.cases.length).toBe(45)
  })

  for (const c of golden.cases) {
    it(`${c.name} @ ${c.threshold_min}분`, () => {
      const k = computeKpis(model, c.x, c.threshold_min as Threshold)
      const g = c.kpis
      expect(Math.abs(k.meanDays - g.mean_days)).toBeLessThanOrEqual(golden.tolerance.days)
      // 정수 분자/분모 한 번 나누기라 실제로는 비트까지 같다.
      expect(k.meanDays).toBe(g.mean_days)
      expect(k.worstEmdDays).toBe(g.worst_emd_days)
      expect(k.gapDays).toBeCloseTo(g.gap_days, 12)
      expect(k.cov1Pop).toBe(g.cov1_pop)
      expect(k.cov3Pop).toBe(g.cov3_pop)
      expect(k.zeroPop).toBe(g.zero_pop)
      expect(k.worstEmd).toBe(g.worst_emd)
      expect(k.bestEmd).toBe(g.best_emd)
      expect(k.p90Tenths).toBe(g.p90_tenths)
      expect(k.timeBandPop).toEqual(g.time_band_pop)
      expect(k.emdDays).toEqual(g.emd_days)
      expect(k.emdZeroPop).toEqual(g.emd_zero_pop)
    })
  }
})

describe('known allocations reproduced from generated data', () => {
  it('current actual (주 10일) at 15분 — r2 (접근점 규칙 access-v1)', () => {
    const k = computeKpis(model, scenario.current_allocation, 15)
    expect(scenario.data_version).toBe('scl01-gongju-r2')
    expect(scenario.current_allocation.reduce((a, b) => a + b, 0)).toBe(10)
    expect(k.meanDays.toFixed(2)).toBe('2.08')
    expect(((k.cov1Pop / model.totalPop) * 100).toFixed(2)).toBe('61.80')
    expect(((k.cov3Pop / model.totalPop) * 100).toFixed(2)).toBe('22.43')
    expect(k.worstEmdDays).toBe(0)
    expect(scenario.emds[k.worstEmd].name).toBe('반포면')
    expect(k.p90Tenths).toBe(222)
  })

  it('the browser engine reproduces the 2026-09 experiment on the r1 matrix (calculation meaning)', () => {
    const r = JSON.parse(readFileSync(resolve(dataDir, '../../../pipeline/reports/r1_to_r2.json'), 'utf-8')) as {
      matrix: { r1_tenths: number[][] }
    }
    const r1 = buildModel({ ...scenario, matrix: { ...scenario.matrix, tenths: r.matrix.r1_tenths } })
    const k = computeKpis(r1, scenario.current_allocation, 15)
    expect(k.meanDays.toFixed(2)).toBe('2.01')
    expect(((k.cov1Pop / r1.totalPop) * 100).toFixed(2)).toBe('60.13')
    expect(((k.cov3Pop / r1.totalPop) * 100).toFixed(2)).toBe('21.40')
    expect(k.p90Tenths).toBe(224)
    expect(computeKpis(r1, scenario.current_allocation, 10).meanDays.toFixed(2)).toBe('1.35')
    expect(computeKpis(r1, scenario.current_allocation, 20).meanDays.toFixed(2)).toBe('3.09')
  })

  it('threshold changes the evaluation of the same allocation', () => {
    const k10 = computeKpis(model, scenario.current_allocation, 10)
    const k20 = computeKpis(model, scenario.current_allocation, 20)
    expect(k10.cov1Pop).toBeLessThan(k20.cov1Pop)
    expect(k10.meanDays.toFixed(2)).toBe('1.32')
    expect(k20.meanDays.toFixed(2)).toBe('3.17')
  })

  it('every village and facility carries access-point metadata, none on motorways', () => {
    type WithAccess = { id: string; access?: { dist_m: number; osm_way: string; highway: string } }
    const pts = [...scenario.villages, ...scenario.facilities] as unknown as WithAccess[]
    expect(pts).toHaveLength(171)
    for (const p of pts) {
      expect(p.access?.osm_way, p.id).toBeTruthy()
      expect(['motorway', 'motorway_link']).not.toContain(p.access?.highway)
    }
  })

  it('reference allocations hit their mission values exactly', () => {
    for (const m of Object.values(landscape.missions)) {
      const k = computeKpis(model, m.reference.x, 15)
      expect(k.meanDays).toBe(m.reference.mean_days)
      expect(k.worstEmdDays).toBe(m.reference.worst_emd_days)
      expect(k.cov3Pop).toBe(m.reference.cov3_pop)
      expect(k.p90Tenths).toBe(m.reference.p90_tenths)
    }
  })
})

describe('allocation pool rules', () => {
  it('keeps each facility within 0..5 and the total within budget', () => {
    let x = new Array(10).fill(0)
    for (let n = 0; n < 7; n++) x = increment(x, 0, 15)
    expect(x[0]).toBe(5)
    expect(canIncrement(x, 0, 15)).toBe(false)
    for (let j = 1; j < 10 && remaining(x, 15) > 0; j++) {
      while (canIncrement(x, j, 15)) x = increment(x, j, 15)
    }
    expect(remaining(x, 15)).toBe(0)
    expect(x.reduce((a, b) => a + b, 0)).toBe(15)
    for (let j = 0; j < 10; j++) expect(canIncrement(x, j, 15)).toBe(false)
    const y = decrement(x, 0)
    expect(y[0]).toBe(4)
    expect(remaining(y, 15)).toBe(1)
    expect(canDecrement(new Array(10).fill(0), 3)).toBe(false)
  })

  it('moving one day from 의당 in the real allocation stays at 10', () => {
    const cur = scenario.current_allocation
    const uidang = scenario.facilities.findIndex((f) => f.id === 'uidang')
    const a = decrement(cur, uidang)
    expect(remaining(a, 10)).toBe(1)
    const b = increment(a, 0, 10)
    expect(remaining(b, 10)).toBe(0)
  })

  it('KPIs update after an increment (recomputed from the matrix)', () => {
    const x0 = new Array(10).fill(0)
    const before = computeKpis(model, x0, 15)
    const after = computeKpis(model, increment(x0, 5, 15), 15)
    expect(before.cov1Pop).toBe(0)
    expect(after.cov1Pop).toBeGreaterThan(0)
    expect(after.meanDays).toBeGreaterThan(before.meanDays)
  })
})

describe('comparison and mission judgement', () => {
  const combo = landscape.combos.find((c) => c.budget === 15 && c.threshold_min === 15)!
  const m1 = landscape.missions.m1

  it('mission 1 reference is achieved and in the top 1%', () => {
    const k = computeKpis(model, m1.reference.x, 15)
    const s = missionStatus(k, m1, combo)
    expect(s.achieved).toBe(true)
    expect(s.topPercent).toBe(1)
    expect(s.remaining).toBe(0)
  })

  it('an empty allocation is 100% and reports the remaining gap', () => {
    const k = computeKpis(model, new Array(10).fill(0), 15)
    const s = missionStatus(k, m1, combo)
    expect(s.achieved).toBe(false)
    expect(s.remaining).toBe(2.8)
    expect(s.topPercent).toBe(100)
  })

  it('topPercent is monotone in value', () => {
    const t = combo.rank_thresholds.mean_days
    let prev = 101
    for (let v = 0; v <= 3.5; v += 0.05) {
      const n = topPercent(v, t)
      expect(n).toBeLessThanOrEqual(prev)
      prev = n
    }
  })

  it('lost villages and gains are measured against the real baseline', () => {
    const base = computeKpis(model, scenario.current_allocation, 15)
    const now = computeKpis(model, m1.reference.x, 15)
    const lost = lostVillages(now, base, model.pop)
    for (const i of lost.lost) {
      expect(base.villageDays[i]).toBeGreaterThanOrEqual(1)
      expect(now.villageDays[i]).toBeLessThan(1)
    }
    expect(lost.lostPop).toBe(lost.lost.reduce((s, i) => s + model.pop[i], 0))
    const gains = topGains(kpiDeltas(now, base), model.totalPop)
    expect(gains.length).toBeLessThanOrEqual(2)
    for (const g of gains) expect(g.change).toBe('better')
  })

  it('lower-is-better KPIs are judged in the right direction', () => {
    const base = computeKpis(model, new Array(10).fill(1), 15)
    const now = computeKpis(model, [0, 0, 0, 0, 0, 5, 0, 0, 0, 0], 15)
    const d = kpiDeltas(now, base)
    const p90 = d.find((v) => v.key === 'p90Tenths')!
    expect(p90.delta!).toBeGreaterThan(0)
    expect(p90.change).toBe('worse')
  })
})

describe('format', () => {
  it('follows the notation rules', () => {
    expect(weekDays(2.4321)).toBe('주 2.4일')
    expect(weekDays(0)).toBe('주 0일')
    expect(allocDays(2.5)).toBe('주 2.5일')
    expect(allocDays(3)).toBe('주 3일')
    expect(people(31200)).toBe('31,200명')
    expect(signed(0.74)).toBe('+0.7')
    expect(signed(-1200, 0)).toBe('−1,200')
    expect(tierOf(0)).toBe(0)
    expect(tierOf(2.5)).toBe(1)
    expect(tierOf(3)).toBe(2)
  })
})
