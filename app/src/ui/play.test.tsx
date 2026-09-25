/**
 * 세계 HUD만으로 플레이(설계안 5-11, 6-17): 지소 말풍선에서 키보드로 진료일을 놓고 빼고, 0~5·총량 제한이 지켜지고,
 * 조작마다 6개 지표(작게, 늘 함께)가 실제 행렬로 바뀌고(검사 환경에서는 빛을 기다리지 않고 바로), 증감이 색이 아닌
 * 글자·글리프로도 읽히는지. 말풍선 Tab 순서는 서쪽 → 동쪽이다. 실제 생성 데이터(public/data)를 쓴다.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useMemo, useReducer } from 'react'
import { describe, expect, it } from 'vitest'

import type { Golden, Landscape, Scenario } from '../data/types'
import { type Threshold, buildModel, computeKpis } from '../engine/kpi'
import { type GameConfig, allowedOps, canConfirm, initialState, reducer } from '../state/game'
import { type MissionId, judge, makeEvaluate } from '../state/results'
import { Hand } from './Hand'
import { ClinicMarkers } from './Markers'
import { GOAL_TILE, KpiLedger, MissionCard, dockOrder } from './PlayPanel'
import { remaining } from '../engine/allocation'
import { FinishCorner } from './WorldHud'

const dataDir = resolve(__dirname, '../../public/data')
const scenario = JSON.parse(readFileSync(resolve(dataDir, 'scenario.json'), 'utf-8')) as Scenario
const landscape = JSON.parse(readFileSync(resolve(dataDir, 'landscape.json'), 'utf-8')) as Landscape
const golden = JSON.parse(readFileSync(resolve(dataDir, 'golden.json'), 'utf-8')) as Golden
const model = buildModel(scenario)
const cfg: GameConfig = { current: scenario.current_allocation, tutorialFrom: 5, missionBudget: 15, evaluate: makeEvaluate(model, landscape) }

function Harness() {
  const r = useMemo(() => reducer(cfg), [])
  const [s, dispatch] = useReducer(r, cfg, (c) => reducer(c)(reducer(c)(initialState(c), { type: 'tutorialSkip' }), { type: 'beginPlay' }))
  const k = computeKpis(model, s.alloc, s.T)
  const base = computeKpis(model, scenario.current_allocation, s.T)
  return (
    <>
      <MissionCard
        missionId="m1"
        mission={landscape.missions.m1}
        status={judge(model, landscape, 'm1', s.alloc).status}
        k15={judge(model, landscape, 'm1', s.alloc).k15}
        scenario={scenario}
        T={s.T}
      />
      <KpiLedger compact k={k} base={base} T={s.T} scenario={scenario} onEmphasis={() => {}} />
      <ClinicMarkers
        scenario={scenario}
        order={dockOrder(scenario)}
        alloc={s.alloc}
        interactive
        allowed={(j) => allowedOps(s, cfg, j)}
        preview={null}
        landing={null}
        denied={null}
        pops={[]}
        onPreview={() => {}}
        onInc={(j) => dispatch({ type: 'inc', j })}
        onDec={(j) => dispatch({ type: 'dec', j })}
        onDenied={() => {}}
      />
      <Hand left={remaining(s.alloc, s.budget)} budget={s.budget} mission />
      <FinishCorner canConfirm={canConfirm(s)} left={remaining(s.alloc, s.budget)} onConfirm={() => dispatch({ type: 'confirm' })} />
      <output data-testid="screen">{s.screen}</output>
    </>
  )
}

/** 시나리오 순서 j의 지소 말풍선(서쪽→동쪽이라 화면 순서와 다르다) */
const card = (j: number) => document.querySelector<HTMLElement>(`.fac-row[data-j="${j}"]`)!
const rows = () => scenario.facilities.map((_, j) => card(j))
const kpis = () => document.querySelector('.kpi-grid')!.textContent

const hand = (left: number) => screen.getByRole('region', { name: `남은 진료일 ${left} / 15` })

describe('world HUD keyboard play', () => {
  it('allocates 15 days with the keyboard, respects limits and recomputes KPIs each step', () => {
    render(<Harness />)
    expect(hand(15)).toBeTruthy()
    // 15가 보이는 곳에는 분해와 두 배지(10-1 14번)
    expect(hand(15).textContent).toContain('실제 10')
    expect(hand(15).textContent).toContain('가정 5')
    const confirm = screen.getByRole('button', { name: '이 배분으로 확정' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    const yugu = rows()[0]
    const before = kpis()
    fireEvent.keyDown(yugu, { key: '+' })
    const after = kpis()
    expect(after).not.toBe(before)
    for (let n = 0; n < 8; n++) fireEvent.keyDown(yugu, { key: 'ArrowRight' })
    expect(within(rows()[0]).getByText('주 5일')).toBeTruthy()
    // 한 지소는 5일까지: 칸 다섯이 모두 켜지고 더 누르면 그대로다
    expect(rows()[0].querySelectorAll('.mk-slot.on')).toHaveLength(5)

    for (const j of [3, 7]) for (let n = 0; n < 6; n++) fireEvent.keyDown(rows()[j], { key: '+' })
    expect(hand(0)).toBeTruthy()
    // 총량을 다 놓으면 어떤 지소에도 더 놓을 수 없다(말풍선을 눌러도 그대로).
    fireEvent.keyDown(rows()[1], { key: '+' })
    fireEvent.click(within(rows()[1]).getByRole('button', { name: '이인 진료일 하루 더하기' }))
    expect(within(rows()[1]).getByText('미운영')).toBeTruthy()
    expect(confirm.disabled).toBe(false)
    expect(screen.getByText(/목표 달성 · 가능한 배분 중 상위 \d+%/)).toBeTruthy()

    // 빼기도 키보드로, 불 켜진 칸을 눌러도
    fireEvent.keyDown(rows()[0], { key: '-' })
    expect(within(rows()[0]).getByText('주 4일')).toBeTruthy()
    expect(hand(1)).toBeTruthy()
    fireEvent.click(within(rows()[0]).getByRole('button', { name: '유구 진료일 하루 빼기' }))
    expect(within(rows()[0]).getByText('주 3일')).toBeTruthy()
    expect(hand(2)).toBeTruthy()
    expect(confirm.disabled).toBe(true)
  })

  it('shows deltas as sign = value direction and a word for better/worse, with no arrows (UI_DESIGN_SYSTEM 9.1)', () => {
    render(<Harness />)
    for (let n = 0; n < 5; n++) fireEvent.keyDown(rows()[5], { key: '+' })
    const grid = document.querySelector('.kpi-grid')!
    const deltas = grid.querySelectorAll('.delta')
    expect(deltas.length).toBeGreaterThan(0)
    for (const d of deltas) {
      const text = d.textContent ?? ''
      expect(/[▲▼]/.test(text)).toBe(false)
      expect(/(좋아짐|나빠짐|같음) [+−±]/.test(text)).toBe(true)
      if (d.classList.contains('same')) expect(text.endsWith('±0')).toBe(true)
    }
    expect(document.querySelector('.delta-legend')!.textContent).toContain('현재 실제(10일) 대비')
  })

  it('clinic balloons run west to east in Tab order so the order resembles the map', () => {
    render(<Harness />)
    const shown = [...document.querySelectorAll<HTMLElement>('.fac-row')].map((el) => Number(el.dataset.j))
    expect(shown).toEqual(dockOrder(scenario))
    const xs = shown.map((j) => scenario.facilities[j].x)
    for (let q = 1; q < xs.length; q++) expect(xs[q]).toBeGreaterThanOrEqual(xs[q - 1])
    expect(scenario.facilities[shown[0]].short).toBe('유구')
    expect(scenario.facilities[shown[shown.length - 1]].short).toBe('반포')
    // ↓ 키로 옆(동쪽) 지소 말풍선으로 옮겨 간다.
    const first = document.querySelectorAll<HTMLElement>('.fac-row')[0]
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(document.querySelectorAll<HTMLElement>('.fac-row')[1])
  })

  it('recomputes within the 16 ms budget (design 6-12)', () => {
    const x = [3, 1, 0, 2, 1, 4, 0, 2, 1, 1]
    const t0 = performance.now()
    for (let n = 0; n < 200; n++) computeKpis(model, x, 15)
    const per = (performance.now() - t0) / 200
    expect(per).toBeLessThan(16)
  })
})

function Card({ m, x, T }: { m: MissionId; x: number[]; T: Threshold }) {
  const j = judge(model, landscape, m, x)
  const k = computeKpis(model, x, T)
  return (
    <>
      <MissionCard
        missionId={m}
        mission={landscape.missions[m]}
        status={j.status}
        k15={j.k15}
        scenario={scenario}
        T={T}
        canConfirm
        onConfirm={() => {}}
        last={{ n: 1, on: false, onToggle: () => {} }}
      />
      <KpiLedger k={k} base={null} T={T} scenario={scenario} onEmphasis={() => {}} goal={GOAL_TILE[m]} />
    </>
  )
}

const bx = (name: string) => golden.cases.find((c) => c.name === name && c.threshold_min === 15)!.x

describe('mission cards 2 and 3', () => {
  it('mission 2 puts the worst 읍·면 and the regional gap at the centre, with a target line', () => {
    render(<Card m="m2" x={bx('boundary_m2_below')} T={15} />)
    const card = document.querySelector('.mission-card')!
    expect(card.textContent).toContain('미션 2 · 어디에도 빈 곳이 없게')
    expect(card.textContent).toContain('가장 불리한 읍·면 · 15분')
    // 반올림하면 1.0이지만 미달이라 두 자리로 보인다.
    expect(card.textContent).toContain('주 0.99일')
    expect(card.textContent).toContain('목표 주 1.0일')
    expect(card.textContent).toMatch(/목표보다 낮은 읍·면 \d+곳/)
    expect(card.textContent).toMatch(/읍·면 격차 주 [\d.]+일/)
    expect(card.querySelectorAll('.emd-strip-col')).toHaveLength(10)
    expect(card.querySelectorAll('.emd-strip-col i.below').length).toBeGreaterThan(0)
    expect(card.querySelector('[role=img]')!.getAttribute('aria-label')).toMatch(/반포면|탄천면|정안면|이인면/)
    expect(card.textContent).toContain('직전 확정 배분(미션 1)과 비교하며 보기')
    expect(document.querySelector('.kpi.is-goal')!.textContent).toContain('가장 불리한 읍·면')
  })

  it('mission 3 shows how thick the service is for residents, with the target marked', () => {
    render(<Card m="m3" x={bx('boundary_m3_at')} T={15} />)
    const card = document.querySelector('.mission-card')!
    expect(card.textContent).toContain('미션 3 · 두껍게 닿게')
    expect(card.textContent).toContain('목표 24,800명')
    expect(card.textContent).toMatch(/목표 달성 · 가능한 배분 중 상위 \d+%/)
    expect(card.textContent).toContain('주 3일 이상')
    expect(card.textContent).toContain('주 1~2일')
    expect(card.textContent).toContain('닿지 않음')
    expect(card.querySelector('.thick-target')).toBeTruthy()
    expect(document.querySelector('.kpi.is-goal')!.textContent).toContain('주 3일 이상 닿는 주민')
  })

  it('switching the screen to 10 or 20 minutes keeps the 15-minute verdict and says so', () => {
    for (const T of [10, 20] as Threshold[]) {
      const { unmount } = render(<Card m="m3" x={bx('boundary_m3_at')} T={T} />)
      const card = document.querySelector('.mission-card')!
      expect(card.textContent).toContain('미션 판정은 15분 기준이에요')
      expect(card.textContent).toMatch(/목표 달성/)
      unmount()
      const r2 = render(<Card m="m2" x={bx('boundary_m2_below')} T={T} />)
      expect(document.querySelector('.mission-card')!.textContent).not.toMatch(/목표 달성/)
      r2.unmount()
    }
  })
})
