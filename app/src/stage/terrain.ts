/**
 * 지형 높이 격자와 선을 지형에 얹는 도구(설계안 6-3, 6-16).
 * 좌표: 월드 X = 동쪽 km, 월드 Z = −북쪽 km, 월드 Y = 고도(km) × 수직 과장.
 */

import type { PolygonRings, TerrainHeader, XY } from '../data/types'

/** 수직 과장(설계안 6-16: 부드럽고 약간 과장한 지형). */
export const VERTICAL_EXAGGERATION = 1.9

export class Heightmap {
  readonly cols: number
  readonly rows: number
  readonly cell: number
  readonly x0: number
  readonly y0: number
  /** 고도(m). smooth > 0이면 무대용으로 살짝 고른 값(자료 판정에는 쓰지 않는다) */
  readonly h: Float32Array
  readonly mask: Uint8Array

  constructor(header: TerrainHeader, buf: ArrayBuffer, smooth = 0) {
    this.cols = header.cols
    this.rows = header.rows
    this.cell = header.cell_km
    this.x0 = header.x0
    this.y0 = header.y0
    const raw = new Int16Array(buf.slice(header.heights_offset, header.heights_offset + this.cols * this.rows * 2))
    let h: Float32Array = Float32Array.from(raw)
    for (let pass = 0; pass < smooth; pass++) h = blur3(h, this.cols, this.rows)
    this.h = h
    this.mask = new Uint8Array(buf, header.mask_offset, (this.cols - 1) * (this.rows - 1))
  }

  get width(): number {
    return (this.cols - 1) * this.cell
  }

  get height(): number {
    return (this.rows - 1) * this.cell
  }

  /** 격자점 높이(월드 Y). */
  nodeY(r: number, c: number): number {
    return (this.h[r * this.cols + c] / 1000) * VERTICAL_EXAGGERATION
  }

  /** 임의 점 (x, y km)의 높이(월드 Y), 쌍선형 보간. */
  sample(x: number, y: number): number {
    const fc = Math.min(Math.max((x - this.x0) / this.cell, 0), this.cols - 1.001)
    const fr = Math.min(Math.max((y - this.y0) / this.cell, 0), this.rows - 1.001)
    const c = Math.floor(fc)
    const r = Math.floor(fr)
    const tx = fc - c
    const ty = fr - r
    const a = this.nodeY(r, c) * (1 - tx) + this.nodeY(r, c + 1) * tx
    const b = this.nodeY(r + 1, c) * (1 - tx) + this.nodeY(r + 1, c + 1) * tx
    return a * (1 - ty) + b * ty
  }

  /** 반지름 안(8방향 + 가운데) 가장 높은 지형(월드 Y): 경사면에 물건이 묻히지 않게 */
  sampleMax(x: number, y: number, r: number): number {
    let top = this.sample(x, y)
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4
      top = Math.max(top, this.sample(x + r * Math.cos(a), y + r * Math.sin(a)))
    }
    return top
  }

  inside(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.rows - 1 && c < this.cols - 1 && this.mask[r * (this.cols - 1) + c] === 1
  }
}

/** 3×3 가중 평균(1-2-1). 경계는 가장자리 값을 늘린다. */
function blur3(src: Float32Array, cols: number, rows: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = src[r * cols + Math.max(0, c - 1)]
      const b = src[r * cols + c]
      const d = src[r * cols + Math.min(cols - 1, c + 1)]
      tmp[r * cols + c] = (a + 2 * b + d) / 4
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = tmp[Math.max(0, r - 1) * cols + c]
      const b = tmp[r * cols + c]
      const d = tmp[Math.min(rows - 1, r + 1) * cols + c]
      out[r * cols + c] = (a + 2 * b + d) / 4
    }
  }
  return out
}

export function pointInRings(x: number, y: number, rings: PolygonRings): boolean {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

export function pointInPolygons(x: number, y: number, polys: PolygonRings[]): boolean {
  return polys.some((p) => pointInRings(x, y, p))
}

/** 선을 지형 위에 얹는다(선분 쌍): step km마다 점을 넣고 높이를 따른다. */
export function drape(hm: Heightmap, coords: XY[], lift = 0.04, step = 0.25): number[] {
  const out: number[] = []
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i]
    const [x2, y2] = coords[i + 1]
    const len = Math.hypot(x2 - x1, y2 - y1)
    const n = Math.max(1, Math.ceil(len / step))
    for (let k = 0; k < n; k++) {
      const t0 = k / n
      const t1 = (k + 1) / n
      const ax = x1 + (x2 - x1) * t0
      const ay = y1 + (y2 - y1) * t0
      const bx = x1 + (x2 - x1) * t1
      const by = y1 + (y2 - y1) * t1
      out.push(ax, hm.sample(ax, ay) + lift, -ay, bx, hm.sample(bx, by) + lift, -by)
    }
  }
  return out
}

/** Line2용 연속 점열. */
export function drapePath(hm: Heightmap, coords: XY[], lift = 0.05, step = 0.25): number[] {
  const out: number[] = []
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i]
    const [x2, y2] = coords[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      const x = x1 + (x2 - x1) * t
      const y = y1 + (y2 - y1) * t
      out.push(x, hm.sample(x, y) + lift, -y)
    }
  }
  const [lx, ly] = coords[coords.length - 1]
  out.push(lx, hm.sample(lx, ly) + lift, -ly)
  return out
}
