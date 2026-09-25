/**
 * 디브리핑 — 세계 위에서(설계안 6-17, UI_DESIGN_SYSTEM §9.4). 확정하면 HUD가 물러나고 카메라가 불 켜진 섬을 잠시 돈 뒤(감상),
 * 같은 세계 위에 결과가 선다: 미션명 → 판정 문장 → 6개 지표 표(현재 실제 · 내 배분 · 차이, 10-1 4번)
 * → 잃은 것(지도의 빨간 표지와 1:1) → Primary 하나 + Secondary. 판정은 문장과 숫자로만(별·배너·트로피 없음).
 * 배분 지형도·앞 미션 비교·다른 목표·한계는 [결과 자세히] Sheet에 그대로 있다(설계안 5-6 블록).
 */

import { useEffect, useRef } from 'react'

import { copy } from '../content/copy'
import type { Scenario } from '../data/types'
import { type MissionStatus, type LostSummary, kpiDeltas } from '../engine/compare'
import { people } from '../engine/format'
import type { Kpis } from '../engine/kpi'
import type { MissionId } from '../state/results'
import { Badge, Delta } from '../ui/common'
import { GOAL_KPI, KPI_NAME, diffText, fmtKpi } from '../ui/kpiText'
import { ArrowIcon } from '../ui/WorldHud'

/** 잃은 마을 이름을 몇 곳까지 문장에 적는가(나머지는 "외 n곳", 지도 표지와 같은 순서) */
const LOST_NAMES = 3

interface Props {
  scenario: Scenario
  missionId: MissionId
  status: MissionStatus
  mine: Kpis
  base: Kpis
  lost: LostSummary
  nextLabel: string
  onNext(): void
  onAgain(): void
  detailsOpen: boolean
  onDetails(): void
}

export function WorldDebrief(p: Props) {
  const h = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    h.current?.focus()
  }, [])
  const c = copy.missions[p.missionId]
  const deltas = kpiDeltas(p.mine, p.base)
  const goal = GOAL_KPI[p.missionId]
  // 같은 읍·면이 이어지면 읍·면 이름은 처음에만(이인면 만수리 151명, 오룡리 114명)
  const lostNames = p.lost.lost
    .slice(0, LOST_NAMES)
    .map((i, k, xs) => {
      const v = p.scenario.villages[i]
      const same = k > 0 && p.scenario.villages[xs[k - 1]].emd === v.emd
      const emd = p.scenario.emds.find((e) => e.id === v.emd)
      return `${emd && !same ? `${emd.name} ` : ''}${v.name} ${people(v.pop)}`
    })
    .join(', ')
  const [cKpi, cBase, cMine, cDiff] = copy.world.debriefCols
  return (
    <section className="world-result" aria-labelledby="s5-title" data-occlude>
      <div className="wr-eyebrow">{c.title}</div>
      <h2 id="s5-title" className={`verdict wr-verdict${p.status.achieved ? '' : ' missed'}`} tabIndex={-1} ref={h}>
        {p.status.achieved ? copy.debrief.achieved(p.status.topPercent) : copy.debrief.missed(p.status.topPercent)}
      </h2>
      <p className="wr-sub">{copy.world.debriefKpiTitle}</p>
      <table className="wr-table">
        <thead>
          <tr>
            <th scope="col">{cKpi}</th>
            <th scope="col">{cBase}</th>
            <th scope="col">{cMine}</th>
            <th scope="col">{cDiff}</th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((d) => (
            <tr key={d.key} className={`wr-row${d.key === goal ? ' is-goal' : ''}`}>
              <th scope="row">{KPI_NAME[d.key]}</th>
              <td className="num wr-from">{fmtKpi(d.key, d.base, p.base, p.scenario)}</td>
              <td className="num wr-mine">{fmtKpi(d.key, d.now, p.mine, p.scenario)}</td>
              <td className="num">{d.delta !== null && <Delta change={d.change} text={diffText(d)} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`wr-lost${p.lost.lost.length ? ' has-lost' : ''}`}>
        <span className="wr-lost-label">{copy.world.lostLabel}</span>
        {p.lost.lost.length > 0 ? (
          <>
            <b className="num">{copy.world.lostLine(p.lost.lost.length, people(p.lost.lostPop))}</b>
            <p className="num">
              {copy.world.lostDetail(lostNames, p.lost.lost.length - LOST_NAMES)} — {copy.world.lostOnMap}
            </p>
          </>
        ) : (
          <b>{copy.world.lostNone}</b>
        )}
      </div>
      <div className="wr-basis">
        <span className="wr-tags">
          <Badge cls="REAL_DATA">실제 10일</Badge>
          <Badge cls="SIMULATION_ASSUMPTION">가정 5일</Badge>
        </span>
        <span>{copy.debrief.mixedEffect}</span>
      </div>
      <div className="wr-actions">
        <button type="button" className="wr-primary" onClick={p.onNext}>
          {p.nextLabel}
          <ArrowIcon />
        </button>
        <button type="button" className="wr-link" onClick={p.onAgain}>
          {copy.debrief.again}
        </button>
        <button type="button" className="wr-link" aria-expanded={p.detailsOpen} onClick={p.onDetails}>
          {p.detailsOpen ? copy.world.debriefDetailsClose : copy.world.debriefDetails}
        </button>
      </div>
    </section>
  )
}
