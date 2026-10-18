/**
 * S6 겹쳐 보기의 세 칸 기호(설계안 6-19): 배분에 따라 갈리는 마을 위에 작은 판 하나. 칸 셋 = 미션 1·2·3(왼쪽부터),
 * 켜진 칸(호박) = 그 배분에서 주 1일 이상 닿음, 꺼진 칸(슬레이트) = 주 1일 미만. 색만이 아니라 칸의 자리로 어느 배분인지 읽힌다.
 * 다른 갈래(모두 닿음 · 모두 닿지 않음 · 지소 없음)는 기호를 띄우지 않는다: 창 불빛과 판의 갈래 줄, 갈래를 고르면 청록으로 서는 집이 말한다.
 *
 * 판은 늘 카메라를 보고, 화면 크기를 반지름 10~15 px로 묶어 멀리서도 읽히고 가까이서도 집을 덮지 않는다.
 * 깜박이거나 움직이지 않는다. 드로우 하나(인스턴스).
 */

import * as THREE from 'three'

import { PALETTE } from './palette'

/** 판의 반지름: 월드(km)와 화면 하한·상한(px). 높이는 폭의 0.42 */
export const OVERLAP_MARK_KM = 0.2
export const OVERLAP_MARK_MIN_PX = 10
export const OVERLAP_MARK_MAX_PX = 15
const ASPECT = 0.42

export class OverlapMarks {
  readonly mesh: THREE.Mesh
  private readonly pos: THREE.InstancedBufferAttribute
  private readonly info: THREE.InstancedBufferAttribute
  private readonly anchors: THREE.Vector3[]
  private dirty = true

  constructor(anchors: THREE.Vector3[], pxScale: { value: number }) {
    this.anchors = anchors
    const n = anchors.length
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
    geo.setIndex([0, 1, 2, 0, 2, 3])
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
    this.info = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2)
    geo.setAttribute('aPos', this.pos)
    geo.setAttribute('aInfo', this.info)
    geo.instanceCount = n
    anchors.forEach((a, i) => this.pos.setXYZ(i, a.x, a.y + 0.16, a.z))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uPxScale: pxScale,
        uOn: { value: new THREE.Color('#F2B84B') },
        uOff: { value: new THREE.Color(PALETTE.markOff) },
        uPlate: { value: new THREE.Color('#1B1D21') },
        uEdge: { value: new THREE.Color('#EEE7DA') },
      },
      vertexShader: /* glsl */ `
        uniform float uPxScale;
        attribute vec3 aPos;
        attribute vec2 aInfo;
        varying vec2 vUv;
        varying float vMask;
        varying float vPx;
        void main() {
          vMask = aInfo.x;
          vUv = position.xy;
          vec4 mv = viewMatrix * vec4(aPos, 1.0);
          mv.xyz += normalize(-mv.xyz) * 0.3;
          float depth = max(-mv.z, 0.001);
          float px = clamp(${OVERLAP_MARK_KM.toFixed(3)} * uPxScale / depth, ${OVERLAP_MARK_MIN_PX.toFixed(1)}, ${OVERLAP_MARK_MAX_PX.toFixed(1)});
          vPx = px;
          float w = px * depth / uPxScale;
          mv.xy += vec2(position.x * w, position.y * w * ${ASPECT.toFixed(2)});
          gl_Position = projectionMatrix * mv;
          if (aInfo.y < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uOn;
        uniform vec3 uOff;
        uniform vec3 uPlate;
        uniform vec3 uEdge;
        varying vec2 vUv;
        varying float vMask;
        varying float vPx;
        float box(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b + r;
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
        }
        void main() {
          // 판 좌표를 px로: x ∈ [-vPx, vPx], y ∈ [-vPx·0.42, vPx·0.42]
          vec2 p = vec2(vUv.x * vPx, vUv.y * vPx * ${ASPECT.toFixed(2)});
          vec2 hb = vec2(vPx, vPx * ${ASPECT.toFixed(2)});
          float plate = box(p, hb - 0.5, 2.0);
          if (plate > 0.5) discard;
          vec3 col = uPlate;
          float a = 0.86;
          // 얇은 크림 테두리
          col = mix(col, uEdge, smoothstep(-1.4, -0.4, plate) * 0.85);
          float cw = (hb.x * 2.0 - 4.0) / 3.0;
          for (int k = 0; k < 3; k++) {
            float cx = -hb.x + 2.0 + cw * (float(k) + 0.5);
            float d = box(p - vec2(cx, 0.0), vec2(cw * 0.5 - 1.0, hb.y - 2.4), 1.0);
            float inside = 1.0 - smoothstep(-0.5, 0.5, d);
            float on = mod(floor(vMask / pow(2.0, float(k))), 2.0);
            col = mix(col, on > 0.5 ? uOn : uOff, inside);
          }
          gl_FragColor = vec4(col, a * (1.0 - smoothstep(-0.5, 0.5, plate)));
          #include <colorspace_fragment>
        }
      `,
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 7
  }

  /** 마을 i의 기호: mask = 배분마다 닿음 비트(미션 1 = 비트 0), null이면 띄우지 않는다 */
  set(i: number, mask: number | null): void {
    const show = mask === null ? 0 : 1
    const m = mask ?? 0
    if (this.info.getX(i) === m && this.info.getY(i) === show) return
    this.info.setXY(i, m, show)
    this.dirty = true
  }

  /** 띄운 기호 수(검사용) */
  count(): number {
    let n = 0
    for (let i = 0; i < this.anchors.length; i++) if (this.info.getY(i) > 0.5) n++
    return n
  }

  /** 바뀐 것이 있으면 올린다. 그렸어야 하면 참 */
  flush(): boolean {
    if (!this.dirty) return false
    this.dirty = false
    this.info.needsUpdate = true
    this.pos.needsUpdate = true
    return true
  }
}
