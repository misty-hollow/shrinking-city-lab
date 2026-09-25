/**
 * 미션 결과(설계안 5-6, 5-7, 7-5). 확정한 배분 하나의 스냅샷: 지소 10곳 배분, 도로망 15분 기준
 * KPI 6개와 읍·면·마을 결과, 미션 판정. 화면 기준(10·20분)과 상관없이 늘 미션 판정 기준(15분)으로 만든다.
 */

import type { Landscape, LandscapeCombo, MissionData } from '../data/types'
import { type MissionStatus, missionStatus } from '../engine/compare'
import { type Kpis, type Model, type Threshold, computeKpis } from '../engine/kpi'

export type MissionId = 'm1' | 'm2' | 'm3'
export const MISSIONS: readonly MissionId[] = ['m1', 'm2', 'm3']

export function missionNumber(m: MissionId): 1 | 2 | 3 {
  return (MISSIONS.indexOf(m) + 1) as 1 | 2 | 3
}

export function nextMission(m: MissionId): MissionId | null {
  return MISSIONS[MISSIONS.indexOf(m) + 1] ?? null
}

export function prevMission(m: MissionId): MissionId | null {
  return MISSIONS[MISSIONS.indexOf(m) - 1] ?? null
}

export interface MissionResult {
  mission: MissionId
  /** played = 플레이어가 확정한 배분, reference = 건너뛴 미션을 채운 참고 배분(7-6) */
  source: 'played' | 'reference'
  alloc: readonly number[]
  /** 도로망 15분 기준 KPI·읍면·마을 결과 */
  k15: Kpis
  status: MissionStatus
  /** 이 미션을 몇 번째로 확정했는가(참고 배분은 0) */
  attempt: number
}

export type Results = Partial<Record<MissionId, MissionResult>>

export function comboFor(landscape: Landscape, mission: MissionData): LandscapeCombo {
  const c = landscape.combos.find((x) => x.budget === mission.budget && x.threshold_min === mission.threshold_min)
  if (!c) throw new Error(`no landscape combo for B=${mission.budget} T=${mission.threshold_min}`)
  return c
}

/** 미션 판정: 늘 그 미션의 판정 기준(15분)으로 계산한다. 화면에서 고른 기준 T는 들어오지 않는다. */
export function judge(model: Model, landscape: Landscape, m: MissionId, alloc: readonly number[]): { k15: Kpis; status: MissionStatus } {
  const mission = landscape.missions[m]
  const k15 = computeKpis(model, alloc, mission.threshold_min as Threshold)
  return { k15, status: missionStatus(k15, mission, comboFor(landscape, mission)) }
}

export type Evaluate = (m: MissionId, alloc: readonly number[], source: MissionResult['source'], attempt: number) => MissionResult

export function makeEvaluate(model: Model, landscape: Landscape): Evaluate {
  return (m, alloc, source, attempt) => ({ mission: m, source, alloc: [...alloc], attempt, ...judge(model, landscape, m, alloc) })
}

/**
 * S6 「세 개의 공주」가 받는 세 결과(미션 1·2·3 순서). 건너뛴 미션은 참고 배분으로 채운다(7-5).
 * 플레이한 결과는 보관된 그 객체를 그대로 쓴다.
 */
export function finaleResults(results: Results, landscape: Landscape, evaluate: Evaluate): [MissionResult, MissionResult, MissionResult] {
  const [a, b, c] = MISSIONS.map((m) => results[m] ?? evaluate(m, landscape.missions[m].reference.x, 'reference', 0))
  return [a, b, c]
}
