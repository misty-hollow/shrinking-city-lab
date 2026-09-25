/**
 * 미션 판정 경계(설계안 3-4, 7-7). 경계 배분은 파이썬 전처리가 B=15·T=15 전수 831,204개에서 고른 것이다
 * (golden.json boundary_*: 목표 미만 중 가장 높은 배분 / 목표 이상 중 가장 낮은 배분). 브라우저 판정이 그 경계를
 * 정확히 가르는지, 화면 기준(10·20분)이 판정을 바꾸지 않는지, r2 데이터만 쓰는지 본다.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Golden, Landscape, Manifest, MissionKpi, Scenario } from '../data/types'
import { missionValue } from '../engine/compare'
import { missionDays } from '../engine/format'
import { type Threshold, buildModel, computeKpis } from '../engine/kpi'
import { MISSIONS, comboFor, judge } from './results'

const dataDir = resolve(__dirname, '../../public/data')
const read = <T>(name: string): T => JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8')) as T
const scenario = read<Scenario>('scenario.json')
const landscape = read<Landscape>('landscape.json')
const golden = read<Golden>('golden.json')
const manifest = read<Manifest>('manifest.json')
const model = buildModel(scenario)

const GOLDEN_KEY: Record<MissionKpi, 'mean_days' | 'worst_emd_days' | 'cov3_pop'> = {
  mean_days: 'mean_days',
  worst_emd_days: 'worst_emd_days',
  cov3_pop: 'cov3_pop',
}

function boundary(m: string, side: 'below' | 'at', t: number) {
  const c = golden.cases.find((x) => x.name === `boundary_${m}_${side}` && x.threshold_min === t)
  if (!c) throw new Error(`golden boundary_${m}_${side}@${t} missing`)
  return c
}

describe('mission targets (r2)', () => {
  it('are the r2 values from the full enumeration', () => {
    expect(landscape.missions.m1.target).toBe(2.8)
    expect(landscape.missions.m2.target).toBe(1.0)
    expect(landscape.missions.m3.target).toBe(24800)
    for (const m of MISSIONS) {
      const d = landscape.missions[m]
      expect(d.budget).toBe(15)
      expect(d.threshold_min).toBe(15)
      expect(comboFor(landscape, d).n_alloc).toBe(831_204)
    }
  })
})

describe.each(MISSIONS)('mission %s judgement at the target boundary', (m) => {
  const mission = landscape.missions[m]
  const key = GOLDEN_KEY[mission.kpi]
  const below = boundary(m, 'below', 15)
  const at = boundary(m, 'at', 15)

  it('boundary allocations are valid 15-day allocations', () => {
    for (const c of [below, at]) {
      expect(c.x.reduce((a, b) => a + b, 0)).toBe(15)
      expect(Math.min(...c.x)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...c.x)).toBeLessThanOrEqual(5)
    }
  })

  it('just below the target → not achieved; at the target → achieved', () => {
    const b = judge(model, landscape, m, below.x)
    const a = judge(model, landscape, m, at.x)
    // 브라우저 값 = 파이썬 골든 값(비트 단위)
    expect(missionValue(b.k15, mission.kpi)).toBe(below.kpis[key])
    expect(missionValue(a.k15, mission.kpi)).toBe(at.kpis[key])
    expect(b.status.achieved).toBe(false)
    expect(b.status.remaining).toBeGreaterThan(0)
    expect(a.status.achieved).toBe(true)
    expect(a.status.remaining).toBe(0)
    expect(b.status.value).toBeLessThan(mission.target)
    expect(a.status.value).toBeGreaterThanOrEqual(mission.target)
  })

  it('the judgement stays at 15 minutes when the screen shows 10 or 20 minutes', () => {
    const bJudged = judge(model, landscape, m, below.x).status.achieved
    const aJudged = judge(model, landscape, m, at.x).status.achieved
    for (const t of [10, 20] as Threshold[]) {
      // judge()는 화면 기준을 받지 않는다. 같은 배분을 그 기준으로 계산하면 값이 달라진다는 것도 확인한다.
      const kb = computeKpis(model, below.x, t)
      const ka = computeKpis(model, at.x, t)
      expect(missionValue(kb, mission.kpi)).toBe(boundary(m, 'below', t).kpis[key])
      expect(missionValue(ka, mission.kpi)).toBe(boundary(m, 'at', t).kpis[key])
      expect(judge(model, landscape, m, below.x).status.achieved).toBe(bJudged)
      expect(judge(model, landscape, m, at.x).status.achieved).toBe(aJudged)
    }
  })
})

describe('the 15-minute rule really matters at the boundary', () => {
  it('mission 2: the near miss would pass at 20 minutes and the pass would fail at 10 minutes', () => {
    const t = landscape.missions.m2.target
    expect(boundary('m2', 'below', 20).kpis.worst_emd_days).toBeGreaterThanOrEqual(t)
    expect(boundary('m2', 'at', 10).kpis.worst_emd_days).toBeLessThan(t)
  })

  it('mission 3: the near miss would pass at 20 minutes and the pass would fail at 10 minutes', () => {
    const t = landscape.missions.m3.target
    expect(boundary('m3', 'below', 20).kpis.cov3_pop).toBeGreaterThanOrEqual(t)
    expect(boundary('m3', 'at', 10).kpis.cov3_pop).toBeLessThan(t)
  })
})

describe('near-miss display', () => {
  it('a value that rounds up to the target is shown with two decimals so it does not read as reached', () => {
    const b = judge(model, landscape, 'm2', boundary('m2', 'below', 15).x)
    expect(missionDays(b.status.value, 1)).toBe('주 0.99일')
    expect(missionDays(1, 1)).toBe('주 1.0일')
    expect(missionDays(0.84, 1)).toBe('주 0.8일')
    const m3 = judge(model, landscape, 'm3', boundary('m3', 'below', 15).x)
    expect(m3.status.remaining).toBe(24800 - boundary('m3', 'below', 15).kpis.cov3_pop)
  })
})

describe('no r1 data', () => {
  it('scenario, manifest and landscape are r2 (접근점 규칙 access-v1)', () => {
    expect(scenario.data_version).toBe('scl01-gongju-r2')
    expect(manifest.data_version).toBe('scl01-gongju-r2')
  })

  it('the mission references evaluate to their r2 values on the app matrix, not on the r1 matrix', () => {
    const r = JSON.parse(readFileSync(resolve(dataDir, '../../../pipeline/reports/r1_to_r2.json'), 'utf-8')) as {
      matrix: { r1_tenths: number[][] }
    }
    const r1 = buildModel({ ...scenario, matrix: { ...scenario.matrix, tenths: r.matrix.r1_tenths } })
    let changed = 0
    for (let i = 0; i < model.nV; i++) for (let j = 0; j < model.nF; j++) if (model.tenths[i * model.nF + j] !== r1.tenths[i * r1.nF + j]) changed++
    expect(changed).toBe(222)
    for (const m of MISSIONS) {
      const ref = landscape.missions[m].reference
      expect(computeKpis(model, ref.x, 15).worstEmdDays).toBe(ref.worst_emd_days)
      expect(computeKpis(model, ref.x, 15).cov3Pop).toBe(ref.cov3_pop)
    }
    // r1 행렬이면 미션 2 참고 배분의 값이 달라진다(검사가 판본 차이를 알아챈다).
    const ref2 = landscape.missions.m2.reference
    const onR1 = computeKpis(r1, ref2.x, 15)
    expect(onR1.worstEmdDays === ref2.worst_emd_days && onR1.cov3Pop === ref2.cov3_pop && onR1.p90Tenths === ref2.p90_tenths).toBe(false)
  })
})
