/**
 * 섬 모형 굽기(설계안 6-16): 지형 메시 + 받침(흙 단면 두 층) + 땅 그림(텍스처) + 해질녘 빛(정점 색).
 *
 * - 빛은 한 번 계산해 정점 색에 굽는다: 낮은 해(서남서) 쪽 사면은 따뜻하게, 반대 사면과 능선 그늘은 푸르게.
 *   그늘은 높이 격자를 따라 해 쪽으로 광선을 걸어 부드럽게 구한다(그림자 맵 없음). 골짜기는 조금 어둡게(AO).
 * - 땅 그림: 논(황금)·밭(세이지)·숲·물·마을 터·길. 풍경 표현이며 토지이용 자료가 아니다.
 *   공주 시내(모델 밖)는 반투명 트레이싱지 한 장으로 덮는다. 어둠은 '진료가 닿지 않음'에만 쓰므로 어둡게 칠하지 않는다.
 * - 섬 가장자리의 계단 모양은 경계선 위로 끌어 붙여 부드럽게 한다.
 */

import * as THREE from 'three'

import type { Geometry, PolygonRings, XY } from '../data/types'
import { PALETTE } from './palette'
import { type SceneUniforms, bakeLight } from './shaders'
import type { Heightmap } from './terrain'
import { LAND_FIELD, LAND_FOREST, LAND_PADDY, LAND_WATER, type World, fbm, mulberry32 } from './world'

/** 받침 바닥(월드 Y) */
export const BASE_Y = -0.95

export interface TerrainBake {
  mesh: THREE.Mesh
  plinth: THREE.Mesh
  /** 격자점마다 해 그늘(0 그늘 · 1 해) */
  shadow: Float32Array
  /** 격자점마다 굽은 빛(선형 RGB) */
  light: Float32Array
  /** 임의 점의 해 그늘 */
  shadowAt(x: number, y: number): number
  /** 임의 점의 굽은 빛 */
  lightAt(x: number, y: number, out: THREE.Color): THREE.Color
  texture: THREE.CanvasTexture
  /** S6 작은 지도용: 위에서 본 같은 땅 그림 + 빛(데이터 URL) */
  topView(width: number): string | null
}

function nearestOnRings(x: number, y: number, rings: XY[][]): [number, number, number] {
  let best = Infinity
  let bx = x
  let by = y
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i]
      const [cx, cy] = ring[(i + 1) % ring.length]
      const dx = cx - ax
      const dy = cy - ay
      const l2 = dx * dx + dy * dy
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
      const qx = ax + dx * t
      const qy = ay + dy * t
      const d = (qx - x) ** 2 + (qy - y) ** 2
      if (d < best) {
        best = d
        bx = qx
        by = qy
      }
    }
  }
  return [bx, by, Math.sqrt(best)]
}

export function bakeTerrain(hm: Heightmap, geo: Geometry, world: World, u: SceneUniforms, maxAnisotropy: number): TerrainBake {
  const { cols, rows, cell } = hm
  const n = cols * rows
  const used = new Uint8Array(n)
  const idx: number[] = []
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (!hm.inside(r, c)) continue
      const a = r * cols + c
      const b = a + 1
      const d = a + cols
      const e = d + 1
      idx.push(a, b, d, b, e, d)
      used[a] = used[b] = used[d] = used[e] = 1
    }
  }

  // 경계 격자점: 안 칸과 밖 칸이 함께 닿는 점. 경계선 위로 끌어 붙인다.
  const boundary = new Uint8Array(n)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c
      if (!used[k]) continue
      let inCells = 0
      for (const [dr, dc] of [
        [-1, -1],
        [-1, 0],
        [0, -1],
        [0, 0],
      ])
        if (hm.inside(r + dr, c + dc)) inCells++
      if (inCells < 4) boundary[k] = 1
    }
  }
  const outerRings = geo.outer.polygons.flatMap((p) => p)
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c
      px[k] = hm.x0 + c * cell
      py[k] = hm.y0 + r * cell
      if (boundary[k]) {
        const [bx, by, d] = nearestOnRings(px[k], py[k], outerRings)
        if (d < cell * 1.05) {
          px[k] = bx
          py[k] = by
        }
      }
    }
  }

  // --- 빛 굽기 -------------------------------------------------------------------------
  const Y = new Float32Array(n)
  for (let k = 0; k < n; k++) Y[k] = hm.nodeY(Math.floor(k / cols), k % cols)
  const sun = u.uSunDir.value
  const hlen = Math.hypot(sun.x, sun.z)
  const hx = sun.x / hlen
  const hn = -sun.z / hlen // 북쪽 성분
  const tanEl = sun.y / hlen
  const shadow = new Float32Array(n).fill(1)
  for (let k = 0; k < n; k++) {
    if (!used[k]) continue
    const x = hm.x0 + (k % cols) * cell
    const y = hm.y0 + Math.floor(k / cols) * cell
    const y0 = Y[k] + 0.004
    let res = 1
    let s = cell * 0.7
    while (s < 9) {
      const ty = hm.sample(x + hx * s, y + hn * s)
      const ray = y0 + s * tanEl
      const h = ray - ty
      if (h < -0.01) {
        res = 0
        break
      }
      res = Math.min(res, (11 * h) / s + 0.5)
      s *= 1.07
      s += 0.02
    }
    shadow[k] = Math.max(0, Math.min(1, res))
  }
  // 골짜기 AO: 넓게 흐린 높이와의 차이
  const blur = boxBlur(Y, cols, rows, 5)
  const light = new Float32Array(n * 3)
  const tmp = new THREE.Color()
  const sx = 2 * cell
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c
      if (!used[k]) continue
      const hxp = Y[r * cols + Math.min(cols - 1, c + 1)]
      const hxm = Y[r * cols + Math.max(0, c - 1)]
      const hyp = Y[Math.min(rows - 1, r + 1) * cols + c]
      const hym = Y[Math.max(0, r - 1) * cols + c]
      // 법선: y = f(x, z), z = −북
      let nx = -(hxp - hxm) / sx
      let ny = 1
      let nz = (hyp - hym) / sx
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const ao = Math.max(0.66, Math.min(1.08, 1 + (Y[k] - blur[k]) * 1.6))
      bakeLight(u, nx, ny, nz, shadow[k], ao, tmp)
      light[k * 3] = tmp.r
      light[k * 3 + 1] = tmp.g
      light[k * 3 + 2] = tmp.b
    }
  }

  // --- 메시 ----------------------------------------------------------------------------
  const pos = new Float32Array(n * 3)
  const uv = new Float32Array(n * 2)
  for (let k = 0; k < n; k++) {
    pos[k * 3] = px[k]
    pos[k * 3 + 1] = boundary[k] ? hm.sample(px[k], py[k]) : Y[k]
    pos[k * 3 + 2] = -py[k]
    uv[k * 2] = (px[k] - hm.x0) / hm.width
    uv[k * 2 + 1] = (py[k] - hm.y0) / hm.height
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geom.setAttribute('color', new THREE.BufferAttribute(light, 3))
  geom.setIndex(idx)
  geom.computeBoundingSphere()
  const texture = buildLandTexture(hm, geo, world, maxAnisotropy)
  const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, fog: true }))

  const plinth = buildPlinth(hm, pos, u)

  const shadowAt = (x: number, y: number): number => {
    const fc = Math.min(Math.max((x - hm.x0) / cell, 0), cols - 1.001)
    const fr = Math.min(Math.max((y - hm.y0) / cell, 0), rows - 1.001)
    const c = Math.floor(fc)
    const r = Math.floor(fr)
    const tx = fc - c
    const ty = fr - r
    const k = r * cols + c
    const a = shadow[k] * (1 - tx) + shadow[k + 1] * tx
    const b = shadow[k + cols] * (1 - tx) + shadow[k + cols + 1] * tx
    return a * (1 - ty) + b * ty
  }
  const lightAt = (x: number, y: number, out: THREE.Color): THREE.Color => {
    const c = Math.min(cols - 1, Math.max(0, Math.round((x - hm.x0) / cell)))
    const r = Math.min(rows - 1, Math.max(0, Math.round((y - hm.y0) / cell)))
    const k = r * cols + c
    return out.setRGB(light[k * 3], light[k * 3 + 1], light[k * 3 + 2])
  }

  const topView = (width: number): string | null => {
    const src = texture.image as HTMLCanvasElement
    const W = width
    const H = Math.round((W * hm.height) / hm.width)
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(src, 0, 0, W, H)
    // 굽은 빛을 곱한다(위에서 본 같은 해질녘)
    const lc = document.createElement('canvas')
    lc.width = cols
    lc.height = rows
    const lctx = lc.getContext('2d')
    if (!lctx) return cv.toDataURL('image/png')
    const img = lctx.createImageData(cols, rows)
    const toS = (v: number) => Math.round(255 * Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055))
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c
      const o = ((rows - 1 - r) * cols + c) * 4
      const L = used[k] ? [light[k * 3], light[k * 3 + 1], light[k * 3 + 2]] : [0.8, 0.8, 0.8]
      img.data[o] = toS(L[0] * 0.85)
      img.data[o + 1] = toS(L[1] * 0.85)
      img.data[o + 2] = toS(L[2] * 0.85)
      img.data[o + 3] = 255
    }
    lctx.putImageData(img, 0, 0)
    ctx.globalCompositeOperation = 'multiply'
    ctx.imageSmoothingQuality = 'high'
    const s = W / (cols - 1)
    ctx.drawImage(lc, -s / 2, -s / 2, cols * s, rows * s)
    ctx.globalCompositeOperation = 'source-over'
    return cv.toDataURL('image/jpeg', 0.86)
  }

  return { mesh, plinth, shadow, light, shadowAt, lightAt, texture, topView }
}

function boxBlur(src: Float32Array, cols: number, rows: number, rad: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let r = 0; r < rows; r++) {
    let acc = 0
    let cnt = 0
    for (let c = -rad; c < cols + rad; c++) {
      const add = c + rad
      if (add >= 0 && add < cols) {
        acc += src[r * cols + add]
        cnt++
      }
      const rem = c - rad - 1
      if (rem >= 0 && rem < cols) {
        acc -= src[r * cols + rem]
        cnt--
      }
      if (c >= 0 && c < cols) tmp[r * cols + c] = acc / cnt
    }
  }
  for (let c = 0; c < cols; c++) {
    let acc = 0
    let cnt = 0
    for (let r = -rad; r < rows + rad; r++) {
      const add = r + rad
      if (add >= 0 && add < rows) {
        acc += tmp[add * cols + c]
        cnt++
      }
      const rem = r - rad - 1
      if (rem >= 0 && rem < rows) {
        acc -= tmp[rem * cols + c]
        cnt--
      }
      if (r >= 0 && r < rows) out[r * cols + c] = acc / cnt
    }
  }
  return out
}

/** 받침: 섬 가장자리에서 바닥까지 흙 단면 두 층(겉흙·흙 + 가는 띠). 해를 받는 쪽 벽이 밝다. */
function buildPlinth(hm: Heightmap, pos: Float32Array, u: SceneUniforms): THREE.Mesh {
  const { cols, rows } = hm
  const P: number[] = []
  const C: number[] = []
  const bands: { from: (top: number) => number; to: (top: number) => number; color: string }[] = [
    { from: (t) => t, to: (t) => t - 0.07, color: PALETTE.topsoil },
    { from: (t) => t - 0.07, to: () => BASE_Y + 0.5, color: PALETTE.soil },
    { from: () => BASE_Y + 0.5, to: () => BASE_Y + 0.43, color: PALETTE.soilBand },
    { from: () => BASE_Y + 0.43, to: () => BASE_Y + 0.05, color: PALETTE.soil },
    { from: () => BASE_Y + 0.05, to: () => BASE_Y, color: PALETTE.soilDeep },
  ]
  const tmp = new THREE.Color()
  const base = new THREE.Color()
  const wall = (k1: number, k2: number) => {
    const x1 = pos[k1 * 3]
    const t1 = pos[k1 * 3 + 1]
    const z1 = pos[k1 * 3 + 2]
    const x2 = pos[k2 * 3]
    const t2 = pos[k2 * 3 + 1]
    const z2 = pos[k2 * 3 + 2]
    // 바깥 법선(수평): 변 방향 (dx, dz)에 대해 (−dz, dx)
    let nx = -(z2 - z1)
    let nz = x2 - x1
    const l = Math.hypot(nx, nz) || 1
    nx /= l
    nz /= l
    bakeLight(u, nx, 0, nz, 1, 0.92, tmp)
    for (const b of bands) {
      const a1 = b.from(t1)
      const b1 = Math.max(BASE_Y, b.to(t1))
      const a2 = b.from(t2)
      const b2 = Math.max(BASE_Y, b.to(t2))
      if (a1 <= BASE_Y && a2 <= BASE_Y) continue
      base.set(b.color)
      const cr = base.r * tmp.r
      const cg = base.g * tmp.g
      const cb = base.b * tmp.b
      P.push(x1, a1, z1, x2, a2, z2, x2, b2, z2, x1, a1, z1, x2, b2, z2, x1, b1, z1)
      for (let q = 0; q < 6; q++) C.push(cr, cg, cb)
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (!hm.inside(r, c)) continue
      const a = r * cols + c
      if (!hm.inside(r - 1, c)) wall(a, a + 1)
      if (!hm.inside(r + 1, c)) wall(a + cols + 1, a + cols)
      if (!hm.inside(r, c - 1)) wall(a + cols, a)
      if (!hm.inside(r, c + 1)) wall(a + 1, a + cols + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3))
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3))
  g.computeBoundingSphere()
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }))
}

// --- 땅 그림 -----------------------------------------------------------------------------

const TEX_W = 2560

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
}

function mix3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function buildLandTexture(hm: Heightmap, geo: Geometry, world: World, maxAnisotropy: number): THREE.CanvasTexture {
  const W = TEX_W
  const H = Math.round((W * hm.height) / hm.width)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d canvas unavailable')
  const s = W / hm.width
  const X = (x: number) => (x - hm.x0) * s
  const Yp = (y: number) => (hm.y0 + hm.height - y) * s
  const f = world.fields
  const { cols, rows } = hm

  // 1) 땅 덩어리: 격자점 해상도로 칠하고 부드럽게 늘린다(멀리서 읽히는 색 덩어리).
  const small = document.createElement('canvas')
  small.width = cols
  small.height = rows
  const sctx = small.getContext('2d')
  if (!sctx) throw new Error('2d canvas unavailable')
  const img = sctx.createImageData(cols, rows)
  const C = {
    paddy: hex(PALETTE.paddy),
    paddyGreen: hex(PALETTE.paddyGreen),
    field: hex(PALETTE.field),
    forest: hex(PALETTE.forest),
    deep: hex(PALETTE.forestDeep),
    water: hex(PALETTE.water),
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c
      const x = hm.x0 + c * hm.cell
      const y = hm.y0 + r * hm.cell
      const land = world.land[k]
      const nz = fbm(x * 0.45, y * 0.45, 3)
      let col: [number, number, number]
      if (land === LAND_WATER) col = C.water
      else if (land === LAND_PADDY) col = mix3(C.paddy, C.paddyGreen, Math.max(0, Math.min(1, (nz - 0.35) * 1.8)))
      else if (land === LAND_FIELD) col = mix3(C.field, C.paddy, Math.max(0, Math.min(0.35, (0.5 - nz) * 0.9)))
      else {
        const ridge = Math.max(0, Math.min(1, (f.rel[k] - 90) / 220))
        col = mix3(C.forest, C.deep, Math.max(0, Math.min(1, ridge * 0.8 + (nz - 0.5) * 0.9)))
      }
      if (land === LAND_FOREST || land === LAND_FIELD) {
        const v = 0.93 + 0.14 * fbm(x * 2.2, y * 2.2, 8)
        col = [col[0] * v, col[1] * v, col[2] * v]
      }
      const o = ((rows - 1 - r) * cols + c) * 4
      img.data[o] = col[0]
      img.data[o + 1] = col[1]
      img.data[o + 2] = col[2]
      img.data[o + 3] = 255
    }
  }
  sctx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const sc = W / (cols - 1)
  ctx.drawImage(small, -sc / 2, -sc / 2, cols * sc, rows * sc)

  const rnd = mulberry32(20260925)
  // 2) 논 구획: 골짜기 바닥에 크기가 제각각인 사각 논을 골짜기 방향으로. 익은 황금·덜 익은 연두·벤 논.
  const tones = ['rgba(222,186,98,0.42)', 'rgba(205,168,82,0.38)', 'rgba(188,176,96,0.34)', 'rgba(214,158,72,0.32)', 'rgba(160,150,86,0.3)']
  for (let y = hm.y0; y < hm.y0 + hm.height; y += 0.075) {
    for (let x = hm.x0; x < hm.x0 + hm.width; x += 0.075) {
      const px0 = x + (rnd() - 0.5) * 0.07
      const py0 = y + (rnd() - 0.5) * 0.07
      const c = Math.round((px0 - hm.x0) / hm.cell)
      const r = Math.round((py0 - hm.y0) / hm.cell)
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue
      const k = r * cols + c
      if (world.land[k] !== LAND_PADDY) continue
      if (rnd() < 0.45) continue
      const flow = fbm(px0 * 0.35, py0 * 0.35, 21) * Math.PI
      const ang = Math.atan2(-f.down[k * 2 + 1], f.down[k * 2]) * 0.6 + flow * 0.4 + (rnd() - 0.5) * 0.12
      const w = (0.05 + rnd() * 0.09) * s
      const h = (0.035 + rnd() * 0.05) * s
      ctx.save()
      ctx.translate(X(px0), Yp(py0))
      ctx.rotate(ang)
      ctx.fillStyle = tones[Math.floor(rnd() * tones.length)]
      ctx.fillRect(-w / 2, -h / 2, w, h)
      if (rnd() < 0.5) {
        ctx.strokeStyle = 'rgba(118,94,52,0.2)'
        ctx.lineWidth = 0.8
        ctx.strokeRect(-w / 2, -h / 2, w, h)
      }
      ctx.restore()
    }
  }
  // 3) 밭: 드문 이랑 줄
  ctx.strokeStyle = 'rgba(92,98,58,0.22)'
  ctx.lineWidth = 1
  for (let y = hm.y0; y < hm.y0 + hm.height; y += 0.16) {
    for (let x = hm.x0; x < hm.x0 + hm.width; x += 0.16) {
      const c = Math.round((x - hm.x0) / hm.cell)
      const r = Math.round((y - hm.y0) / hm.cell)
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue
      if (world.land[r * cols + c] !== LAND_FIELD || rnd() < 0.55) continue
      const k = r * cols + c
      const ang = Math.atan2(-f.down[k * 2 + 1], f.down[k * 2]) + Math.PI / 2
      const L = 0.1 * s
      ctx.beginPath()
      for (let q = -1; q <= 1; q++) {
        const ox = Math.cos(ang + Math.PI / 2) * q * 3
        const oy = Math.sin(ang + Math.PI / 2) * q * 3
        ctx.moveTo(X(x) + ox - (Math.cos(ang) * L) / 2, Yp(y) + oy - (Math.sin(ang) * L) / 2)
        ctx.lineTo(X(x) + ox + (Math.cos(ang) * L) / 2, Yp(y) + oy + (Math.sin(ang) * L) / 2)
      }
      ctx.stroke()
    }
  }
  // 4) 마을 터: 집 둘레 흙빛
  for (const h of world.houses) {
    const g = ctx.createRadialGradient(X(h.x), Yp(h.y), 0, X(h.x), Yp(h.y), 0.2 * s)
    g.addColorStop(0, 'rgba(201,179,138,0.62)')
    g.addColorStop(1, 'rgba(201,179,138,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(X(h.x), Yp(h.y), 0.2 * s, 0, Math.PI * 2)
    ctx.fill()
  }

  const line = (coords: XY[]) => coords.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Yp(y)) : ctx.lineTo(X(x), Yp(y))))
  const poly = (p: PolygonRings) => {
    for (const ring of p) {
      line(ring)
      ctx.closePath()
    }
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // 5) 물: 모래톱 테두리 → 물 → 가운데 밝은 결
  ctx.strokeStyle = PALETTE.sand
  ctx.lineWidth = 0.06 * s
  ctx.beginPath()
  for (const p of geo.water_polygons) poly(p)
  ctx.stroke()
  for (const r of geo.rivers) {
    ctx.lineWidth = (r.name === '금강' ? 0.2 : 0.085) * s
    ctx.beginPath()
    line(r.coords)
    ctx.stroke()
  }
  ctx.fillStyle = PALETTE.water
  ctx.strokeStyle = PALETTE.water
  ctx.beginPath()
  for (const p of geo.water_polygons) poly(p)
  ctx.fill('evenodd')
  for (const r of geo.rivers) {
    ctx.lineWidth = (r.name === '금강' ? 0.14 : 0.05) * s
    ctx.beginPath()
    line(r.coords)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(160,196,206,0.55)'
  for (const r of geo.rivers) {
    ctx.lineWidth = (r.name === '금강' ? 0.035 : 0.014) * s
    ctx.beginPath()
    line(r.coords)
    ctx.stroke()
  }
  // 6) 길: 경로에 쓰인 작은 길 → 국도·지방도(가장자리 + 흙길)
  ctx.strokeStyle = PALETTE.lane
  ctx.globalAlpha = 0.85
  ctx.lineWidth = 0.028 * s
  const seen = new Set<string>()
  for (const [, , coords] of geo.routes.pairs) {
    ctx.beginPath()
    for (let k = 0; k + 1 < coords.length; k++) {
      const key = `${coords[k][0].toFixed(2)},${coords[k][1].toFixed(2)}|${coords[k + 1][0].toFixed(2)},${coords[k + 1][1].toFixed(2)}`
      if (seen.has(key)) continue
      seen.add(key)
      ctx.moveTo(X(coords[k][0]), Yp(coords[k][1]))
      ctx.lineTo(X(coords[k + 1][0]), Yp(coords[k + 1][1]))
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const roadW = (cls: string) => (cls === 'motorway' ? 0.075 : cls === 'trunk' ? 0.065 : cls === 'primary' ? 0.055 : 0.045)
  for (const pass of [0, 1] as const) {
    for (const r of geo.roads) {
      ctx.strokeStyle = pass === 0 ? 'rgba(122,100,66,0.42)' : PALETTE.road
      ctx.lineWidth = roadW(r.class) * s + (pass === 0 ? 2.2 : 0)
      ctx.beginPath()
      line(r.coords)
      ctx.stroke()
    }
  }
  // 7) 읍·면 경계: 가는 점선
  ctx.setLineDash([9, 7])
  ctx.strokeStyle = 'rgba(52,40,28,0.38)'
  ctx.lineWidth = 1.4
  for (const e of geo.emds) {
    ctx.beginPath()
    for (const p of e.polygons) poly(p)
    ctx.stroke()
  }
  ctx.setLineDash([])
  // 8) 공주 시내: 반투명 트레이싱지
  ctx.save()
  ctx.beginPath()
  for (const p of geo.city_core.polygons) poly(p)
  ctx.fillStyle = 'rgba(236,230,218,0.52)'
  ctx.fill('evenodd')
  ctx.strokeStyle = 'rgba(244,239,230,0.85)'
  ctx.lineWidth = 2.2
  ctx.stroke()
  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(8, maxAnisotropy)
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}
