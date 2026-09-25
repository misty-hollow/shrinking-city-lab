/**
 * 나무 덩이(설계안 6-16): 숲 덩어리 위의 저다각형 나무. 풍경 표현이며 데이터 채널을 쓰지 않는다 —
 * 빛보다 어둡고 채도가 낮다. 소나무(뾰족)와 활엽수(둥근) 두 모양, 인스턴스 두 묶음(드로우 2회).
 */

import * as THREE from 'three'

import { PALETTE } from './palette'
import { type SceneUniforms, makeLitMaterial } from './shaders'
import type { Heightmap } from './terrain'
import type { TreeSpec } from './world'

function conifer(): THREE.BufferGeometry {
  const a = new THREE.ConeGeometry(0.055, 0.11, 6, 1).translate(0, 0.085, 0)
  const b = new THREE.ConeGeometry(0.04, 0.085, 6, 1).translate(0, 0.14, 0)
  const trunk = new THREE.CylinderGeometry(0.008, 0.01, 0.04, 4).translate(0, 0.02, 0)
  return merge([a, b, trunk], [1, 1.06, 0])
}

function broadleaf(): THREE.BufferGeometry {
  const c = new THREE.IcosahedronGeometry(0.058, 0).scale(1, 0.85, 1).translate(0, 0.085, 0)
  const trunk = new THREE.CylinderGeometry(0.008, 0.011, 0.05, 4).translate(0, 0.025, 0)
  return merge([c, trunk], [1, 0])
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

export class TreeLayer {
  readonly group = new THREE.Group()
  private readonly meshes: THREE.InstancedMesh[] = []

  /** 느린 GPU에서 나무를 줄인다(풍경 표현이라 계산 의미가 없다). keep = 남길 비율 */
  thin(keep: number): void {
    for (const m of this.meshes) m.count = Math.max(1, Math.floor(m.instanceMatrix.count * keep))
  }

  constructor(trees: TreeSpec[], hm: Heightmap, shadowAt: (x: number, y: number) => number, u: SceneUniforms) {
    const kinds = [trees.filter((t) => t.kind === 0), trees.filter((t) => t.kind === 1)]
    const geos = [conifer(), broadleaf()]
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
      const geo = geos[kind]
      // 잎·줄기 색은 인스턴스 색(aTint) × 부위(aPart)로. 줄기는 셰이더 대신 정점 색으로 섞는다.
      const part = geo.getAttribute('aPart') as THREE.BufferAttribute
      const vc = new Float32Array(part.count * 3)
      for (let q = 0; q < part.count; q++) {
        const leaf = part.getX(q)
        vc[q * 3] = leaf ? 1 : trunk.r * 1.6
        vc[q * 3 + 1] = leaf ? 1 : trunk.g * 1.6
        vc[q * 3 + 2] = leaf ? 1 : trunk.b * 1.6
      }
      geo.setAttribute('color', new THREE.BufferAttribute(vc, 3))
      const mat = makeLitMaterial(u, { instAlbedo: true, vertAlbedo: true, instShadow: true })
      const mesh = new THREE.InstancedMesh(geo, mat, list.length)
      const tint = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3)
      const shade = new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1)
      const palette = leafCols[kind]
      list.forEach((t, k) => {
        const y = hm.sample(t.x, t.y) - 0.006
        Q.setFromAxisAngle(Y, t.tint * Math.PI * 2)
        const h = t.s * (kind === 0 ? 1.08 : 0.95)
        M.compose(P.set(t.x, y, -t.y), Q, S.set(t.s, h, t.s))
        mesh.setMatrixAt(k, M)
        const c = palette[Math.floor(t.tint * palette.length) % palette.length]
        const v = 0.9 + ((k * 2654435761) % 1000) / 5000
        tint.setXYZ(k, c.r * v, c.g * v, c.b * v)
        shade.setX(k, shadowAt(t.x, t.y))
      })
      geo.setAttribute('aTint', tint)
      geo.setAttribute('aShadow', shade)
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      this.meshes.push(mesh)
      this.group.add(mesh)
    })
  }
}
