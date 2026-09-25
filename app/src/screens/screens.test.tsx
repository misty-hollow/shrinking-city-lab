/**
 * 미션 2·3 디브리핑과 S6 「세 개의 공주」(설계안 5-6, 5-7). 실제 생성 데이터로 그린다.
 * 확인: 세 결과를 정확히 받는다, 15일 = 실제 10일 + 가정 5일 표현, 배지 세 종류, 순위·점수·정답 없음,
 * 문장 속 숫자가 계산값과 같다.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { APPROVED_NEGATIONS } from '../content/copy'
import type { Geometry, Landscape, Manifest, Scenario } from '../data/types'
import { zeroOverlap, zeroVillages } from '../engine/compare'
import { buildModel, computeKpis } from '../engine/kpi'
import { type MissionResult, type Results, comboFor, finaleResults, makeEvaluate } from '../state/results'
import { DebriefPanel } from './Debrief'
import { FinaleBoard, FinalePanel, type FinaleResults, finaleSummary } from './Finale'

const dataDir = resolve(__dirname, '../../public/data')
const read = <T,>(name: string): T => JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8')) as T
const scenario = read<Scenario>('scenario.json')
const landscape = read<Landscape>('landscape.json')
const geometry = read<Geometry>('geometry.json')
const manifest = read<Manifest>('manifest.json')
const model = buildModel(scenario)
const evaluate = makeEvaluate(model, landscape)
const current15 = computeKpis(model, scenario.current_allocation, 15)

const A1 = [5, 0, 0, 5, 0, 0, 0, 5, 0, 0]
const A2 = [2, 1, 2, 2, 3, 1, 2, 1, 1, 0]
const A3 = [3, 3, 0, 3, 0, 0, 3, 3, 0, 0]
const played: Results = { m1: evaluate('m1', A1, 'played', 1), m2: evaluate('m2', A2, 'played', 1), m3: evaluate('m3', A3, 'played', 1) }

/** 화면에 나오면 안 되는 말(설계안 5-12 + 이번 범위: 순위·점수·정답·추천). */
const BANNED = ['최적', '최선', '추천', '정답', '가장 좋은 배분', '1등', '점수', '순위', '우승', '이동시간', '예산', '늘려야']

function visibleText(): string {
  let t = document.body.textContent ?? ''
  for (const ok of APPROVED_NEGATIONS) t = t.split(ok).join('')
  return t
}

function debrief(m: 'm2' | 'm3', prev: MissionResult | undefined) {
  const r = played[m]!
  const d = landscape.missions[m]
  return render(
    <DebriefPanel
      scenario={scenario}
      model={model}
      missionId={m}
      mission={d}
      status={r.status}
      mine={r.k15}
      base={current15}
      combo={comboFor(landscape, d)}
      prev={prev ? { n: m === 'm2' ? 1 : 2, k15: prev.k15 } : null}
      others={[{ label: '미션 1', mean: played.m1!.k15.meanDays, worst: played.m1!.k15.worstEmdDays }]}
      next={m === 'm2' ? { id: 'm3', reference: landscape.missions.m3.reference.x } : null}
      ghost={false}
      onToggleGhost={() => {}}
      compare={false}
      onToggleCompare={() => {}}
      onNext={() => {}}
      onAgain={() => {}}
      onHome={() => {}}
    />,
  )
}

describe('debrief for missions 2 and 3', () => {
  it('mission 2 compares with mission 1 at equal 15 days and points to mission 3', () => {
    debrief('m2', played.m1)
    const cmp = screen.getByRole('region', { name: '미션 1 배분과 비교 · 둘 다 15일' })
    expect(cmp.textContent).toMatch(/미션 1 배분보다 좋아진 마을 \d+곳, 나빠진 마을 \d+곳이에요/)
    // 평균을 조금 포기하고 가장 불리한 읍·면을 지켰다: 평균 ▼, 가장 불리한 읍·면 ▲
    const rows = within(cmp).getAllByRole('row')
    const row = (name: string) => rows.find((r) => r.textContent?.startsWith(name))!.textContent ?? ''
    expect(row('평균 진료일')).toContain('나빠짐')
    expect(row('가장 불리한 읍·면')).toContain('좋아짐')
    expect(screen.getByText(/같은 15일로 "주 3일 이상 닿는 주민"을 높인 배분/)).toBeTruthy()
    expect(screen.getByText('참고 배분 · 두꺼운 서비스형')).toBeTruthy()
    // 한계 문장 5번(시내·민간 시설 없음)
    expect(document.body.textContent).toContain('민간 의원, 다른 시군의 시설은 모델에 없어요')
    expect(screen.getByRole('button', { name: '다음 미션' })).toBeTruthy()
    expect(document.body.textContent).toContain('5일이 늘어난 효과도 섞여')
    for (const w of BANNED) expect(visibleText()).not.toContain(w)
  })

  it('mission 3 has no next reference and leads to 세 개의 공주', () => {
    debrief('m3', played.m2)
    expect(screen.queryByText('다른 목표였다면')).toBeNull()
    expect(screen.getByRole('button', { name: '세 개의 공주 보기' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '미션 2 배분과 비교 · 둘 다 15일' })).toBeTruthy()
    // 한계 문장 3번(진료일은 의료서비스 전체가 아님)
    expect(document.body.textContent).toContain('진료일은 게임용 단위예요')
    // 배분 지형도에 다른 미션 결과 ●
    expect(document.body.textContent).toContain('다른 미션 결과 (15일)')
  })

  it('without a played previous mission there is no comparison block', () => {
    debrief('m2', undefined)
    expect(screen.queryByRole('region', { name: /배분과 비교/ })).toBeNull()
  })
})

describe('S6 세 개의 공주', () => {
  const results = finaleResults(played, landscape, evaluate) as FinaleResults

  function renderFinale(r: FinaleResults = results) {
    return render(
      <>
        <FinaleBoard
          results={r}
          scenario={scenario}
          geometry={geometry}
          model={model}
          manifest={manifest}
          hillshade={null}
          hover={null}
          onHover={() => {}}
          onOpen={() => {}}
          returnFocus={null}
        />
        <FinalePanel results={r} scenario={scenario} model={model} hover={null} focus={null} onHome={() => {}} onData={() => {}} />
      </>,
    )
  }

  it('shows exactly three allocations side by side, each on the same top-view map', () => {
    renderFinale()
    const cols = document.querySelectorAll('.finale-col')
    expect(cols).toHaveLength(3)
    expect([...cols].map((c) => c.getAttribute('data-mission'))).toEqual(['m1', 'm2', 'm3'])
    expect(document.querySelectorAll('.finale-col svg.minimap')).toHaveLength(3)
    for (const c of cols) {
      // 마을 161개, 지소 탑 10개
      expect(c.querySelectorAll('svg.minimap .minimap-tower')).toHaveLength(10)
      expect(c.querySelector('.alloc-strip')!.getAttribute('aria-label')).toMatch(/^보건지소별 진료일: 유구 \d/)
    }
    // 각 열은 자기 미션의 목표 지표만 표시한다(순위가 아니다).
    expect(cols[0].querySelector('.finale-fact.is-goal')!.textContent).toContain('평균 진료일')
    expect(cols[1].querySelector('.finale-fact.is-goal')!.textContent).toContain('가장 불리한 읍·면')
    expect(cols[2].querySelector('.finale-fact.is-goal')!.textContent).toContain('주 3일 이상 닿는 주민')
    // 표는 세 열(미션 1·2·3) + 행 머리
    const table = screen.getAllByRole('table')[0]
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4)
    expect(within(table).getAllByRole('row')).toHaveLength(7)
  })

  it('keeps the 15-day = real 10 + assumed 5 framing and all three data classes visible', () => {
    renderFinale()
    const text = document.body.textContent ?? ''
    expect(text).toContain('세 배분 모두 실제 10일 + 가정 5일 = 15일 기준 · 가상 정책실험')
    expect(text).toContain('주 15일 = 실제 10일 + 가정 5일')
    expect(text).toContain('지금 실제로 운영하는 주 10일과는 다른 가상 배분이에요')
    expect(document.querySelector('.badge-REAL_DATA')).toBeTruthy()
    expect(document.querySelector('.badge-DERIVED')).toBeTruthy()
    expect(document.querySelector('.badge-SIMULATION_ASSUMPTION')).toBeTruthy()
    expect(text).toContain('같은 자원이라도 목표에 따라 좋은 배분이 달라요')
    for (const w of BANNED) expect(visibleText()).not.toContain(w)
  })

  it('summary sentences use the computed values', () => {
    const lines = finaleSummary(results)
    const zeros = results.map((r) => zeroVillages(r.k15).length)
    expect(lines[1]).toBe(`진료가 닿지 않는 마을은 ${zeros[0]} · ${zeros[1]} · ${zeros[2]}곳이에요.`)
    const { union, all } = zeroOverlap(results.map((r) => r.k15))
    expect(union.length).toBeGreaterThan(all.length)
    expect(lines[2]).toContain(`${union.length}곳 가운데 세 배분 모두에서 닿지 않는 마을은 ${all.length}곳`)
    // 평균 폭이 0.5일을 넘으면 "비슷하지만"이라고 하지 않는다.
    const means = results.map((r) => r.k15.meanDays)
    expect(lines[0].includes('비슷하지만')).toBe(Math.max(...means) - Math.min(...means) <= 0.5)
  })

  it('marks skipped missions as reference allocations', () => {
    const r = finaleResults({ m2: played.m2 }, landscape, evaluate) as FinaleResults
    renderFinale(r)
    const chips = [...document.querySelectorAll('.finale-col .finale-chip')].map((c) => c.textContent)
    expect(chips[0]).toBe('참고 배분')
    expect(chips[1]).toMatch(/^(달성|미달) · 상위 \d+%$/)
    expect(chips[2]).toBe('참고 배분')
    expect(document.body.textContent).toContain('건너뛴 미션은 그 지표만 보면 가장 높은 배분 하나(참고 배분)로 채웠어요')
  })

  it('opens a column with the keyboard', () => {
    const opened: string[] = []
    render(
      <FinaleBoard
        results={results}
        scenario={scenario}
        geometry={geometry}
        model={model}
        manifest={manifest}
        hillshade={null}
        hover={null}
        onHover={() => {}}
        onOpen={(m) => opened.push(m)}
        returnFocus={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '어디에도 빈 곳이 없게 배분을 무대에서 크게 보기' }))
    expect(opened).toEqual(['m2'])
  })
})
