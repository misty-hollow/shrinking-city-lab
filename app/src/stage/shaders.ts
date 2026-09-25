/**
 * 무대의 한 가지 빛(설계안 6-16): 서남서의 낮은 해 + 푸른 하늘빛 + 흙빛 반사. 모든 재질은 무광이다.
 * 그림자 맵·후처리 블룸은 쓰지 않는다. 지형 그늘은 terrainBake가 미리 계산하고, 건물·나무는 선 자리의 그늘 값을 받는다.
 * 지형(MeshBasicMaterial + 굽은 조명)과 아래 셰이더가 같은 식을 써서 한 장면으로 보인다.
 */

import * as THREE from 'three'

import { LIGHT, PALETTE, SUN_DIR } from './palette'

export interface SceneUniforms {
  uSunDir: { value: THREE.Vector3 }
  uSunColor: { value: THREE.Color }
  uSkyColor: { value: THREE.Color }
  uGroundColor: { value: THREE.Color }
  uExposure: { value: THREE.Color }
  uFogColor: { value: THREE.Color }
  uFogNear: { value: number }
  uFogFar: { value: number }
}

export function makeSceneUniforms(): SceneUniforms {
  return {
    uSunDir: { value: new THREE.Vector3(...SUN_DIR).normalize() },
    uSunColor: { value: new THREE.Color(PALETTE.sun).multiplyScalar(LIGHT.sun) },
    uSkyColor: { value: new THREE.Color(PALETTE.sky).multiplyScalar(LIGHT.sky) },
    uGroundColor: { value: new THREE.Color(PALETTE.ground).multiplyScalar(LIGHT.sky * 0.9) },
    uExposure: { value: new THREE.Color(1, 1, 1) },
    uFogColor: { value: new THREE.Color(PALETTE.haze) },
    uFogNear: { value: 60 },
    uFogFar: { value: 200 },
  }
}

/** JS에서 같은 빛을 계산(지형 굽기). n = 월드 법선, 반환은 선형 RGB 배율. */
export function bakeLight(u: SceneUniforms, nx: number, ny: number, nz: number, shadow: number, ao: number, out: THREE.Color): THREE.Color {
  const L = u.uSunDir.value
  const ndl = Math.max(0, nx * L.x + ny * L.y + nz * L.z)
  const up = 0.5 + 0.5 * ny
  const s = u.uSkyColor.value
  const g = u.uGroundColor.value
  const sun = u.uSunColor.value
  out.r = (g.r + (s.r - g.r) * up) * ao + sun.r * ndl * shadow
  out.g = (g.g + (s.g - g.g) * up) * ao + sun.g * ndl * shadow
  out.b = (g.b + (s.b - g.b) * up) * ao + sun.b * ndl * shadow
  return out
}

export const LIGHT_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uExposure;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
vec3 sceneLight(vec3 n, float shadow, float ao) {
  float ndl = max(dot(n, uSunDir), 0.0);
  float up = 0.5 + 0.5 * n.y;
  vec3 amb = mix(uGroundColor, uSkyColor, up) * ao;
  return amb + uSunColor * ndl * shadow;
}
vec3 applyFog(vec3 c, float depth) {
  float f = smoothstep(uFogNear, uFogFar, depth);
  return mix(c, uFogColor, f * 0.55);
}
`

export interface LitOptions {
  /** 인스턴스마다 바탕색(aTint) */
  instAlbedo?: boolean
  /** 정점마다 바탕색(color) */
  vertAlbedo?: boolean
  /** 인스턴스마다 그늘(aShadow) */
  instShadow?: boolean
  /** 정점마다 그늘(aVShadow) */
  vertShadow?: boolean
  transparent?: boolean
  opacity?: number
}

/** 나무·지소 건물 같은 무광 물체의 재질. */
export function makeLitMaterial(u: SceneUniforms, o: LitOptions = {}): THREE.ShaderMaterial {
  const defines: Record<string, string> = {}
  if (o.instAlbedo) defines.INST_ALBEDO = ''
  if (o.vertAlbedo) defines.VERT_ALBEDO = ''
  if (o.instShadow) defines.INST_SHADOW = ''
  if (o.vertShadow) defines.VERT_SHADOW = ''
  return new THREE.ShaderMaterial({
    defines,
    transparent: !!o.transparent,
    depthWrite: !o.transparent,
    uniforms: { ...u, uOpacity: { value: o.opacity ?? 1 }, uAlbedo: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: /* glsl */ `
      #ifdef INST_ALBEDO
      attribute vec3 aTint;
      #endif
      #ifdef VERT_ALBEDO
      attribute vec3 color;
      #endif
      #ifdef INST_SHADOW
      attribute float aShadow;
      #endif
      #ifdef VERT_SHADOW
      attribute float aVShadow;
      #endif
      varying vec3 vN;
      varying vec3 vAlb;
      varying float vShadow;
      varying float vDepth;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
        m = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = m * vec4(position, 1.0);
        vN = normalize(transpose(inverse(mat3(m))) * normal);
        vAlb = vec3(1.0);
        #ifdef INST_ALBEDO
        vAlb *= aTint;
        #endif
        #ifdef VERT_ALBEDO
        vAlb *= color;
        #endif
        vShadow = 1.0;
        #ifdef INST_SHADOW
        vShadow = aShadow;
        #endif
        #ifdef VERT_SHADOW
        vShadow = aVShadow;
        #endif
        vec4 mv = viewMatrix * wp;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform float uOpacity;
      uniform vec3 uAlbedo;
      varying vec3 vN;
      varying vec3 vAlb;
      varying float vShadow;
      varying float vDepth;
      void main() {
        vec3 n = normalize(vN);
        vec3 c = vAlb * uAlbedo * sceneLight(n, vShadow, 1.0) * uExposure;
        c = applyFog(c, vDepth);
        gl_FragColor = vec4(c, uOpacity);
        #include <colorspace_fragment>
      }
    `,
  })
}

/** 빛 번짐 크기를 화면 픽셀로 묶는 값(무대가 창 크기·카메라마다 채운다) */
export interface GlowUniforms {
  /** 원근: 깊이 1에서 월드 1의 픽셀 수 */
  uPxScale: { value: number }
  /** 정사영이면 월드 1의 픽셀 수(아니면 0) */
  uOrthoPx: { value: number }
}

export function makeGlowUniforms(): GlowUniforms {
  return { uPxScale: { value: 1000 }, uOrthoPx: { value: 0 } }
}

/**
 * 빛 번짐(스프라이트). 카메라를 보며, 제 물체보다 조금 앞으로 당겨 가리지 않게 한다.
 * 크기는 월드 km로 정하되 화면에서 minPx~maxPx로 묶는다: 멀리서는 빛 덩어리가 보이고, 가까이 가도 구름처럼 번지지 않는다.
 * 섞기는 '스크린'(1 − (1−a)(1−b))이라 여러 집의 빛이 겹쳐도 하얗게 타지 않는다.
 */
export function makeGlowMaterial(g: GlowUniforms, color: string, toward = 0.18, minPx = 2.5, maxPx = 22): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcColorFactor,
    // 알파는 그대로(투명 캔버스 위에서 번짐 사각형이 어둡게 찍히지 않게)
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    uniforms: {
      ...g,
      uColor: { value: new THREE.Color(color) },
      uToward: { value: toward },
      uGain: { value: 1 },
      uPxClamp: { value: new THREE.Vector2(minPx, maxPx) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aPos;
      attribute vec2 aGlow;
      uniform float uToward;
      uniform float uPxScale;
      uniform float uOrthoPx;
      uniform vec2 uPxClamp;
      varying vec2 vUv;
      varying float vI;
      void main() {
        vUv = position.xy;
        vI = aGlow.y;
        vec4 mv = viewMatrix * vec4(aPos, 1.0);
        mv.xyz += normalize(-mv.xyz) * uToward;
        float depth = max(0.01, -mv.z);
        float ppu = uOrthoPx > 0.0 ? uOrthoPx : uPxScale / depth;
        float px = clamp(aGlow.x * ppu, uPxClamp.x, uPxClamp.y);
        mv.xy += position.xy * (px / ppu);
        gl_Position = projectionMatrix * mv;
        if (aGlow.y <= 0.0005 || aGlow.x <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uGain;
      varying vec2 vUv;
      varying float vI;
      void main() {
        float r2 = dot(vUv, vUv);
        float a = exp(-r2 * 3.6) * (1.0 - smoothstep(0.72, 1.0, r2));
        float core = exp(-r2 * 30.0) * 0.5;
        gl_FragColor = vec4(uColor * (a + core) * vI * uGain, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}

/** 사각형 하나(−1..1)를 인스턴스로 찍는 빛 번짐 메시 */
export function makeGlowMesh(count: number, mat: THREE.ShaderMaterial): { mesh: THREE.Mesh; pos: THREE.InstancedBufferAttribute; glow: THREE.InstancedBufferAttribute } {
  const geo = new THREE.InstancedBufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
  geo.setIndex([0, 1, 2, 0, 2, 3])
  const pos = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
  const glow = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2)
  pos.setUsage(THREE.DynamicDrawUsage)
  glow.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('aPos', pos)
  geo.setAttribute('aGlow', glow)
  geo.instanceCount = count
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  return { mesh, pos, glow }
}
