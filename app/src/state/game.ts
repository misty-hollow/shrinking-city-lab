/**
 * 한 판의 흐름(설계안 3-1, 5절): S0 시작 → S1 소개 → S2 튜토리얼 → (S3 브리핑 → S4 플레이 → S5 디브리핑)
 * × 미션 1·2·3 → S6 세 개의 공주. 화면 상태는 이 리듀서 하나가 정한다(순수 함수).
 *
 * 미션 결과는 미션마다 따로 보관한다(results). 확정하거나 다시 확정하면 그 미션의 칸만 바뀐다.
 */

import { canDecrement, canIncrement, decrement, increment, remaining } from '../engine/allocation'
import type { Threshold } from '../engine/kpi'
import { type Evaluate, type MissionId, type Results, nextMission } from './results'

export type Screen = 'start' | 'intro' | 'tutorial' | 'briefing' | 'play' | 'debrief' | 'finale'
export type Baseline = 'current' | 'last'
/** S6에서 크게 본 배분의 증감 기준 */
export type FinaleBase = 'current' | MissionId

export interface GameConfig {
  current: readonly number[]
  /** 튜토리얼 3단계에서 하루를 빼는 지소(의당) */
  tutorialFrom: number
  missionBudget: number
  /** 확정 배분 → 결과 스냅샷(15분 기준). results.ts의 makeEvaluate */
  evaluate: Evaluate
}

export interface GameState {
  screen: Screen
  introStep: 0 | 1 | 2
  tutorialStep: 1 | 2 | 3
  /** 튜토리얼 2단계에서 처음 바꿔 본 기준(10 또는 20) */
  tutorialTriedT: Threshold | null
  /** 튜토리얼 3단계: 하루를 뺐는가, 어디에 놓았는가 */
  tutorialRemoved: boolean
  tutorialPlaced: number | null
  /** 브리핑·플레이·디브리핑 중인 미션 */
  mission: MissionId
  /** 미션별 확정 결과. 건너뛴 미션은 비어 있다(S6에서 참고 배분으로 채운다) */
  results: Results
  T: Threshold
  alloc: number[]
  budget: number
  baseline: Baseline
  /** 가장 최근에 확정한 배분(기준선 `직전 확정 배분`) */
  lastConfirmed: { mission: MissionId; alloc: number[] } | null
  deltaMode: boolean
  ghost: boolean
  /** 디브리핑: 무대 증감을 앞 미션 결과와 비교 */
  debriefCompare: boolean
  /** S6: 크게 본 배분(없으면 세 개를 나란히) */
  finaleFocus: MissionId | null
  finaleBase: FinaleBase
  selectedFacility: number | null
  regionEmd: number | null
  dataOpen: boolean
  /** 직전 조작(무대 깜빡임·라이브 문장용) */
  lastOp: { j: number; before: number[]; seq: number } | null
  lastTChange: { from: Threshold; seq: number } | null
  seq: number
}

export type Action =
  | { type: 'start' }
  | { type: 'introNext' }
  | { type: 'introSkip' }
  | { type: 'tutorialNext' }
  | { type: 'tutorialSkip' }
  | { type: 'toBriefing' }
  | { type: 'beginPlay' }
  | { type: 'skipMission' }
  | { type: 'setT'; T: Threshold }
  | { type: 'inc'; j: number }
  | { type: 'dec'; j: number }
  | { type: 'confirm' }
  | { type: 'replay' }
  | { type: 'nextMission' }
  | { type: 'home' }
  | { type: 'setBaseline'; baseline: Baseline }
  | { type: 'compareLast'; on: boolean }
  | { type: 'toggleDelta' }
  | { type: 'toggleGhost' }
  | { type: 'toggleCompare' }
  | { type: 'finaleFocus'; m: MissionId | null }
  | { type: 'finaleBase'; base: FinaleBase }
  | { type: 'selectFacility'; j: number | null }
  | { type: 'openRegion'; m: number | null }
  | { type: 'openData'; open: boolean }

export function initialState(cfg: Pick<GameConfig, 'current'>): GameState {
  return {
    screen: 'start',
    introStep: 0,
    tutorialStep: 1,
    tutorialTriedT: null,
    tutorialRemoved: false,
    tutorialPlaced: null,
    mission: 'm1',
    results: {},
    T: 15,
    alloc: [...cfg.current],
    budget: 10,
    baseline: 'current',
    lastConfirmed: null,
    deltaMode: false,
    ghost: false,
    debriefCompare: false,
    finaleFocus: null,
    finaleBase: 'current',
    selectedFacility: null,
    regionEmd: null,
    dataOpen: false,
    lastOp: null,
    lastTChange: null,
    seq: 0,
  }
}

/** 이 상태에서 지소 j의 +/−가 가능한가. 화면의 버튼 활성화와 리듀서가 같은 규칙을 쓴다. */
export function allowedOps(s: GameState, cfg: Pick<GameConfig, 'tutorialFrom'>, j: number): { inc: boolean; dec: boolean } {
  if (s.screen === 'tutorial') {
    if (s.tutorialStep !== 3 || s.tutorialPlaced !== null) return { inc: false, dec: false }
    if (!s.tutorialRemoved) return { inc: false, dec: j === cfg.tutorialFrom && canDecrement(s.alloc, j) }
    return { inc: j !== cfg.tutorialFrom && canIncrement(s.alloc, j, s.budget), dec: false }
  }
  if (s.screen !== 'play') return { inc: false, dec: false }
  return { inc: canIncrement(s.alloc, j, s.budget), dec: canDecrement(s.alloc, j) }
}

export function canConfirm(s: GameState): boolean {
  return s.screen === 'play' && remaining(s.alloc, s.budget) === 0
}

/** 디브리핑·S6의 숫자는 확정한 15분 결과라 기준 스위치를 잠근다. */
export function thresholdLocked(s: GameState): boolean {
  return s.screen === 'debrief' || s.screen === 'finale'
}

function tutorialCanAdvance(s: GameState): boolean {
  if (s.tutorialStep === 2) return s.tutorialTriedT !== null && s.T === 15
  return true
}

export function canTutorialNext(s: GameState): boolean {
  return s.screen === 'tutorial' && s.tutorialStep < 3 && tutorialCanAdvance(s)
}

export function reducer(cfg: GameConfig) {
  const emptyMission = (s: GameState, mission: MissionId): GameState => ({
    ...s,
    screen: 'briefing',
    mission,
    T: 15,
    alloc: new Array(cfg.current.length).fill(0),
    budget: cfg.missionBudget,
    baseline: 'current',
    deltaMode: false,
    ghost: false,
    debriefCompare: false,
    selectedFacility: null,
    regionEmd: null,
    lastOp: null,
  })
  // S6은 같은 세계에서 미션 1 배분부터 본다(설계안 6-17). 세 장의 지도는 finaleFocus = null.
  const toFinale = (s: GameState): GameState => ({
    ...s,
    screen: 'finale',
    T: 15,
    deltaMode: true,
    ghost: false,
    debriefCompare: false,
    finaleFocus: 'm1',
    finaleBase: 'current',
    selectedFacility: null,
    regionEmd: null,
    lastOp: null,
  })
  return (s: GameState, a: Action): GameState => {
    switch (a.type) {
      case 'start':
        return { ...initialState(cfg), screen: 'intro', seq: s.seq + 1 }
      case 'introNext':
        if (s.introStep < 2) return { ...s, introStep: (s.introStep + 1) as 0 | 1 | 2 }
        return toTutorial(s, cfg)
      case 'introSkip':
        return toTutorial(s, cfg)
      case 'tutorialNext':
        if (!canTutorialNext(s)) return s
        return { ...s, tutorialStep: (s.tutorialStep + 1) as 1 | 2 | 3 }
      case 'tutorialSkip':
      case 'toBriefing':
        // 튜토리얼에서 바꾼 배분은 버린다(설계안 5-3 전환).
        return emptyMission(s, 'm1')
      case 'beginPlay':
        if (s.screen !== 'briefing') return s
        return {
          ...s,
          screen: 'play',
          T: 15,
          alloc: new Array(cfg.current.length).fill(0),
          budget: cfg.missionBudget,
          baseline: 'current',
          deltaMode: false,
          lastOp: null,
        }
      case 'skipMission': {
        // S3 [건너뛰기] → 다음 미션 브리핑 또는 S6(설계안 5-4). 건너뛴 미션의 결과 칸은 비워 둔다.
        if (s.screen !== 'briefing') return s
        const next = nextMission(s.mission)
        return next ? emptyMission(s, next) : toFinale(s)
      }
      case 'setT': {
        if (a.T === s.T || thresholdLocked(s)) return s
        const next = { ...s, T: a.T, lastTChange: { from: s.T, seq: s.seq + 1 }, seq: s.seq + 1 }
        if (s.screen === 'tutorial' && s.tutorialStep === 2 && a.T !== 15 && s.tutorialTriedT === null) {
          next.tutorialTriedT = a.T
        }
        return next
      }
      case 'inc':
      case 'dec': {
        const ok = allowedOps(s, cfg, a.j)
        if (a.type === 'inc' ? !ok.inc : !ok.dec) return s
        const alloc = a.type === 'inc' ? increment(s.alloc, a.j, s.budget) : decrement(s.alloc, a.j)
        const next: GameState = {
          ...s,
          alloc,
          selectedFacility: a.j,
          lastOp: { j: a.j, before: s.alloc, seq: s.seq + 1 },
          seq: s.seq + 1,
        }
        if (s.screen === 'tutorial') {
          if (a.type === 'dec') next.tutorialRemoved = true
          else next.tutorialPlaced = a.j
        }
        return next
      }
      case 'confirm': {
        if (!canConfirm(s)) return s
        const attempt = (s.results[s.mission]?.attempt ?? 0) + 1
        return {
          ...s,
          screen: 'debrief',
          // 이 미션의 칸만 새 결과로 바꾼다. 다른 미션 결과는 같은 객체 그대로다.
          results: { ...s.results, [s.mission]: cfg.evaluate(s.mission, s.alloc, 'played', attempt) },
          lastConfirmed: { mission: s.mission, alloc: [...s.alloc] },
          T: 15,
          baseline: 'current',
          deltaMode: true,
          ghost: nextMission(s.mission) !== null,
          debriefCompare: false,
          selectedFacility: null,
          regionEmd: null,
          lastOp: null,
        }
      }
      case 'replay': {
        const r = s.results[s.mission]
        if (s.screen !== 'debrief' || !r) return s
        return {
          ...s,
          screen: 'play',
          alloc: [...r.alloc],
          budget: cfg.missionBudget,
          deltaMode: false,
          ghost: false,
          debriefCompare: false,
          lastOp: null,
        }
      }
      case 'nextMission': {
        if (s.screen !== 'debrief') return s
        const next = nextMission(s.mission)
        return next ? emptyMission(s, next) : toFinale(s)
      }
      case 'home':
        return { ...initialState(cfg), seq: s.seq + 1 }
      case 'setBaseline':
        if (a.baseline === 'last' && !s.lastConfirmed) return s
        return { ...s, baseline: a.baseline }
      case 'compareLast':
        if (s.screen !== 'play') return s
        if (a.on && !s.lastConfirmed) return s
        return a.on ? { ...s, baseline: 'last', deltaMode: true } : { ...s, baseline: 'current' }
      case 'toggleDelta':
        return { ...s, deltaMode: !s.deltaMode }
      case 'toggleGhost':
        return { ...s, ghost: !s.ghost, debriefCompare: s.ghost ? s.debriefCompare : false }
      case 'toggleCompare':
        if (s.screen !== 'debrief') return s
        return { ...s, debriefCompare: !s.debriefCompare, ghost: s.debriefCompare ? s.ghost : false }
      case 'finaleFocus':
        if (s.screen !== 'finale') return s
        return {
          ...s,
          finaleFocus: a.m,
          finaleBase: a.m !== null && s.finaleBase === a.m ? 'current' : s.finaleBase,
          deltaMode: a.m !== null,
          selectedFacility: null,
        }
      case 'finaleBase':
        if (s.screen !== 'finale' || a.base === s.finaleFocus) return s
        return { ...s, finaleBase: a.base }
      case 'selectFacility':
        return { ...s, selectedFacility: a.j }
      case 'openRegion':
        return { ...s, regionEmd: a.m }
      case 'openData':
        return { ...s, dataOpen: a.open }
    }
  }
}

function toTutorial(s: GameState, cfg: GameConfig): GameState {
  return {
    ...s,
    screen: 'tutorial',
    tutorialStep: 1,
    tutorialTriedT: null,
    tutorialRemoved: false,
    tutorialPlaced: null,
    T: 15,
    alloc: [...cfg.current],
    budget: 10,
    baseline: 'current',
    deltaMode: false,
    selectedFacility: null,
    lastOp: null,
  }
}
