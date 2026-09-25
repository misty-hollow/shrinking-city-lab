/**
 * 빛의 나무(설계안 6-16): 한 지소에서 기준 시간 안 마을들로 가는 **실제 도로망 경로**(geometry.routes)를
 * 합쳐, 같은 길은 한 번만 남긴 가지들. 점마다 "지소에서의 도로망 분"을 단다.
 *
 * 마을 끝점의 분은 행렬 t_ij와 같다. 그 사이는 경로 길이에 비례해 나눈 시각 표현이다(계산에 쓰지 않는다).
 * 가까운 마을의 경로부터 깔고, 이미 깔린 길(허용 오차 안)은 건너뛰어 새 갈래만 잇는다.
 * 그래서 지소 앞에서 선이 다발로 겹치지 않는다(네트워크 그래프가 되지 않게).
 */

import type { XY } from '../data/types'

export interface LightBranch {
  pts: XY[]
  /** 점마다 지소(또는 마을)에서의 도로망 분 */
  t: number[]
  /** 가지 시작에서의 길이(km), 점선용 */
  d: number[]
}

export interface RouteInput {
  /** 출발(빛이 나가는 곳) → 도착 순서의 좌표 */
  coords: XY[]
  /** 도착점까지 도로망 분 */
  minutes: number
  /** 도착 대상(마을 또는 지소 번호) */
  target: number
}

const STEP = 0.03
const TOL = 0.065

interface Sample {
  x: number
  y: number
  s: number
}

function resample(coords: XY[], step: number): { pts: Sample[]; length: number } {
  const pts: Sample[] = [{ x: coords[0][0], y: coords[0][1], s: 0 }]
  let s = 0
  for (let k = 0; k + 1 < coords.length; k++) {
    const [ax, ay] = coords[k]
    const [bx, by] = coords[k + 1]
    const len = Math.hypot(bx - ax, by - ay)
    const n = Math.max(1, Math.ceil(len / step))
    for (let q = 1; q <= n; q++) {
      const t = q / n
      pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, s: s + len * t })
    }
    s += len
  }
  return { pts, length: s }
}

class Claimed {
  private readonly map = new Map<number, number[]>()
  private readonly xs: number[] = []
  private readonly ys: number[] = []
  private key(c: number, r: number): number {
    return (c + 20000) * 40000 + (r + 20000)
  }
  add(x: number, y: number): void {
    const id = this.xs.length
    this.xs.push(x)
    this.ys.push(y)
    const k = this.key(Math.floor(x / TOL), Math.floor(y / TOL))
    const b = this.map.get(k)
    if (b) b.push(id)
    else this.map.set(k, [id])
  }
  covered(x: number, y: number): boolean {
    const c = Math.floor(x / TOL)
    const r = Math.floor(y / TOL)
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const b = this.map.get(this.key(c + dc, r + dr))
      if (!b) continue
      for (const id of b) {
        const dx = this.xs[id] - x
        const dy = this.ys[id] - y
        if (dx * dx + dy * dy <= TOL * TOL) return true
      }
    }
    return false
  }
}

/** 경로 여러 개 → 겹치지 않는 가지들. 가까운(분이 작은) 경로부터 깐다. */
export function mergeRoutes(routes: RouteInput[]): LightBranch[] {
  const sorted = [...routes].sort((a, b) => a.minutes - b.minutes || a.target - b.target)
  const claimed = new Claimed()
  const out: LightBranch[] = []
  for (const r of sorted) {
    if (r.coords.length < 2) continue
    const { pts, length } = resample(r.coords, STEP)
    const tOf = (s: number) => (length > 0 ? (r.minutes * s) / length : r.minutes)
    let cur: LightBranch | null = null
    let startS = 0
    const added: Sample[] = []
    const finish = () => {
      if (cur && cur.pts.length >= 2) out.push(cur)
      cur = null
    }
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k]
      if (claimed.covered(p.x, p.y)) {
        finish()
        continue
      }
      if (!cur) {
        cur = { pts: [], t: [], d: [] }
        // 이미 깔린 길에서 갈라지는 자리부터 잇는다.
        const from = k > 0 ? pts[k - 1] : p
        startS = from.s
        cur.pts.push([from.x, from.y])
        cur.t.push(tOf(from.s))
        cur.d.push(0)
        if (from === p) {
          added.push(p)
          continue
        }
      }
      cur.pts.push([p.x, p.y])
      cur.t.push(tOf(p.s))
      cur.d.push(p.s - startS)
      added.push(p)
    }
    finish()
    for (const p of added) claimed.add(p.x, p.y)
  }
  return out
}

/** geometry.routes 쌍 [마을 i, 지소 j, 좌표(마을→지소)] */
export type RoutePair = [number, number, XY[]]

/** 지소 j에서 나가는 빛의 나무(maxMinutes 안 마을까지). 좌표를 뒤집어 지소에서 출발하게 한다. */
export function clinicTree(j: number, pairs: readonly RoutePair[], minutesOf: (i: number, j: number) => number, maxMinutes: number): LightBranch[] {
  const routes: RouteInput[] = []
  for (const [i, jj, coords] of pairs) {
    if (jj !== j) continue
    const m = minutesOf(i, j)
    if (m > maxMinutes) continue
    routes.push({ coords: [...coords].reverse(), minutes: m, target: i })
  }
  return mergeRoutes(routes)
}

/** 마을 i에서 지소들(js)로 가는 길(마을 hover: 거꾸로 읽기). */
export function villageTree(i: number, js: readonly number[], pairs: readonly RoutePair[], minutesOf: (i: number, j: number) => number, maxMinutes: number): LightBranch[] {
  const want = new Set(js)
  const routes: RouteInput[] = []
  for (const [ii, j, coords] of pairs) {
    if (ii !== i || !want.has(j)) continue
    const m = minutesOf(i, j)
    if (m > maxMinutes) continue
    routes.push({ coords, minutes: m, target: j })
  }
  return mergeRoutes(routes)
}
