/**
 * 손(설계안 6-17): 아직 놓지 않은 진료일. 목록이 아니라 "지금 손에 든 말 하나 + 남은 개수"다.
 * 실제 10일은 꽉 찬 나무 말, 가정 5일은 옅은 점선 말(모양이 다르다 — 색만이 아니다). 실제를 먼저 쓴다(풀과 같은 순서).
 * 15가 보이는 곳에는 늘 분해(실제 · 가정)와 두 배지가 함께 있다(10-1 14번).
 */

import { copy } from '../content/copy'
import { Badge } from './common'

interface Props {
  /** 남은 진료일 */
  left: number
  budget: number
  /** 미션(실제 10 + 가정 5)인가, 튜토리얼(옮길 하루)인가 */
  mission: boolean
}

const REAL = 10

export function Hand({ left, budget, mission }: Props) {
  const used = budget - left
  const realLeft = mission ? Math.max(0, REAL - used) : left
  const assumedLeft = mission ? left - realLeft : 0
  // 손에 쌓인 말(많아야 셋). 맨 위가 다음에 놓일 말이다.
  const stack = Array.from({ length: Math.min(3, Math.ceil(left)) }, (_, q) => used + q)
  return (
    <section className={`hand${left <= 0 ? ' is-empty' : ''}`} aria-label={copy.world.handLabel(left, budget)} data-occlude>
      <div className="hand-stack" aria-hidden="true">
        {left <= 0 && <i className="hand-well" />}
        {stack
          .slice()
          .reverse()
          .map((token, q, arr) => {
            const depth = arr.length - 1 - q
            const assumed = mission && token >= REAL
            return <i key={token} data-token={token} className={`hand-peg${assumed ? ' assumed' : ''}${depth === 0 ? ' top' : ''}`} style={{ ['--d' as string]: String(depth) }} />
          })}
      </div>
      <div className="hand-text">
        <span className="hand-count num">{left <= 0 ? '×0' : copy.world.handCount(left)}</span>
        <span className="hand-caption">{left <= 0 ? (mission ? copy.world.handEmpty : copy.world.handTutorialEmpty) : mission ? copy.world.handCaption : copy.world.handTutorial}</span>
      </div>
      {mission && (
        <div className="hand-split">
          <div className="hand-tags">
            <Badge cls="REAL_DATA">{copy.world.handReal(realLeft)}</Badge>
            <Badge cls="SIMULATION_ASSUMPTION">{copy.world.handAssumed(assumedLeft)}</Badge>
          </div>
          <span className="hand-basis">{copy.pool.caption}</span>
        </div>
      )}
    </section>
  )
}
