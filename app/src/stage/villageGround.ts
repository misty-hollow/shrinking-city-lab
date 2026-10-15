/**
 * 마을 받침(설계안 6-18 P2): 집 묶음 발치의 마을 터가 그 마을의 단계(창 불빛과 같은 tierOf)를 한 번 더 말한다.
 *
 *   주 1일 미만(닿지 않음)  슬레이트 테두리만 — 빈 고리. 안쪽은 맨땅 그대로다(사람이 사는 마을 터).
 *   주 1~2일(1 ≤ A < 3)     호박 테두리 + 서쪽 절반을 채운다 — 반 채움.
 *   주 3~5일(A ≥ 3)         호박 테두리 + 가득 채운다.
 *
 * 새 계산이 없다: 단계는 집의 창과 같은 값(HouseLayer의 보이는 단계)을 그대로 받는다. 빛이 닿는 순간 함께 바뀐다.
 * 모양은 집마다 둥근 마당을 합친 것이라 집 묶음을 따라간다(마을 중심의 원·서비스권이 아니다). 다른 마을의 받침과는
 * 틈을 두고, 보건지소 터에는 깔지 않는다.
 *
 * 그리는 법: 받침 모양(부호 거리)과 마을 번호를 땅 그림과 같은 좌표의 작은 텍스처로 한 번 굽고, 지형 재질이 그것을 읽어
 * 칠한다. 드로우가 늘지 않고 지형에 꼭 붙는다. 밉맵을 만들지 않는다(GPU 밉맵 생성에 기대지 않는다, terrainBake 참고).
 */

import * as THREE from 'three'

import type { Heightmap } from './terrain'
import { R_WATER, type World } from './world'

/** 굽는 격자 한 칸(km) */
export const GROUND_TEXEL_KM = 0.025
/** 집 한 채의 마당 반지름(km). 물가 집은 좁힌다 */
export const YARD_KM = 0.16
const YARD_WET_KM = 0.11
/** 같은 마을 집 사이를 잇는 정도(km): 마당을 이만큼 넓혔다가 다시 줄인다(닫기). 집이 0.5 km 안팎이면 한 터가 된다 */
export const BRIDGE_KM = 0.1
/** 다른 마을 받침 사이의 틈(km) */
export const GROUND_GAP_KM = 0.08
/** 보건지소 둘레(건물·앞마당·탑)에는 받침을 깔지 않는다(km) */
export const CLINIC_CLEAR_KM = 0.36
/** 부호 거리를 담는 범위(±km, 8비트 1 m) */
const SDF_RANGE = 0.127
/** 서쪽/동쪽 좌표를 담는 범위(±km, 8비트 1 cm 단위 100) */
const SIDE_RANGE = 1.27

export interface GroundBake {
  cols: number
  rows: number
  /** RG: 부호 거리(안쪽 음수) · 마을 무게중심 기준 동서 좌표 */
  sdf: Uint8Array
  /** R: 마을 번호 + 1 (0 = 받침 없음). 받침 바깥 가까이까지 같은 번호를 채워 경계에서 보간이 섞이지 않게 한다 */
  id: Uint8Array
}

export function encodeSdf(km: number): number {
  return Math.max(0, Math.min(255, Math.round(128 + Math.max(-SDF_RANGE, Math.min(SDF_RANGE, km)) * 1000)))
}

export function decodeSdf(v: number): number {
  return (v - 128) / 1000
}

const INF = 1e20

/** 1차원 제곱 거리 변환(Felzenszwalb–Huttenlocher). f: 0 = 특징, INF = 아님 */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}

/** 격자(w×h) 위 특징 칸까지의 유클리드 거리(칸 단위) */
export function distanceTransform(feature: Uint8Array, w: number, h: number): Float64Array {
  const g = new Float64Array(w * h)
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = feature[y * w + x] ? 0 : INF
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) g[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x])
  }
  return g
}

/**
 * 받침 모양을 굽는다(세계와 높이 격자에서 한 번, 늘 같은 결과).
 * 마을마다: 집 마당(반지름 YARD)의 합을 BRIDGE만큼 넓혔다 줄여(닫기) 한 터로 잇고, 그 부호 거리를 잰다.
 * 그다음 가장 가까운 두 마을 사이에 틈을 두고, 보건지소 둘레를 비운다.
 */
export function bakeVillageGround(world: World, hm: Heightmap): GroundBake {
  const T = GROUND_TEXEL_KM
  const cols = Math.ceil(hm.width / T)
  const rows = Math.ceil(hm.height / T)
  const n = cols * rows
  const best1 = new Float32Array(n).fill(INF)
  const best2 = new Float32Array(n).fill(INF)
  const v1 = new Int16Array(n).fill(-1)
  const cx = (c: number) => hm.x0 + ((c + 0.5) / cols) * hm.width
  const cy = (r: number) => hm.y0 + ((r + 0.5) / rows) * hm.height
  const pad = YARD_KM + BRIDGE_KM + SDF_RANGE + 2 * T
  for (const site of world.villages) {
    const hs = site.houses.map((k) => world.houses[k])
    const rad = hs.map((h) => (world.raster.near(h.x, h.y, YARD_KM, R_WATER) ? YARD_WET_KM : YARD_KM))
    let minx = Infinity
    let miny = Infinity
    let maxx = -Infinity
    let maxy = -Infinity
    for (const h of hs) {
      minx = Math.min(minx, h.x)
      miny = Math.min(miny, h.y)
      maxx = Math.max(maxx, h.x)
      maxy = Math.max(maxy, h.y)
    }
    const c0 = Math.max(0, Math.floor(((minx - pad - hm.x0) / hm.width) * cols))
    const c1 = Math.min(cols - 1, Math.ceil(((maxx + pad - hm.x0) / hm.width) * cols))
    const r0 = Math.max(0, Math.floor(((miny - pad - hm.y0) / hm.height) * rows))
    const r1 = Math.min(rows - 1, Math.ceil(((maxy + pad - hm.y0) / hm.height) * rows))
    const w = c1 - c0 + 1
    const h = r1 - r0 + 1
    // 넓힌 마당(반지름 + BRIDGE)의 합: 집마다 원을 찍는다
    const wide = new Uint8Array(w * h)
    for (let q = 0; q < hs.length; q++) {
      const rr = rad[q] + BRIDGE_KM
      const qc0 = Math.max(0, Math.floor(((hs[q].x - rr - hm.x0) / hm.width) * cols) - c0)
      const qc1 = Math.min(w - 1, Math.ceil(((hs[q].x + rr - hm.x0) / hm.width) * cols) - c0)
      const qr0 = Math.max(0, Math.floor(((hs[q].y - rr - hm.y0) / hm.height) * rows) - r0)
      const qr1 = Math.min(h - 1, Math.ceil(((hs[q].y + rr - hm.y0) / hm.height) * rows) - r0)
      for (let r = qr0; r <= qr1; r++) {
        const dy = cy(r0 + r) - hs[q].y
        for (let c = qc0; c <= qc1; c++) {
          const dx = cx(c0 + c) - hs[q].x
          if (dx * dx + dy * dy <= rr * rr) wide[r * w + c] = 1
        }
      }
    }
    // 다시 BRIDGE만큼 줄인다: 바깥까지 거리 ≥ BRIDGE인 칸이 받침
    const outside = new Uint8Array(w * h)
    for (let k = 0; k < w * h; k++) outside[k] = wide[k] ? 0 : 1
    const depth = distanceTransform(outside, w, h)
    const inside = new Uint8Array(w * h)
    const notIn = new Uint8Array(w * h)
    for (let k = 0; k < w * h; k++) {
      inside[k] = wide[k] && depth[k] * T >= BRIDGE_KM ? 1 : 0
      notIn[k] = 1 - inside[k]
    }
    const dOut = distanceTransform(inside, w, h)
    const dIn = distanceTransform(notIn, w, h)
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const k = r * w + c
        // 칸 중심 사이 거리라 반 칸을 빼 경계를 가운데에 둔다
        const sd = (inside[k] ? -(dIn[k] - 0.5) : dOut[k] - 0.5) * T
        if (sd > SDF_RANGE) continue
        const g = (r0 + r) * cols + (c0 + c)
        if (v1[g] === site.i) {
          if (sd < best1[g]) best1[g] = sd
        } else if (sd < best1[g]) {
          best2[g] = best1[g]
          best1[g] = sd
          v1[g] = site.i
        } else if (sd < best2[g]) best2[g] = sd
      }
    }
  }
  // 다른 마을과의 틈: 두 마을 가장자리의 가운데에서 GAP만큼 비운다(best1을 최종 부호 거리로 덮어쓴다)
  for (let k = 0; k < n; k++) {
    if (v1[k] >= 0 && best2[k] < INF) best1[k] = Math.max(best1[k], (GROUND_GAP_KM - (best2[k] - best1[k])) / 2)
  }
  // 보건지소 둘레(건물·앞마당과 탑)를 비운다
  const clinicReach = CLINIC_CLEAR_KM + SDF_RANGE
  for (const cl of world.clinics) {
    for (const [px0, py0, clear] of [
      [cl.x, cl.y, CLINIC_CLEAR_KM],
      [cl.mastX, cl.mastY, CLINIC_CLEAR_KM * 0.6],
    ]) {
      const cc0 = Math.max(0, Math.floor(((px0 - clinicReach - hm.x0) / hm.width) * cols))
      const cc1 = Math.min(cols - 1, Math.ceil(((px0 + clinicReach - hm.x0) / hm.width) * cols))
      const rr0 = Math.max(0, Math.floor(((py0 - clinicReach - hm.y0) / hm.height) * rows))
      const rr1 = Math.min(rows - 1, Math.ceil(((py0 + clinicReach - hm.y0) / hm.height) * rows))
      for (let rr = rr0; rr <= rr1; rr++) {
        const dy = cy(rr) - py0
        for (let cc = cc0; cc <= cc1; cc++) {
          const k = rr * cols + cc
          if (v1[k] < 0) continue
          const dx = cx(cc) - px0
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < clinicReach) best1[k] = Math.max(best1[k], clear - d)
        }
      }
    }
  }
  // 담기. 받침이 없는 칸(id = 0)도 RG를 "바깥"(부호 거리 +최대, 동서 0)으로 채운다: 셰이더는 RG를 선형 보간하므로
  // 받침 가장자리 바깥 칸이 0(= 깊은 안쪽)이면 경계에서 값이 0을 지나 받침 바깥 약 0.13 km에 점선 고리가 생긴다(2026-10-15 수정).
  const sdf = new Uint8Array(n * 2)
  for (let k = 0; k < n; k++) {
    sdf[k * 2] = 255
    sdf[k * 2 + 1] = 128
  }
  const id = new Uint8Array(n)
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      const k = rr * cols + cc
      if (v1[k] < 0) continue
      const v = world.villages[v1[k]]
      sdf[k * 2] = encodeSdf(best1[k])
      sdf[k * 2 + 1] = Math.max(0, Math.min(255, Math.round(128 + Math.max(-SIDE_RANGE, Math.min(SIDE_RANGE, cx(cc) - v.mx)) * 100)))
      id[k] = v1[k] + 1
    }
  }
  return { cols, rows, sdf, id }
}

/** 받침을 지형 재질에 붙인다: 모양 텍스처 둘 + 마을 상태 텍스처(256×1, 단계·보임). */
export class VillageGround {
  readonly sdfTex: THREE.DataTexture
  readonly idTex: THREE.DataTexture
  readonly stateTex: THREE.DataTexture
  private readonly state = new Uint8Array(256 * 4)
  private changed = false

  constructor(bake: GroundBake) {
    this.sdfTex = new THREE.DataTexture(bake.sdf, bake.cols, bake.rows, THREE.RGFormat, THREE.UnsignedByteType)
    this.sdfTex.magFilter = THREE.LinearFilter
    this.sdfTex.minFilter = THREE.LinearFilter
    this.idTex = new THREE.DataTexture(bake.id, bake.cols, bake.rows, THREE.RedFormat, THREE.UnsignedByteType)
    this.idTex.magFilter = THREE.NearestFilter
    this.idTex.minFilter = THREE.NearestFilter
    this.stateTex = new THREE.DataTexture(this.state, 256, 1, THREE.RGBAFormat, THREE.UnsignedByteType)
    this.stateTex.magFilter = THREE.NearestFilter
    this.stateTex.minFilter = THREE.NearestFilter
    for (const t of [this.sdfTex, this.idTex, this.stateTex]) {
      t.generateMipmaps = false
      t.wrapS = THREE.ClampToEdgeWrapping
      t.wrapT = THREE.ClampToEdgeWrapping
      t.unpackAlignment = 1
      t.colorSpace = THREE.NoColorSpace
      t.needsUpdate = true
    }
  }

  /** 마을 i의 보이는 단계(0..2 실수, 집의 창과 같은 값)와 보임(소개 화면은 받침이 없다) */
  set(i: number, level: number, visible: boolean): void {
    const r = Math.round(Math.max(0, Math.min(2, level)) * 127.5)
    const g = visible ? 255 : 0
    const o = i * 4
    if (this.state[o] === r && this.state[o + 1] === g) return
    this.state[o] = r
    this.state[o + 1] = g
    this.changed = true
  }

  /**
   * 그리는 방식(S6 겹쳐 보기, 설계안 6-19·6-20): 0 보통 · 1 받침 없음 · 2 울타리(기준 안에 지소 없음, 회색 테두리 두 겹)
   * · 3 강조(판에서 고른 갈래의 마을 — 청록 테두리와 옅은 채움, 선택 색이며 데이터 색이 아니다). 미션 하나를 볼 때와 그 밖의 화면은 늘 0이다.
   */
  setStyle(i: number, style: GroundStyle): void {
    const o = i * 4 + 2
    if (this.state[o] === style) return
    this.state[o] = style
    this.changed = true
  }

  /** 지금 올라간 값(검사용): 단계 0..2, 보임, 그리는 방식 */
  read(i: number): { level: number; visible: boolean; style: GroundStyle } {
    return { level: this.state[i * 4] / 127.5, visible: this.state[i * 4 + 1] > 0, style: this.state[i * 4 + 2] as GroundStyle }
  }

  /** 바뀐 것이 있으면 올린다. 그렸어야 하면 참 */
  flush(): boolean {
    if (!this.changed) return false
    this.changed = false
    this.stateTex.needsUpdate = true
    return true
  }
}

export type GroundStyle = 0 | 1 | 2 | 3

/** 받침 색(선형 RGB로 바꿔 넘긴다). 호박은 데이터의 빛 계열, 슬레이트는 꺼진 창 계열이다. */
export const GROUND_COLORS = {
  fill: '#F0CC86',
  rimLit: '#D7A657',
  rimOff: '#45505B',
  /** 울타리(기준 안에 지소 없음): 데이터의 빛도 꺼진 창도 아닌 옅은 회색 */
  fence: '#AEB2B6',
  /** 강조(S6 겹쳐 보기에서 고른 갈래): 선택·포커스 색(palette select) */
  focus: '#8FD6CB',
} as const

/**
 * 받침이 집·창빛·길의 빛보다 앞에 나서지 않게: 테두리 폭(km, 화면 최소 px 배율)과 칠하는 세기.
 * 호박 테두리(빛과 같은 계열)는 옅게, 닿지 않음의 슬레이트 테두리는 상태를 말하는 유일한 표시라 또렷하게 둔다.
 */
export const GROUND_RIM_KM = 0.028
export const GROUND_RIM_PX = 1.4
export const GROUND_RIM_ALPHA_LIT = 0.7
export const GROUND_RIM_ALPHA_OFF = 0.9
export const GROUND_FILL_ALPHA = 0.8

/**
 * 지형 재질(MeshBasicMaterial + 땅 그림 + 굽은 빛)에 받침을 칠하는 조각을 끼운다.
 * 채움은 굽은 빛을 절반만 받는다(골짜기 그늘에서도 불 켜진 마을 터로 읽히게). 테두리 바깥에 아주 옅은 접지 그늘을 둔다.
 */
export function attachVillageGround(mat: THREE.MeshBasicMaterial, g: VillageGround): void {
  const uniforms = {
    uVgSdf: { value: g.sdfTex },
    uVgId: { value: g.idTex },
    uVgState: { value: g.stateTex },
    uVgFill: { value: new THREE.Color(GROUND_COLORS.fill) },
    uVgRimLit: { value: new THREE.Color(GROUND_COLORS.rimLit) },
    uVgRimOff: { value: new THREE.Color(GROUND_COLORS.rimOff) },
    uVgFence: { value: new THREE.Color(GROUND_COLORS.fence) },
    uVgFocus: { value: new THREE.Color(GROUND_COLORS.focus) },
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        /* glsl */ `
uniform sampler2D uVgSdf;
uniform sampler2D uVgId;
uniform sampler2D uVgState;
uniform vec3 uVgFill;
uniform vec3 uVgRimLit;
uniform vec3 uVgRimOff;
uniform vec3 uVgFence;
uniform vec3 uVgFocus;
void main() {`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
  {
    vec2 vg = texture2D(uVgSdf, vMapUv).rg;
    float vid = floor(texture2D(uVgId, vMapUv).r * 255.0 + 0.5);
    if (vid > 0.5) {
      vec4 st = texture2D(uVgState, vec2((vid - 0.5) / 256.0, 0.5));
      float level = st.r * 2.0;
      float style = floor(st.b * 255.0 + 0.5);
      float vis = style > 0.5 && style < 1.5 ? 0.0 : st.g;
      float fence = style > 1.5 && style < 2.5 ? 1.0 : 0.0;
      float focus = style > 2.5 ? 1.0 : 0.0;
      float s = (vg.r * 255.0 - 128.0) / 1000.0;
      float side = (vg.g * 255.0 - 128.0) / 100.0;
      float aa = max(fwidth(s), 0.002);
      float aaSide = max(fwidth(side), 0.002);
      float rimW = max(${GROUND_RIM_KM.toFixed(3)}, aa * ${GROUND_RIM_PX.toFixed(2)});
      float inside = 1.0 - smoothstep(-aa, aa, s);
      float rim = inside * smoothstep(-rimW - aa, -rimW + aa, s);
      float west = 1.0 - smoothstep(-aaSide, aaSide, side);
      float lit = clamp(level, 0.0, 1.0);
      float fill = level <= 1.0 ? west * lit : mix(west, 1.0, level - 1.0);
      vec3 lift = mix(vColor.rgb, vec3(1.0), 0.5) * diffuse;
      vec3 c = diffuseColor.rgb;
      // 접지 그늘: 테두리 바로 바깥
      c *= 1.0 - vis * 0.1 * (1.0 - smoothstep(0.0, 0.035, s)) * (1.0 - inside);
      c = mix(c, uVgFill * lift, vis * inside * (1.0 - rim) * fill * ${GROUND_FILL_ALPHA.toFixed(2)});
      vec3 rimCol = mix(uVgRimOff * mix(vColor.rgb, vec3(1.0), 0.25) * diffuse, uVgRimLit * lift, lit);
      // 울타리: 회색 테두리 두 겹(받침 테두리 + 바깥으로 한 폭 띄운 고리). 안쪽 고리는 집에 가려지므로 바깥에 둔다.
      // 색만이 아니라 모양(두 겹)으로 빈 고리와 갈린다
      float rim2 = smoothstep(rimW * 1.0 - aa, rimW * 1.0 + aa, s) * (1.0 - smoothstep(rimW * 2.0 - aa, rimW * 2.0 + aa, s));
      rimCol = mix(rimCol, uVgFence * lift, fence);
      c = mix(c, rimCol, vis * rim * mix(${GROUND_RIM_ALPHA_OFF.toFixed(2)}, ${GROUND_RIM_ALPHA_LIT.toFixed(2)}, lit));
      c = mix(c, uVgFence * lift, vis * fence * rim2 * ${GROUND_RIM_ALPHA_OFF.toFixed(2)});
      // 강조: 단계와 상관없이 청록 테두리 + 옅은 채움(마을 터 전체). 판의 갈래 줄을 누르면 그 마을들이 지도에서 보인다
      c = mix(c, uVgFocus * lift, vis * focus * inside * (1.0 - rim) * 0.6);
      c = mix(c, uVgFocus * lift, vis * focus * rim);
      // 바깥 고리 한 겹(울타리와 같은 자리): 전체 시점에서도 강조한 마을이 보이게
      c = mix(c, uVgFocus * lift, vis * focus * rim2 * 0.85);
      diffuseColor.rgb = c;
    }
  }`,
      )
  }
  mat.needsUpdate = true
}
