/** 기준 변경 소식이 말풍선·HUD 판을 피해 가장 가까운 자리로 옮겨 가는 규칙(ui/toastPlace) */

import { describe, expect, it } from 'vitest'

import { type Box, clearOffset } from './toastPlace'

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const moved = (box: Box, o: { dx: number; dy: number }) => ({ ...box, x: box.x + o.dx, y: box.y + o.dy })

describe('소식 자리', () => {
  // 1440×900 S4에서 잰 값: 소식 두 줄(544..896, 96..177), 정안 말풍선 머리(832..951, 93..121), 왼쪽 위 HUD(40..376)
  const toast: Box = { x: 544, y: 96, w: 352, h: 81 }
  const jeongan: Box = { x: 832, y: 93, w: 119, h: 28 }
  const hud: Box = { x: 40, y: 36, w: 336, h: 560 }
  const tools: Box = { x: 905, y: 28, w: 495, h: 44 }

  it('막는 것이 없으면 그대로', () => {
    expect(clearOffset(toast, [hud, tools], 1440, 900)).toEqual({ dx: 0, dy: 0 })
  })

  it('말풍선 머리를 가리면 가장 덜 움직여 말풍선·HUD 어느 것과도 겹치지 않게 비킨다', () => {
    const o = clearOffset(toast, [jeongan, hud, tools], 1440, 900)
    const at = moved(toast, o)
    for (const b of [jeongan, hud, tools]) expect(overlap(at, b)).toBe(false)
    // 정안 머리 아래로 37px 내리기(3×37 = 111)보다 같은 높이에서 왼쪽으로 76px 비키기가 덜 움직인다
    expect(o).toEqual({ dx: -76, dy: 0 })
  })

  it('조금 내리면 되면 가운데를 지킨다', () => {
    const low: Box = { x: 832, y: 80, w: 119, h: 28 } // 정안 머리 아래 끝 108 → 소식을 24px만 내리면 된다
    const wide: Box = { x: 400, y: 96, w: 100, h: 28 } // 왼쪽도 막혀 옆으로 비키려면 멀리 가야 한다
    expect(clearOffset(toast, [low, wide, hud, tools], 1440, 900)).toEqual({ dx: 0, dy: 24 })
  })

  it('양쪽에서 막혀도 말풍선·HUD 어느 것과도 겹치지 않는 화면 안 자리를 찾는다', () => {
    // 1024×768: 정안(590..710, 90..118)과 유구(328..447, 144..172)가 두 줄을 양쪽에서 막는다
    const t: Box = { x: 336, y: 96, w: 352, h: 81 }
    const blockers = [
      { x: 590, y: 90, w: 120, h: 28 },
      { x: 328, y: 144, w: 119, h: 28 },
      { x: 24, y: 24, w: 250, h: 441 },
      { x: 245, y: 24, w: 755, h: 44 },
    ]
    const o = clearOffset(t, blockers, 1024, 768)
    const at = moved(t, o)
    for (const b of blockers) expect(overlap(at, b)).toBe(false)
    expect(at.x).toBeGreaterThanOrEqual(16)
    expect(at.x + at.w).toBeLessThanOrEqual(1024 - 16)
  })

  it('화면 안에 비킬 자리가 없으면 그대로 둔다(소식을 숨기지 않는다)', () => {
    const wall: Box = { x: 0, y: 0, w: 400, h: 300 }
    expect(clearOffset({ x: 20, y: 20, w: 360, h: 80 }, [wall], 400, 300)).toEqual({ dx: 0, dy: 0 })
  })
})
