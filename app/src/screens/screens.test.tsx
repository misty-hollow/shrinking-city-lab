/**
 * 미션 2·3 디브리핑과 S6 「세 개의 공주」(설계안 5-6, 5-7). 실제 생성 데이터로 그린다.
 * 확인: 세 결과를 정확히 받는다, 15일 = 실제 10일 + 가정 5일 표현, 배지 세 종류, 순위·점수·정답 없음,
 * 문장 속 숫자가 계산값과 같다.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { APPROVED_NEGATIONS, copy } from '../content/copy'
import type { Geometry, Landscape, Manifest, Scenario } from '../data/types'
import { lostVillages, overlapCategories, unreachableVillages, villageChangeCounts, zeroOverlap, zeroVillages } from '../engine/compare'
import { people } from '../engine/format'
import { type Kpis, buildModel, computeKpis } from '../engine/kpi'
import { type MissionResult, type Results, comboFor, finaleResults, makeEvaluate } from '../state/results'
import { withEdgeInsets } from '../stage/Stage'
import { changeSummary, lostPinOrder } from '../ui/changeSummary'
import { RegionCard, dockOrder } from '../ui/PlayPanel'
import { IntroCard, TutorialCard } from './Cards'
import { DataLimits } from './DataLimits'
import { DebriefPanel } from './Debrief'
import { WorldDebrief } from './WorldDebrief'
import { FinaleBoard, FinalePanel, type FinaleResults, finaleSummary } from './Finale'
import { WorldFinale } from './WorldFinale'

const dataDir = resolve(__dirname, '../../public/data')
const read = <T,>(name: string): T => JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8')) as T
const scenario = read<Scenario>('scenario.json')
const landscape = read<Landscape>('landscape.json')
const geometry = read<Geometry>('geometry.json')
const manifest = read<Manifest>('manifest.json')
const model = buildModel(scenario)
const ORDER = dockOrder(scenario)
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
    expect(text).toContain(copy.finale.closing)
    expect(text).toContain(copy.finale.lead)
    // 반례가 있는 단정(설계안 5-7 이전 문구)은 남지 않는다
    expect(text).not.toContain('늘 어느 지역의 희생')
    for (const w of BANNED) expect(visibleText()).not.toContain(w)
  })

  it('the closing claim holds for the shipped data: pushing each goal to the top gives a different allocation', () => {
    // 참고 배분 = 그 지표만 보면 가장 높은 배분. 다른 미션의 참고 배분은 그 지표에서 더 낮다(같은 배분이 둘을 동시에 최대로 만들지 않는다).
    const ms = ['m1', 'm2', 'm3'] as const
    const value = (x: readonly number[], m: (typeof ms)[number]) => {
      const k = computeKpis(model, x, 15)
      return m === 'm1' ? k.meanDays : m === 'm2' ? k.worstEmdDays : k.cov3Pop
    }
    for (const a of ms)
      for (const b of ms)
        if (a !== b) expect(value(landscape.missions[a].reference.x, b)).toBeLessThan(value(landscape.missions[b].reference.x, b))
  })

  it('summary sentences use the computed values and separate villages no allocation can reach', () => {
    const lines = finaleSummary(results, model)
    const zeros = results.map((r) => zeroVillages(r.k15))
    expect(lines[1]).toBe(`진료가 닿지 않는 마을은 ${zeros[0].length} · ${zeros[1].length} · ${zeros[2].length}곳이에요.`)
    // 행렬에서 바로: 15분 안에 지소가 하나도 없는 마을
    const unreachable = scenario.matrix.tenths.map((row, i) => (row.every((v) => v > 150) ? i : -1)).filter((i) => i >= 0)
    expect(unreachable.length).toBeGreaterThan(0)
    const pop = unreachable.reduce((s, i) => s + scenario.villages[i].pop, 0)
    expect(lines[2]).toBe(`그중 ${unreachable.length}곳(${people(pop)})은 도로망 15분 안에 보건지소가 하나도 없어서, 어느 지소에 진료일을 두어도 닿지 않아요.`)
    // 세 배분의 차이는 배분 때문에 닿지 않는 마을에서만 센다
    const { union, all } = zeroOverlap(results.map((r) => r.k15))
    const allocUnion = union.filter((i) => !unreachable.includes(i))
    const allocAll = all.filter((i) => !unreachable.includes(i))
    expect(allocUnion.length).toBeGreaterThan(allocAll.length)
    expect(lines[3]).toContain(`세 배분 중 한 번이라도 ${allocUnion.length}곳이고, 그중 세 배분 모두에서 닿지 않는 곳은 ${allocAll.length}곳`)
    // 평균 폭이 0.5일을 넘으면 "비슷하지만"이라고 하지 않는다.
    const means = results.map((r) => r.k15.meanDays)
    expect(lines[0].includes('비슷하지만')).toBe(Math.max(...means) - Math.min(...means) <= 0.5)
  })

  it('the same allocation confirmed in all three missions is described as the same, not as different', () => {
    // 세 미션 목표를 모두 넘는 배분(전수 계산에서 2,457개 중 하나): 유구 4 · 탄천 1 · 계룡 3 · 반포 1 · 정안 1 · 우성 4 · 신풍 1
    const X = [4, 0, 1, 3, 1, 0, 1, 4, 0, 1]
    const same: Results = { m1: evaluate('m1', X, 'played', 1), m2: evaluate('m2', X, 'played', 1), m3: evaluate('m3', X, 'played', 1) }
    for (const m of ['m1', 'm2', 'm3'] as const) expect(same[m]!.status.achieved).toBe(true)
    const r = finaleResults(same, landscape, evaluate) as FinaleResults
    const lines = finaleSummary(r, model)
    expect(lines[0]).not.toContain('비슷하지만')
    expect(lines).toContain(copy.finale.sameAllocLine)
    expect(lines.some((l) => l.includes('나머지는 배분에 따라 달라져요'))).toBe(false)
    renderFinale(r)
    const text = document.body.textContent ?? ''
    expect(text).toContain(copy.finale.leadSameAlloc)
    expect(text).not.toContain(copy.finale.lead)
    expect(text).not.toContain('달라졌어요')
    for (const w of BANNED) expect(visibleText()).not.toContain(w)
  })

  it('lists villages no allocation can reach once, apart from the per-mission lists', () => {
    renderFinale()
    const block = document.querySelector('.finale-unreachable')!
    expect(block.textContent).toContain(copy.finale.unreachableTitle(15))
    const names = unreachableVillages(model, 15).map((i) => scenario.villages[i].name)
    for (const n of names) expect(block.textContent).toContain(n)
    // 열별 목록에는 배분 때문에 0일이 된 마을만(어느 배분으로도 닿지 않는 마을은 빠진다)
    const u = new Set(unreachableVillages(model, 15))
    const items = [...document.querySelectorAll('.finale-zero > li')]
    expect(items).toHaveLength(3)
    items.forEach((li, c) => {
      const expected = zeroVillages(results[c].k15).filter((i) => !u.has(i)).length
      const summary = li.querySelector('summary')?.textContent ?? ''
      const listed = [...summary.matchAll(/ (\d+)/g)].reduce((s, m) => s + Number(m[1]), 0)
      expect(listed).toBe(expected)
    })
    expect(document.body.textContent).toContain(copy.finale.zeroTitle)
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
    fireEvent.click(screen.getByRole('button', { name: '가장 불리한 읍·면을 끌어올려라 배분을 무대에서 크게 보기' }))
    expect(opened).toEqual(['m2'])
  })
})

describe('S8 자료와 한계: 출처·이용조건 표기', () => {
  it('진료일정은 기준일·원본 주소·방문 전 확인과 함께, 이용조건은 별도 확인 필요로만 적는다', () => {
    render(<DataLimits manifest={manifest} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const s = manifest.sources.schedule
    expect(within(dialog).getByRole('link', { name: s.page_url })).toHaveProperty('href', s.page_url)
    expect(dialog.textContent).toContain(`${s.reference_date} 기준`)
    expect(dialog.textContent).toContain('방문 전에 해당 보건(지)소에 꼭 확인해 주세요')
    expect(s.usage_status).toContain('별도 확인 필요')
    // 기관에 문의·회신한 적이 없다. 회신·확인 요청이 있었던 것처럼 적지 않는다
    expect(s.usage_status).not.toMatch(/회신|확인 중|확인을 요청/)
    expect(dialog.textContent).toContain(s.usage_status)
    expect(dialog.textContent).not.toMatch(/공공누리 제\s*\d\s*유형[^.]*진료/)
  })

  it('미션 목표치는 상위 10% 경계를 내림한 값이라고 밝힌다(목표를 넘어도 상위 n%가 10보다 클 수 있다)', () => {
    render(<DataLimits manifest={manifest} onClose={() => {}} />)
    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text).toContain('상위 10% 경계값을 진료일은 0.1일, 주민은 100명 단위로 내린 값이에요')
    expect(text).toContain('목표를 넘는 배분은 10%보다 많을 수 있어요')
    expect(copy.world.debriefKpiTitle).toContain('상위 10% 경계를 내림한 값')
    // 문장의 근거: 전처리 규칙(내림)과 실제 비율. 목표를 넘는 배분 비율은 늘 10% 이상이고, 내림 규칙이 기록돼 있다.
    for (const m of ['m1', 'm2', 'm3'] as const) {
      const d = landscape.missions[m]
      expect(d.share_at_or_above_target).toBeGreaterThanOrEqual(0.1)
      expect(d.target_rule).toMatch(/상위 10% 경계값을 (0\.1일|100명) 단위로 내림/)
    }
    // 목표에 딱 맞춘 미션 1 배분은 '목표 달성'이면서 상위 10%를 넘는다 — 그래서 "상위 10% 경계"라고만 쓰면 모순이 된다.
    const at = read<{ cases: { name: string; threshold_min: number; x: number[] }[] }>('golden.json').cases.find(
      (c) => c.name === 'boundary_m1_at' && c.threshold_min === 15,
    )!
    const r = evaluate('m1', at.x, 'played', 1)
    expect(r.status.achieved).toBe(true)
    expect(r.status.topPercent).toBeGreaterThan(10)
  })

  it('인구 출처는 이용허락범위가 확인된 행정안전부 개방 자료이고, 계산 파일과의 대조를 밝힌다', () => {
    render(<DataLimits manifest={manifest} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const p = manifest.sources.population
    expect(p.publisher).toBe('행정안전부')
    expect(p.page_url).toMatch(/^https:\/\/www\.data\.go\.kr\/data\/15099158\//)
    expect(within(dialog).getByRole('link', { name: p.page_url })).toBeTruthy()
    expect(dialog.textContent).toContain(p.attribution)
    expect(dialog.textContent).toContain('행정안전부 공개 자료와 값이 모두 같아요')
  })
})

describe('지역 카드: 어느 배분으로도 닿지 않는 마을 표시', () => {
  it('marks only villages with no clinic inside the current threshold, and the mark follows the threshold', () => {
    for (const t of [10, 15, 20] as const) {
      const k = computeKpis(model, scenario.current_allocation, t)
      const u = new Set(unreachableVillages(model, t))
      for (let m = 0; m < scenario.emds.length; m++) {
        const { unmount } = render(
          <RegionCard m={m} k={k} t={t} scenario={scenario} model={model} alloc={scenario.current_allocation} populationDate="2026-08-31" onClose={() => {}} />,
        )
        const dark = scenario.villages.filter((_, i) => model.emd[i] === m && k.villageDays[i] < 1)
        const marked = scenario.villages.filter((_, i) => model.emd[i] === m && u.has(i))
        const items = [...document.querySelectorAll('.region-zero li')]
        expect(items).toHaveLength(dark.length)
        expect(document.querySelectorAll('.region-unreachable')).toHaveLength(marked.length)
        for (const li of items) {
          const v = dark.find((d) => li.textContent?.startsWith(`${d.name} · `))!
          expect(li.querySelector('.region-unreachable') !== null).toBe(marked.includes(v))
          if (marked.includes(v)) expect(li.textContent).toContain(copy.region.unreachable(t))
        }
        unmount()
      }
    }
  })
})

describe('S6 좁은 화면(768~1099): 표가 차지한 왼쪽 단을 무대가 피한다', () => {
  const results = finaleResults(
    { m1: evaluate('m1', A1, 'played', 1), m2: evaluate('m2', A2, 'played', 1), m3: evaluate('m3', A3, 'played', 1) },
    landscape,
    evaluate,
  ) as FinaleResults
  const world = (narrow: boolean) =>
    render(
      <WorldFinale
        results={results}
        scenario={scenario}
        model={model}
        current15={current15}
        narrow={narrow}
        focus="m1"
        onFocus={() => {}}
        overlap={overlapCategories(model, results.map((r) => r.k15), 15)}
        order={ORDER}
        base="current"
        onBase={() => {}}
        onBoard={() => {}}
        onHome={() => {}}
      />,
    )

  it('marks the table as a left edge only on narrow screens', () => {
    const { unmount } = world(true)
    expect(document.querySelector('.wf-table')!.getAttribute('data-occlude')).toBe('inset-left')
    unmount()
    world(false)
    // 넓은 화면은 지금까지처럼 피해야 할 판일 뿐(왼쪽 여백을 바꾸지 않는다)
    expect(document.querySelector('.wf-table')!.getAttribute('data-occlude')).toBe('true')
  })

  it('turns an inset-left panel into the left inset and leaves other panels alone', () => {
    const insets = { left: 0, right: 0, top: 16, bottom: 20 }
    const edge = document.createElement('div')
    edge.setAttribute('data-occlude', 'inset-left')
    const plain = document.createElement('div')
    plain.setAttribute('data-occlude', 'true')
    const rect = (l: number, r: number) => ({ left: l, right: r, top: 100, bottom: 600, width: r - l, height: 500, x: l, y: 100, toJSON() {} }) as DOMRect
    edge.getBoundingClientRect = () => rect(24, 415)
    plain.getBoundingClientRect = () => rect(500, 760)
    document.body.append(plain)
    expect(withEdgeInsets(insets)).toBe(insets)
    document.body.append(edge)
    expect(withEdgeInsets(insets)).toEqual({ ...insets, left: 415 })
    // 이미 더 큰 왼쪽 여백(시작 화면 등)은 줄이지 않는다
    expect(withEdgeInsets({ ...insets, left: 600 }).left).toBe(600)
    edge.remove()
    plain.remove()
  })
})

describe('도입부·튜토리얼 설명은 데이터의 규칙과 맞는다(S1·S2)', () => {
  const intro = (step: 0 | 1 | 2) => render(<IntroCard step={step} scenario={scenario} manifest={manifest} onNext={() => {}} onSkip={() => {}} />)
  const tutorial = (step: 1 | 2 | 3, result: string | null = null) =>
    render(
      <TutorialCard step={step} triedText={null} needReturn={false} canNext result={result} onNext={() => {}} onSkip={() => {}} onStartMission={() => {}} />,
    )

  it('S1-2: one clinic per 읍·면, and the every-other-week rule the numbers come from', () => {
    // "읍·면마다 한 곳씩"의 근거: 지소 10곳이 읍·면 10곳에 하나씩
    expect(new Set(scenario.facilities.map((f) => f.emd)).size).toBe(scenario.emds.length)
    expect(scenario.facilities).toHaveLength(scenario.emds.length)
    intro(1)
    const text = document.body.textContent ?? ''
    expect(text).toContain('읍·면마다 한 곳씩 있는 공공 보건기관')
    expect(text).toContain('격주로 열리면 주 0.5일로 셌어요')
    expect(manifest.sources.schedule.conversion_rule).toContain('격주 = 주 0.5일')
  })

  it('S1-3: the 10 days are the clinics’ 의과 days, not the whole medical supply of Gongju', () => {
    intro(2)
    const text = document.body.textContent ?? ''
    expect(scenario.rules.current_total_days).toBe(10)
    expect(text).toContain('읍·면 보건지소 10곳의 의과 진료일을 모두 더하면 지금 주 10일')
    expect(text).toContain('의료진 수·진료 과목·시내 병원은 담지 않은 게임 단위')
    expect(text).not.toContain('공주의 진료자원')
    expect(document.querySelector('.badge-REAL_DATA')).toBeTruthy()
    expect(document.querySelector('.badge-SIMULATION_ASSUMPTION')).toBeTruthy()
  })

  it('S2-1 states the calculation the game uses: clinic days within 15 minutes, capped at 5', () => {
    tutorial(1)
    const text = document.body.textContent ?? ''
    expect(text).toContain('15분 안에 있는 보건지소들의 진료일을 더하면')
    expect(text).toContain('최대 주 5일')
    expect(scenario.rules.resident_cap_days).toBe(5)
    expect(scenario.rules.mission_threshold_min).toBe(15)
    // 엔진도 같은 정의: 기준 안 지소들의 진료일 합, 5일에서 멈춤
    const x = scenario.current_allocation
    const k = computeKpis(model, x, 15)
    scenario.villages.forEach((_, i) => {
      const sum = scenario.matrix.tenths[i].reduce((s, t, j) => s + (t <= 150 ? x[j] : 0), 0)
      expect(k.villageDays[i]).toBe(Math.min(5, sum))
    })
  })

  it('S2-2 names the buttons to press; S2-3 bridges to the mission with real 10 + assumed 5', () => {
    const { unmount } = tutorial(2)
    expect(document.body.textContent).toContain('오른쪽 위 10분 · 15분 · 20분 중 다른 시간을 눌러 보세요')
    unmount()
    tutorial(3, '신풍에 하루를 놓았어요.')
    const text = document.body.textContent ?? ''
    expect(text).toContain('실제 10일에 가정 5일을 더한 15일')
    expect(scenario.rules.added_assumption_days).toBe(5)
    expect(scenario.rules.mission_budget).toBe(15)
    for (const w of BANNED) expect(visibleText()).not.toContain(w)
  })

  it('S2-3 result sentence uses 닿는 진료일 instead of the unexplained word 두께', () => {
    expect(copy.tutorial.step3Result('신풍', 0, 29)).toBe('신풍에 하루를 놓았어요. 처음으로 닿은 마을은 없고, 의당 쪽 29개 마을은 닿는 진료일이 줄었어요.')
    expect(copy.tutorial.step3Result('신풍', 3, 29)).not.toContain('두께')
  })
})

describe('결산 두 칸: 나아진 주민 / 불리해진 주민(설계안 5-6)', () => {
  function worldDebrief(m: 'm1' | 'm2' | 'm3', x: readonly number[], opts: { mapVsCurrent?: boolean; prev?: { n: number; k15: Kpis } | null } = {}) {
    const r = evaluate(m, x, 'played', 1)
    render(
      <WorldDebrief
        scenario={scenario}
        model={model}
        missionId={m}
        status={r.status}
        mine={r.k15}
        base={current15}
        prev={opts.prev ?? null}
        nextLabel="다음 미션"
        onNext={() => {}}
        onAgain={() => {}}
        detailsOpen={false}
        onDetails={() => {}}
        mapVsCurrent={opts.mapVsCurrent ?? true}
      />,
    )
    return { r, ch: changeSummary(r.k15, current15, model) }
  }
  const side = (label: string) => [...document.querySelectorAll('.wr-side')].find((el) => el.textContent?.startsWith(label))!.textContent ?? ''

  it('mission 2 reference: no village loses access, yet the worse side states the villages that dropped a day or more', () => {
    const { ch } = worldDebrief('m2', A2)
    expect(ch.worse.lost).toEqual([])
    expect(ch.worse.thinner.length).toBeGreaterThan(0)
    const worse = side(copy.world.worseLabel)
    expect(worse).toContain(copy.world.sideTotal(people(ch.worse.pop), ch.worse.villages.length))
    expect(worse).toContain(copy.world.worseParts(0, ch.worse.thinner.length))
    // 0곳인 갈래는 적지 않는다
    expect(worse).not.toContain('닿지 않게 됨')
    const better = side(copy.world.betterLabel)
    expect(better).toContain(copy.world.sideTotal(people(ch.better.pop), ch.better.villages.length))
    expect(better).toContain(copy.world.betterParts(ch.better.newly.length, ch.better.more.length))
    // 어디서: 주민이 가장 많이 바뀐 읍·면이 먼저
    expect(worse).toContain(`주로 ${scenario.emds[ch.worse.emds[0].m].name}`)
    expect(document.body.textContent).toContain(copy.world.mapGlyphs)
    // 끊긴 마을이 없으면 빨간 표지 문장도 없다
    expect(document.body.textContent).not.toContain(copy.world.lostOnMap)
  })

  it('mission 1 reference: lost villages are named with the red map pin; none only dropped while still reached', () => {
    const { ch } = worldDebrief('m1', A1)
    expect(ch.worse.lost.length).toBeGreaterThan(0)
    expect(ch.worse.thinner).toEqual([])
    expect(side(copy.world.worseLabel)).toContain(copy.world.worseParts(ch.worse.lost.length, 0))
    expect(side(copy.world.worseLabel)).not.toContain('하루 이상 줄어듦')
    expect(document.body.textContent).toContain(copy.world.lostOnMap)
    // 문장의 이름 = 지도의 빨간 표지(App이 같은 lostPinOrder로 상위 3곳에 표지를 단다): 주민이 많은 순
    const named = lostPinOrder(ch.worse.lost, model.pop).slice(0, 3)
    expect(model.pop[named[0]]).toBeGreaterThanOrEqual(model.pop[named[1]])
    const line = [...document.querySelectorAll('.wr-change p')].map((e) => e.textContent ?? '').find((t) => t.includes(copy.world.lostOnMap))!
    let at = -1
    for (const i of named) {
      const pos = line.indexOf(`${scenario.villages[i].name} ${people(scenario.villages[i].pop)}`)
      expect(pos).toBeGreaterThan(at)
      at = pos
    }
  })

  it('sides never overlap and follow the ±1 day rule', () => {
    for (const [m, x] of [['m1', A1], ['m2', A2], ['m3', A3]] as const) {
      const r = evaluate(m, x, 'played', 1)
      const ch = changeSummary(r.k15, current15, model)
      expect(ch.better.villages.filter((i) => ch.worse.villages.includes(i))).toEqual([])
      // 규칙을 만족하는 마을이 빠짐없이, 만족하지 않는 마을은 하나도 들어가지 않는다
      const better = new Set(ch.better.villages)
      for (let i = 0; i < model.nV; i++) {
        const a = r.k15.villageDays[i]
        const b = current15.villageDays[i]
        expect(better.has(i)).toBe((b < 1 && a >= 1) || (b >= 1 && a - b >= 1))
      }
      const l = lostVillages(r.k15, current15, model.pop)
      expect(ch.worse.villages).toEqual([...l.lost, ...l.thinner].sort((p, q) => p - q))
      expect(ch.better.pop).toBe(ch.better.villages.reduce((n, i) => n + model.pop[i], 0))
      expect(ch.worse.emds.reduce((n, e) => n + e.pop, 0)).toBe(ch.worse.pop)
    }
  })

  it('mission 2 after mission 1: the same-15-days line counts villages with a day or more of change', () => {
    worldDebrief('m2', A2, { prev: { n: 1, k15: played.m1!.k15 } })
    const c = villageChangeCounts(played.m2!.k15, played.m1!.k15)
    expect(document.body.textContent).toContain(copy.world.prevLine(1, c.better, c.worse))
  })

  it('when the map compares against the previous mission, the ▲▼ sentence is left out', () => {
    worldDebrief('m2', A2, { mapVsCurrent: false })
    expect(document.body.textContent).not.toContain(copy.world.mapGlyphs)
  })

  it('the current allocation itself: both sides say none', () => {
    worldDebrief('m2', scenario.current_allocation)
    expect(side(copy.world.betterLabel)).toContain(copy.world.sideNone)
    expect(side(copy.world.worseLabel)).toContain(copy.world.sideNone)
    expect(document.body.textContent).not.toContain(copy.world.mapGlyphs)
  })

  it('details sheet also states reduced villages next to lost ones', () => {
    debrief('m2', played.m1)
    const lost = lostVillages(played.m2!.k15, current15, model.pop)
    expect(document.body.textContent).toContain(copy.debrief.thinnerTitle(lost.thinner.length, people(lost.thinnerPop)))
  })
})

describe('S6 표: 현재 실제 대비 나아진·불리해진 주민', () => {
  it('shows each mission’s better and worse residents with village counts', () => {
    const results = finaleResults(played, landscape, evaluate) as FinaleResults
    render(
      <WorldFinale
        results={results}
        scenario={scenario}
        model={model}
        current15={current15}
        focus="m1"
        onFocus={() => {}}
        overlap={overlapCategories(model, results.map((r) => r.k15), 15)}
        order={ORDER}
        base="current"
        onBase={() => {}}
        onBoard={() => {}}
        onHome={() => {}}
      />,
    )
    const rows = [...document.querySelectorAll('.wf-change tr')].map((r) => r.textContent ?? '')
    expect(rows[0]).toBe(copy.finale.changeHead)
    for (const [k, label] of [['better', copy.world.betterLabel], ['worse', copy.world.worseLabel]] as const) {
      const row = rows.find((t) => t.startsWith(label))!
      for (const r of results) {
        const ch = changeSummary(r.k15, current15, model)[k]
        expect(row).toContain(copy.finale.changeCell(people(ch.pop), ch.villages.length))
      }
    }
  })
})

describe('지역 카드: 규모와 비율 먼저', () => {
  it('states count, residents and share before the folded list', () => {
    const k = computeKpis(model, scenario.current_allocation, 15)
    const u = new Set(unreachableVillages(model, 15))
    for (let m = 0; m < scenario.emds.length; m++) {
      const { unmount } = render(
        <RegionCard m={m} k={k} t={15} scenario={scenario} model={model} alloc={scenario.current_allocation} populationDate="2026-08-31" onClose={() => {}} />,
      )
      const dark = scenario.villages.map((v, i) => ({ v, i })).filter(({ i }) => model.emd[i] === m && k.villageDays[i] < 1)
      if (dark.length === 0) {
        expect(document.body.textContent).toContain(copy.region.zeroNone)
      } else {
        const pop = dark.reduce((n, { v }) => n + v.pop, 0)
        const pct = ((pop / scenario.emds[m].pop) * 100).toFixed(0)
        expect(document.querySelector('.region-zero-summary')!.textContent).toBe(copy.region.zeroSummary(dark.length, people(pop), pct))
        const nu = dark.filter(({ i }) => u.has(i)).length
        if (nu > 0) expect(document.body.textContent).toContain(copy.region.unreachableNote(nu, 15))
        else expect(document.body.textContent).not.toContain('어느 배분으로도 닿지 않음')
        // 목록은 접혀 있다(details)
        expect(document.querySelector('details.region-zero-list')!.hasAttribute('open')).toBe(false)
      }
      unmount()
    }
  })
})

describe('S6 겹쳐 보기(설계안 6-19)', () => {
  const results = finaleResults(
    { m1: evaluate('m1', A1, 'played', 1), m2: evaluate('m2', A2, 'played', 1), m3: evaluate('m3', A3, 'played', 1) },
    landscape,
    evaluate,
  ) as FinaleResults
  const ov = overlapCategories(model, results.map((r) => r.k15), 15)
  const views: string[] = []
  const draw = () =>
    render(
      <WorldFinale
        results={results}
        scenario={scenario}
        model={model}
        current15={current15}
        focus="overlap"
        onFocus={(v) => views.push(v)}
        overlap={ov}
        order={ORDER}
        base="current"
        onBase={() => {}}
        onBoard={() => {}}
        onHome={() => {}}
      />,
    )

  it('shows four tabs with the overlap selected, and no change base (no ▲▼ in this view)', () => {
    const { unmount } = draw()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false'])
    expect(tabs[0].textContent).toContain(copy.world.overlapTab)
    // 증감 기준 줄은 자리만 남고(보기를 바꿔도 섬이 그대로) 보이지도 읽히지도 않는다
    const base = document.querySelector<HTMLElement>('.wf-base')!
    expect(base.style.visibility).toBe('hidden')
    expect(base.getAttribute('aria-hidden')).toBe('true')
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    fireEvent.keyDown(tabs[0], { key: 'End' })
    expect(views.slice(-2)).toEqual(['m1', 'm3'])
    unmount()
  })

  it('lists the four groups with village and resident counts that add up to all 161 villages', () => {
    const { unmount } = draw()
    const rows = [...document.querySelectorAll('.wf-ov-cats tr')]
    expect(rows).toHaveLength(4)
    rows.forEach((r, k) => {
      expect(r.textContent).toContain(copy.world.overlapCats[k].title)
      expect(r.querySelector('.wf-ov-n')?.textContent).toBe(copy.world.overlapCount(ov.counts[k].villages))
      expect(r.querySelector('.wf-ov-pop')?.textContent).toBe(people(ov.counts[k].pop))
    })
    expect(document.querySelector('.wf-ov-total')?.textContent).toBe(copy.world.overlapTotal(161, people(model.totalPop)))
    unmount()
  })

  it('shows each mission’s clinic days in one table (west → east), equal to the confirmed allocations', () => {
    const { unmount } = draw()
    const head = [...document.querySelectorAll('.wf-ov-alloc thead th')].map((th) => th.textContent)
    expect(head).toEqual(ORDER.map((j) => scenario.facilities[j].short))
    const body = [...document.querySelectorAll('.wf-ov-alloc tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent === '·' ? 0 : Number(td.textContent))))
    expect(body).toEqual(results.map((r) => ORDER.map((j) => r.alloc[j])))
    unmount()
  })

  it('opens the 6×3 table and the fixed sentences on demand', () => {
    const { unmount } = draw()
    expect(document.querySelector('.wf-kpis')).toBeNull()
    const btn = screen.getByRole('button', { name: copy.world.overlapKpis })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelectorAll('.wf-kpis tbody:not(.wf-change) tr')).toHaveLength(6)
    for (const line of finaleSummary(results, model)) expect(document.body.textContent).toContain(line)
    unmount()
  })
})
