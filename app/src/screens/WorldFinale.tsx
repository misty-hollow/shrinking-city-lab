/**
 * S6 「세 개의 공주」 — 같은 세계 위에서(설계안 6-17, 6-19). 위 가운데 탭으로 보기를 고른다.
 *   겹쳐 보기(기본): 세 배분을 한 땅에. 왼쪽 판은 마을 갈래 넷(마을 수·주민 수)과 보건지소별 진료일 3×10 표,
 *     [6개 지표 표]를 누르면 6×3 표와 고정 문장이 열린다. 무대는 창 불빛(셋 중 가장 낮은 단계)·세 칸 기호, 고른 갈래의 청록 집으로 말한다.
 *   미션 1·2·3: 말풍선의 칸과 마을의 불빛이 그 배분으로 바뀐다. 아래에는 세 배분의 6개 지표 한 표(자기 목표 칸만 굵게).
 * 위에서 본 지도 세 장 · 보건지소별 · 읍·면별 표는 [세 배분 나란히 보기]에 그대로 있다(설계안 5-7).
 * 순위·점수·정답·추천은 만들지 않는다. 갈래는 새 판정이 아니라 엔진의 「주 1일 이상 = 닿음」과 「기준 안 지소 없음」의 조합이다.
 */

import { useEffect, useRef, useState } from 'react'

import { copy } from '../content/copy'
import type { Scenario } from '../data/types'
import { people } from '../engine/format'
import type { Overlap } from '../engine/compare'
import type { Kpis, Model } from '../engine/kpi'
import type { FinaleBase, FinaleView } from '../state/game'
import { missionNumber } from '../state/results'
import { changeSummary } from '../ui/changeSummary'
import { Badge } from '../ui/common'
import { GOAL_KPI, KPI_KEYS, KPI_NAME, fmtKpi } from '../ui/kpiText'
import { ArrowIcon } from '../ui/WorldHud'
import { type FinaleResults, chipOf, finaleSummary } from './Finale'

interface Props {
  results: FinaleResults
  scenario: Scenario
  model: Model
  /** 현재 실제(10일) 배분의 15분 결과. 표 아래 나아진·불리해진 주민의 기준선 */
  current15: Kpis
  /** 좁은 화면(<1100): 표가 왼쪽 단을 차지하므로 무대가 그 오른쪽에 섬을 놓게 한다(Stage의 inset-left) */
  narrow?: boolean
  focus: FinaleView
  onFocus(m: FinaleView): void
  /** 겹쳐 보기의 마을 갈래(도로망 15분) */
  overlap: Overlap
  /** 지소 순서: 서쪽 → 동쪽(말풍선 Tab 순서와 같다) */
  order: readonly number[]
  /** 지도에서 강조할 갈래(누름 = 고정). 다시 누르면 끈다 */
  picked?: number | null
  onPick?(k: number): void
  /** 가리키거나 포커스한 갈래(잠깐 강조) */
  onHoverCat?(k: number | null): void
  base: FinaleBase
  onBase(b: FinaleBase): void
  onBoard(): void
  onHome(): void
}

export function WorldFinale(p: Props) {
  const h = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    h.current?.focus()
  }, [])
  const [kpiOpen, setKpiOpen] = useState(false)
  const overlapOn = p.focus === 'overlap'
  const summary = finaleSummary(p.results, p.model)
  const changes = p.results.map((r) => changeSummary(r.k15, p.current15, p.model))
  const options: { id: FinaleBase; label: string }[] = [
    { id: 'current', label: copy.finale.baseCurrent },
    ...p.results.filter((r) => r.mission !== p.focus).map((r) => ({ id: r.mission as FinaleBase, label: copy.finale.baseMission(missionNumber(r.mission)) })),
  ]
  const views: FinaleView[] = ['overlap', ...p.results.map((r) => r.mission)]
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = views.indexOf(p.focus)
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % views.length
    else if (e.key === 'ArrowLeft') n = (i + views.length - 1) % views.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = views.length - 1
    if (n < 0) return
    e.preventDefault()
    p.onFocus(views[n])
    document.getElementById(`finale-tab-${views[n]}`)?.focus()
  }
  const total = p.overlap.counts.reduce((a, c) => ({ villages: a.villages + c.villages, pop: a.pop + c.pop }), { villages: 0, pop: 0 })
  const kpiTable = (
    <>
      <table className="wf-kpis">
        <thead>
          <tr>
            <th scope="col">{copy.world.finaleTableTitle}</th>
            {p.results.map((r) => (
              <th key={r.mission} scope="col" className={r.mission === p.focus ? 'is-on' : ''}>
                {copy.finale.col(missionNumber(r.mission))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KPI_KEYS.map((key) => (
            <tr key={key}>
              <th scope="row">{KPI_NAME[key]}</th>
              {p.results.map((r) => {
                const goal = GOAL_KPI[r.mission] === key
                return (
                  <td key={r.mission} className={`num${r.mission === p.focus ? ' is-on' : ''}${goal ? ' is-goal' : ''}`}>
                    {fmtKpi(key, r.k15[key], r.k15, p.scenario)}
                    {goal && <span className="sr-only"> ({copy.finale.goalTag})</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {/* 세 배분이 현재 실제보다 나아지게·불리하게 만든 주민(설계안 5-7, 2026-10-10). 지도 증감 기준 [현재 실제]와 같은 비교 */}
        <tbody className="wf-change">
          <tr>
            <th scope="rowgroup" colSpan={p.results.length + 1}>
              {copy.finale.changeHead}
            </th>
          </tr>
          {(['better', 'worse'] as const).map((k) => (
            <tr key={k}>
              <th scope="row">{k === 'better' ? copy.world.betterLabel : copy.world.worseLabel}</th>
              {p.results.map((r, i) => (
                <td key={r.mission} className={`num${r.mission === p.focus ? ' is-on' : ''}`}>
                  {copy.finale.changeCell(people(changes[i][k].pop), changes[i][k].villages.length)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="wf-legend small">{copy.finale.goalLegend}</div>
      <div className="wf-summary num">
        {summary.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>
    </>
  )
  const basis = (
    <div className="wf-basis">
      <Badge cls="REAL_DATA">실제 10일</Badge>
      <Badge cls="SIMULATION_ASSUMPTION">가정 5일</Badge>
      <span>{copy.finale.basis}</span>
    </div>
  )
  return (
    <>
      <header className="wf-top" data-occlude>
        <h2 id="s6-title" className="wf-lead" tabIndex={-1} ref={h}>
          {copy.world.finaleLead}
        </h2>
        <div className="wf-tabs" role="tablist" aria-label={copy.world.finaleTabs} onKeyDown={onTabKey}>
          <button
            id="finale-tab-overlap"
            type="button"
            role="tab"
            aria-selected={overlapOn}
            tabIndex={overlapOn ? 0 : -1}
            className={`wf-tab wf-tab-overlap${overlapOn ? ' is-on' : ''}`}
            onClick={() => p.onFocus('overlap')}
          >
            <span className="wf-tab-name">{copy.world.overlapTab}</span>
            <small className="finale-chip">{copy.world.overlapTabSub}</small>
          </button>
          {p.results.map((r) => {
            const on = r.mission === p.focus
            return (
              <button
                key={r.mission}
                id={`finale-tab-${r.mission}`}
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                className={`wf-tab${on ? ' is-on' : ''}`}
                onClick={() => p.onFocus(r.mission)}
              >
                <span className="wf-tab-name">
                  <span className="num">{missionNumber(r.mission)}</span> · {copy.missions[r.mission].name}
                </span>
                <small className={`finale-chip${r.source === 'reference' ? ' is-reference' : ''}`}>{chipOf(r)}</small>
              </button>
            )
          })}
        </div>
        {/* 겹쳐 보기에는 증감 기준이 없다. 줄은 보이지 않게 자리만 남겨, 보기를 바꿔도 머리 높이(섬이 피하는 판)가 같다 */}
        <div className="wf-base" aria-hidden={overlapOn || undefined} style={overlapOn ? { visibility: 'hidden' } : undefined}>
          <span id="finale-base-label">{copy.finale.base}</span>
          <div className="wf-base-group" role="radiogroup" aria-labelledby="finale-base-label">
            {options.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={p.base === o.id} onClick={() => p.onBase(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      {overlapOn ? (
        <section className="wf-table wf-overlap" aria-label={copy.world.overlapAria} data-occlude={p.narrow ? 'inset-left' : true}>
          <p className="wf-ov-basis small">{copy.world.overlapBasis}</p>
          {/* 갈래 줄 = 지도와 잇는 손잡이: 누르면(Enter·Space) 그 마을들이 지도에서 청록으로 남고, 가리키면 잠깐 보인다 */}
          <ul className="wf-ov-cats" aria-label={copy.world.overlapCatsAria}>
            {p.overlap.counts.map((c, k) => (
              <li key={k} data-cat={k}>
                <button
                  type="button"
                  className={`wf-ov-cat${p.picked === k ? ' is-on' : ''}`}
                  aria-pressed={p.picked === k}
                  disabled={c.villages === 0}
                  onClick={() => p.onPick?.(k)}
                  onMouseEnter={() => p.onHoverCat?.(k)}
                  onMouseLeave={() => p.onHoverCat?.(null)}
                  onFocus={() => p.onHoverCat?.(k)}
                  onBlur={() => p.onHoverCat?.(null)}
                >
                  <span className="wf-ov-glyph" aria-hidden="true">
                    <OverlapGlyph cat={k} />
                  </span>
                  <span className="wf-ov-name">
                    {copy.world.overlapCats[k].title}
                    <small>{copy.world.overlapCats[k].sub}</small>
                  </span>
                  <span className="num wf-ov-n">{copy.world.overlapCount(c.villages)}</span>
                  <span className="num wf-ov-pop">{people(c.pop)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="wf-ov-total small num">
            <span>{copy.world.overlapHint}</span>
            <span>{copy.world.overlapTotal(total.villages, people(total.pop))}</span>
          </p>
          <table className="wf-ov-alloc num">
            <caption>{copy.world.overlapFacilities}</caption>
            <thead>
              <tr>
                <td />
                {p.order.map((j) => (
                  <th key={j} scope="col">
                    {p.scenario.facilities[j].short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.results.map((r) => (
                <tr key={r.mission}>
                  <th scope="row">{copy.finale.col(missionNumber(r.mission))}</th>
                  {p.order.map((j) => (
                    <td key={j} className={r.alloc[j] > 0 ? 'is-on' : ''}>
                      {r.alloc[j] > 0 ? r.alloc[j] : <span aria-label="0">·</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="wf-ov-links">
            <button type="button" className="wr-link" aria-expanded={kpiOpen} aria-controls="wf-ov-kpis" onClick={() => setKpiOpen(!kpiOpen)}>
              {copy.world.overlapKpis}
            </button>
            <button type="button" className="wr-link" onClick={p.onBoard}>
              {copy.world.finaleBoard}
            </button>
          </div>
          {kpiOpen && (
            <div id="wf-ov-kpis" className="wf-ov-kpis">
              {basis}
              {kpiTable}
            </div>
          )}
        </section>
      ) : (
        <section className="wf-table" aria-label={copy.world.finaleTableTitle} data-occlude={p.narrow ? 'inset-left' : true}>
          {basis}
          {kpiTable}
        </section>
      )}
      <div className="wf-end" data-occlude>
        <p className="wf-closing">
          {copy.finale.closing.split(/(?<=요\.) /).map((line, i) => (
            <span key={line}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
        <div className="wf-actions">
          {/* 겹쳐 보기에서는 왼쪽 판에 같은 링크가 있다(같은 이름의 버튼을 두 번 두지 않는다). 자리는 남겨 보기를 바꿔도 이 줄의 폭이 같다 */}
          <button
            type="button"
            className="wr-link"
            onClick={p.onBoard}
            aria-hidden={overlapOn || undefined}
            tabIndex={overlapOn ? -1 : undefined}
            style={overlapOn ? { visibility: 'hidden' } : undefined}
          >
            {copy.world.finaleBoard}
          </button>
          <button type="button" className="wr-primary" onClick={p.onHome}>
            {copy.finale.home}
            <ArrowIcon />
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * 겹쳐 보기 갈래 기호 = 지도에 실제로 보이는 모양(설계안 6-20·6-25): 0 불 켜진 집 · 1 세 칸 판 · 2·3 어두운 집
 * (모두 닿지 않음과 지소 없음은 지도에서 같은 어두운 집이다. 갈래 줄을 누르면 그 마을 집이 청록으로 선다)
 */
function OverlapGlyph({ cat }: { cat: number }) {
  const house = (lit: boolean) => (
    <g transform="translate(15 9)">
      <rect x="-5" y="-3" width="10" height="7" fill="#EFE6D6" />
      <path d="M-6.4 -2.6 L0 -7.6 L6.4 -2.6 Z" fill="#9A5A45" />
      <rect x="-3.4" y="-1" width="2.2" height="2.4" fill={lit ? '#FFD27A' : '#2F3A45'} />
      <rect x="1.2" y="-1" width="2.2" height="2.4" fill={lit ? '#FFD27A' : '#2F3A45'} />
    </g>
  )
  return (
    <svg className="swatch ov-glyph" width="30" height="20" viewBox="0 0 30 20">
      {cat === 0 && (
        <g>
          <ellipse cx="15" cy="12" rx="13" ry="7" fill="#FFB347" opacity="0.35" />
          {house(true)}
        </g>
      )}
      {cat === 1 && (
        <g>
          <rect x="3" y="5" width="24" height="10" rx="2" fill="#1B1D21" stroke="#EEE7DA" strokeWidth="1" />
          <rect x="5" y="7" width="6" height="6" rx="1" fill="#F2B84B" />
          <rect x="12" y="7" width="6" height="6" rx="1" fill="#45505B" />
          <rect x="19" y="7" width="6" height="6" rx="1" fill="#F2B84B" />
        </g>
      )}
      {(cat === 2 || cat === 3) && house(false)}
    </svg>
  )
}
