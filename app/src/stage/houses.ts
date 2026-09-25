/**
 * 마을의 집(설계안 6-16). 집 한 채 ≈ 주민 50명. 데이터는 빛 하나다.
 *
 *   주 0일   창이 어둡다. 벽·지붕은 그대로 — 사람이 사는 집이다. 불빛만 없다.
 *   주 1~2일 벽마다 창 하나가 켜지고 집 발치에 작은 빛.
 *   주 3~5일 모든 창과 회관 문등, 집 모양을 따라가는 넓은 빛 번짐(집마다 따로 — 마을 중심의 원이 아니다).
 *   소개 화면  창 자체가 없다(아직 진료 이야기를 하지 않는다).
 *
 * 빛이 닿는 순간 집이 한 번 들썩이고, 0일이 된 마을에는 1.2초 동안 차가운 윤곽이 남는다.
 *
 * 표시(마크, 설계안 6-17): 놓기 전 미리보기는 **바뀔 마을**의 집에 테두리 빛(얻음 = 따뜻한 흰빛, 잃음 = 산호빛)을
 * 켠다. 놓은 뒤에는 빛이 그 마을에 닿는 순간 테두리가 불빛으로 바뀐다(빛의 계획의 도착 시각).
 */

import * as THREE from 'three'

import type { Heightmap } from './terrain'
import { PALETTE } from './palette'
import { type GlowUniforms, LIGHT_GLSL, type SceneUniforms, makeGlowMaterial, makeGlowMesh } from './shaders'
import type { World } from './world'

/** 마을 표시 단계: 0 닿지 않음 · 1 주 1~2일 · 2 주 3~5일 · 3 중립(소개) */
export type VillageLevel = 0 | 1 | 2 | 3

const FADE_MS = 230
const HOP_MS = 260
const HOP_KM = 0.045
const LOST_MS = 1200
const WAKE_SPREAD_MS = 150
/** 사건 표시가 불빛으로 바뀌며 사라지는 시간 */
const MARK_FADE_MS = 220

function bodyGeometry(): THREE.BufferGeometry {
  const P: number[] = []
  const N: number[] = []
  const U: number[] = []
  const W: number[] = []
  const idx: number[] = []
  const y0 = -0.8
  const y1 = 1
  const quad = (a: number[], b: number[], n: number[], wall: number, flip: boolean) => {
    const base = P.length / 3
    // a→b 아래 변, 위로 올린다
    const pts = [
      [a[0], y0, a[1]],
      [b[0], y0, b[1]],
      [b[0], y1, b[1]],
      [a[0], y1, a[1]],
    ]
    const us = [0, 1, 1, 0]
    const vs = [y0, y0, y1, y1]
    for (let k = 0; k < 4; k++) {
      P.push(...pts[k])
      N.push(...n)
      U.push(us[k], vs[k])
      W.push(wall)
    }
    if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  quad([-0.5, 0.5], [0.5, 0.5], [0, 0, 1], 0, false)
  quad([0.5, -0.5], [-0.5, -0.5], [0, 0, -1], 1, false)
  quad([0.5, 0.5], [0.5, -0.5], [1, 0, 0], 2, false)
  quad([-0.5, -0.5], [-0.5, 0.5], [-1, 0, 0], 3, false)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
  g.setAttribute('aWall', new THREE.Float32BufferAttribute(W, 1))
  g.setIndex(idx)
  return g
}

/** 박공 지붕(용마루 = x축). 박공 삼각형은 벽 색(aGable = 1). */
function gableGeometry(): THREE.BufferGeometry {
  const P: number[] = []
  const G: number[] = []
  const tri = (a: number[], b: number[], c: number[], gable: number) => {
    P.push(...a, ...b, ...c)
    G.push(gable, gable, gable)
  }
  const A = [-0.5, 1, 0]
  const B = [0.5, 1, 0]
  const f0 = [-0.5, 0, 0.5]
  const f1 = [0.5, 0, 0.5]
  const b0 = [-0.5, 0, -0.5]
  const b1 = [0.5, 0, -0.5]
  tri(f0, f1, B, 0)
  tri(f0, B, A, 0)
  tri(b1, b0, A, 0)
  tri(b1, A, B, 0)
  tri(f1, b1, B, 1)
  tri(b0, f0, A, 1)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('aGable', new THREE.Float32BufferAttribute(G, 1))
  g.computeVertexNormals()
  return g
}

/** 모임지붕(회관·지소). 짧은 용마루. */
export function hipGeometry(ridge = 0.28): THREE.BufferGeometry {
  const P: number[] = []
  const tri = (a: number[], b: number[], c: number[]) => P.push(...a, ...b, ...c)
  const A = [-ridge, 1, 0]
  const B = [ridge, 1, 0]
  const f0 = [-0.5, 0, 0.5]
  const f1 = [0.5, 0, 0.5]
  const b0 = [-0.5, 0, -0.5]
  const b1 = [0.5, 0, -0.5]
  tri(f0, f1, B)
  tri(f0, B, A)
  tri(b1, b0, A)
  tri(b1, A, B)
  tri(f1, b1, B)
  tri(b0, f0, A)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('aGable', new THREE.Float32BufferAttribute(new Array(P.length / 3).fill(0), 1))
  g.computeVertexNormals()
  return g
}

function bodyMaterial(u: SceneUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...u,
      uWall: { value: new THREE.Color(PALETTE.wall) },
      uWinOn: { value: new THREE.Color(PALETTE.windowOn) },
      uWinOff: { value: new THREE.Color(PALETTE.windowOff) },
      uDoor: { value: new THREE.Color(PALETTE.door) },
      uLost: { value: new THREE.Color(PALETTE.lost) },
      uMarkGain: { value: new THREE.Color(PALETTE.markGain) },
      uMarkLoss: { value: new THREE.Color(PALETTE.markLoss) },
    },
    vertexShader: /* glsl */ `
      attribute float aWall;
      attribute vec4 aState;
      attribute vec4 aInfo;
      attribute float aMark;
      varying vec3 vN;
      varying vec2 vUv;
      varying float vWall;
      varying vec4 vState;
      varying vec4 vInfo;
      varying float vDepth;
      varying vec3 vView;
      varying float vMark;
      void main() {
        vMark = aMark;
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(position, 1.0);
        wp.y += aState.w;
        vN = normalize(transpose(inverse(mat3(m))) * normal);
        vUv = uv;
        vWall = aWall;
        vState = aState;
        vInfo = aInfo;
        vec4 mv = viewMatrix * wp;
        vDepth = -mv.z;
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform vec3 uWall;
      uniform vec3 uWinOn;
      uniform vec3 uWinOff;
      uniform vec3 uDoor;
      uniform vec3 uLost;
      uniform vec3 uMarkGain;
      uniform vec3 uMarkLoss;
      varying vec3 vN;
      varying vec2 vUv;
      varying float vWall;
      varying vec4 vState;
      varying vec4 vInfo;
      varying float vDepth;
      varying vec3 vView;
      varying float vMark;
      void main() {
        vec3 n = normalize(vN);
        float level = vState.x;
        float lost = vState.y;
        float neutral = vState.z;
        float hall = vInfo.z;
        vec3 L = sceneLight(n, vInfo.x, 1.0) * uExposure;
        vec3 col = uWall * (0.93 + 0.1 * vInfo.y) * L;
        float nWin = vWall < 1.5 ? (hall > 0.5 ? 3.0 : 2.0) : 1.0;
        float u = vUv.x;
        float v = vUv.y;
        float slot = floor(clamp(u, 0.0, 0.999) * nWin);
        float cu = (slot + 0.5) / nWin;
        float hw = nWin > 1.5 ? 0.26 / nWin : 0.17;
        float inWin = step(abs(u - cu), hw) * step(0.3, v) * step(v, 0.74);
        float door = 0.0;
        if (vWall < 0.5) {
          door = step(abs(u - 0.5), hall > 0.5 ? 0.09 : 0.07) * step(v, 0.64) * step(-0.02, v);
          inWin *= 1.0 - step(abs(u - 0.5), 0.11);
        }
        float want = slot < 0.5 ? 1.0 : 2.0;
        if (nWin < 1.5) want = 1.0;
        float lit = clamp(level - want + 1.0, 0.0, 1.0);
        if (neutral > 0.5) { inWin = 0.0; lit = 0.0; }
        vec3 winOff = uWinOff * L * 0.85;
        vec3 winOn = uWinOn * 1.3;
        col = mix(col, mix(winOff, winOn, lit), inWin);
        // 회관 문등: 주 3~5일
        float lamp = hall > 0.5 ? clamp(level - 1.0, 0.0, 1.0) * (1.0 - neutral) : 0.0;
        col = mix(col, mix(uDoor * L, uWinOn * 1.1, lamp * 0.7), door);
        float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 1.6);
        col += uLost * lost * (0.3 + 0.7 * rim) * 0.75;
        col *= 1.0 + vInfo.w * 0.22;
        // 미리보기·사건 표시: 벽 가장자리가 밝게 선다(집 모양을 따라가는 테두리 빛)
        float mk = abs(vMark);
        vec3 mcol = vMark > 0.0 ? uMarkGain : uMarkLoss;
        col = mix(col, mcol, mk * (0.22 + 0.6 * rim));
        col = applyFog(col, vDepth);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

function roofMaterial(u: SceneUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...u,
      uWall: { value: new THREE.Color(PALETTE.wall) },
      uLost: { value: new THREE.Color(PALETTE.lost) },
      uMarkGain: { value: new THREE.Color(PALETTE.markGain) },
      uMarkLoss: { value: new THREE.Color(PALETTE.markLoss) },
    },
    vertexShader: /* glsl */ `
      attribute float aGable;
      attribute vec3 aRoof;
      attribute vec4 aRoofState;
      attribute float aRoofMark;
      varying vec3 vN;
      varying vec3 vCol;
      varying float vGable;
      varying vec4 vS;
      varying float vDepth;
      varying float vMark;
      void main() {
        vMark = aRoofMark;
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(position, 1.0);
        wp.y += aRoofState.w;
        vN = normalize(transpose(inverse(mat3(m))) * normal);
        vCol = aRoof;
        vGable = aGable;
        vS = aRoofState;
        vec4 mv = viewMatrix * wp;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform vec3 uWall;
      uniform vec3 uLost;
      uniform vec3 uMarkGain;
      uniform vec3 uMarkLoss;
      varying vec3 vN;
      varying vec3 vCol;
      varying float vGable;
      varying vec4 vS;
      varying float vDepth;
      varying float vMark;
      void main() {
        vec3 n = normalize(vN);
        vec3 L = sceneLight(n, vS.x, 1.0) * uExposure;
        vec3 col = mix(vCol, uWall * 0.96, vGable) * L;
        col += uLost * vS.y * 0.22;
        col *= 1.0 + vS.z * 0.2;
        col = mix(col, vMark > 0.0 ? uMarkGain : uMarkLoss, abs(vMark) * 0.42);
        col = applyFog(col, vDepth);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

interface VillageAnim {
  /** 목표 단계와 적용 시각 */
  target: VillageLevel
  switchAt: number
  applied: boolean
  /** 보이는 단계: fadeAt부터 from → to(0..2 실수). 중립이면 창이 없다 */
  from: number
  to: number
  fadeAt: number
  neutral: boolean
  lostAt: number
  hopAt: number
}

function levelNow(a: VillageAnim, now: number, delay = 0): number {
  if (a.neutral) return 0
  const f = Math.min(1, Math.max(0, (now - a.fadeAt - delay) / FADE_MS))
  return a.from + (a.to - a.from) * f
}

export class HouseLayer {
  readonly group = new THREE.Group()
  /** 가리키기용(보이지 않는 상자) */
  readonly hit: THREE.InstancedMesh
  private readonly bodies: THREE.InstancedMesh
  private readonly gables: THREE.InstancedMesh
  private readonly hips: THREE.InstancedMesh
  private readonly glow: ReturnType<typeof makeGlowMesh>
  private readonly lamp: ReturnType<typeof makeGlowMesh>
  /** 표시 테두리의 번짐(얻음·잃음) */
  private readonly haloGain: ReturnType<typeof makeGlowMesh>
  private readonly haloLoss: ReturnType<typeof makeGlowMesh>
  private readonly aMark: THREE.InstancedBufferAttribute
  private readonly gMark: THREE.InstancedBufferAttribute
  private readonly hMark: THREE.InstancedBufferAttribute
  private readonly aState: THREE.InstancedBufferAttribute
  private readonly aInfo: THREE.InstancedBufferAttribute
  private readonly gState: THREE.InstancedBufferAttribute
  private readonly hState: THREE.InstancedBufferAttribute
  /** 집 → (박공 또는 모임지붕 인스턴스 번호, 종류) */
  private readonly roofOf: Int32Array
  private readonly baseY: Float32Array
  private readonly anim: VillageAnim[]
  private readonly wakeDelay: Float32Array
  private emphasis: 'zero' | 'thick' | null = null
  private hoverVillage: number | null = null
  private highlight = new Set<number>()
  /** 미리보기: 바뀔 마을과 방향 */
  private preview = new Set<number>()
  private previewSign: 1 | -1 = 1
  /** 사건 표시: 마을 → (방향, 빛이 닿는 시각) */
  private readonly eventMarks = new Map<number, { sign: 1 | -1; until: number }>()
  private marksLive = false
  private dirty = true
  private readonly world: World

  constructor(
    world: World,
    hm: Heightmap,
    shadowAt: (x: number, y: number) => number,
    u: SceneUniforms,
    gu: GlowUniforms,
  ) {
    this.world = world
    const hs = world.houses
    const n = hs.length
    const halls = hs.filter((h) => h.kind === 1).length
    this.bodies = new THREE.InstancedMesh(bodyGeometry(), bodyMaterial(u), n)
    this.gables = new THREE.InstancedMesh(gableGeometry(), roofMaterial(u), n - halls)
    this.hips = new THREE.InstancedMesh(hipGeometry(), roofMaterial(u), halls)
    const hitGeo = new THREE.BoxGeometry(1.25, 2.2, 1.35).translate(0, 0.55, 0)
    this.hit = new THREE.InstancedMesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }), n)
    this.aState = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)
    this.aInfo = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)
    this.gState = new THREE.InstancedBufferAttribute(new Float32Array((n - halls) * 4), 4)
    this.hState = new THREE.InstancedBufferAttribute(new Float32Array(halls * 4), 4)
    this.aMark = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
    this.gMark = new THREE.InstancedBufferAttribute(new Float32Array(n - halls), 1)
    this.hMark = new THREE.InstancedBufferAttribute(new Float32Array(halls), 1)
    for (const a of [this.aState, this.aInfo, this.gState, this.hState, this.aMark, this.gMark, this.hMark]) a.setUsage(THREE.DynamicDrawUsage)
    this.bodies.geometry.setAttribute('aState', this.aState)
    this.bodies.geometry.setAttribute('aInfo', this.aInfo)
    this.bodies.geometry.setAttribute('aMark', this.aMark)
    this.gables.geometry.setAttribute('aRoofMark', this.gMark)
    this.hips.geometry.setAttribute('aRoofMark', this.hMark)
    const gRoof = new THREE.InstancedBufferAttribute(new Float32Array((n - halls) * 3), 3)
    const hRoof = new THREE.InstancedBufferAttribute(new Float32Array(halls * 3), 3)
    this.gables.geometry.setAttribute('aRoof', gRoof)
    this.gables.geometry.setAttribute('aRoofState', this.gState)
    this.hips.geometry.setAttribute('aRoof', hRoof)
    this.hips.geometry.setAttribute('aRoofState', this.hState)
    this.glow = makeGlowMesh(n, makeGlowMaterial(gu, PALETTE.glow, 0.16, 2.2, 16))
    this.lamp = makeGlowMesh(halls, makeGlowMaterial(gu, PALETTE.windowOn, 0.1, 1.2, 6))
    this.haloGain = makeGlowMesh(n, makeGlowMaterial(gu, PALETTE.markGain, 0.2, 3, 18))
    this.haloLoss = makeGlowMesh(n, makeGlowMaterial(gu, PALETTE.markLoss, 0.2, 3, 18))
    this.roofOf = new Int32Array(n)
    this.baseY = new Float32Array(n)
    this.wakeDelay = new Float32Array(n)
    const M = new THREE.Matrix4()
    const Q = new THREE.Quaternion()
    const S = new THREE.Vector3()
    const P = new THREE.Vector3()
    const Yax = new THREE.Vector3(0, 1, 0)
    const roofCols = PALETTE.roofs.map((c) => new THREE.Color(c))
    let gi = 0
    let hi = 0
    hs.forEach((h, k) => {
      const top = hm.sampleMax(h.x, h.y, Math.max(h.w, h.d) * 0.55)
      const bottom = Math.min(hm.sample(h.x, h.y), top)
      const y = (top * 2 + bottom) / 3
      this.baseY[k] = y
      Q.setFromAxisAngle(Yax, h.rot)
      M.compose(P.set(h.x, y, -h.y), Q, S.set(h.w, h.h, h.d))
      this.bodies.setMatrixAt(k, M)
      M.compose(P.set(h.x, y, -h.y), Q, S.set(h.w, h.h, h.d))
      this.hit.setMatrixAt(k, M)
      M.compose(P.set(h.x, y + h.h, -h.y), Q, S.set(h.w * 1.1, h.roofH, h.d * 1.22))
      const sh = shadowAt(h.x, h.y)
      const c = roofCols[h.roof]
      const tint = ((k * 7919) % 97) / 97
      this.aInfo.setXYZW(k, sh, tint, h.kind, 0)
      if (h.kind === 1) {
        this.hips.setMatrixAt(hi, M)
        hRoof.setXYZ(hi, c.r, c.g, c.b)
        this.hState.setXYZW(hi, sh, 0, 0, 0)
        this.roofOf[k] = hi++
        // 문등: 앞면 가운데 문 위
        const fx = Math.sin(h.rot)
        const fz = Math.cos(h.rot)
        this.lamp.pos.setXYZ(this.roofOf[k], h.x + fx * (h.d * 0.55), y + h.h * 0.6, -h.y + fz * (h.d * 0.55))
      } else {
        this.gables.setMatrixAt(gi, M)
        gRoof.setXYZ(gi, c.r, c.g, c.b)
        this.gState.setXYZW(gi, sh, 0, 0, 0)
        this.roofOf[k] = gi++
      }
      this.glow.pos.setXYZ(k, h.x, y + h.h * 0.7, -h.y)
      this.haloGain.pos.setXYZ(k, h.x, y + h.h * 0.8, -h.y)
      this.haloLoss.pos.setXYZ(k, h.x, y + h.h * 0.8, -h.y)
    })
    // 마을 안 깨어나는 순서: 대표점에서 가까운 집부터
    for (const v of world.villages) {
      const d = v.houses.map((k) => Math.hypot(hs[k].x - v.cx, hs[k].y - v.cy))
      const max = Math.max(0.001, ...d)
      v.houses.forEach((k, q) => {
        this.wakeDelay[k] = (d[q] / max) * WAKE_SPREAD_MS
      })
    }
    this.anim = world.villages.map(() => ({ target: 3, switchAt: 0, applied: true, from: 0, to: 0, fadeAt: -1e9, neutral: true, lostAt: -1e9, hopAt: -1e9 }))
    for (const im of [this.bodies, this.gables, this.hips, this.hit]) {
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
    }
    this.bodies.frustumCulled = false
    this.gables.frustumCulled = false
    this.hips.frustumCulled = false
    this.hit.frustumCulled = false
    this.group.add(this.bodies, this.gables, this.hips, this.hit, this.glow.mesh, this.lamp.mesh, this.haloGain.mesh, this.haloLoss.mesh)
  }

  /** 마을 i의 목표 단계. at = 적용 시각(performance.now 기준). 이미 같은 목표로 가는 중이면 그대로 둔다. */
  setTarget(i: number, level: VillageLevel, at: number): void {
    const a = this.anim[i]
    if (a.target === level) return
    a.target = level
    a.switchAt = at
    a.applied = false
    this.dirty = true
  }

  /** 도착 시각을 다시 정한다(같은 목표라도 새 빛이 닿는 시각으로). */
  retime(i: number, level: VillageLevel, at: number): void {
    const a = this.anim[i]
    if (a.target === level && a.applied) return
    a.target = level
    a.switchAt = at
    a.applied = false
    this.dirty = true
  }

  /** 바로 적용(애니메이션 없이) */
  setNow(i: number, level: VillageLevel): void {
    const a = this.anim[i]
    a.target = level
    a.applied = true
    a.neutral = level === 3
    a.from = a.to = level === 3 ? 0 : level
    a.fadeAt = -1e9
    this.dirty = true
  }

  targetOf(i: number): VillageLevel {
    return this.anim[i].target
  }

  setEmphasis(e: 'zero' | 'thick' | null): void {
    if (this.emphasis === e) return
    this.emphasis = e
    this.dirty = true
  }

  setHover(i: number | null): void {
    if (this.hoverVillage === i) return
    this.hoverVillage = i
    this.dirty = true
  }

  setHighlight(list: readonly number[] | null): void {
    this.highlight = new Set(list ?? [])
    this.dirty = true
  }

  /** 놓기 전 미리보기: 이 조작으로 바뀔 마을들(없으면 끔) */
  setPreview(list: readonly number[] | null, sign: 1 | -1): void {
    const next = new Set(list ?? [])
    if (next.size === this.preview.size && sign === this.previewSign && [...next].every((i) => this.preview.has(i))) return
    this.preview = next
    this.previewSign = sign
    this.dirty = true
  }

  /** 사건 표시: 빛이 이 마을에 닿는 순간(until)까지 테두리를 켜 둔다 */
  markUntil(i: number, sign: 1 | -1, until: number): void {
    this.eventMarks.set(i, { sign, until })
    this.dirty = true
  }

  /** instanceId → 마을 번호 */
  villageOf(instance: number): number {
    return this.world.houses[instance].village
  }

  /** 지붕 꼭대기(월드) — 라벨 자리 */
  topOf(i: number): THREE.Vector3 {
    const v = this.world.villages[i]
    let top = -Infinity
    for (const k of v.houses) top = Math.max(top, this.baseY[k] + this.world.houses[k].h + this.world.houses[k].roofH)
    return new THREE.Vector3(v.mx, top, -v.my)
  }

  private markOf(i: number, now: number, reduced: boolean): number {
    const e = this.eventMarks.get(i)
    if (e) {
      const k = (now - e.until) / MARK_FADE_MS
      if (k < 0) return e.sign
      if (k < 1 && !reduced) return e.sign * (1 - k)
      this.eventMarks.delete(i)
    }
    if (this.preview.has(i)) return this.previewSign * (reduced ? 1 : 0.78 + 0.22 * Math.sin(now / 260))
    return 0
  }

  update(now: number, reduced: boolean): boolean {
    let animating = false
    const hs = this.world.houses
    let touched = this.dirty
    this.dirty = false
    const marking = this.preview.size > 0 || this.eventMarks.size > 0
    // 표시가 꺼지는 프레임에도 한 번 더 그린다(0으로 돌려놓기)
    const wasMarking = this.marksLive
    this.marksLive = marking
    if (marking && !reduced) animating = true
    const pulse = this.emphasis === 'thick' ? 0.75 + 0.25 * Math.sin(now / 170) : 1
    for (let i = 0; i < this.anim.length; i++) {
      const a = this.anim[i]
      if (!a.applied && now >= a.switchAt) {
        const cur = levelNow(a, now)
        a.applied = true
        if (a.target === 3) {
          a.neutral = true
          a.from = a.to = 0
          a.fadeAt = -1e9
        } else if (reduced) {
          a.neutral = false
          a.from = a.to = a.target
          a.fadeAt = -1e9
        } else {
          a.from = a.neutral ? 0 : cur
          a.neutral = false
          a.to = a.target
          a.fadeAt = a.switchAt
          if (a.target > cur + 0.01) a.hopAt = a.switchAt
          if (a.target === 0 && cur > 0.5) a.lostAt = a.switchAt
        }
        touched = true
      }
      if (!a.applied) animating = true
      const fading = now - a.fadeAt < FADE_MS + WAKE_SPREAD_MS
      const hopping = now - a.hopAt < HOP_MS + WAKE_SPREAD_MS
      const losing = now - a.lostAt < LOST_MS
      const emph = this.emphasis !== null || this.highlight.size > 0 || this.hoverVillage !== null
      if (!(fading || hopping || losing || touched || emph || marking || wasMarking)) continue
      const mark = this.markOf(i, now, reduced)
      if (fading || hopping || losing) animating = true
      const v = this.world.villages[i]
      const zeroEmph = this.emphasis === 'zero' && !a.neutral && a.target === 0
      const hl = this.highlight.has(i)
      const hov = this.hoverVillage === i ? 1 : 0
      for (const k of v.houses) {
        const dk = this.wakeDelay[k]
        const level = levelNow(a, now, dk)
        const hk = (now - a.hopAt - dk) / HOP_MS
        const hop = hk >= 0 && hk <= 1 && !reduced ? Math.sin(Math.PI * hk) * HOP_KM : 0
        const lk = (now - a.lostAt) / LOST_MS
        const lost = Math.max(lk >= 0 && lk <= 1 && !reduced ? 1 - lk : 0, zeroEmph || hl ? 0.85 : 0)
        this.aState.setXYZW(k, level, lost, a.neutral ? 1 : 0, hop)
        this.aInfo.setW(k, hov)
        const r = this.roofOf[k]
        const st = hs[k].kind === 1 ? this.hState : this.gState
        st.setY(r, lost)
        st.setZ(r, hov)
        st.setW(r, hop)
        // 빛 번짐: 단계에 따라 크기·세기. 이웃이 많으면 한 채의 세기를 낮춰 큰 마을이 더 밝아 보이지 않게.
        const norm = 1 / (1 + 0.33 * hs[k].neighbours)
        const l = a.neutral ? 0 : level
        // 주 1~2일은 작고 옅게, 주 3~5일은 크고 밝게: 멀리서도 두 단계가 갈린다(크기 + 세기, 색만이 아니다).
        const size = l <= 0 ? 0 : 0.1 + 0.06 * Math.min(1, l) + 0.17 * Math.max(0, l - 1)
        const inten = l <= 0 ? 0 : (0.22 * Math.min(1, l) + 0.42 * Math.max(0, l - 1)) * norm * (l > 1.5 ? pulse : 1) * (1 + hov * 0.4)
        this.glow.glow.setXY(k, size, inten)
        if (hs[k].kind === 1) this.lamp.glow.setXY(r, 0.13, a.neutral ? 0 : Math.max(0, l - 1) * 0.9)
        this.aMark.setX(k, mark)
        ;(hs[k].kind === 1 ? this.hMark : this.gMark).setX(r, mark)
        const halo = Math.abs(mark) * norm
        this.haloGain.glow.setXY(k, mark > 0 ? 0.2 : 0, mark > 0 ? 0.34 * halo : 0)
        this.haloLoss.glow.setXY(k, mark < 0 ? 0.2 : 0, mark < 0 ? 0.34 * halo : 0)
      }
    }
    if (this.emphasis === 'thick') animating = true
    if (touched || animating) {
      this.aState.needsUpdate = true
      this.aInfo.needsUpdate = true
      this.gState.needsUpdate = true
      this.hState.needsUpdate = true
      this.glow.glow.needsUpdate = true
      this.lamp.glow.needsUpdate = true
      this.aMark.needsUpdate = true
      this.gMark.needsUpdate = true
      this.hMark.needsUpdate = true
      this.haloGain.glow.needsUpdate = true
      this.haloLoss.glow.needsUpdate = true
    }
    return animating || touched
  }
}
