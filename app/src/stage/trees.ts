/**
 * 나무 덩이(설계안 6-16·6-25): 숲 덩어리 위의 깎은 면 나무. 풍경 표현이며 데이터 채널을 쓰지 않는다 —
 * 빛보다 어둡고 채도가 낮다. 소나무(3층 원뿔)와 활엽수(덩이 넷), 인스턴스 두 묶음(드로우 2회).
 * 잎 덩이 아래는 어둡고 위는 밝다(가려진 빛 흉내). 적응 화질이 내려가면 예전의 단순한 모양으로 바꾼다(setDetail).
 */

import * as THREE from 'three'

import { PALETTE } from './palette'
import { type SceneUniforms, makeLitMaterial } from './shaders'
import type { Heightmap } from './terrain'
import { type TreeSpec, mulberry32 } from './world'

/** 단순한 소나무(적응 화질이 내려갔을 때) */
function conifer(): THREE.BufferGeometry {
  const a = new THREE.ConeGeometry(0.055, 0.11, 6, 1).translate(0, 0.085, 0)
  const b = new THREE.ConeGeometry(0.04, 0.085, 6, 1).translate(0, 0.14, 0)
  const trunk = new THREE.CylinderGeometry(0.008, 0.01, 0.04, 4).translate(0, 0.02, 0)
  return merge([a, b, trunk], [1, 1.06, 0])
}

/** 단순한 활엽수(적응 화질이 내려갔을 때) */
function broadleaf(): THREE.BufferGeometry {
  const c = new THREE.IcosahedronGeometry(0.058, 0).scale(1, 0.85, 1).translate(0, 0.085, 0)
  const trunk = new THREE.CylinderGeometry(0.008, 0.011, 0.05, 4).translate(0, 0.025, 0)
  return merge([c, trunk], [1, 0])
}

/** 소나무: 8면 원뿔 3층 */
function coniferHi(): THREE.BufferGeometry {
  const a = new THREE.ConeGeometry(0.06, 0.1, 8, 1).translate(0, 0.075, 0)
  const b = new THREE.ConeGeometry(0.048, 0.085, 8, 1).translate(0, 0.12, 0)
  const c = new THREE.ConeGeometry(0.033, 0.07, 8, 1).translate(0, 0.16, 0)
  const trunk = new THREE.CylinderGeometry(0.008, 0.011, 0.045, 5).translate(0, 0.022, 0)
  return merge([a, b, c, trunk], [1, 1.04, 1.08, 0])
}

/** 활엽수: 덩이 넷이 겹친 모양(한 번 나눈 20면체, 꼭짓점을 조금씩 흔든다) */
function broadleafHi(): THREE.BufferGeometry {
  const blob = (r: number, x: number, y: number, z: number, seed: number) => {
    const g = new THREE.IcosahedronGeometry(r, 1)
    const p = g.getAttribute('position') as THREE.BufferAttribute
    let s0 = seed
    for (let q = 0; q < p.count; q++) {
      s0 = (s0 * 1103515245 + 12345) >>> 0
      const k = 1 + ((s0 % 1000) / 1000 - 0.5) * 0.18
      p.setXYZ(q, p.getX(q) * k, p.getY(q) * k * 0.88, p.getZ(q) * k)
    }
    return g.translate(x, y, z)
  }
  const trunk = new THREE.CylinderGeometry(0.008, 0.012, 0.055, 5).translate(0, 0.027, 0)
  return merge([blob(0.05, 0, 0.09, 0, 3), blob(0.036, 0.03, 0.075, 0.018, 5), blob(0.034, -0.026, 0.08, -0.02, 7), blob(0.03, 0.004, 0.125, -0.006, 9), trunk], [1, 0.96, 1.02, 1.08, 0])
}

/** 나눠진 조각을 합치고 aPart(1 = 잎, 0 = 줄기)로 색을 가른다. 평평한 면(깎은 모양)이 되도록 정점을 나눈다. */
function merge(parts: THREE.BufferGeometry[], leaf: number[]): THREE.BufferGeometry {
  const P: number[] = []
  const C: number[] = []
  parts.forEach((g, k) => {
    const ng = g.index ? g.toNonIndexed() : g
    const pos = ng.getAttribute('position')
    for (let q = 0; q < pos.count; q++) {
      P.push(pos.getX(q), pos.getY(q), pos.getZ(q))
      C.push(leaf[k])
    }
  })
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  out.setAttribute('aPart', new THREE.Float32BufferAttribute(C, 1))
  out.computeVertexNormals()
  return out
}

/** 0..n-1을 씨앗 고정으로 섞은 순서. 앞에서 몇 개를 남겨도 섬 전체에 고르게 퍼진다 */
export function scatterOrder(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, k) => k)
  const rnd = mulberry32(seed)
  for (let q = n - 1; q > 0; q--) {
    const r = Math.floor(rnd() * (q + 1))
    ;[order[q], order[r]] = [order[r], order[q]]
  }
  return order
}

export class TreeLayer {
  readonly group = new THREE.Group()
  private readonly meshes: THREE.InstancedMesh[] = []
  /** 종류마다 [자세한 모양, 단순한 모양] */
  private readonly geos: [THREE.BufferGeometry, THREE.BufferGeometry][] = []
  private detail = true

  /**
   * 느린 GPU에서 나무를 줄인다(풍경 표현이라 계산 의미가 없다). keep = 남길 비율.
   * 인스턴스 순서를 미리 섞어 두었으므로 앞에서 keep만큼 남기면 섬 전체에서 고르게 줄어든다
   * (이전에는 남→북 생성 순서 그대로라 북쪽 절반이 통째로 사라졌다, 2026-10-15 수정).
   */
  thin(keep: number): void {
    for (const m of this.meshes) m.count = Math.max(1, Math.floor(m.instanceMatrix.count * keep))
  }

  /** 자세한 모양(기본)과 단순한 모양 사이를 바꾼다. 위치·종류·색은 그대로. 바뀌었으면 참 */
  setDetail(hi: boolean): boolean {
    if (this.detail === hi) return false
    this.detail = hi
    this.meshes.forEach((m, k) => (m.geometry = this.geos[k][hi ? 0 : 1]))
    return true
  }

  get detailed(): boolean {
    return this.detail
  }

  /** 지금 그리는 나무 수 / 전체(검사용) */
  shown(): { drawn: number; total: number } {
    let drawn = 0
    let total = 0
    for (const m of this.meshes) {
      drawn += m.count
      total += m.instanceMatrix.count
    }
    return { drawn, total }
  }

  constructor(trees: TreeSpec[], hm: Heightmap, shadowAt: (x: number, y: number) => number, u: SceneUniforms) {
    const kinds = [trees.filter((t) => t.kind === 0), trees.filter((t) => t.kind === 1)]
    const geoSets: [THREE.BufferGeometry, THREE.BufferGeometry][] = [
      [coniferHi(), conifer()],
      [broadleafHi(), broadleaf()],
    ]
    const leafCols = [
      [new THREE.Color('#3E6443'), new THREE.Color('#4B7048'), new THREE.Color('#355A3E')],
      [new THREE.Color('#5A824D'), new THREE.Color('#6A8A4F'), new THREE.Color('#7C8744'), new THREE.Color('#4E7746')],
    ]
    const trunk = new THREE.Color(PALETTE.door)
    const M = new THREE.Matrix4()
    const Q = new THREE.Quaternion()
    const S = new THREE.Vector3()
    const P = new THREE.Vector3()
    const Y = new THREE.Vector3(0, 1, 0)
    kinds.forEach((list, kind) => {
      if (list.length === 0) return
      // 잎·줄기 색은 인스턴스 색(aTint) × 부위(aPart)로. 줄기는 셰이더 대신 정점 색으로 섞는다.
      // 자세한 모양은 잎 덩이 아래쪽을 어둡게·위를 밝게(가려진 빛 흉내), 단순한 모양은 예전 그대로 한 색.
      geoSets[kind].forEach((g, d) => {
        const part = g.getAttribute('aPart') as THREE.BufferAttribute
        const py = g.getAttribute('position') as THREE.BufferAttribute
        const vc = new Float32Array(part.count * 3)
        for (let q = 0; q < part.count; q++) {
          const leaf = part.getX(q)
          const v = d === 0 && leaf ? (0.62 + 0.55 * Math.min(1, Math.max(0, (py.getY(q) - 0.04) / 0.15))) * leaf : 1
          vc[q * 3] = leaf ? v : trunk.r * 1.6
          vc[q * 3 + 1] = leaf ? v : trunk.g * 1.6
          vc[q * 3 + 2] = leaf ? v : trunk.b * 1.6
        }
        g.setAttribute('color', new THREE.BufferAttribute(vc, 3))
      })
      const geo = geoSets[kind][0]
      const mat = makeLitMaterial(u, { instAlbedo: true, vertAlbedo: true, instShadow: true })
      const mesh = new THREE.InstancedMesh(geo, mat, list.length)
      const tint = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3)
      const shade = new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1)
      const palette = leafCols[kind]
      // 고르게 줄이기 위해 놓는 순서를 섞는다. 나무마다의 밝기 흔들림은 원래 번호(k)로 정해 모양은 그대로다.
      scatterOrder(list.length, 20261015 + kind).forEach((k, slot) => {
        const t = list[k]
        const y = hm.sample(t.x, t.y) - 0.006
        Q.setFromAxisAngle(Y, t.tint * Math.PI * 2)
        const h = t.s * (kind === 0 ? 1.08 : 0.95)
        M.compose(P.set(t.x, y, -t.y), Q, S.set(t.s, h, t.s))
        mesh.setMatrixAt(slot, M)
        const c = palette[Math.floor(t.tint * palette.length) % palette.length]
        const v = 0.9 + ((k * 2654435761) % 1000) / 5000
        tint.setXYZ(slot, c.r * v, c.g * v, c.b * v)
        shade.setX(slot, shadowAt(t.x, t.y))
      })
      for (const g of geoSets[kind]) {
        g.setAttribute('aTint', tint)
        g.setAttribute('aShadow', shade)
      }
      this.geos.push(geoSets[kind])
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      this.meshes.push(mesh)
      this.group.add(mesh)
    })
  }
}
