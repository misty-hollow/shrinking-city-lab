/**
 * S6 「세 개의 공주」 — 같은 세계 위에서(설계안 6-17). 위 가운데에서 미션을 고르면 말풍선의 칸과 마을의 불빛만
 * 그 배분으로 바뀐다. 아래에는 세 배분의 6개 지표를 한 표로(자기 목표 칸만 굵게) — 누가 얻고 누가 잃는지가 여기서 읽힌다.
 * 위에서 본 지도 세 장 · 보건지소별 · 읍·면별 표는 [세 배분 나란히 보기]에 그대로 있다(설계안 5-7).
 * 순위·점수·정답·추천은 만들지 않는다.
 */

import { useEffect, useRef } from 'react'

import { copy } from '../content/copy'
import type { Scenario } from '../data/types'
import type { FinaleBase } from '../state/game'
import { type MissionId, missionNumber } from '../state/results'
import { Badge } from '../ui/common'
import { GOAL_KPI, KPI_KEYS, KPI_NAME, fmtKpi } from '../ui/kpiText'
import { ArrowIcon } from '../ui/WorldHud'
import { type FinaleResults, chipOf, finaleSummary } from './Finale'

interface Props {
  results: FinaleResults
  scenario: Scenario
  focus: MissionId
  onFocus(m: MissionId): void
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
  const summary = finaleSummary(p.results)
  const options: { id: FinaleBase; label: string }[] = [
    { id: 'current', label: copy.finale.baseCurrent },
    ...p.results.filter((r) => r.mission !== p.focus).map((r) => ({ id: r.mission as FinaleBase, label: copy.finale.baseMission(missionNumber(r.mission)) })),
  ]
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = p.results.findIndex((r) => r.mission === p.focus)
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const n = (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3
      p.onFocus(p.results[n].mission)
      document.getElementById(`finale-tab-${p.results[n].mission}`)?.focus()
    }
  }
  return (
    <>
      <header className="wf-top" data-occlude>
        <h2 id="s6-title" className="wf-lead" tabIndex={-1} ref={h}>
          {copy.world.finaleLead}
        </h2>
        <div className="wf-tabs" role="tablist" aria-label={copy.world.finaleTabs} onKeyDown={onTabKey}>
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
        <div className="wf-base">
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
      <section className="wf-table" aria-label={copy.world.finaleTableTitle} data-occlude>
        <div className="wf-basis">
          <Badge cls="REAL_DATA">실제 10일</Badge>
          <Badge cls="SIMULATION_ASSUMPTION">가정 5일</Badge>
          <span>{copy.finale.basis}</span>
        </div>
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
        </table>
        <div className="wf-legend small">{copy.finale.goalLegend}</div>
        <div className="wf-summary num">
          {summary.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>
      </section>
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
          <button type="button" className="wr-link" onClick={p.onBoard}>
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
