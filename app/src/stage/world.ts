/**
 * 디오라마 세계 만들기(설계안 6-16 v0.4 「불빛이 닿는 골짜기」). 자료에서 한 번, 늘 같은 결과로 만든다.
 *
 * - 땅 덩어리: 논·밭·숲·물. 고도·경사·골짜기 바닥에서의 높이로 정하는 **풍경 표현**이다. 토지이용 자료가 아니다.
 * - 집: 마을(법정리)마다 집 한 채 ≈ 주민 50명(최소 1채). 실제 건물 위치·수가 아니라 인구 규모를 전하는 기호다.
 *   대표점 둘레에 모이고, 물·급경사·도로·시내 위에는 놓지 않는다. 등은 산, 얼굴은 낮은 쪽이나 길을 본다.
 * - 나무: 숲 덩어리 위에만, 무더기로. 데이터 채널을 쓰지 않는다.
 * - 보건지소 터: 건물과 진료등 탑 자리. 집과 나무가 비켜 간다.
 *
 * 계산에는 쓰지 않는다. 같은 자료면 같은 세계가 나온다(씨앗 고정).
 */

import type { Geometry, PolygonRings, Scenario, XY } from '../data/types'
import type { Heightmap } from './terrain'

/** 집 한 채가 뜻하는 주민 수(범례에 그대로 쓴다) */
export const RESIDENTS_PER_HOUSE = 50

export function houseCount(pop: number): number {
  return Math.max(1, Math.round(pop / RESIDENTS_PER_HOUSE))
}

// --- 난수·잡음(결정론) --------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** 값 잡음 0..1 (격자 크기 = 1) */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}

export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let v = 0
  let amp = 0.5
  let f = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    v += amp * valueNoise(x * f, y * f, seed + o * 17)
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return v / norm
}

// --- 래스터(물·도로·시내 표시) ----------------------------------------------------------

export const R_WATER = 1
export const R_ROAD = 2
export const R_LANE = 4
export const R_CITY = 8
export const R_INSIDE = 16

/** km 좌표 위의 비트 격자. 칸 중심으로 판정한다. */
export class Raster {
  readonly data: Uint8Array
  readonly x0: number
  readonly y0: number
  readonly cell: number
  readonly cols: number
  readonly rows: number
  constructor(x0: number, y0: number, cell: number, cols: number, rows: number) {
    this.x0 = x0
    this.y0 = y0
    this.cell = cell
    this.cols = cols
    this.rows = rows
    this.data = new Uint8Array(cols * rows)
  }

  at(x: number, y: number): number {
    const c = Math.floor((x - this.x0) / this.cell)
    const r = Math.floor((y - this.y0) / this.cell)
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0
    return this.data[r * this.cols + c]
  }

  /** 반지름 안 어느 칸이라도 flag면 참 */
  near(x: number, y: number, radius: number, flag: number): boolean {
    const c0 = Math.floor((x - radius - this.x0) / this.cell)
    const c1 = Math.floor((x + radius - this.x0) / this.cell)
    const r0 = Math.floor((y - radius - this.y0) / this.cell)
    const r1 = Math.floor((y + radius - this.y0) / this.cell)
    const r2 = radius * radius
    for (let r = Math.max(0, r0); r <= Math.min(this.rows - 1, r1); r++) {
      const cy = this.y0 + (r + 0.5) * this.cell - y
      for (let c = Math.max(0, c0); c <= Math.min(this.cols - 1, c1); c++) {
        if (!(this.data[r * this.cols + c] & flag)) continue
        const cx = this.x0 + (c + 0.5) * this.cell - x
        if (cx * cx + cy * cy <= r2) return true
      }
    }
    return false
  }

  /** 짝홀 규칙 주사선 채우기 */
  fillRings(rings: XY[][], flag: number): void {
    let minY = Infinity
    let maxY = -Infinity
    for (const ring of rings) for (const [, y] of ring) {
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    const r0 = Math.max(0, Math.floor((minY - this.y0) / this.cell))
    const r1 = Math.min(this.rows - 1, Math.ceil((maxY - this.y0) / this.cell))
    const xs: number[] = []
    for (let r = r0; r <= r1; r++) {
      const y = this.y0 + (r + 0.5) * this.cell
      xs.length = 0
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i]
          const [xj, yj] = ring[j]
          if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi))
        }
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - this.x0) / this.cell - 0.5))
        const c1 = Math.min(this.cols - 1, Math.floor((xs[k + 1] - this.x0) / this.cell - 0.5))
        for (let c = c0; c <= c1; c++) this.data[r * this.cols + c] |= flag
      }
    }
  }

  strokeLine(coords: XY[], half: number, flag: number): void {
    for (let k = 0; k + 1 < coords.length; k++) {
      const [ax, ay] = coords[k]
      const [bx, by] = coords[k + 1]
      const dx = bx - ax
      const dy = by - ay
      const len2 = dx * dx + dy * dy
      const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - half - this.x0) / this.cell))
      const c1 = Math.min(this.cols - 1, Math.floor((Math.max(ax, bx) + half - this.x0) / this.cell))
      const r0 = Math.max(0, Math.floor((Math.min(ay, by) - half - this.y0) / this.cell))
      const r1 = Math.min(this.rows - 1, Math.floor((Math.max(ay, by) + half - this.y0) / this.cell))
      for (let r = r0; r <= r1; r++) {
        const py = this.y0 + (r + 0.5) * this.cell
        for (let c = c0; c <= c1; c++) {
          const px = this.x0 + (c + 0.5) * this.cell
          const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
          const qx = ax + dx * t - px
          const qy = ay + dy * t - py
          if (qx * qx + qy * qy <= half * half) this.data[r * this.cols + c] |= flag
        }
      }
    }
  }
}

// --- 지형 장(고도·경사·골짜기 바닥에서의 높이) ---------------------------------------------

export interface TerrainFields {
  cols: number
  rows: number
  cell: number
  x0: number
  y0: number
  /** 고도 m */
  elev: Float32Array
  /** 경사 도 */
  slope: Float32Array
  /** 반경 약 1.4 km 안 가장 낮은 곳보다 몇 m 높은가 */
  rel: Float32Array
  /** 경사 내려가는 방향(단위 벡터, x 동 · y 북) */
  down: Float32Array
}

function minFilter(src: Float32Array, cols: number, rows: number, rad: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let m = Infinity
      for (let k = Math.max(0, c - rad); k <= Math.min(cols - 1, c + rad); k++) m = Math.min(m, src[r * cols + k])
      tmp[r * cols + c] = m
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      let m = Infinity
      for (let k = Math.max(0, r - rad); k <= Math.min(rows - 1, r + rad); k++) m = Math.min(m, tmp[k * cols + c])
      out[r * cols + c] = m
    }
  }
  return out
}

export function terrainFields(hm: Heightmap): TerrainFields {
  const { cols, rows, cell } = hm
  const n = cols * rows
  const elev = new Float32Array(n)
  for (let k = 0; k < n; k++) elev[k] = hm.h[k]
  const slope = new Float32Array(n)
  const down = new Float32Array(n * 2)
  const cm = cell * 1000
  const E = (r: number, c: number) => elev[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = (E(r, c + 1) - E(r, c - 1)) / (2 * cm)
      const gy = (E(r + 1, c) - E(r - 1, c)) / (2 * cm)
      const k = r * cols + c
      slope[k] = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI
      const g = Math.hypot(gx, gy)
      if (g > 1e-4) {
        down[k * 2] = -gx / g
        down[k * 2 + 1] = -gy / g
      } else {
        // 평지: 남향(한국 시골집의 관례)
        down[k * 2] = 0
        down[k * 2 + 1] = -1
      }
    }
  }
  const low = minFilter(elev, cols, rows, 12)
  const rel = new Float32Array(n)
  for (let k = 0; k < n; k++) rel[k] = elev[k] - low[k]
  return { cols, rows, cell, x0: hm.x0, y0: hm.y0, elev, slope, rel, down }
}

/** 격자점 값의 쌍선형 보간 */
export function sampleField(f: TerrainFields, arr: Float32Array, x: number, y: number): number {
  const fc = Math.min(Math.max((x - f.x0) / f.cell, 0), f.cols - 1.001)
  const fr = Math.min(Math.max((y - f.y0) / f.cell, 0), f.rows - 1.001)
  const c = Math.floor(fc)
  const r = Math.floor(fr)
  const tx = fc - c
  const ty = fr - r
  const k = r * f.cols + c
  const a = arr[k] * (1 - tx) + arr[k + 1] * tx
  const b = arr[k + f.cols] * (1 - tx) + arr[k + f.cols + 1] * tx
  return a * (1 - ty) + b * ty
}

// --- 땅 덩어리 --------------------------------------------------------------------------

export const LAND_FOREST = 0
export const LAND_FIELD = 1
export const LAND_PADDY = 2
export const LAND_WATER = 3

/**
 * 격자점마다 땅 덩어리. 논 = 골짜기 바닥(평평하고 낮은 곳), 밭 = 완경사, 숲 = 나머지.
 * 경계에 잡음을 섞어 자연스럽게 끊는다(풍경 표현, 자료 아님).
 */
export function landCover(f: TerrainFields, raster: Raster): Uint8Array {
  const out = new Uint8Array(f.cols * f.rows)
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const k = r * f.cols + c
      const x = f.x0 + c * f.cell
      const y = f.y0 + r * f.cell
      if (raster.at(x, y) & R_WATER) {
        out[k] = LAND_WATER
        continue
      }
      const nz = fbm(x * 0.9, y * 0.9, 11) - 0.5
      const s = f.slope[k] + nz * 3
      const rel = f.rel[k] + nz * 16
      if (s < 4.2 && rel < 24 && f.elev[k] < 260) out[k] = LAND_PADDY
      else if (s < 10.5 && rel < 78) out[k] = LAND_FIELD
      else out[k] = LAND_FOREST
    }
  }
  return out
}

// --- 집 --------------------------------------------------------------------------------

export const HOUSE_KIND_HOUSE = 0
export const HOUSE_KIND_HALL = 1

/** 집 한 채(km, 북쪽 +y). rot = 앞면(+z 지역축)이 보는 방향의 라디안(동쪽 0에서 반시계가 아니라 three.js Y축 회전값) */
export interface HouseSpec {
  x: number
  y: number
  rot: number
  kind: 0 | 1
  /** 지붕 색 칸(0..4). 무작위이며 데이터가 아니다 */
  roof: number
  village: number
  /** 폭(용마루 방향)·깊이·벽 높이·지붕 높이(km) */
  w: number
  d: number
  h: number
  roofH: number
  /** 빛 번짐 세기를 고르게 하려고 센 이웃 집 수(0.4 km 안) */
  neighbours: number
}

export interface VillageSite {
  i: number
  cx: number
  cy: number
  /** 집들이 차지한 반지름(대표점 기준) */
  radius: number
  houses: number[]
  /** 집 묶음의 무게중심 */
  mx: number
  my: number
}

export interface ClinicSite {
  j: number
  x: number
  y: number
  /** 건물 앞면이 보는 방향(three.js Y축 회전) */
  rot: number
  /** 진료등 탑 자리 */
  mastX: number
  mastY: number
}

export interface TreeSpec {
  x: number
  y: number
  s: number
  kind: 0 | 1
  tint: number
}

export interface World {
  fields: TerrainFields
  raster: Raster
  land: Uint8Array
  houses: HouseSpec[]
  villages: VillageSite[]
  clinics: ClinicSite[]
  trees: TreeSpec[]
}

/** 점 → 선분 집합에서 가장 가까운 점(버킷 색인) */
class SegIndex {
  private readonly cell: number
  private readonly map = new Map<string, number[]>()
  private readonly segs: number[] = []
  constructor(cell: number) {
    this.cell = cell
  }
  add(coords: XY[]): void {
    for (let k = 0; k + 1 < coords.length; k++) {
      const [ax, ay] = coords[k]
      const [bx, by] = coords[k + 1]
      const id = this.segs.length / 4
      this.segs.push(ax, ay, bx, by)
      const c0 = Math.floor(Math.min(ax, bx) / this.cell)
      const c1 = Math.floor(Math.max(ax, bx) / this.cell)
      const r0 = Math.floor(Math.min(ay, by) / this.cell)
      const r1 = Math.floor(Math.max(ay, by) / this.cell)
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const key = `${c},${r}`
        const b = this.map.get(key)
        if (b) b.push(id)
        else this.map.set(key, [id])
      }
    }
  }
  nearest(x: number, y: number, maxD: number): { x: number; y: number; d: number } | null {
    const c0 = Math.floor((x - maxD) / this.cell)
    const c1 = Math.floor((x + maxD) / this.cell)
    const r0 = Math.floor((y - maxD) / this.cell)
    const r1 = Math.floor((y + maxD) / this.cell)
    let best: { x: number; y: number; d: number } | null = null
    const seen = new Set<number>()
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const b = this.map.get(`${c},${r}`)
      if (!b) continue
      for (const id of b) {
        if (seen.has(id)) continue
        seen.add(id)
        const ax = this.segs[id * 4]
        const ay = this.segs[id * 4 + 1]
        const dx = this.segs[id * 4 + 2] - ax
        const dy = this.segs[id * 4 + 3] - ay
        const l2 = dx * dx + dy * dy
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
        const qx = ax + dx * t
        const qy = ay + dy * t
        const d = Math.hypot(qx - x, qy - y)
        if (d <= maxD && (!best || d < best.d)) best = { x: qx, y: qy, d }
      }
    }
    return best
  }
}

/** 놓인 건물(집·지소)의 점 색인: 겹침 검사 */
export class PointIndex {
  private readonly map = new Map<number, number[]>()
  readonly xs: number[] = []
  readonly ys: number[] = []
  readonly rs: number[] = []
  private readonly cell: number
  constructor(cell: number) {
    this.cell = cell
  }
  private key(c: number, r: number): number {
    return (c + 4096) * 8192 + (r + 4096)
  }
  add(x: number, y: number, radius: number): number {
    const id = this.xs.length
    this.xs.push(x)
    this.ys.push(y)
    this.rs.push(radius)
    const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell))
    const b = this.map.get(k)
    if (b) b.push(id)
    else this.map.set(k, [id])
    return id
  }
  /** 이 원(반지름 radius)과 겹치는 점이 있나 */
  hits(x: number, y: number, radius: number): boolean {
    const reach = radius + 0.5
    const c0 = Math.floor((x - reach) / this.cell)
    const c1 = Math.floor((x + reach) / this.cell)
    const r0 = Math.floor((y - reach) / this.cell)
    const r1 = Math.floor((y + reach) / this.cell)
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const b = this.map.get(this.key(c, r))
      if (!b) continue
      for (const id of b) {
        const d = radius + this.rs[id]
        const dx = this.xs[id] - x
        const dy = this.ys[id] - y
        if (dx * dx + dy * dy < d * d) return true
      }
    }
    return false
  }
  within(x: number, y: number, radius: number): number[] {
    const out: number[] = []
    const c0 = Math.floor((x - radius) / this.cell)
    const c1 = Math.floor((x + radius) / this.cell)
    const r0 = Math.floor((y - radius) / this.cell)
    const r1 = Math.floor((y + radius) / this.cell)
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const b = this.map.get(this.key(c, r))
      if (!b) continue
      for (const id of b) {
        const dx = this.xs[id] - x
        const dy = this.ys[id] - y
        if (dx * dx + dy * dy <= radius * radius) out.push(id)
      }
    }
    return out
  }
}

/** 집 크기(km). 실제보다 수십 배 크게 — 미니어처 축척(설계안 6-16) */
export const HOUSE_SIZE = { w: 0.2, d: 0.14, h: 0.07, roofH: 0.062 }
export const HALL_SIZE = { w: 0.27, d: 0.18, h: 0.082, roofH: 0.07 }
/** 집 중심 사이 최소 거리(km) */
const HOUSE_GAP = 0.27
/** 보건지소 터 반지름(km): 집·나무가 들어오지 않는다 */
export const CLINIC_CLEAR = 0.46

function rotFacing(fx: number, fy: number): number {
  // 앞면(지역 +z) = 세계 (fx, 북 fy). three.js: 세계 z = −북. Y축 회전 θ에서 지역 +z → (sin θ, cos θ)(x, z)
  // (sin θ, cos θ) = (fx, −fy)
  return Math.atan2(fx, -fy)
}

export function buildWorld(scenario: Scenario, geo: Geometry, hm: Heightmap): World {
  const fields = terrainFields(hm)
  const cell = 0.04
  const cols = Math.ceil(hm.width / cell)
  const rows = Math.ceil(hm.height / cell)
  const raster = new Raster(hm.x0, hm.y0, cell, cols, rows)
  for (const p of geo.outer.polygons) raster.fillRings(p, R_INSIDE)
  for (const p of geo.water_polygons) raster.fillRings(p, R_WATER)
  for (const rv of geo.rivers) raster.strokeLine(rv.coords, rv.name === '금강' ? 0.09 : 0.035, R_WATER)
  for (const p of geo.city_core.polygons) raster.fillRings(p, R_CITY)
  const roadIdx = new SegIndex(0.5)
  for (const rd of geo.roads) {
    raster.strokeLine(rd.coords, rd.class === 'motorway' || rd.class === 'trunk' ? 0.075 : 0.06, R_ROAD)
    roadIdx.add(rd.coords)
  }
  for (const [, , coords] of geo.routes.pairs) {
    raster.strokeLine(coords, 0.035, R_LANE)
    roadIdx.add(coords)
  }
  const land = landCover(fields, raster)
  const landAt = (x: number, y: number) => {
    const c = Math.round((x - fields.x0) / fields.cell)
    const r = Math.round((y - fields.y0) / fields.cell)
    if (c < 0 || r < 0 || c >= fields.cols || r >= fields.rows) return LAND_FOREST
    return land[r * fields.cols + c]
  }

  const occupied = new PointIndex(0.6)
  // 1) 보건지소 터: 앞면은 가장 가까운 길을 본다.
  const clinics: ClinicSite[] = scenario.facilities.map((f, j) => {
    const near = roadIdx.nearest(f.x, f.y, 1.2)
    let fx = 0
    let fy = -1
    if (near && near.d > 0.02) {
      fx = (near.x - f.x) / near.d
      fy = (near.y - f.y) / near.d
    }
    const rot = rotFacing(fx, fy)
    // 탑은 건물 앞마당(길 쪽), 건물 오른편으로 조금 비켜 선다.
    const rx = fy
    const ry = -fx
    const site = { j, x: f.x, y: f.y, rot, mastX: f.x + fx * 0.2 + rx * 0.13, mastY: f.y + fy * 0.2 + ry * 0.13 }
    occupied.add(f.x, f.y, CLINIC_CLEAR)
    return site
  })

  // 2) 집: 큰 마을부터 자리를 잡는다(같은 자료면 같은 순서).
  const houses: HouseSpec[] = []
  const villages: VillageSite[] = scenario.villages.map((v, i) => ({ i, cx: v.x, cy: v.y, radius: 0, houses: [], mx: v.x, my: v.y }))
  const order = scenario.villages.map((_, i) => i).sort((a, b) => scenario.villages[b].pop - scenario.villages[a].pop || a - b)
  for (const i of order) {
    const v = scenario.villages[i]
    const n = houseCount(v.pop)
    const rnd = mulberry32(hashString(v.id))
    const picked: { x: number; y: number }[] = []
    let radius = 0.3 + HOUSE_GAP * Math.sqrt(n) * 0.95
    for (let attempt = 0; attempt < 5 && picked.length < n; attempt++) {
      const relax = attempt >= 3
      const ang = rnd() * Math.PI
      const cands: { x: number; y: number; score: number }[] = []
      const step = HOUSE_GAP * 0.9
      const span = Math.ceil(radius / step) + 1
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      for (let a = -span; a <= span; a++) {
        for (let b = -span; b <= span; b++) {
          // 기울인 육각 격자 + 흔들기
          const lx = (a + (b & 1) * 0.5) * step + (rnd() - 0.5) * step * 0.5
          const ly = b * step * 0.866 + (rnd() - 0.5) * step * 0.5
          const x = v.x + lx * ca - ly * sa
          const y = v.y + lx * sa + ly * ca
          const dist = Math.hypot(x - v.x, y - v.y)
          if (dist > radius) continue
          const flags = raster.at(x, y)
          if (!(flags & R_INSIDE) || flags & R_CITY) continue
          if (raster.near(x, y, 0.09, R_WATER)) continue
          if (raster.near(x, y, 0.07, R_ROAD | R_LANE)) continue
          const s = sampleField(fields, fields.slope, x, y)
          if (s > (relax ? 22 : 15)) continue
          const road = roadIdx.nearest(x, y, 0.45)
          const lc = landAt(x, y)
          const score =
            dist / radius +
            s / 24 +
            (lc === LAND_FOREST ? 0.22 : 0) +
            (road ? (road.d < 0.3 ? -0.14 : -0.05) : 0) +
            sampleField(fields, fields.rel, x, y) / 400 +
            (rnd() - 0.5) * 0.12
          cands.push({ x, y, score })
        }
      }
      cands.sort((p, q) => p.score - q.score)
      for (const c of cands) {
        if (picked.length >= n) break
        if (occupied.hits(c.x, c.y, HOUSE_GAP * 0.46)) continue
        occupied.add(c.x, c.y, HOUSE_GAP * 0.46)
        picked.push(c)
      }
      radius *= 1.35
    }
    // 마지막 수단(아주 좁은 골짜기): 대표점 둘레 나선
    for (let k = 0; picked.length < n && k < 400; k++) {
      const a = k * 2.39996
      const rr = 0.12 + 0.05 * Math.sqrt(k) * 3
      const x = v.x + Math.cos(a) * rr
      const y = v.y + Math.sin(a) * rr
      if (raster.at(x, y) & (R_WATER | R_CITY)) continue
      if (occupied.hits(x, y, HOUSE_GAP * 0.4)) continue
      occupied.add(x, y, HOUSE_GAP * 0.4)
      picked.push({ x, y })
    }
    const site = villages[i]
    // 회관: 4채 이상 마을에서 대표점에 가장 가까운 집
    let hall = -1
    if (picked.length >= 4) {
      let best = Infinity
      picked.forEach((p, k) => {
        const d = Math.hypot(p.x - v.x, p.y - v.y)
        if (d < best) {
          best = d
          hall = k
        }
      })
    }
    let sx = 0
    let sy = 0
    picked.forEach((p, k) => {
      // 배산임수: 등은 산, 얼굴은 낮은 쪽. 길이 가까우면 길을 본다.
      const road = roadIdx.nearest(p.x, p.y, 0.32)
      let fx: number
      let fy: number
      if (road && road.d > 0.01) {
        fx = (road.x - p.x) / road.d
        fy = (road.y - p.y) / road.d
      } else {
        ;[fx, fy] = downAt(fields, p.x, p.y)
      }
      const isHall = k === hall
      const size = isHall ? HALL_SIZE : HOUSE_SIZE
      const jitter = 0.92 + rnd() * 0.16
      houses.push({
        x: p.x,
        y: p.y,
        rot: rotFacing(fx, fy) + (rnd() - 0.5) * 0.16,
        kind: isHall ? HOUSE_KIND_HALL : HOUSE_KIND_HOUSE,
        roof: Math.floor(rnd() * 5),
        village: i,
        w: size.w * jitter,
        d: size.d * (0.94 + rnd() * 0.12),
        h: size.h * (0.94 + rnd() * 0.12),
        roofH: size.roofH * (0.9 + rnd() * 0.2),
        neighbours: 0,
      })
      site.houses.push(houses.length - 1)
      sx += p.x
      sy += p.y
    })
    site.mx = sx / picked.length
    site.my = sy / picked.length
    site.radius = Math.max(0.15, ...picked.map((p) => Math.hypot(p.x - v.x, p.y - v.y) + 0.12))
  }
  // 이웃 수(빛 번짐 세기 고르게)
  const hIdx = new PointIndex(0.5)
  houses.forEach((h) => hIdx.add(h.x, h.y, 0))
  houses.forEach((h) => {
    h.neighbours = hIdx.within(h.x, h.y, 0.4).length - 1
  })

  // 3) 나무: 숲 덩어리 위 무더기. 밭 가장자리에 드문드문.
  const trees: TreeSpec[] = []
  const trnd = mulberry32(20260924)
  const tStep = 0.15
  for (let y = hm.y0 + tStep / 2; y < hm.y0 + hm.height; y += tStep) {
    for (let x = hm.x0 + tStep / 2; x < hm.x0 + hm.width; x += tStep) {
      const px = x + (trnd() - 0.5) * tStep * 0.9
      const py = y + (trnd() - 0.5) * tStep * 0.9
      const flags = raster.at(px, py)
      if (!(flags & R_INSIDE) || flags & (R_CITY | R_WATER)) continue
      const lc = landAt(px, py)
      const clump = fbm(px * 1.6, py * 1.6, 5)
      let p = 0
      if (lc === LAND_FOREST) p = 0.25 + 1.1 * Math.max(0, clump - 0.3)
      else if (lc === LAND_FIELD) p = clump > 0.62 ? 0.3 : 0.015
      else if (lc === LAND_PADDY) p = 0.004
      if (trnd() >= p) continue
      if (raster.near(px, py, 0.05, R_ROAD | R_LANE | R_WATER)) continue
      if (occupied.hits(px, py, 0.1)) continue
      const e = sampleField(fields, fields.elev, px, py)
      const conifer = e > 170 ? trnd() < 0.62 : trnd() < 0.28
      trees.push({ x: px, y: py, s: 0.78 + trnd() * 0.5, kind: conifer ? 0 : 1, tint: trnd() })
    }
  }
  return { fields, raster, land, houses, villages, clinics, trees }
}

function downAt(f: TerrainFields, x: number, y: number): [number, number] {
  const c = Math.round((x - f.x0) / f.cell)
  const r = Math.round((y - f.y0) / f.cell)
  const k = Math.min(f.rows - 1, Math.max(0, r)) * f.cols + Math.min(f.cols - 1, Math.max(0, c))
  return [f.down[k * 2], f.down[k * 2 + 1]]
}

/** 다각형 링들의 bbox */
export function ringsBox(polys: PolygonRings[]): [number, number, number, number] {
  let a = Infinity
  let b = Infinity
  let c = -Infinity
  let d = -Infinity
  for (const p of polys) for (const [x, y] of p[0]) {
    a = Math.min(a, x)
    b = Math.min(b, y)
    c = Math.max(c, x)
    d = Math.max(d, y)
  }
  return [a, b, c, d]
}
