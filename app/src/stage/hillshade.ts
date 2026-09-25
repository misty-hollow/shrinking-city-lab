/**
 * 위에서 본 지형 그림(설계안 6-13): 3D 무대와 같은 높이 격자·같은 고도 층 색(terrain.ts BAND_HEX)으로 만든 음영 이미지 한 장.
 * S6 「세 개의 공주」의 작은 지도 세 장이 같은 지형 위에 놓이도록 한 번만 만든다. 시각 표현 전용.
 */

import type { Geometry } from '../data/types'
import { Heightmap, VERTICAL_EXAGGERATION } from './terrain'

/** 무대가 없을 때(WebGL 불가)의 대체 바탕: 낮은 곳 황금 논 → 세이지 → 숲(풍경 표현) */
const BAND_HEX = ['#C9A956', '#B6AD6B', '#9DA876', '#7E9763', '#628452', '#4E7148', '#3F5F40'] as const

/** 북서쪽 빛(지도 음영 관례). x 동, y 북, z 위 */
const LIGHT = (() => {
  const v = [-0.55, 0.55, 0.63]
  const n = Math.hypot(...v)
  return v.map((x) => x / n)
})()

const BANDS = BAND_HEX.map((h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)])

export interface Hillshade {
  url: string
  /** 이미지가 덮는 범위(km). 행 0 = 북쪽 */
  x0: number
  y1: number
  width: number
  height: number
}

/** 2D 캔버스가 없는 환경(검사용 jsdom 등)에서는 null — 지도는 바탕색으로 그린다. */
export function buildHillshade(geo: Geometry, buf: ArrayBuffer): Hillshade | null {
  let ctx: CanvasRenderingContext2D | null = null
  const canvas = document.createElement('canvas')
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!ctx) return null
  const hm = new Heightmap(geo.terrain, buf)
  const { cols, rows } = hm
  canvas.width = cols
  canvas.height = rows
  const img = ctx.createImageData(cols, rows)
  // terrain.ts와 같은 층 나누기: 월드 Y 0.65×과장 위는 맨 위 층.
  const maxH = 0.65 * VERTICAL_EXAGGERATION
  const cellM = hm.cell * 1000
  const ex = 2.2
  const H = (r: number, c: number) => hm.h[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))]
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = ((H(r, c + 1) - H(r, c - 1)) / (2 * cellM)) * ex
      const dy = ((H(r + 1, c) - H(r - 1, c)) / (2 * cellM)) * ex
      const shade = Math.max(0, (-dx * LIGHT[0] - dy * LIGHT[1] + LIGHT[2]) / Math.hypot(dx, dy, 1))
      const worldY = (H(r, c) / 1000) * VERTICAL_EXAGGERATION
      const band = Math.min(BANDS.length - 1, Math.floor((Math.min(1, Math.max(0, worldY / maxH)) - 1e-6) * BANDS.length))
      const k = 0.72 + 0.4 * shade
      const o = ((rows - 1 - r) * cols + c) * 4
      for (let ch = 0; ch < 3; ch++) img.data[o + ch] = Math.min(255, BANDS[band][ch] * k)
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return {
    url: canvas.toDataURL('image/png'),
    x0: hm.x0,
    y1: hm.y0 + hm.height,
    width: hm.width,
    height: hm.height,
  }
}
