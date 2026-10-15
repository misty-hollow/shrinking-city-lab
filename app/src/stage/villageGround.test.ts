/**
 * 마을 받침(설계안 6-18 P2). 실제 생성 데이터(public/data)로 확인한다.
 * - 단계는 새 규칙이 아니라 tierOf(A_i)다: 주 1일 미만 / 1 ≤ A < 3 / A ≥ 3. 반나절 단위 경계값(0.5·2.5·3.5)도 빠짐없이 한 단계에 든다.
 * - 받침 단계별 주민 수는 KPI(주 1일 이상 닿는 주민·주 3일 이상 닿는 주민)와 같다.
 * - 모든 집이 자기 마을 받침 위에 있고, 다른 마을 받침끼리 붙지 않고, 보건지소 터를 덮지 않는다.
 * - 받침이 섬을 과하게 덮지 않는다.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Geometry, Scenario } from '../data/types'
import { type Threshold, buildModel, computeKpis, tierOf } from '../engine/kpi'
import { Heightmap } from './terrain'
import { CLINIC_CLEAR_KM, GROUND_GAP_KM, GROUND_TEXEL_KM, bakeVillageGround, decodeSdf, distanceTransform, encodeSdf } from './villageGround'
import { buildWorld } from './world'

const dataDir = resolve(__dirname, '../../public/data')
const scenario = JSON.parse(readFileSync(resolve(dataDir, 'scenario.json'), 'utf-8')) as Scenario
const geometry = JSON.parse(readFileSync(resolve(dataDir, 'geometry.json'), 'utf-8')) as Geometry
const bin = readFileSync(resolve(dataDir, 'terrain.bin'))
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer
const hm = new Heightmap(geometry.terrain, buf, 1)
const model = buildModel(scenario)
const world = buildWorld(scenario, geometry, hm)
const t0 = performance.now()
const bake = bakeVillageGround(world, hm)
const bakeMs = performance.now() - t0

const texel = (x: number, y: number) => {
  const c = Math.floor(((x - hm.x0) / hm.width) * bake.cols)
  const r = Math.floor(((y - hm.y0) / hm.height) * bake.rows)
  return r * bake.cols + c
}
const sAt = (k: number) => decodeSdf(bake.sdf[k * 2])

describe('village ground — state follows the existing tiers', () => {
  it('maps every half-day value into exactly one tier, with the KPI boundaries (1 day, 3 days)', () => {
    const cases: [number, number][] = [
      [0, 0],
      [0.5, 0],
      [0.99, 0],
      [1, 1],
      [1.5, 1],
      [2, 1],
      [2.5, 1],
      [2.99, 1],
      [3, 2],
      [3.5, 2],
      [4.5, 2],
      [5, 2],
    ]
    for (const [d, t] of cases) expect(tierOf(d), `A = ${d}`).toBe(t)
  })

  it('residents on each ground tier equal the KPI counts (current 10 days, 10 · 15 · 20 minutes)', () => {
    const x = scenario.facilities.map((f) => f.current_days)
    const seen = new Set<number>()
    for (const T of [10, 15, 20] as Threshold[]) {
      const k = computeKpis(model, x, T)
      let lit = 0
      let full = 0
      for (let i = 0; i < model.nV; i++) {
        seen.add(k.villageDays[i])
        const t = tierOf(k.villageDays[i])
        if (t >= 1) lit += model.pop[i]
        if (t === 2) full += model.pop[i]
      }
      expect(lit).toBe(k.cov1Pop)
      expect(full).toBe(k.cov3Pop)
    }
    // 현재 실제 배분에는 격주(반나절 단위) 값이 있다: 1.5일·2.5일 마을이 실제로 생긴다
    expect([...seen].some((d) => d % 1 !== 0)).toBe(true)
  })
})

describe('village ground — shape', () => {
  it('bakes quickly and deterministically', () => {
    expect(bakeMs).toBeLessThan(1500)
    const again = bakeVillageGround(world, hm)
    expect(Buffer.from(again.sdf).equals(Buffer.from(bake.sdf))).toBe(true)
    expect(Buffer.from(again.id).equals(Buffer.from(bake.id))).toBe(true)
  })

  it('encodes distances to 1 m', () => {
    for (const v of [-0.12, -0.03, 0, 0.0004, 0.05, 0.12]) expect(Math.abs(decodeSdf(encodeSdf(v)) - v)).toBeLessThanOrEqual(0.0005)
  })

  it('distance transform matches brute force on a small grid', () => {
    const w = 9
    const h = 7
    const f = new Uint8Array(w * h)
    f[2 * w + 3] = 1
    f[5 * w + 7] = 1
    const d = distanceTransform(f, w, h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const want = Math.min(Math.hypot(x - 3, y - 2), Math.hypot(x - 7, y - 5))
        expect(d[y * w + x]).toBeCloseTo(want, 6)
      }
  })

  it('puts every house on its own village ground', () => {
    for (const h of world.houses) {
      const k = texel(h.x, h.y)
      expect(bake.id[k] - 1, `house of village ${h.village}`).toBe(h.village)
      expect(sAt(k)).toBeLessThan(0)
    }
  })

  it('keeps grounds of different villages apart and off clinic sites', () => {
    const reach = Math.ceil((GROUND_GAP_KM * 0.6) / GROUND_TEXEL_KM)
    let touching = 0
    for (let r = 0; r < bake.rows; r++)
      for (let c = 0; c < bake.cols; c++) {
        const k = r * bake.cols + c
        if (!bake.id[k] || sAt(k) >= 0) continue
        for (let dr = -reach; dr <= reach; dr++)
          for (let dc = -reach; dc <= reach; dc++) {
            const rr = r + dr
            const cc = c + dc
            if (rr < 0 || cc < 0 || rr >= bake.rows || cc >= bake.cols) continue
            const q = rr * bake.cols + cc
            if (bake.id[q] && bake.id[q] !== bake.id[k] && sAt(q) < 0 && Math.hypot(dr, dc) * GROUND_TEXEL_KM < GROUND_GAP_KM * 0.6) touching++
          }
      }
    expect(touching).toBe(0)
    for (const cl of world.clinics) {
      const span = Math.ceil(CLINIC_CLEAR_KM / GROUND_TEXEL_KM)
      const k0 = texel(cl.x, cl.y)
      const r0 = Math.floor(k0 / bake.cols)
      const c0 = k0 % bake.cols
      for (let dr = -span; dr <= span; dr++)
        for (let dc = -span; dc <= span; dc++) {
          if (Math.hypot(dr, dc) * GROUND_TEXEL_KM > CLINIC_CLEAR_KM - 2 * GROUND_TEXEL_KM) continue
          const q = (r0 + dr) * bake.cols + (c0 + dc)
          expect(bake.id[q] && sAt(q) < 0 ? 1 : 0).toBe(0)
        }
    }
  })

  it('never crosses zero between a ground texel and its outside neighbours (no ring outside the ground)', () => {
    // 셰이더는 부호 거리를 선형 보간한다. 마을 번호가 바뀌는 경계(받침 없음 포함)의 양쪽은 모두 바깥(> 0)이어야
    // 보간값이 0을 지나지 않는다. 2026-10-15: 받침 없는 칸을 0(= 깊은 안쪽)으로 두어 점선 고리가 생겼던 회귀.
    let crossings = 0
    for (let r = 0; r < bake.rows; r++)
      for (let c = 0; c < bake.cols; c++) {
        const k = r * bake.cols + c
        if (!bake.id[k]) {
          if (bake.sdf[k * 2] !== 255) crossings++
          continue
        }
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]) {
          const rr = r + dr
          const cc = c + dc
          if (rr < 0 || cc < 0 || rr >= bake.rows || cc >= bake.cols) continue
          const q = rr * bake.cols + cc
          if (bake.id[q] !== bake.id[k] && (sAt(k) <= 0 || sAt(q) <= 0)) crossings++
        }
      }
    expect(crossings).toBe(0)
  })

  it('covers only a small share of the island', () => {
    let inside = 0
    for (let k = 0; k < bake.cols * bake.rows; k++) if (bake.id[k] && sAt(k) < 0) inside++
    const groundKm2 = inside * GROUND_TEXEL_KM * GROUND_TEXEL_KM
    let cells = 0
    for (let r = 0; r < hm.rows - 1; r++) for (let c = 0; c < hm.cols - 1; c++) if (hm.inside(r, c)) cells++
    const islandKm2 = cells * hm.cell * hm.cell
    // 집 808채의 마당(2026-10-15 약 9.1%). 섬의 10% 안만 덮는다(지형을 가리지 않게). 0일 마을은 테두리만 칠한다
    expect(groundKm2 / islandKm2).toBeLessThan(0.1)
    expect(groundKm2).toBeGreaterThan(20)
  })
})
