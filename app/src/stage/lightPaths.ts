/**
 * 길의 빛(설계안 6-16 "늘 / 궁금할 때 / 바뀔 때"). 빛은 실제 의료진·차량의 이동이 아니라 **도로망 접근성 변화의 시각적 은유**다.
 *
 * - 늘: 길은 풍경의 일부(땅 그림). 여기서는 아무것도 그리지 않는다.
 * - 궁금할 때: 지소를 가리키거나 고르면 기준 시간 안 마을까지의 실제 경로를 합친 **빛의 나무**가 은은하게 선다.
 *   미운영 지소는 흐린 점선(열면 닿는 곳). 마을을 가리키면 거꾸로, 그 마을에서 기준 안 지소들로.
 * - 바뀔 때: +1은 빛이 지소에서 길을 따라 나가고, −1은 먼 쪽부터 거둬지며, 기준 변경은 빛 끝이 늘거나 준다.
 *   빛 끝은 셰이더의 값 하나(도로망 분)라 지소마다 드로우 1회다.
 */

import * as THREE from 'three'

import type { XY } from '../data/types'
import { type LightPlan, frontAt } from './lightPlan'
import { type LightBranch, type RoutePair, clinicTree, villageTree } from './lightTree'
import { PALETTE } from './palette'
import type { Heightmap } from './terrain'

const HALF_W = 0.075
const LIFT = 0.014
const AFTER_MS = 700

function pathMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    // 가산(색) + 알파는 그대로: 캔버스가 투명 배경이라 알파까지 더하면 섬 밖 허공에 검은 선이 찍힌다
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    uniforms: {
      uColor: { value: new THREE.Color(PALETTE.glow) },
      uFront: { value: 0 },
      uBehind: { value: 0 },
      uAhead: { value: 0 },
      uHead: { value: 0 },
      uDark: { value: 0 },
      uDash: { value: 0 },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aT;
      attribute float aSide;
      attribute float aD;
      attribute float aIn;
      varying float vT;
      varying float vSide;
      varying float vD;
      varying float vIn;
      void main() {
        vT = aT;
        vSide = aSide;
        vD = aD;
        vIn = aIn;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uFront;
      uniform float uBehind;
      uniform float uAhead;
      uniform float uHead;
      uniform float uDark;
      uniform float uDash;
      uniform float uAlpha;
      varying float vT;
      varying float vSide;
      varying float vD;
      varying float vIn;
      void main() {
        float edge = smoothstep(uFront - 0.06, uFront + 0.06, vT);
        float base = mix(uBehind, uAhead, edge);
        float x = (vT - uFront) / 0.85;
        float band = exp(-x * x);
        float I = base + uHead * band * (1.0 - edge) * 1.3 - uDark * band * base;
        float prof = exp(-vSide * vSide * 4.5) * 0.55 + exp(-vSide * vSide * 42.0) * 0.95;
        // 섬 밖(실제 경로가 공주 경계 밖으로 잠깐 나가는 구간)은 허공에 뜨지 않게 지운다
        I = max(I, 0.0) * prof * smoothstep(0.35, 0.95, vIn);
        if (uDash > 0.5) I *= step(0.48, fract(vD / 0.17));
        vec3 c = mix(uColor, vec3(1.0, 0.94, 0.8), clamp(band * uHead * (1.0 - edge) * 0.7, 0.0, 1.0));
        gl_FragColor = vec4(c * I * uAlpha, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

function ribbon(hm: Heightmap, branches: LightBranch[], inside: (x: number, y: number) => boolean): THREE.BufferGeometry {
  const P: number[] = []
  const T: number[] = []
  const S: number[] = []
  const D: number[] = []
  const I: number[] = []
  const idx: number[] = []
  for (const b of branches) {
    const n = b.pts.length
    if (n < 2) continue
    const base = P.length / 3
    for (let k = 0; k < n; k++) {
      const a = b.pts[Math.max(0, k - 1)]
      const c = b.pts[Math.min(n - 1, k + 1)]
      let tx = c[0] - a[0]
      let ty = c[1] - a[1]
      const l = Math.hypot(tx, ty) || 1
      tx /= l
      ty /= l
      const nx = -ty
      const ny = tx
      const [x, y] = b.pts[k]
      const inn = inside(x, y) ? 1 : 0
      for (const side of [-1, 1]) {
        const px = x + nx * HALF_W * side
        const py = y + ny * HALF_W * side
        P.push(px, Math.max(hm.sample(px, py), hm.sample(x, y)) + LIFT, -py)
        T.push(b.t[k])
        S.push(side)
        D.push(b.d[k])
        I.push(inn)
      }
    }
    for (let k = 0; k < n - 1; k++) {
      const q = base + k * 2
      idx.push(q, q + 1, q + 3, q, q + 3, q + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('aT', new THREE.Float32BufferAttribute(T, 1))
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(S, 1))
  g.setAttribute('aD', new THREE.Float32BufferAttribute(D, 1))
  g.setAttribute('aIn', new THREE.Float32BufferAttribute(I, 1))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

interface Pulse {
  plan: LightPlan
  t0: number
  /** +1 전에 이미 운영 중이었나 / −1 뒤에도 운영 중인가 */
  keep: boolean
}

interface ClinicPath {
  mesh: THREE.Mesh
  mat: THREE.ShaderMaterial
  /** 궁금할 때(가리킴·선택)의 세기 0..1 */
  steady: number
  pulse: Pulse | null
}

export class LightPaths {
  readonly group = new THREE.Group()
  private readonly paths: (ClinicPath | null)[]
  private focus: number | null = null
  private T = 15
  private alloc: readonly number[] = []
  private villageMeshes: THREE.Mesh[] = []
  private villageKey = ''
  private villageAt = -1e9
  private readonly hm: Heightmap
  private readonly pairs: readonly RoutePair[]
  private readonly minutesOf: (i: number, j: number) => number
  private readonly feet: THREE.Vector3[]
  private readonly inside: (x: number, y: number) => boolean

  constructor(
    hm: Heightmap,
    pairs: readonly RoutePair[],
    minutesOf: (i: number, j: number) => number,
    feet: THREE.Vector3[],
    nF: number,
    inside: (x: number, y: number) => boolean = () => true,
  ) {
    this.inside = inside
    this.hm = hm
    this.pairs = pairs
    this.minutesOf = minutesOf
    this.feet = feet
    this.paths = new Array(nF).fill(null)
  }

  private ensure(j: number): ClinicPath {
    const hit = this.paths[j]
    if (hit) return hit
    const branches = clinicTree(j, this.pairs, this.minutesOf, 20)
    // 탑 발치 → 경로 시작(지소 접근점)
    let start: XY | null = null
    for (const b of branches) if (b.t[0] < 0.05) {
      start = b.pts[0]
      break
    }
    const f = this.feet[j]
    if (start) branches.push({ pts: [[f.x, -f.z], start], t: [0, 0], d: [0, Math.hypot(start[0] - f.x, start[1] + f.z)] })
    const mat = pathMaterial()
    const mesh = new THREE.Mesh(ribbon(this.hm, branches, this.inside), mat)
    mesh.renderOrder = 4
    mesh.visible = false
    mesh.frustumCulled = false
    this.group.add(mesh)
    const p = { mesh, mat, steady: 0, pulse: null }
    this.paths[j] = p
    return p
  }

  /** 모든 지소의 나무를 미리 만든다(첫 가리키기에서 끊기지 않게). */
  warm(): void {
    for (let j = 0; j < this.paths.length; j++) this.ensure(j)
  }

  setContext(T: number, alloc: readonly number[]): void {
    this.T = T
    this.alloc = alloc
  }

  setFocus(j: number | null): void {
    this.focus = j
  }

  pulse(plan: LightPlan, t0: number, before: readonly number[], after: readonly number[]): void {
    for (const j of plan.clinics) {
      const p = this.ensure(j)
      const keep = plan.kind === 'op' ? (plan.dir > 0 ? before[j] > 0 : after[j] > 0) : false
      p.pulse = { plan, t0, keep }
    }
  }

  /** 마을 hover: 운영 중 지소로 가는 길은 빛, 미운영 지소로 가는 길은 흐린 점선. */
  setVillage(i: number | null, lit: number[], unlit: number[], now: number): void {
    const key = i === null ? '' : `${i}|${lit.join(',')}|${unlit.join(',')}|${this.T}`
    if (key === this.villageKey) return
    this.villageKey = key
    for (const m of this.villageMeshes) {
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
      this.group.remove(m)
    }
    this.villageMeshes = []
    if (i === null) return
    this.villageAt = now
    const mk = (js: number[], dash: boolean) => {
      if (js.length === 0) return
      const mat = pathMaterial()
      const mesh = new THREE.Mesh(ribbon(this.hm, villageTree(i, js, this.pairs, this.minutesOf, this.T), this.inside), mat)
      mat.uniforms.uDash.value = dash ? 1 : 0
      if (dash) (mat.uniforms.uColor.value as THREE.Color).set('#C9D3DA')
      mat.uniforms.uFront.value = this.T
      mat.uniforms.uBehind.value = dash ? 0.5 : 0.62
      mesh.renderOrder = 4
      mesh.frustumCulled = false
      this.villageMeshes.push(mesh)
      this.group.add(mesh)
    }
    mk(lit, false)
    mk(unlit, true)
  }

  update(now: number, reduced: boolean, dt: number): boolean {
    let animating = false
    const vk = Math.min(1, (now - this.villageAt) / 220)
    for (const m of this.villageMeshes) (m.material as THREE.ShaderMaterial).uniforms.uAlpha.value = reduced ? 1 : vk
    if (vk < 1 && this.villageMeshes.length > 0 && !reduced) animating = true
    for (let j = 0; j < this.paths.length; j++) {
      const want = this.focus === j ? 1 : 0
      const p = this.paths[j] ?? (want > 0 ? this.ensure(j) : null)
      if (!p) continue
      if (p.steady !== want) {
        const rate = want > p.steady ? dt / 0.22 : dt / 0.3
        p.steady = reduced ? want : want > p.steady ? Math.min(want, p.steady + rate) : Math.max(want, p.steady - rate)
        animating = true
      }
      const operating = (this.alloc[j] ?? 0) > 0
      const u = p.mat.uniforms
      // 궁금할 때: 운영 중이면 은은한 빛, 미운영이면 흐린 점선
      let front = this.T
      let behind = p.steady * (operating ? 0.42 : 0.34)
      let ahead = 0
      let head = 0
      let dark = 0
      let dash = operating ? 0 : 1
      if (p.pulse) {
        const { plan, t0, keep } = p.pulse
        const e = now - t0
        if (reduced || e > plan.endMs + AFTER_MS) p.pulse = null
        else {
          animating = true
          const fr = frontAt(plan, e)
          const after = e > plan.endMs ? Math.min(1, (e - plan.endMs) / AFTER_MS) : 0
          const k = 1 - after
          dash = 0
          if (plan.kind === 'op' && plan.dir > 0) {
            if (e < plan.front.startMs) {
              // 불씨가 아직 날아가는 중: 전에 운영하던 지소면 지금의 빛, 새로 여는 지소면 아직 어둡다
              front = this.T
              behind = keep ? behind : 0
              ahead = 0
            } else {
              front = fr
              behind = 1 * k + behind * (1 - k)
              ahead = keep ? 0.42 * k : 0
              head = k
            }
          } else if (plan.kind === 'op') {
            front = fr
            if (keep) {
              behind = Math.max(behind, 0.75 * k)
              ahead = Math.max(behind * 0.8, 0.55 * k)
              dark = 0.8 * k
            } else {
              behind = 0.8 * k
              ahead = 0
            }
          } else {
            front = fr
            behind = Math.max(behind, 0.85 * k)
            head = plan.dir > 0 ? 0.8 * k : 0
          }
        }
      }
      u.uFront.value = front
      u.uBehind.value = behind
      u.uAhead.value = ahead
      u.uHead.value = head
      u.uDark.value = dark
      u.uDash.value = dash
      ;(u.uColor.value as THREE.Color).set(dash > 0.5 ? '#C9D3DA' : PALETTE.glow)
      p.mesh.visible = behind > 0.002 || ahead > 0.002 || head > 0.002
    }
    return animating
  }
}
