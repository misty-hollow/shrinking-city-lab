/**
 * 해 그림자(설계안 6-25): 서남서의 낮은 해에서 본 깊이 한 장으로 집·나무·지소가 땅과 서로에게 부드러운 그림자를 드리운다.
 * - 그늘은 해의 몫만 뺀다(하늘빛은 남는다): 검게 되지 않고, 세기도 75%로 묶어 해질녘의 따뜻함을 지킨다.
 * - 창 불빛·회관 문등·진료등 켜진 칸·빛 번짐·길의 빛은 빛을 받는 재질이 아니라 그림자와 상관없다(데이터는 그늘에 묻히지 않는다).
 * - 그림자 영역은 카메라가 보는 땅에 맞춘다(확대할수록 선명). 물체는 고정이라 카메라·건물이 바뀔 때만 다시 그린다.
 * - 적응 화질의 첫 단계에서 끈다(uShadowOn = 0).
 */

import * as THREE from 'three'

import { SUN_DIR } from './palette'

export interface ShadowUniforms {
  uShadowMap: { value: THREE.Texture | null }
  uShadowMat: { value: THREE.Matrix4 }
  uShadowOn: { value: number }
  uShadowTexel: { value: THREE.Vector2 }
  uShadowStrength: { value: number }
  uShadowSoft: { value: number }
}

export function makeShadowUniforms(): ShadowUniforms {
  return {
    uShadowMap: { value: null },
    uShadowMat: { value: new THREE.Matrix4() },
    uShadowOn: { value: 0 },
    uShadowTexel: { value: new THREE.Vector2(1 / 4096, 1 / 4096) },
    uShadowStrength: { value: 0.75 },
    uShadowSoft: { value: 2.6 },
  }
}

/** 조각 셰이더 공용: 월드 위치의 해 그림자(1 = 해 받음, 0 = 그늘). 16점 포아송 + 화소마다 돌린 무늬로 부드럽게 */
export const SHADOW_GLSL = /* glsl */ `
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat;
uniform float uShadowOn;
uniform vec2 uShadowTexel;
uniform float uShadowStrength;
uniform float uShadowSoft;
const vec2 SH_POISSON[16] = vec2[16](
  vec2(-0.94201624, -0.39906216), vec2(0.94558609, -0.76890725), vec2(-0.09418410, -0.92938870), vec2(0.34495938, 0.29387760),
  vec2(-0.91588581, 0.45771432), vec2(-0.81544232, -0.87912464), vec2(-0.38277543, 0.27676845), vec2(0.97484398, 0.75648379),
  vec2(0.44323325, -0.97511554), vec2(0.53742981, -0.47373420), vec2(-0.26496911, -0.41893023), vec2(0.79197514, 0.19090188),
  vec2(-0.24188840, 0.99706507), vec2(-0.81409955, 0.91437590), vec2(0.19984126, 0.78641367), vec2(0.14383161, -0.14100790)
);
float castShadow(vec3 wp, vec3 n) {
  if (uShadowOn < 0.5) return 1.0;
  vec4 lp = uShadowMat * vec4(wp + n * 0.012, 1.0);
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float ang = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  float sum = 0.0;
  for (int i = 0; i < 16; i++) {
    vec2 o = rot * SH_POISSON[i] * uShadowTexel * uShadowSoft;
    float d = texture2D(uShadowMap, p.xy + o).r;
    sum += step(p.z - 0.0008, d);
  }
  return mix(1.0, sum / 16.0, uShadowStrength);
}
`

/**
 * 해에서 본 깊이 한 장. 카메라가 보는 땅(섬 윗면 높이에서 화면 네 귀퉁이 광선이 닿는 곳)을 덮게 잡는다.
 * 물체는 고정이라 카메라나 건물이 바뀔 때만 다시 그린다.
 */
export class SunShadow {
  readonly rt: THREE.WebGLRenderTarget
  readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400)
  private readonly depthMat = new THREE.MeshDepthMaterial()
  private readonly dir = new THREE.Vector3(...SUN_DIR).normalize()
  private key = ''
  dirty = true

  readonly size: number
  private readonly su: ShadowUniforms
  private readonly bounds: { cx: number; cz: number; hw: number; hd: number }

  constructor(size: number, su: ShadowUniforms, bounds: { cx: number; cz: number; hw: number; hd: number }) {
    this.size = size
    this.su = su
    this.bounds = bounds
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true })
    this.rt.depthTexture = new THREE.DepthTexture(size, size, THREE.FloatType)
    this.rt.depthTexture.minFilter = THREE.NearestFilter
    this.rt.depthTexture.magFilter = THREE.NearestFilter
    this.cam.layers.set(1)
    su.uShadowMap.value = this.rt.depthTexture
    su.uShadowTexel.value.set(1 / size, 1 / size)
    su.uShadowOn.value = 1
  }

  /** 보는 카메라에 맞춰 그림자 영역을 잡고, 바뀌었거나 dirty면 다시 그린다 */
  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, view: THREE.PerspectiveCamera): boolean {
    const pts: THREE.Vector3[] = []
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2)
    const b = this.bounds
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [0, 0],
    ]) {
      ray.setFromCamera(new THREE.Vector2(x, y), view)
      const hit = new THREE.Vector3()
      if (!ray.ray.intersectPlane(plane, hit) || hit.distanceTo(view.position) > 400) hit.copy(ray.ray.at(400, new THREE.Vector3())).setY(0.2)
      hit.x = Math.min(b.cx + b.hw, Math.max(b.cx - b.hw, hit.x))
      hit.z = Math.min(b.cz + b.hd, Math.max(b.cz - b.hd, hit.z))
      pts.push(hit.clone().setY(-0.9), hit.clone().setY(1.8))
    }
    // 섬 대부분이 보이면(전체 시점·S0 회전·위에서 보기) 섬 전체에 고정해 잡는다: 카메라가 돌아도 그림자를 다시 그리지 않는다
    {
      let minx = Infinity
      let maxx = -Infinity
      let minz = Infinity
      let maxz = -Infinity
      for (const p of pts) {
        minx = Math.min(minx, p.x)
        maxx = Math.max(maxx, p.x)
        minz = Math.min(minz, p.z)
        maxz = Math.max(maxz, p.z)
      }
      if ((maxx - minx) * (maxz - minz) >= 0.55 * (2 * b.hw) * (2 * b.hd)) {
        pts.length = 0
        for (const [sx, sz] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ])
          pts.push(new THREE.Vector3(b.cx + sx * b.hw, -0.9, b.cz + sz * b.hd), new THREE.Vector3(b.cx + sx * b.hw, 1.8, b.cz + sz * b.hd))
      }
    }
    // 화면 밖에서 들어오는 긴 그림자(낮은 해)도 받게 해 쪽으로 넉넉히
    const center = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length)
    this.cam.position.copy(center).addScaledVector(this.dir, 150)
    this.cam.up.set(0, 1, 0)
    this.cam.lookAt(center)
    this.cam.updateMatrixWorld()
    const inv = this.cam.matrixWorldInverse
    let minx = Infinity
    let maxx = -Infinity
    let miny = Infinity
    let maxy = -Infinity
    for (const p of pts) {
      const q = p.clone().applyMatrix4(inv)
      minx = Math.min(minx, q.x)
      maxx = Math.max(maxx, q.x)
      miny = Math.min(miny, q.y)
      maxy = Math.max(maxy, q.y)
    }
    const pad = 1.2
    minx -= pad
    miny -= pad
    maxx += pad
    maxy += pad
    // 정사각형 + 텍셀 맞춤(움직일 때 그림자 가장자리가 반짝이지 않게)
    const span = Math.max(maxx - minx, maxy - miny)
    const texel = span / this.size
    const cx = Math.round((minx + maxx) / 2 / texel) * texel
    const cy = Math.round((miny + maxy) / 2 / texel) * texel
    const half = Math.ceil(span / 2 / texel) * texel
    this.cam.left = cx - half
    this.cam.right = cx + half
    this.cam.bottom = cy - half
    this.cam.top = cy + half
    this.cam.near = 50
    this.cam.far = 260
    this.cam.updateProjectionMatrix()
    const key = [this.cam.left, this.cam.bottom, half, center.x.toFixed(2), center.z.toFixed(2)].map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join('|')
    if (key === this.key && !this.dirty) return false
    this.key = key
    this.dirty = false
    this.su.uShadowMat.value.multiplyMatrices(this.cam.projectionMatrix, this.cam.matrixWorldInverse)
    const prevOverride = scene.overrideMaterial
    const prevTarget = renderer.getRenderTarget()
    const prevFog = scene.fog
    scene.overrideMaterial = this.depthMat
    scene.fog = null
    renderer.setRenderTarget(this.rt)
    renderer.clear()
    renderer.render(scene, this.cam)
    renderer.setRenderTarget(prevTarget)
    scene.overrideMaterial = prevOverride
    scene.fog = prevFog
    return true
  }

  dispose(): void {
    this.rt.dispose()
    this.depthMat.dispose()
  }
}

/** 물체 무리에서 불투명·보이는 메시를 그림자 던지는 층(1)에 올린다 */
export function markCasters(root: THREE.Object3D): number {
  let n = 0
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = m.material as THREE.Material
    if (mat.transparent || !m.visible) return
    m.layers.enable(1)
    n++
  })
  return n
}

/**
 * 지형(MeshBasicMaterial + 굽은 정점 빛)에 그림자를 더한다: 정점 빛 중 해의 몫(aSunL)만 그림자만큼 뺀다.
 * 기존 onBeforeCompile이 있으면 먼저 돌린다.
 */
export function patchTerrainShadow(mat: THREE.MeshBasicMaterial, su: ShadowUniforms): void {
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, r) => {
    prev.call(mat, shader, r)
    Object.assign(shader.uniforms, su)
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute vec3 aSunL;\nvarying vec3 vSunL;\nvarying vec3 vWP;\nvoid main() {\n  vSunL = aSunL;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${SHADOW_GLSL}\nvarying vec3 vSunL;\nvarying vec3 vWP;\nvoid main() {`)
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
    float cs = castShadow(vWP, vec3(0.0, 1.0, 0.0));
    vec3 lv = max(vColor.rgb, vec3(1e-3));
    outgoingLight *= (lv - vSunL * (1.0 - cs)) / lv;
  }
  #include <opaque_fragment>`,
      )
  }
  mat.needsUpdate = true
}
