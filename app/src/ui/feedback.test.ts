/**
 * 알림이 속한 단계(ui/feedback)와 실제 게임 상태 전환이 맞는지. S2-2에서 기준을 바꾼 알림이 S2-3까지 남거나
 * 늦게 뜨지 않게 하는 규칙의 근거다(App은 단계가 바뀌면 알림을 지우고, 단계가 바뀐 뒤 끝난 빛은 알림을 만들지 않는다).
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Landscape, Scenario } from '../data/types'
import { buildModel } from '../engine/kpi'
import { type GameConfig, type GameState, initialState, reducer } from '../state/game'
import { makeEvaluate } from '../state/results'
import { feedbackKey, feedbackStale } from './feedback'

const dataDir = resolve(__dirname, '../../public/data')
const scenario = JSON.parse(readFileSync(resolve(dataDir, 'scenario.json'), 'utf-8')) as Scenario
const landscape = JSON.parse(readFileSync(resolve(dataDir, 'landscape.json'), 'utf-8')) as Landscape
const model = buildModel(scenario)
const cfg: GameConfig = {
  current: scenario.current_allocation,
  tutorialFrom: scenario.facilities.findIndex((f) => f.id === 'uidang'),
  missionBudget: 15,
  evaluate: makeEvaluate(model, landscape),
}
const step = reducer(cfg)
const run = (s: GameState, ...as: Parameters<typeof step>[1][]) => as.reduce((x, a) => step(x, a), s)

describe('알림이 속한 단계', () => {
  const s2 = run(initialState(cfg), { type: 'start' }, { type: 'introSkip' }, { type: 'tutorialNext' })

  it('S2-2에서 기준을 바꾸고 되돌리는 동안에는 같은 단계다(알림이 보인다)', () => {
    expect(s2.screen).toBe('tutorial')
    expect(s2.tutorialStep).toBe(2)
    const tried = run(s2, { type: 'setT', T: 10 }, { type: 'setT', T: 15 })
    expect(feedbackStale(feedbackKey(s2), feedbackKey(tried))).toBe(false)
  })

  it('S2-2 → S2-3으로 넘어가면 앞 단계의 알림은 맞지 않는다(지우고, 늦게 끝난 빛은 알림을 만들지 않는다)', () => {
    const back = run(s2, { type: 'setT', T: 10 }, { type: 'setT', T: 15 })
    const s3 = run(back, { type: 'tutorialNext' })
    expect(s3.screen).toBe('tutorial')
    expect(s3.tutorialStep).toBe(3)
    expect(feedbackStale(feedbackKey(back), feedbackKey(s3))).toBe(true)
  })

  it('S2-3에서 진료일을 옮기는 조작의 알림은 그 단계에 남는다', () => {
    const s3 = run(s2, { type: 'setT', T: 10 }, { type: 'setT', T: 15 }, { type: 'tutorialNext' })
    const j = cfg.tutorialFrom
    const to = scenario.facilities.findIndex((f) => f.id === 'sinpung')
    const moved = run(s3, { type: 'dec', j }, { type: 'inc', j: to })
    expect(moved.tutorialStep).toBe(3)
    expect(feedbackStale(feedbackKey(s3), feedbackKey(moved))).toBe(false)
  })

  it('미션 플레이 중 조작과 기준 변경은 같은 단계, 확정해 결산으로 가면 다른 단계', () => {
    const play = run(initialState(cfg), { type: 'start' }, { type: 'introSkip' }, { type: 'tutorialSkip' }, { type: 'beginPlay' })
    expect(play.screen).toBe('play')
    const acted = run(play, { type: 'inc', j: 0 }, { type: 'setT', T: 20 }, { type: 'setT', T: 15 })
    expect(feedbackStale(feedbackKey(play), feedbackKey(acted))).toBe(false)
    const full = [0, 3, 7].reduce((x, j) => run(x, ...Array.from({ length: x.alloc[j] < 5 ? 5 - x.alloc[j] : 0 }, () => ({ type: 'inc' as const, j }))), acted)
    const done = run(full, { type: 'confirm' })
    expect(done.screen).toBe('debrief')
    expect(feedbackStale(feedbackKey(full), feedbackKey(done))).toBe(true)
  })
})
