/**
 * 한 판의 흐름과 미션 결과 보관(설계안 3-1, 5-4~5-7). 실제 생성 데이터(public/data)로 돈다.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Landscape, Scenario } from '../data/types'
import { remaining, total } from '../engine/allocation'
import { buildModel } from '../engine/kpi'
import { type Action, type GameConfig, type GameState, allowedOps, canConfirm, canTutorialNext, initialState, reducer } from './game'
import { MISSIONS, finaleResults, judge, makeEvaluate } from './results'

const dataDir = resolve(__dirname, '../../public/data')
const scenario = JSON.parse(readFileSync(resolve(dataDir, 'scenario.json'), 'utf-8')) as Scenario
const landscape = JSON.parse(readFileSync(resolve(dataDir, 'landscape.json'), 'utf-8')) as Landscape
const model = buildModel(scenario)
const evaluate = makeEvaluate(model, landscape)
const cfg: GameConfig = {
  current: scenario.current_allocation,
  tutorialFrom: scenario.facilities.findIndex((f) => f.id === 'uidang'),
  missionBudget: 15,
  evaluate,
}
const step = reducer(cfg)

function run(...actions: Action[]) {
  return actions.reduce(step, initialState(cfg))
}

/** 플레이 화면에서 배분 x를 +로만 놓는다(빈 풀에서 시작). */
function place(s: GameState, x: readonly number[]): GameState {
  for (let j = 0; j < x.length; j++) for (let n = 0; n < x[j]; n++) s = step(s, { type: 'inc', j })
  return s
}

const A1 = [5, 0, 0, 5, 0, 0, 0, 5, 0, 0]
const A2 = [2, 1, 2, 2, 3, 1, 2, 1, 1, 0]
const A3 = [3, 3, 0, 3, 0, 0, 3, 3, 0, 0]

function playMission(s: GameState, x: readonly number[]): GameState {
  s = step(s, { type: 'beginPlay' })
  s = place(s, x)
  return step(s, { type: 'confirm' })
}

describe('flow S0 → S5', () => {
  it('walks through intro, tutorial and mission 1 to the debrief', () => {
    let s = run({ type: 'start' }, { type: 'introNext' }, { type: 'introNext' }, { type: 'introNext' })
    expect(s.screen).toBe('tutorial')
    expect(s.alloc).toEqual(cfg.current)
    s = step(s, { type: 'tutorialNext' })
    expect(s.tutorialStep).toBe(2)
    // 기준을 바꾸지 않고는 넘어갈 수 없다(설계안 10-3 S2).
    expect(canTutorialNext(s)).toBe(false)
    s = step(s, { type: 'setT', T: 10 })
    expect(canTutorialNext(s)).toBe(false)
    s = step(s, { type: 'setT', T: 15 })
    expect(canTutorialNext(s)).toBe(true)
    s = step(s, { type: 'tutorialNext' })
    expect(s.tutorialStep).toBe(3)
    // 3단계: 의당에서만 뺄 수 있고, 뺀 뒤에는 다른 지소에만 놓을 수 있다.
    expect(allowedOps(s, cfg, 0)).toEqual({ inc: false, dec: false })
    expect(allowedOps(s, cfg, 5).dec).toBe(true)
    s = step(s, { type: 'dec', j: 5 })
    expect(s.alloc[5]).toBe(4)
    expect(allowedOps(s, cfg, 5).inc).toBe(false)
    s = step(s, { type: 'inc', j: 0 })
    expect(s.tutorialPlaced).toBe(0)
    expect(remaining(s.alloc, s.budget)).toBe(0)
    s = step(s, { type: 'toBriefing' })
    expect(s.screen).toBe('briefing')
    expect(s.mission).toBe('m1')
    // 튜토리얼 변경은 미션에 넘어가지 않는다.
    expect(s.alloc.every((v) => v === 0)).toBe(true)
    s = step(s, { type: 'beginPlay' })
    expect(s.screen).toBe('play')
    expect(s.budget).toBe(15)
    expect(canConfirm(s)).toBe(false)
    s = place(s, A1)
    expect(remaining(s.alloc, s.budget)).toBe(0)
    // 풀이 0이면 더 놓을 수 없다.
    expect(allowedOps(s, cfg, 1).inc).toBe(false)
    expect(canConfirm(s)).toBe(true)
    s = step(s, { type: 'setT', T: 20 })
    s = step(s, { type: 'confirm' })
    expect(s.screen).toBe('debrief')
    expect(s.T).toBe(15)
    expect(s.results.m1?.alloc).toEqual(A1)
    expect(s.deltaMode).toBe(true)
    s = step(s, { type: 'replay' })
    expect(s.screen).toBe('play')
    expect(s.alloc).toEqual(A1)
    s = step(s, { type: 'setBaseline', baseline: 'last' })
    expect(s.baseline).toBe('last')
    s = step(s, { type: 'home' })
    expect(s.screen).toBe('start')
    expect(s.results).toEqual({})
  })

  it('cannot confirm while days remain in the pool', () => {
    let s = run({ type: 'tutorialSkip' }, { type: 'beginPlay' }, { type: 'inc', j: 1 })
    s = step(s, { type: 'confirm' })
    expect(s.screen).toBe('play')
  })

  it('last-confirmed baseline is only available after a confirmation', () => {
    const s = run({ type: 'tutorialSkip' }, { type: 'beginPlay' }, { type: 'setBaseline', baseline: 'last' })
    expect(s.baseline).toBe('current')
  })
})

describe('missions 1 → 2 → 3 → S6', () => {
  it('runs the whole learning loop without a break and keeps each result on its own', () => {
    let s = run({ type: 'tutorialSkip' })
    s = playMission(s, A1)
    expect(s.screen).toBe('debrief')
    // 미션 1 디브리핑의 '다른 목표였다면'은 켜진 채 시작한다(다음 미션이 있다).
    expect(s.ghost).toBe(true)
    s = step(s, { type: 'nextMission' })
    expect(s.screen).toBe('briefing')
    expect(s.mission).toBe('m2')
    expect(s.alloc.every((v) => v === 0)).toBe(true)
    expect(s.budget).toBe(15)
    s = playMission(s, A2)
    expect(s.mission).toBe('m2')
    s = step(s, { type: 'nextMission' })
    expect(s.mission).toBe('m3')
    s = playMission(s, A3)
    // 마지막 미션에는 다음 미션 참고 배분이 없다.
    expect(s.ghost).toBe(false)
    s = step(s, { type: 'nextMission' })
    expect(s.screen).toBe('finale')

    expect(Object.keys(s.results).sort()).toEqual(['m1', 'm2', 'm3'])
    expect(s.results.m1?.alloc).toEqual(A1)
    expect(s.results.m2?.alloc).toEqual(A2)
    expect(s.results.m3?.alloc).toEqual(A3)
    for (const m of MISSIONS) {
      const r = s.results[m]!
      expect(r.mission).toBe(m)
      expect(r.source).toBe('played')
      // 스냅샷은 15분 기준: 같은 배분을 15분으로 다시 판정한 값과 같다.
      const j = judge(model, landscape, m, r.alloc)
      expect(r.status).toEqual(j.status)
      expect(r.k15.meanDays).toBe(j.k15.meanDays)
      expect(r.k15.emdDays).toEqual(j.k15.emdDays)
      expect(total(r.alloc)).toBe(15)
    }
    // 목표가 다르면 판정도 다르다: 미션 1 배분은 미션 1 목표를 달성하고 미션 2 목표는 못 미친다.
    expect(s.results.m1?.status.achieved).toBe(true)
    expect(judge(model, landscape, 'm2', A1).status.achieved).toBe(false)

    // S6은 정확히 세 결과를 미션 순서로 받는다. 플레이한 결과는 보관된 객체 그대로다.
    const f = finaleResults(s.results, landscape, evaluate)
    expect(f).toHaveLength(3)
    expect(f.map((r) => r.mission)).toEqual(['m1', 'm2', 'm3'])
    expect(f[0]).toBe(s.results.m1)
    expect(f[1]).toBe(s.results.m2)
    expect(f[2]).toBe(s.results.m3)
  })

  it('a retry replaces only that mission result', () => {
    let s = run({ type: 'tutorialSkip' })
    s = playMission(s, A1)
    s = step(s, { type: 'nextMission' })
    s = playMission(s, A2)
    const m1Before = s.results.m1
    const m2First = s.results.m2
    expect(m2First?.attempt).toBe(1)
    // 미션 2 다시 배분: 하루를 옮겨 다시 확정
    s = step(s, { type: 'replay' })
    expect(s.screen).toBe('play')
    expect(s.mission).toBe('m2')
    expect(s.alloc).toEqual(A2)
    s = step(s, { type: 'dec', j: 4 })
    s = step(s, { type: 'inc', j: 9 })
    s = step(s, { type: 'confirm' })
    expect(s.results.m2?.attempt).toBe(2)
    expect(s.results.m2?.alloc).toEqual([2, 1, 2, 2, 2, 1, 2, 1, 1, 1])
    expect(s.results.m2).not.toBe(m2First)
    // 미션 1 결과는 같은 객체 그대로(섞이지 않는다), 미션 3 칸은 아직 비어 있다.
    expect(s.results.m1).toBe(m1Before)
    expect(s.results.m3).toBeUndefined()
    expect(m2First?.alloc).toEqual(A2)
  })

  it('skipped missions leave their slot empty and S6 fills it with the reference allocation', () => {
    let s = run({ type: 'tutorialSkip' })
    expect(s.screen).toBe('briefing')
    s = step(s, { type: 'skipMission' })
    expect(s.screen).toBe('briefing')
    expect(s.mission).toBe('m2')
    s = playMission(s, A2)
    s = step(s, { type: 'nextMission' })
    s = step(s, { type: 'skipMission' })
    expect(s.screen).toBe('finale')
    expect(Object.keys(s.results)).toEqual(['m2'])
    const f = finaleResults(s.results, landscape, evaluate)
    expect(f.map((r) => r.source)).toEqual(['reference', 'played', 'reference'])
    expect(f[0].alloc).toEqual(landscape.missions.m1.reference.x)
    expect(f[2].alloc).toEqual(landscape.missions.m3.reference.x)
    expect(f[1]).toBe(s.results.m2)
  })

  it('keeps 0..5 per facility and exactly 15 days in missions 2 and 3', () => {
    let s = run({ type: 'tutorialSkip' }, { type: 'skipMission' })
    for (const m of ['m2', 'm3'] as const) {
      expect(s.mission).toBe(m)
      s = step(s, { type: 'beginPlay' })
      for (let n = 0; n < 9; n++) s = step(s, { type: 'inc', j: 2 })
      expect(s.alloc[2]).toBe(5)
      for (let j = 0; j < 10; j++) for (let n = 0; n < 9; n++) s = step(s, { type: 'inc', j })
      expect(total(s.alloc)).toBe(15)
      expect(Math.max(...s.alloc)).toBeLessThanOrEqual(5)
      expect(Math.min(...s.alloc)).toBeGreaterThanOrEqual(0)
      for (let n = 0; n < 9; n++) s = step(s, { type: 'dec', j: 2 })
      expect(s.alloc[2]).toBe(0)
      expect(canConfirm(s)).toBe(false)
      s = step(s, { type: 'inc', j: 9 })
      s = step(s, { type: 'inc', j: 9 })
      s = step(s, { type: 'inc', j: 8 })
      s = step(s, { type: 'inc', j: 8 })
      s = step(s, { type: 'inc', j: 8 })
      expect(total(s.alloc)).toBe(15)
      s = step(s, { type: 'confirm' })
      expect(s.screen).toBe('debrief')
      s = step(s, { type: 'nextMission' })
    }
    expect(s.screen).toBe('finale')
  })

  it('judges at 15 minutes whatever threshold the screen shows, and locks the switch on result screens', () => {
    let s = run({ type: 'tutorialSkip' }, { type: 'skipMission' }, { type: 'beginPlay' })
    s = place(s, A2)
    s = step(s, { type: 'setT', T: 10 })
    expect(s.T).toBe(10)
    s = step(s, { type: 'confirm' })
    expect(s.T).toBe(15)
    expect(s.results.m2?.status).toEqual(judge(model, landscape, 'm2', A2).status)
    expect(s.results.m2?.status.achieved).toBe(true)
    // 디브리핑·S6에서는 기준을 바꿀 수 없다(숫자가 확정한 15분 결과다).
    expect(step(s, { type: 'setT', T: 20 }).T).toBe(15)
    s = step(s, { type: 'nextMission' })
    s = step(s, { type: 'skipMission' })
    expect(s.screen).toBe('finale')
    expect(step(s, { type: 'setT', T: 10 }).T).toBe(15)
  })

  it('compares with the previous mission only through explicit toggles', () => {
    let s = run({ type: 'tutorialSkip' })
    s = playMission(s, A1)
    s = step(s, { type: 'nextMission' })
    s = step(s, { type: 'beginPlay' })
    expect(s.baseline).toBe('current')
    s = step(s, { type: 'compareLast', on: true })
    expect(s.baseline).toBe('last')
    expect(s.deltaMode).toBe(true)
    expect(s.lastConfirmed?.mission).toBe('m1')
    s = step(s, { type: 'compareLast', on: false })
    expect(s.baseline).toBe('current')
    s = place(s, A2)
    s = step(s, { type: 'confirm' })
    // 디브리핑: 앞 미션 비교와 다음 미션 참고 배분(유령 탑)은 동시에 켜지지 않는다.
    expect(s.ghost).toBe(true)
    s = step(s, { type: 'toggleCompare' })
    expect(s.debriefCompare).toBe(true)
    expect(s.ghost).toBe(false)
    s = step(s, { type: 'toggleGhost' })
    expect(s.ghost).toBe(true)
    expect(s.debriefCompare).toBe(false)
  })

  it('S6 opens one allocation at a time and never compares it with itself', () => {
    let s = run({ type: 'tutorialSkip' })
    s = playMission(s, A1)
    s = step(s, { type: 'nextMission' })
    s = playMission(s, A2)
    s = step(s, { type: 'nextMission' })
    s = playMission(s, A3)
    s = step(s, { type: 'nextMission' })
    s = step(s, { type: 'finaleFocus', m: 'm2' })
    expect(s.finaleFocus).toBe('m2')
    expect(s.deltaMode).toBe(true)
    expect(s.finaleBase).toBe('current')
    expect(step(s, { type: 'finaleBase', base: 'm2' }).finaleBase).toBe('current')
    s = step(s, { type: 'finaleBase', base: 'm1' })
    expect(s.finaleBase).toBe('m1')
    s = step(s, { type: 'finaleFocus', m: 'm1' })
    expect(s.finaleBase).toBe('current')
    s = step(s, { type: 'finaleFocus', m: null })
    expect(s.finaleFocus).toBeNull()
    // S6에서 둘러봐도 결과는 바뀌지 않는다.
    expect(s.results.m1?.alloc).toEqual(A1)
    expect(s.results.m2?.alloc).toEqual(A2)
    expect(s.results.m3?.alloc).toEqual(A3)
  })
})
