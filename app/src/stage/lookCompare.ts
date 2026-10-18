/**
 * [비교 전용 · 개발 서버에서만] `?look=tone,relief`로 켜는, 아직 정하지 않은 두 표현(설계안 6-25 「비교 중」).
 * - tone: 땅·집·나무에 Neutral 톤 처리(빛 번짐·길의 빛·깃발은 그대로).
 * - relief: 지형을 화소마다 비추고(120 m 고도 자료를 부드럽게 늘린 법선) 숲·밭·논에 다른 세기의 표면 결을 준다.
 * 운영 빌드에서는 늘 꺼져 있다. 사용자가 고르면 기본으로 바꾸거나 이 파일을 지운다.
 */

import * as THREE from 'three'

export const LOOK: ReadonlySet<string> = new Set(
  import.meta.env.DEV && typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('look') ?? '').split(',').filter(Boolean) : [],
)

/** 높이 격자를 Catmull-Rom으로 f배 늘려 법선 지도를 만든다(월드 법선을 RGB에). 자료 해상도(120 m)를 넘는 형상은 만들지 않는다 */
export function buildReliefNormalMap(cols: number, rows: number, cellKm: number, nodeY: (r: number, c: number) => number, f = 3): THREE.DataTexture {
  const W = (cols - 1) * f + 1
  const H = (rows - 1) * f + 1
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  const at = (r: number, c: number) => nodeY(Math.min(rows - 1, Math.max(0, r)), Math.min(cols - 1, Math.max(0, c)))
  const hf = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    const fr = y / f
    const r = Math.floor(fr)
    const ty = fr - r
    for (let x = 0; x < W; x++) {
      const fc = x / f
      const c = Math.floor(fc)
      const tx = fc - c
      const row = (rr: number) => cr(at(rr, c - 1), at(rr, c), at(rr, c + 1), at(rr, c + 2), tx)
      hf[y * W + x] = cr(row(r - 1), row(r), row(r + 1), row(r + 2), ty)
    }
  }
  const step = cellKm / f
  const data = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const xp = hf[y * W + Math.min(W - 1, x + 1)]
      const xm = hf[y * W + Math.max(0, x - 1)]
      const yp = hf[Math.min(H - 1, y + 1) * W + x]
      const ym = hf[Math.max(0, y - 1) * W + x]
      let nx = -(xp - xm) / (2 * step)
      let ny = 1
      let nz = (yp - ym) / (2 * step)
      const l = Math.hypot(nx, ny, nz)
      nx /= l
      ny /= l
      nz /= l
      const o = (y * W + x) * 4
      data[o] = Math.round((nx * 0.5 + 0.5) * 255)
      data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      data[o + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      data[o + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat)
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

/** 땅 종류 무게(격자 해상도): R 숲 · G 밭 · B 논 · A 물 */
export function buildMaterialMask(cols: number, rows: number, land: Uint8Array, forest: number, field: number, paddy: number, water: number): THREE.DataTexture {
  const data = new Uint8Array(cols * rows * 4)
  for (let k = 0; k < cols * rows; k++) {
    const v = land[k]
    data[k * 4] = v === forest ? 255 : 0
    data[k * 4 + 1] = v === field ? 255 : 0
    data[k * 4 + 2] = v === paddy ? 255 : 0
    data[k * 4 + 3] = v === water ? 255 : 0
  }
  const t = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat)
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

/** 이어 붙는 잔결 법선(256², 값 잡음 3겹). RG = 기울기(−1..1), B = 높이 */
export function buildBumpTexture(size = 256): THREE.DataTexture {
  const lattice = (g: number, seed: number) => {
    const v = new Float32Array(g * g)
    let s = seed
    for (let k = 0; k < v.length; k++) {
      s = (s * 1664525 + 1013904223) >>> 0
      v[k] = s / 4294967296
    }
    return (x: number, y: number) => {
      const xi = Math.floor(x)
      const yi = Math.floor(y)
      const tx = x - xi
      const ty = y - yi
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const a = v[((yi % g) + g) % g * g + (((xi % g) + g) % g)]
      const b = v[((yi % g) + g) % g * g + ((((xi + 1) % g) + g) % g)]
      const c = v[((((yi + 1) % g) + g) % g) * g + (((xi % g) + g) % g)]
      const d = v[((((yi + 1) % g) + g) % g) * g + ((((xi + 1) % g) + g) % g)]
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
    }
  }
  const oct = [lattice(16, 7), lattice(32, 11), lattice(64, 13)]
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0
      let amp = 0.55
      oct.forEach((fn, i) => {
        const g = 16 << i
        v += fn((x / size) * g, (y / size) * g) * amp
        amp *= 0.5
      })
      h[y * size + x] = v
    }
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)]
      const dy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x]
      const o = (y * size + x) * 4
      data[o] = Math.max(0, Math.min(255, Math.round((-dx * 6 * 0.5 + 0.5) * 255)))
      data[o + 1] = Math.max(0, Math.min(255, Math.round((-dy * 6 * 0.5 + 0.5) * 255)))
      data[o + 2] = Math.round(Math.max(0, Math.min(1, h[y * size + x])) * 255)
      data[o + 3] = 255
    }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.needsUpdate = true
  return t
}

/**
 * 지형을 화소마다 비춘다: 법선 = 늘린 높이 법선 + 땅 종류별 잔결(숲 > 밭 > 논, 물 없음, 멀어지면 줄어든다).
 * 빛 식은 정점에 굽던 것과 같다(하늘·흙 반사 × AO + 해 × 굽은 그늘 × 그림자 맵). 정점 빛으로 나눠 바꿔 낀다.
 */
export function patchTerrainRelief(
  mat: THREE.MeshBasicMaterial,
  uniforms: Record<string, { value: unknown }>,
  lightGlsl: string,
  tex: { normal: THREE.Texture; mask: THREE.Texture; bump: THREE.Texture },
): void {
  const prev = mat.onBeforeCompile
  const own = {
    uReliefN: { value: tex.normal },
    uReliefMask: { value: tex.mask },
    uReliefBump: { value: tex.bump },
    uBumpScale: { value: 1 / 0.09 },
    uBumpAmp: { value: new THREE.Vector4(0.5, 0.22, 0.08, 0.0) },
  }
  mat.onBeforeCompile = (shader, r) => {
    prev.call(mat, shader, r)
    Object.assign(shader.uniforms, uniforms, own)
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute vec2 aSA;\nvarying vec2 vSA;\nvarying vec3 vWP;\nvoid main() {\n  vSA = aSA;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `${lightGlsl}
uniform sampler2D uReliefN;
uniform sampler2D uReliefMask;
uniform sampler2D uReliefBump;
uniform float uBumpScale;
uniform vec4 uBumpAmp;
varying vec2 vSA;
void main() {`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
    vec3 nB = texture2D(uReliefN, vMapUv).xyz * 2.0 - 1.0;
    vec4 mm = texture2D(uReliefMask, vMapUv);
    vec2 g = texture2D(uReliefBump, vWP.xz * uBumpScale).xy * 2.0 - 1.0;
    vec2 g2 = texture2D(uReliefBump, vWP.xz * uBumpScale * 0.31 + 0.37).xy * 2.0 - 1.0;
    float amp = dot(mm, uBumpAmp);
    #ifdef USE_FOG
    amp *= 1.0 - smoothstep(18.0, 70.0, vFogDepth);
    #endif
    vec3 n = normalize(nB + vec3(g.x + g2.x * 0.6, 0.0, g.y + g2.y * 0.6) * amp);
    float cs = castShadow(vWP, nB);
    float ndl = max(dot(n, uSunDir), 0.0);
    vec3 amb = mix(uGroundColor, uSkyColor, 0.5 + 0.5 * n.y) * vSA.y;
    vec3 L = amb + uSunColor * ndl * vSA.x * cs;
    outgoingLight *= L / max(vColor.rgb, vec3(1e-3));
  }
  #include <opaque_fragment>`,
      )
  }
  mat.needsUpdate = true
}
