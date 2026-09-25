/**
 * 디오라마 세계·빛의 나무·빛의 순서(설계안 6-16). 실제 생성 데이터(public/data)로 확인한다.
 * - 집 수는 인구에 비례한다(집 한 채 ≈ 주민 50명, 최소 1채). 물·시내 위에 집이 없다. 늘 같은 세계가 나온다.
 * - 빛의 나무는 기준 안 마을 경로를 모두 덮고, 같은 길을 두 번 깔지 않는다. 가지의 분은 행렬 시간을 넘지 않는다.
 * - 빛은 행렬의 도로망 시간 순서로 마을에 닿는다. 계산과 다른 마을을 켜지 않는다.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Geometry, Scenario } from '../data/types'
import { buildModel, computeKpis } from '../engine/kpi'
import { EMBER_MS, MS_PER_MIN, frontAt, planOp, planThreshold, progressAt } from './lightPlan'
import { clinicTree, mergeRoutes, villageTree } from './lightTree'
import { Heightmap } from './terrain'
import { R_CITY, R_WATER, RESIDENTS_PER_HOUSE, buildWorld, houseCount } from './world'

const dataDir = resolve(__dirname, '../../public/data')
const scenario = JSON.parse(readFileSync(resolve(dataDir, 'scenario.json'), 'utf-8')) as Scenario
const geometry = JSON.parse(readFileSync(resolve(dataDir, 'geometry.json'), 'utf-8')) as Geometry
const bin = readFileSync(resolve(dataDir, 'terrain.bin'))
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer
const hm = new Heightmap(geometry.terrain, buf, 1)
const model = buildModel(scenario)
const world = buildWorld(scenario, geometry, hm)
const minutesOf = (i: number, j: number) => model.tenths[i * model.nF + j] / 10

describe('diorama world', () => {
  it('one house stands for about 50 residents, at least one per village', () => {
    expect(RESIDENTS_PER_HOUSE).toBe(50)
    scenario.villages.forEach((v, i) => {
      expect(world.villages[i].houses.length).toBe(houseCount(v.pop))
    })
    const total = scenario.villages.reduce((s, v) => s + houseCount(v.pop), 0)
    expect(world.houses.length).toBe(total)
    expect(total).toBeGreaterThan(780)
    expect(total).toBeLessThan(840)
    // 인구가 많은 마을이 집이 더 많다(단조).
    const byPop = scenario.villages.map((v, i) => ({ pop: v.pop, n: world.villages[i].houses.length })).sort((a, b) => a.pop - b.pop)
    for (let k = 1; k < byPop.length; k++) expect(byPop[k].n).toBeGreaterThanOrEqual(byPop[k - 1].n)
  })

  it('houses stay off water and the city core, close to their village, without overlapping', () => {
    for (const h of world.houses) {
      expect(world.raster.at(h.x, h.y) & (R_WATER | R_CITY)).toBe(0)
      const v = scenario.villages[h.village]
      expect(Math.hypot(h.x - v.x, h.y - v.y)).toBeLessThan(2.2)
    }
    // 겹침 없음(중심 사이 0.2 km 이상)
    const hs = world.houses
    let tooClose = 0
    for (let a = 0; a < hs.length; a++) for (let b = a + 1; b < hs.length; b++) {
      if (Math.hypot(hs[a].x - hs[b].x, hs[a].y - hs[b].y) < 0.2) tooClose++
    }
    expect(tooClose).toBe(0)
    // 보건지소 터에는 집이 없다.
    for (const c of world.clinics) for (const h of hs) expect(Math.hypot(h.x - c.x, h.y - c.y)).toBeGreaterThan(0.3)
  })

  it('is the same world every time (fixed seeds)', () => {
    const again = buildWorld(scenario, geometry, hm)
    expect(again.houses.map((h) => [h.x, h.y, h.rot, h.roof])).toEqual(world.houses.map((h) => [h.x, h.y, h.rot, h.roof]))
    expect(again.trees.length).toBe(world.trees.length)
  })

  it('trees are a landscape layer within a draw budget and stay off water and the city', () => {
    expect(world.trees.length).toBeGreaterThan(3000)
    expect(world.trees.length).toBeLessThan(20000)
    for (const t of world.trees) expect(world.raster.at(t.x, t.y) & (R_WATER | R_CITY)).toBe(0)
  })
})

describe('light tree (real road routes, one line per road)', () => {
  it('covers the end of every route within the threshold and never exceeds the matrix time', () => {
    for (let j = 0; j < model.nF; j++) {
      const branches = clinicTree(j, geometry.routes.pairs, minutesOf, 20)
      const ends = geometry.routes.pairs.filter(([, jj]) => jj === j).map(([i, , c]) => ({ i, p: c[0] }))
      for (const { i, p } of ends) {
        // 마을 쪽 끝점(경로 첫 점) 근처에 가지 점이 있다.
        let best = Infinity
        for (const b of branches) for (const q of b.pts) best = Math.min(best, Math.hypot(q[0] - p[0], q[1] - p[1]))
        expect(best, `clinic ${j} village ${i}`).toBeLessThan(0.1)
      }
      for (const b of branches) {
        for (let k = 1; k < b.t.length; k++) expect(b.t[k]).toBeGreaterThanOrEqual(b.t[k - 1] - 1e-9)
        expect(Math.max(...b.t)).toBeLessThanOrEqual(20 + 1e-9)
      }
    }
  })

  it('does not lay the same road twice (no bundle at the clinic)', () => {
    const j = scenario.facilities.findIndex((f) => f.short === '의당')
    const branches = clinicTree(j, geometry.routes.pairs, minutesOf, 15)
    const raw = geometry.routes.pairs.filter(([i, jj]) => jj === j && minutesOf(i, j) <= 15)
    const rawLen = raw.reduce((s, [, , c]) => s + c.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - c[k][0], p[1] - c[k][1]), 0), 0)
    const treeLen = branches.reduce((s, b) => s + b.d[b.d.length - 1], 0)
    expect(treeLen).toBeLessThan(rawLen * 0.6)
    // 지소 근처 1 km 안을 지나는 가지 점이 한 줄 굵기 이상으로 쌓이지 않는다(다발 없음).
    const f = scenario.facilities[j]
    const near = branches.flatMap((b) => b.pts).filter(([x, y]) => Math.hypot(x - f.x, y - f.y) < 1)
    const rawNear = raw.flatMap(([, , c]) => c).filter(([x, y]) => Math.hypot(x - f.x, y - f.y) < 1)
    expect(near.length).toBeLessThan(Math.max(80, rawNear.length * 3))
  })

  it('merges a simple fork into a trunk and one branch', () => {
    const trunk: [number, number][] = [
      [0, 0],
      [1, 0],
    ]
    const a = { coords: [...trunk, [2, 0]] as [number, number][], minutes: 4, target: 0 }
    const b = { coords: [...trunk, [1, 1]] as [number, number][], minutes: 5, target: 1 }
    const out = mergeRoutes([b, a])
    expect(out).toHaveLength(2)
    expect(out[0].t[out[0].t.length - 1]).toBeCloseTo(4)
    // 두 번째 가지는 갈림목에서 시작한다.
    expect(Math.hypot(out[1].pts[0][0] - 1, out[1].pts[0][1])).toBeLessThan(0.07)
    expect(out[1].t[out[1].t.length - 1]).toBeCloseTo(5)
  })

  it('village hover reads the routes backwards to the clinics', () => {
    const i = geometry.routes.pairs[0][0]
    const js = geometry.routes.pairs.filter(([ii]) => ii === i).map(([, j]) => j)
    const b = villageTree(i, js, geometry.routes.pairs, minutesOf, 20)
    expect(b.length).toBeGreaterThan(0)
    const v = scenario.villages[i]
    expect(Math.hypot(b[0].pts[0][0] - v.x, b[0].pts[0][1] - v.y)).toBeLessThan(1)
  })
})

describe('light order follows the road-network matrix', () => {
  const T = 15 as const
  const j = scenario.facilities.findIndex((f) => f.short === '우성')

  it('+1 reaches changed villages in matrix-time order, after the ember lands, within 0.8 s of light', () => {
    const x0 = new Array(10).fill(0)
    const x1 = x0.map((v, k) => (k === j ? 1 : v))
    const a = computeKpis(model, x0, T).villageDays
    const b = computeKpis(model, x1, T).villageDays
    const plan = planOp(model, 1, j, 1, T, a, b)
    const want = []
    for (let i = 0; i < model.nV; i++) if (b[i] !== a[i]) want.push(i)
    expect(plan.arrivals.map((x) => x.i).sort((p, q) => p - q)).toEqual(want)
    // 행렬이 T 안이라고 한 마을만 켠다.
    for (const ar of plan.arrivals) expect(model.tenths[ar.i * model.nF + j]).toBeLessThanOrEqual(T * 10)
    for (let k = 1; k < plan.arrivals.length; k++) {
      const p = plan.arrivals[k - 1]
      const q = plan.arrivals[k]
      expect(minutesOf(q.i, j)).toBeGreaterThanOrEqual(minutesOf(p.i, j))
      expect(q.at).toBeCloseTo(EMBER_MS + minutesOf(q.i, j) * MS_PER_MIN)
    }
    expect(plan.chamberMs).toBe(EMBER_MS)
    expect(plan.endMs - EMBER_MS).toBeLessThanOrEqual(T * MS_PER_MIN + 1)
    expect(plan.endMs - EMBER_MS).toBeLessThanOrEqual(800)
    expect(progressAt(plan, 0)).toBe(0)
    expect(progressAt(plan, plan.endMs)).toBe(1)
    expect(frontAt(plan, EMBER_MS)).toBe(0)
    expect(frontAt(plan, plan.endMs)).toBeCloseTo(T)
  })

  it('−1 retracts from the far villages first', () => {
    const x1 = new Array(10).fill(0).map((_, k) => (k === j ? 1 : 0))
    const a = computeKpis(model, x1, T).villageDays
    const b = computeKpis(model, new Array(10).fill(0), T).villageDays
    const plan = planOp(model, 2, j, -1, T, a, b)
    expect(plan.chamberMs).toBe(0)
    for (let k = 1; k < plan.arrivals.length; k++) {
      expect(minutesOf(plan.arrivals[k].i, j)).toBeLessThanOrEqual(minutesOf(plan.arrivals[k - 1].i, j))
    }
    expect(plan.arrivals.every((x) => !x.gain)).toBe(true)
  })

  it('a threshold change extends the light along the roads, nearest band first', () => {
    const x = scenario.current_allocation
    const a = computeKpis(model, x, 15).villageDays
    const b = computeKpis(model, x, 20).villageDays
    const plan = planThreshold(model, 3, 15, 20, x, a, b)
    expect(plan.clinics.sort()).toEqual(x.map((v, k) => (v > 0 ? k : -1)).filter((k) => k >= 0))
    expect(plan.arrivals.length).toBeGreaterThan(0)
    expect(plan.arrivals.every((ar) => ar.at >= 0 && ar.at <= 620)).toBe(true)
    // 움직임 줄이기: 전부 즉시
    const r = planThreshold(model, 4, 15, 20, x, a, b, true)
    expect(r.endMs).toBe(0)
    expect(progressAt(r, 0)).toBe(1)
  })
})
