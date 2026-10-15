/**
 * 나무 줄이기(적응 화질 마지막 단계)는 섬 전체에서 고르게 줄어야 한다. 실제 생성 데이터로 확인한다.
 * 2026-10-15: 생성 순서(남 → 북) 그대로 앞 절반을 남겨 북쪽 숲이 통째로 사라졌던 회귀.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Geometry, Scenario } from '../data/types'
import { FLAG_CAP_PX, FLAG_MIN_PX, FLAG_SIZES } from './flags'
import { Heightmap } from './terrain'
import { scatterOrder } from './trees'
import { buildWorld } from './world'

const dataDir = resolve(__dirname, '../../public/data')
const scenario = JSON.parse(readFileSync(resolve(dataDir, 'scenario.json'), 'utf-8')) as Scenario
const geometry = JSON.parse(readFileSync(resolve(dataDir, 'geometry.json'), 'utf-8')) as Geometry
const bin = readFileSync(resolve(dataDir, 'terrain.bin'))
const hm = new Heightmap(geometry.terrain, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer, 1)
const world = buildWorld(scenario, geometry, hm)

describe('tree thinning stays even across the island', () => {
  it('half of the trees keeps about half of every quarter (north, south, east, west)', () => {
    for (const kind of [0, 1]) {
      const list = world.trees.filter((t) => t.kind === kind)
      const kept = new Set(scatterOrder(list.length, 20261015 + kind).slice(0, Math.floor(list.length * 0.5)))
      const ys = list.map((t) => t.y).sort((a, b) => a - b)
      const xs = list.map((t) => t.x).sort((a, b) => a - b)
      const q = (a: number[], f: number) => a[Math.floor(a.length * f)]
      const bands = [
        (t: { x: number; y: number }) => t.y >= q(ys, 0.75), // 북쪽 4분의 1
        (t: { x: number; y: number }) => t.y < q(ys, 0.25), // 남쪽
        (t: { x: number; y: number }) => t.x >= q(xs, 0.75), // 동쪽
        (t: { x: number; y: number }) => t.x < q(xs, 0.25), // 서쪽
      ]
      for (const inBand of bands) {
        let all = 0
        let keep = 0
        list.forEach((t, k) => {
          if (!inBand(t)) return
          all++
          if (kept.has(k)) keep++
        })
        expect(keep / all).toBeGreaterThan(0.44)
        expect(keep / all).toBeLessThan(0.56)
      }
    }
  })

  it('is a deterministic permutation', () => {
    const a = scatterOrder(500, 7)
    expect(a).toEqual(scatterOrder(500, 7))
    expect([...a].sort((x, y) => x - y)).toEqual(Array.from({ length: 500 }, (_, k) => k))
  })
})

describe('change flags keep the three size steps', () => {
  it('sizes and on-screen caps grow with |Δ| (1 · 2 · 3+ days)', () => {
    for (const arr of [FLAG_SIZES, FLAG_MIN_PX, FLAG_CAP_PX]) {
      expect(arr[0]).toBe(0)
      expect(arr[1]).toBeGreaterThan(0)
      expect(arr[2]).toBeGreaterThan(arr[1])
      expect(arr[3]).toBeGreaterThan(arr[2])
    }
    // 화면 크기 범위가 단계마다 겹치지 않게 순서를 지킨다(하한 < 상한)
    for (const k of [1, 2, 3]) expect(FLAG_MIN_PX[k]).toBeLessThan(FLAG_CAP_PX[k])
  })
})
