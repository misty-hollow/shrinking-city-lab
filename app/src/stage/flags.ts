/**
 * ▲▼ 깃발(설계안 6-7, 6-16): 증감 모드에서 기준선 대비 마을 진료일 변화. 방향(▲ 좋아짐 / ▼ 나빠짐)이 뜻을 말하고
 * 색은 거든다(파랑 / 갈색-주황, 적록 없음). 크기 3단 = |Δ| 1일 / 2일 / 3일 이상. 마을 빛(상태)과 한 자리에서 함께 읽힌다.
 *
 * 디오라마 안의 작은 표지(설계안 6-18 후속, 2026-10-15): 채도를 낮춘 색 + 얇은 크림 테두리, 지붕 바로 위.
 * 화면 크기를 단계별로 묶는다(반지름 5~9 · 6~11 · 7~13 px): 전체 시점에서도 세 단계가 읽히고, 가까이 봐도 집·창빛을 덮을 만큼
 * 커지지 않는다. 크기 3단의 순서는 그대로다.
 */

import * as THREE from 'three'

import { PALETTE } from './palette'

const RISE_MS = 300

function atlas(): THREE.CanvasTexture | null {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const tri = (cx: number, up: boolean, fill: string) => {
    const s = 50
    ctx.beginPath()
    if (up) {
      ctx.moveTo(cx, 64 - s)
      ctx.lineTo(cx + s * 0.95, 64 + s * 0.72)
      ctx.lineTo(cx - s * 0.95, 64 + s * 0.72)
    } else {
      ctx.moveTo(cx, 64 + s)
      ctx.lineTo(cx + s * 0.95, 64 - s * 0.72)
      ctx.lineTo(cx - s * 0.95, 64 - s * 0.72)
    }
    ctx.closePath()
    ctx.lineJoin = 'round'
    ctx.lineWidth = 11
    ctx.strokeStyle = 'rgba(20,24,28,0.55)'
    ctx.stroke()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#F2ECE0'
    ctx.stroke()
    ctx.fillStyle = fill
    ctx.fill()
  }
  tri(64, true, PALETTE.better)
  tri(192, false, PALETTE.worse)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** 크기 3단(월드 반지름 km)과 화면 하한·상한(반지름 px) */
export const FLAG_SIZES = [0, 0.17, 0.22, 0.28] as const
export const FLAG_MIN_PX = [0, 5, 6, 7] as const
export const FLAG_CAP_PX = [0, 9, 11, 13] as const

export class FlagLayer {
  readonly mesh: THREE.Mesh
  private readonly pos: THREE.InstancedBufferAttribute
  private readonly info: THREE.InstancedBufferAttribute
  private readonly want: Float32Array
  private readonly cap: Float32Array
  private readonly floor: Float32Array
  private readonly kind: Float32Array
  private readonly shown: Float32Array
  private readonly riseAt: Float64Array
  private readonly anchors: THREE.Vector3[]

  /** pxScale: 거리 1에서 월드 1의 화면 px(무대의 uPxScale을 함께 쓴다) */
  constructor(anchors: THREE.Vector3[], pxScale: { value: number }) {
    this.anchors = anchors
    const n = anchors.length
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    this.info = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)
    this.pos.setUsage(THREE.DynamicDrawUsage)
    this.info.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aPos', this.pos)
    geo.setAttribute('aInfo', this.info)
    geo.instanceCount = n
    const tex = atlas()
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uMap: { value: tex }, uPxScale: pxScale },
      vertexShader: /* glsl */ `
        uniform float uPxScale;
        attribute vec3 aPos;
        attribute vec4 aInfo;
        varying vec2 vUv;
        varying float vKind;
        void main() {
          vKind = aInfo.y;
          vUv = position.xy * 0.5 + 0.5;
          vec4 mv = viewMatrix * vec4(aPos, 1.0);
          mv.xyz += normalize(-mv.xyz) * 0.25;
          // 화면 반지름을 [aInfo.w, aInfo.z] px로 묶는다: 멀리서도 읽히고, 가까이 봐도 마을을 덮을 만큼 커지지 않는다
          float px = aInfo.x * uPxScale / max(-mv.z, 0.001);
          float k = aInfo.z > 0.0 ? clamp(px, aInfo.w, aInfo.z) / max(px, 0.001) : 1.0;
          mv.xy += position.xy * aInfo.x * k;
          gl_Position = projectionMatrix * mv;
          if (aInfo.x <= 0.0001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying float vKind;
        void main() {
          vec2 uv = vec2(vUv.x * 0.5 + vKind * 0.5, vUv.y);
          vec4 c = texture2D(uMap, uv);
          if (c.a < 0.02) discard;
          gl_FragColor = c;
          #include <colorspace_fragment>
        }
      `,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 7
    this.want = new Float32Array(n)
    this.cap = new Float32Array(n)
    this.floor = new Float32Array(n)
    this.kind = new Float32Array(n)
    this.shown = new Float32Array(n)
    this.riseAt = new Float64Array(n).fill(-1e9)
  }

  /** size 0 = 없음, 1·2·3 = |Δ| 단계. up = 좋아짐 */
  set(i: number, size: 0 | 1 | 2 | 3, up: boolean, now: number): void {
    const s = FLAG_SIZES[size]
    if (this.want[i] === s && this.kind[i] === (up ? 0 : 1)) return
    if (this.want[i] === 0 && s > 0) this.riseAt[i] = now
    this.want[i] = s
    this.cap[i] = FLAG_CAP_PX[size]
    this.floor[i] = FLAG_MIN_PX[size]
    this.kind[i] = up ? 0 : 1
  }

  update(now: number, reduced: boolean): boolean {
    let animating = false
    for (let i = 0; i < this.anchors.length; i++) {
      const k = reduced ? 1 : Math.min(1, Math.max(0, (now - this.riseAt[i]) / RISE_MS))
      if (k < 1) animating = true
      const e = 1 - (1 - k) ** 3
      const s = this.want[i] * (this.want[i] > 0 ? e : 0)
      const a = this.anchors[i]
      this.pos.setXYZ(i, a.x, a.y + 0.12 + 0.12 * e, a.z)
      // 솟아오르는 동안(e < 1)에는 하한도 같이 줄여 0에서 자란다
      this.info.setXYZW(i, s, this.kind[i], this.cap[i], this.floor[i] * (this.want[i] > 0 ? e : 0))
      this.shown[i] = s
    }
    this.pos.needsUpdate = true
    this.info.needsUpdate = true
    return animating
  }
}
