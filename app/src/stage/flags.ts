/**
 * ▲▼ 깃발(설계안 6-7, 6-16): 증감 모드에서 기준선 대비 마을 진료일 변화. 방향(▲ 좋아짐 / ▼ 나빠짐)이 뜻을 말하고
 * 색은 거든다(파랑 / 갈색-주황, 적록 없음). 크기 3단 = |Δ| 1일 / 2일 / 3일 이상. 마을 빛(상태)과 한 자리에서 함께 읽힌다.
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
    ctx.lineWidth = 14
    ctx.strokeStyle = 'rgba(20,24,28,0.85)'
    ctx.stroke()
    ctx.lineWidth = 7
    ctx.strokeStyle = '#F7F1E6'
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

export class FlagLayer {
  readonly mesh: THREE.Mesh
  private readonly pos: THREE.InstancedBufferAttribute
  private readonly info: THREE.InstancedBufferAttribute
  private readonly want: Float32Array
  private readonly kind: Float32Array
  private readonly shown: Float32Array
  private readonly riseAt: Float64Array
  private readonly anchors: THREE.Vector3[]

  constructor(anchors: THREE.Vector3[]) {
    this.anchors = anchors
    const n = anchors.length
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    this.info = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2)
    this.pos.setUsage(THREE.DynamicDrawUsage)
    this.info.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aPos', this.pos)
    geo.setAttribute('aInfo', this.info)
    geo.instanceCount = n
    const tex = atlas()
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uMap: { value: tex } },
      vertexShader: /* glsl */ `
        attribute vec3 aPos;
        attribute vec2 aInfo;
        varying vec2 vUv;
        varying float vKind;
        void main() {
          vKind = aInfo.y;
          vUv = position.xy * 0.5 + 0.5;
          vec4 mv = viewMatrix * vec4(aPos, 1.0);
          mv.xyz += normalize(-mv.xyz) * 0.25;
          mv.xy += position.xy * aInfo.x;
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
    this.kind = new Float32Array(n)
    this.shown = new Float32Array(n)
    this.riseAt = new Float64Array(n).fill(-1e9)
  }

  /** size 0 = 없음, 1·2·3 = |Δ| 단계. up = 좋아짐 */
  set(i: number, size: 0 | 1 | 2 | 3, up: boolean, now: number): void {
    const s = [0, 0.2, 0.26, 0.33][size]
    if (this.want[i] === s && this.kind[i] === (up ? 0 : 1)) return
    if (this.want[i] === 0 && s > 0) this.riseAt[i] = now
    this.want[i] = s
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
      this.pos.setXYZ(i, a.x, a.y + 0.2 + 0.18 * e, a.z)
      this.info.setXY(i, s, this.kind[i])
      this.shown[i] = s
    }
    this.pos.needsUpdate = true
    this.info.needsUpdate = true
    return animating
  }
}
