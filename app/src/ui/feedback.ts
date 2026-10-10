/**
 * 알림(가운데 소식 한 줄 · 말풍선 위 숫자)이 속한 학습 단계. 알림은 그 조작을 한 단계에서만 보인다.
 * 화면·튜토리얼 단계·미션 중 하나라도 바뀌면 앞 단계의 알림은 지우고, 늦게 끝난 앞 단계의 빛은 알림을 만들지 않는다.
 */

import type { GameState } from '../state/game'

export function feedbackKey(s: Pick<GameState, 'screen' | 'tutorialStep' | 'mission'>): string {
  return `${s.screen}|${s.tutorialStep}|${s.mission}`
}

/** 조작이 시작된 단계(eventKey)와 지금 단계(nowKey)가 다르면 그 조작의 알림은 이제 맞지 않는다. */
export function feedbackStale(eventKey: string, nowKey: string): boolean {
  return eventKey !== nowKey
}
