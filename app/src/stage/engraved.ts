/**
 * 땅에 새긴 이름(설계안 6-16): 읍·면 이름은 자간 넓은 세리프가 지면에 눕는다. 미션 2·3에서는 그 아래 줄에 미션 값이,
 * 가장 불리한 읍·면에는 '가장 불리'가 함께 새겨진다. 멀리서는 또렷하고, 가까이 가면 옅어져 마을 이름에 자리를 내준다.
 * 글씨 판은 지형을 따라 휘는 격자 메시라 산 위에서도 땅에 붙어 있다.
 */

import * as THREE from 'three'

import type { Heightmap } from './terrain'

const CW = 768
const CH = 240
const PX_PER_KM = 122

export const DISPLAY_FONT = "'Hahmlet Variable', 'Hahmlet', 'Nanum Myeongjo', 'Batang', serif"
export const UI_FONT = "'Pretendard Variable', 'Pretendard', 'Malgun Gothic', system-ui, sans-serif"

interface Item {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  tex: THREE.CanvasTexture
  key: string
  kind: 'emd' | 'city'
  last: [string, string, string | null] | null
  uv: THREE.BufferAttribute
  flipped: boolean
}

function spaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number): void {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let x = cx - total / 2
  chars.forEach((c, k) => {
    ctx.fillText(c, x + widths[k] / 2, y)
    x += widths[k] + spacing
  })
}

export class EngravedLabels {
  readonly group = new THREE.Group()
  private readonly items: Item[] = []
  private fontsReady = false
  private readonly hm: Heightmap

  constructor(hm: Heightmap, emds: { x: number; y: number }[], city: { x: number; y: number }) {
    this.hm = hm
    for (const p of emds) this.items.push(this.make(p.x, p.y, 'emd'))
    this.items.push(this.make(city.x, city.y, 'city'))
    // 글꼴이 늦게 오면 다시 그린다(처음에는 대체 글꼴).
    if (typeof document !== 'undefined' && document.fonts) {
      Promise.all([document.fonts.load(`600 100px ${DISPLAY_FONT}`), document.fonts.load(`600 60px ${UI_FONT}`)])
        .then(() => {
          this.fontsReady = true
          this.items.forEach((it, k) => {
            it.key = ''
            if (it.last) this.set(k, ...it.last)
          })
          this.onRedraw?.()
        })
        .catch(() => {})
    }
  }

  get ready(): boolean {
    return this.fontsReady
  }

  /** 글꼴이 늦게 와서 다시 그렸을 때(무대가 한 번 더 그리도록) */
  onRedraw: (() => void) | null = null

  private make(cx: number, cy: number, kind: 'emd' | 'city'): Item {
    const canvas = document.createElement('canvas')
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext('2d')!
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const w = CW / PX_PER_KM
    const h = CH / PX_PER_KM
    const nx = 28
    const ny = 9
    const P: number[] = []
    const U: number[] = []
    const idx: number[] = []
    for (let r = 0; r < ny; r++) {
      for (let c = 0; c < nx; c++) {
        const u = c / (nx - 1)
        const v = r / (ny - 1)
        const x = cx + (u - 0.5) * w
        const y = cy + (v - 0.5) * h
        P.push(x, this.hm.sample(x, y) + 0.02, -y)
        U.push(u, v)
      }
    }
    for (let r = 0; r < ny - 1; r++) for (let c = 0; c < nx - 1; c++) {
      const a = r * nx + c
      idx.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
    const uv = new THREE.Float32BufferAttribute(U, 2)
    g.setAttribute('uv', uv)
    g.setIndex(idx)
    g.computeBoundingSphere()
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
    const mesh = new THREE.Mesh(g, mat)
    mesh.renderOrder = 3
    this.group.add(mesh)
    return { mesh, mat, canvas, ctx, tex, key: '', kind, uv, flipped: false, last: null }
  }

  /** m번 읍·면(끝 = 시내)의 글씨. sub = 둘째 줄(미션 값), worst = '가장 불리' */
  set(k: number, name: string, sub: string, worstTag: string | null): void {
    const it = this.items[k]
    it.last = [name, sub, worstTag]
    const key = `${name}|${sub}|${worstTag}|${this.fontsReady}`
    if (it.key === key) return
    it.key = key
    const ctx = it.ctx
    ctx.clearRect(0, 0, CW, CH)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const city = it.kind === 'city'
    ctx.shadowColor = 'rgba(18,16,12,0.6)'
    ctx.shadowBlur = 10
    ctx.fillStyle = city ? 'rgba(62,58,52,0.92)' : 'rgba(246,238,222,0.96)'
    ctx.font = city ? `650 64px ${DISPLAY_FONT}` : `600 104px ${DISPLAY_FONT}`
    if (city) ctx.shadowColor = 'rgba(255,255,255,0.5)'
    spaced(ctx, name, CW / 2, city ? 136 : 118, city ? 8 : 30)
    if (sub || worstTag) {
      ctx.font = `700 52px ${UI_FONT}`
      const parts = [sub, worstTag].filter(Boolean).join(' · ')
      ctx.fillStyle = worstTag ? 'rgba(227,236,244,0.98)' : 'rgba(246,238,222,0.92)'
      spaced(ctx, parts, CW / 2, 196, 3)
      if (worstTag) {
        ctx.shadowBlur = 0
        ctx.strokeStyle = 'rgba(227,236,244,0.9)'
        ctx.lineWidth = 4
        ctx.setLineDash([16, 10])
        ctx.beginPath()
        ctx.moveTo(CW / 2 - 200, 214)
        ctx.lineTo(CW / 2 + 200, 214)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    it.tex.needsUpdate = true
  }

  /** zoom = 전체 시점 대비 확대 배율, emphasize = 강조할 읍·면(가리킴·가장 불리) */
  setView(zoom: number, emphasize: (k: number) => boolean, hasSub: boolean, flip: boolean): void {
    const base = zoom <= 1.7 ? 1 : zoom >= 2.8 ? 0.22 : 1 - ((zoom - 1.7) / 1.1) * 0.78
    this.items.forEach((it, k) => {
      const e = emphasize(k)
      it.mat.opacity = Math.max(base, e ? 0.92 : hasSub && it.kind === 'emd' ? 0.55 : 0)
      if (it.flipped !== flip) {
        it.flipped = flip
        const nx = 28
        const ny = 9
        for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
          const u = c / (nx - 1)
          const v = r / (ny - 1)
          it.uv.setXY(r * nx + c, flip ? 1 - u : u, flip ? 1 - v : v)
        }
        it.uv.needsUpdate = true
      }
    })
  }

  texts(): string[] {
    return this.items.map((it) => it.key.split('|').slice(0, 3).join(' '))
  }
}
