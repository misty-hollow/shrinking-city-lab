/**
 * 기준 변경 소식 한 줄(가운데 위 슬롯, UI_DESIGN_SYSTEM §8.1)의 자리. 소식은 세계 위에 뜨는 Sheet 판이라,
 * 그 자리에 지소 말풍선 머리·결과 판이 있으면 말풍선을 가린다(1440 S4에서 정안, 1024~1366에서 유구까지).
 * 소식이 나타날 때 한 번만 재서, 말풍선·HUD 판과 겹치지 않는 가장 가까운 자리로 옮긴다. 프레임마다 다시 재지 않는다.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** 후보는 막는 것의 가장자리 + gap에 정확히 맞닿게 만든다. 소수 좌표(translate −50%)의 실수 오차로 그 후보가 막히지 않게 EPS만큼 봐준다 */
const EPS = 0.01
const hits = (a: Box, b: Box, gap: number) =>
  a.x < b.x + b.w + gap - EPS && b.x < a.x + a.w + gap - EPS && a.y < b.y + b.h + gap - EPS && b.y < a.y + a.h + gap - EPS

/**
 * 소식 판(box)을 막는 것(blockers: 말풍선 머리·결과 판·HUD 판)과 화면 끝(여백 margin)을 피하는 가장 작은 이동.
 * 덜 움직이는 자리를 고른다. 세로 이동은 3배로 친다: 슬롯이 "가운데 위"이고, 섬 가운데로 내려가면 기준을 바꾼 결과(빛)를 가린다.
 * 그래서 조금 내리면 되는 경우가 아니면 같은 높이에서 옆으로(대개 기준 스위치가 있는 오른쪽 위 도구 아래로) 비킨다.
 * 후보는 막는 것의 가장자리에 맞닿는 자리뿐이라 계산이 가볍다. 비킬 자리가 없으면 그대로(0, 0) 둔다.
 */
export function clearOffset(box: Box, blockers: Box[], vw: number, vh: number, margin = 16, gap = 12): { dx: number; dy: number } {
  const inside = (dx: number, dy: number) =>
    box.x + dx >= margin - EPS && box.x + dx + box.w <= vw - margin + EPS && box.y + dy >= margin - EPS && box.y + dy + box.h <= vh - margin + EPS
  const free = (dx: number, dy: number) => inside(dx, dy) && !blockers.some((b) => hits({ ...box, x: box.x + dx, y: box.y + dy }, b, gap))
  if (free(0, 0)) return { dx: 0, dy: 0 }
  const xs = new Set<number>([0, margin - box.x, vw - margin - (box.x + box.w)])
  const ys = new Set<number>([0])
  for (const b of blockers) {
    xs.add(b.x + b.w + gap - box.x)
    xs.add(b.x - gap - (box.x + box.w))
    ys.add(b.y + b.h + gap - box.y)
    ys.add(b.y - gap - (box.y + box.h))
  }
  let best: { dx: number; dy: number } | null = null
  let cost = Infinity
  for (const dy of ys) {
    for (const dx of xs) {
      const c = Math.abs(dx) + 3 * Math.abs(dy)
      if (c < cost && free(dx, dy)) {
        cost = c
        best = { dx, dy }
      }
    }
  }
  return best ?? { dx: 0, dy: 0 }
}
