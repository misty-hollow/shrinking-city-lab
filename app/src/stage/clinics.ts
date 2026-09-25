/**
 * 보건지소(설계안 6-16): 늘 같은 크기의 흰 벽 두 칸 건물 + 짙은 청록 모임지붕 + 앞마당, 그 앞의 **진료등 탑**.
 * 진료일 하루 = 등칸 하나에 불이 켜진다(격주 평균 0.5일은 칸의 아래 절반). 탑 높이는 고정 — 미운영이어도 어디 있는지 보이고
 * 최대 다섯 칸이 늘 보인다. 미운영은 다섯 칸 모두 어두운 유리일 뿐 건물은 그대로다('폐쇄'가 아니다).
 * 지소 바닥에는 어떤 번짐·원·면도 그리지 않는다(설계안 6-6). 빛은 탑의 칸에만 있고, 밖으로는 길을 따라서만 간다.
 */

import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { hipGeometry } from './houses'
import { PALETTE } from './palette'
import { type GlowUniforms, LIGHT_GLSL, type SceneUniforms, makeGlowMaterial, makeGlowMesh, makeLitMaterial } from './shaders'
import type { Heightmap } from './terrain'
import type { ClinicSite } from './world'

export const CHAMBERS = 5
const CH = 0.105
const GAP = 0.024
const MAST_BASE = 0.05
const MAST_W = 0.1
const PAD = { w: 0.74, d: 0.52, t: 0.03 }
const SQUASH_MS = 200
const LIGHT_MS = 160

interface ClinicAnim {
  /** 보이는 칸 수(0..5 실수) */
  level: number
  from: number
  to: number
  fadeAt: number
  target: number
  switchAt: number
  applied: boolean
  squashAt: number
  flashAt: number
  ghost: number | null
  rise: number
  riseTo: number
  riseAt: number
  riseFrom: number
}

function colored(g: THREE.BufferGeometry, color: string, shade = 1): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g
  const c = new THREE.Color(color).multiplyScalar(shade)
  const n = geo.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let k = 0; k < n; k++) {
    arr[k * 3] = c.r
    arr[k * 3 + 1] = c.g
    arr[k * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv')
  if (geo.getAttribute('aGable')) geo.deleteAttribute('aGable')
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  return geo
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z)
}

function chamberMaterial(u: SceneUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...u, uOn: { value: new THREE.Color(PALETTE.chamberOn) }, uOff: { value: new THREE.Color(PALETTE.chamberOff) } },
    vertexShader: /* glsl */ `
      attribute vec4 aCh;
      varying vec3 vN;
      varying vec2 vUv;
      varying vec4 vCh;
      varying float vDepth;
      varying vec3 vView;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(position, 1.0);
        vN = normalize(transpose(inverse(mat3(m))) * normal);
        vUv = uv;
        vCh = aCh;
        vec4 mv = viewMatrix * wp;
        vDepth = -mv.z;
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform vec3 uOn;
      uniform vec3 uOff;
      varying vec3 vN;
      varying vec2 vUv;
      varying vec4 vCh;
      varying float vDepth;
      varying vec3 vView;
      void main() {
        // aCh: x 켜진 몫(0..1, 아래부터) · y 밝기 · z 어둡게(다른 지소 선택) · w 번쩍
        vec3 n = normalize(vN);
        vec3 L = sceneLight(n, 1.0, 1.0) * uExposure;
        float lit = step(vUv.y, vCh.x) * vCh.y;
        float fres = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.0);
        vec3 glass = uOff * L * 0.9 + vec3(0.05, 0.07, 0.09) * fres;
        float mid = 1.0 - abs(vUv.x - 0.5) * 1.2;
        vec3 on = uOn * (1.15 + 0.25 * mid + vCh.w * 0.6);
        vec3 c = mix(glass, on, lit);
        c *= 1.0 - vCh.z * 0.45;
        c = applyFog(c, vDepth);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

export class ClinicLayer {
  readonly group = new THREE.Group()
  readonly hits: THREE.Mesh[] = []
  /** 탑 꼭대기(월드) — 명판 자리 */
  readonly tops: THREE.Vector3[] = []
  /** 탑 발치(월드) — 빛이 나가는 곳 */
  readonly feet: THREE.Vector3[] = []
  private readonly masts: THREE.Mesh[] = []
  private readonly chambers: THREE.InstancedMesh
  private readonly ghosts: THREE.InstancedMesh
  private readonly aCh: THREE.InstancedBufferAttribute
  private readonly glow: ReturnType<typeof makeGlowMesh>
  private readonly frames: LineSegments2[] = []
  private readonly anim: ClinicAnim[]
  private readonly padY: number[] = []
  private readonly rotQ: THREE.Quaternion[] = []
  private selected: number | null = null
  private hover: number | null = null
  private dirty = true
  readonly frameMat: LineMaterial

  constructor(
    sites: ClinicSite[],
    hm: Heightmap,
    shadowAt: (x: number, y: number) => number,
    u: SceneUniforms,
    gu: GlowUniforms,
  ) {
    const statics: THREE.BufferGeometry[] = []
    const shadows: number[] = []
    const n = sites.length
    this.chambers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), chamberMaterial(u), n * CHAMBERS)
    this.aCh = new THREE.InstancedBufferAttribute(new Float32Array(n * CHAMBERS * 4), 4)
    this.aCh.setUsage(THREE.DynamicDrawUsage)
    this.chambers.geometry.setAttribute('aCh', this.aCh)
    this.chambers.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.chambers.frustumCulled = false
    this.ghosts = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: PALETTE.ghost, transparent: true, opacity: 0.5, depthWrite: false }),
      n * CHAMBERS,
    )
    this.ghosts.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.ghosts.frustumCulled = false
    this.ghosts.renderOrder = 4
    this.glow = makeGlowMesh(n * CHAMBERS, makeGlowMaterial(gu, PALETTE.glow, 0.14, 2.5, 13))
    this.frameMat = new LineMaterial({ color: new THREE.Color(PALETTE.select).getHex(), linewidth: 2.6, transparent: true, opacity: 0.95, worldUnits: false })
    const mastMat = makeLitMaterial(u, { vertAlbedo: true, vertShadow: true })
    const Yax = new THREE.Vector3(0, 1, 0)
    sites.forEach((s, j) => {
      const q = new THREE.Quaternion().setFromAxisAngle(Yax, s.rot)
      this.rotQ.push(q)
      const top = hm.sampleMax(s.x, s.y, 0.42)
      const y = top + 0.004
      this.padY.push(y + PAD.t)
      const sh = shadowAt(s.x, s.y)
      const place = (g: THREE.BufferGeometry) => {
        g.applyQuaternion(q)
        g.translate(s.x, y, -s.y)
        return g
      }
      const parts = [
        colored(box(PAD.w, PAD.t, PAD.d, 0, 0, 0.02), PALETTE.forecourt),
        colored(box(PAD.w + 0.03, 0.012, PAD.d + 0.03, 0, -0.012, 0.02), PALETTE.roadEdge, 0.9),
        colored(box(0.42, 0.11, 0.24, -0.06, PAD.t, -0.1), PALETTE.clinicWall),
        colored(box(0.15, 0.08, 0.19, 0.24, PAD.t, -0.11), PALETTE.clinicWall, 0.97),
        colored(hipGeometry(0.22).scale(0.48, 0.075, 0.3).translate(-0.06, PAD.t + 0.11, -0.1), PALETTE.clinicRoof),
        colored(hipGeometry(0.12).scale(0.18, 0.055, 0.22).translate(0.24, PAD.t + 0.08, -0.11), PALETTE.clinicRoof, 0.92),
        // 창(어두운 유리, 불은 켜지 않는다: 빛은 탑에만)
        colored(box(0.3, 0.035, 0.005, -0.06, PAD.t + 0.045, 0.021), PALETTE.windowOff, 1.1),
        colored(box(0.05, 0.06, 0.005, 0.08, PAD.t, 0.021), PALETTE.door),
      ]
      for (const p of parts) {
        statics.push(place(p))
        for (let k = 0; k < p.getAttribute('position').count; k++) shadows.push(sh)
      }
      // 탑: 발치를 원점으로 둔 메시(솟아오르기용으로 y 배율만 바꾼다)
      const mx = s.mastX
      const my = s.mastY
      const my0 = this.padY[j]
      const H = MAST_BASE + CHAMBERS * (CH + GAP)
      const mparts: THREE.BufferGeometry[] = [
        colored(box(0.15, MAST_BASE, 0.15, 0, 0, 0), PALETTE.mastFrame, 1.25),
      ]
      const post = 0.016
      for (const [px, pz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        mparts.push(colored(box(post, H - MAST_BASE + 0.01, post, (px * (MAST_W + post)) / 2, MAST_BASE, (pz * (MAST_W + post)) / 2), PALETTE.mastFrame))
      for (let k = 0; k <= CHAMBERS; k++)
        mparts.push(colored(box(MAST_W + 0.03, GAP * 0.8, MAST_W + 0.03, 0, MAST_BASE + k * (CH + GAP) - GAP * 0.8, 0), PALETTE.mastFrame, 1.1))
      mparts.push(colored(hipGeometry(0.02).scale(0.17, 0.075, 0.17).translate(0, H, 0), PALETTE.clinicRoof, 1.05))
      mparts.push(colored(box(0.012, 0.05, 0.012, 0, H + 0.07, 0), PALETTE.mastFrame))
      const mg = mergeGeometries(mparts.map((g) => g.applyQuaternion(q)))
      const ms = new Float32Array(mg.getAttribute('position').count).fill(sh)
      mg.setAttribute('aVShadow', new THREE.BufferAttribute(ms, 1))
      const mast = new THREE.Mesh(mg, mastMat)
      mast.position.set(mx, my0, -my)
      this.masts.push(mast)
      this.group.add(mast)
      this.tops.push(new THREE.Vector3(mx, my0 + H + 0.14, -my))
      this.feet.push(new THREE.Vector3(mx, my0, -my))
      // 선택 테두리(앞마당 가장자리)
      const hw = PAD.w / 2 + 0.03
      const hd = PAD.d / 2 + 0.03
      const corners = [
        [-hw, 0.02 - hd],
        [hw, 0.02 - hd],
        [hw, 0.02 + hd],
        [-hw, 0.02 + hd],
      ].map(([cx, cz]) => new THREE.Vector3(cx, 0, cz).applyQuaternion(q).add(new THREE.Vector3(s.x, this.padY[j] + 0.004, -s.y)))
      const segs: number[] = []
      for (let k = 0; k < 4; k++) segs.push(...corners[k].toArray(), ...corners[(k + 1) % 4].toArray())
      const fg = new LineSegmentsGeometry()
      fg.setPositions(segs)
      const frame = new LineSegments2(fg, this.frameMat)
      frame.visible = false
      frame.renderOrder = 6
      this.frames.push(frame)
      this.group.add(frame)
      // 가리키기 상자
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, H + 0.3, 0.9), new THREE.MeshBasicMaterial({ visible: false }))
      hit.position.set((s.x + mx) / 2, my0 + (H + 0.3) / 2, -(s.y + my) / 2)
      hit.userData = { kind: 'facility', index: j }
      this.hits.push(hit)
      this.group.add(hit)
    })
    const merged = mergeGeometries(statics)
    merged.setAttribute('aVShadow', new THREE.BufferAttribute(new Float32Array(shadows), 1))
    const staticMesh = new THREE.Mesh(merged, makeLitMaterial(u, { vertAlbedo: true, vertShadow: true }))
    this.group.add(staticMesh, this.chambers, this.ghosts, this.glow.mesh)
    this.anim = sites.map(() => ({ level: 0, from: 0, to: 0, fadeAt: -1e9, target: 0, switchAt: 0, applied: true, squashAt: -1e9, flashAt: -1e9, ghost: null, rise: 1, riseTo: 1, riseAt: -1e9, riseFrom: 1 }))
  }

  /** 등칸 목표(진료일). at = 바뀌는 시각. */
  setLevel(j: number, days: number, at: number): void {
    const a = this.anim[j]
    if (a.target === days && (a.applied || a.switchAt === at)) return
    a.target = days
    a.switchAt = at
    a.applied = false
    this.dirty = true
  }

  setLevelNow(j: number, days: number): void {
    const a = this.anim[j]
    a.target = a.from = a.to = a.level = days
    a.applied = true
    a.fadeAt = -1e9
    this.dirty = true
  }

  setGhost(j: number, days: number | null): void {
    if (this.anim[j].ghost === days) return
    this.anim[j].ghost = days
    this.dirty = true
  }

  setSelected(j: number | null): void {
    if (this.selected === j) return
    this.selected = j
    this.frames.forEach((f, k) => (f.visible = k === j))
    this.dirty = true
  }

  setHover(j: number | null): void {
    if (this.hover === j) return
    this.hover = j
    this.dirty = true
  }

  /** 탑을 낮추거나(0) 세운다(1). 소개 1장에서는 낮춘다. */
  setRise(target: number, now: number, reduced: boolean): void {
    for (const a of this.anim) {
      if (a.riseTo === target) continue
      a.riseFrom = a.rise
      a.riseTo = target
      a.riseAt = reduced ? -1e9 : now
      if (reduced) a.rise = target
    }
    this.dirty = true
  }

  /** 등칸 k(0부터)의 가운데(월드) */
  chamberCenter(j: number, k: number): THREE.Vector3 {
    const f = this.feet[j]
    const r = this.anim[j].rise
    return new THREE.Vector3(f.x, f.y + (MAST_BASE + k * (CH + GAP) + CH / 2) * r, f.z)
  }

  update(now: number, reduced: boolean): boolean {
    let animating = false
    const M = new THREE.Matrix4()
    const S = new THREE.Vector3()
    const P = new THREE.Vector3()
    const Z = new THREE.Matrix4().makeScale(0, 0, 0)
    let any = this.dirty
    this.dirty = false
    this.anim.forEach((a, j) => {
      if (!a.applied && now >= a.switchAt) {
        a.applied = true
        a.from = a.level
        a.to = a.target
        a.fadeAt = reduced ? -1e9 : a.switchAt
        if (reduced) a.level = a.target
        if (a.target > a.from && !reduced) {
          a.squashAt = a.switchAt
          a.flashAt = a.switchAt
        }
        any = true
      }
      if (!a.applied) animating = true
      const fk = Math.min(1, Math.max(0, (now - a.fadeAt) / LIGHT_MS))
      const lvl = a.fadeAt < 0 ? a.to : a.from + (a.to - a.from) * fk
      if (fk < 1 && a.fadeAt >= 0) animating = true
      a.level = lvl
      const rk = Math.min(1, Math.max(0, (now - a.riseAt) / 700))
      const rise = a.riseAt < 0 ? a.riseTo : a.riseFrom + (a.riseTo - a.riseFrom) * (1 - (1 - rk) ** 3)
      if (rk < 1 && a.riseAt >= 0) animating = true
      if (rise !== a.rise) any = true
      a.rise = rise
      this.masts[j].scale.set(1, Math.max(0.0001, rise), 1)
      this.masts[j].visible = rise > 0.01
      const sk = (now - a.squashAt) / SQUASH_MS
      const squash = sk >= 0 && sk <= 1 ? Math.sin(Math.PI * sk) * (1 - sk) : 0
      if (squash > 0) animating = true
      const flk = (now - a.flashAt) / 520
      const flash = flk >= 0 && flk <= 1 ? (1 - flk) ** 2 : 0
      if (flash > 0) animating = true
      const dim = this.selected !== null && this.selected !== j ? 1 : 0
      const hov = this.hover === j || this.selected === j ? 1 : 0
      const f = this.feet[j]
      for (let k = 0; k < CHAMBERS; k++) {
        const id = j * CHAMBERS + k
        const fill = Math.max(0, Math.min(1, lvl - k))
        const cy = (MAST_BASE + k * (CH + GAP)) * rise
        const sy = CH * rise * (1 - 0.12 * squash)
        M.compose(P.set(f.x, f.y + cy + sy / 2, f.z), this.rotQ[j], S.set(MAST_W * (1 + 0.06 * squash), Math.max(0.0001, sy), MAST_W * (1 + 0.06 * squash)))
        this.chambers.setMatrixAt(id, rise > 0.01 ? M : Z)
        const top = Math.ceil(lvl) - 1 === k
        this.aCh.setXYZW(id, fill >= 0.999 ? 1.01 : fill, 1, dim, top ? flash : 0)
        const glowI = fill > 0 ? (0.42 + 0.14 * fill) * (1 - dim * 0.55) * (1 + hov * 0.3) * (1 + (top ? flash : 0)) : 0
        this.glow.pos.setXYZ(id, f.x, f.y + cy + sy * Math.min(0.5, fill / 2 + 0.001), f.z)
        this.glow.glow.setXY(id, fill > 0 ? 0.14 + 0.03 * hov : 0, rise > 0.5 ? glowI : 0)
        // 유령 탑: 옆에 반투명(비교 배분)
        const g = a.ghost
        const gf = g === null ? 0 : Math.max(0, Math.min(1, g - k))
        if (gf > 0 && rise > 0.5) {
          const off = new THREE.Vector3(0.19, 0, 0).applyQuaternion(this.rotQ[j])
          const gh = CH * gf
          M.compose(P.set(f.x + off.x, f.y + MAST_BASE + k * (CH + GAP) + gh / 2, f.z + off.z), this.rotQ[j], S.set(MAST_W * 0.7, gh, MAST_W * 0.7))
          this.ghosts.setMatrixAt(id, M)
        } else this.ghosts.setMatrixAt(id, Z)
      }
    })
    if (any || animating) {
      this.chambers.instanceMatrix.needsUpdate = true
      this.ghosts.instanceMatrix.needsUpdate = true
      this.aCh.needsUpdate = true
      this.glow.pos.needsUpdate = true
      this.glow.glow.needsUpdate = true
    }
    return animating || any
  }
}
