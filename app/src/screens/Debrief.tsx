import { useEffect, useRef, useState } from 'react'

import { LIMITS, copy } from '../content/copy'
import type { LandscapeCombo, MissionData, Scenario } from '../data/types'
import {
  type MissionStatus,
  emdChanges,
  kpiDeltas,
  lostVillages,
  topGains,
  villageChangeCounts,
} from '../engine/compare'
import { people, signed } from '../engine/format'
import type { Kpis, Model } from '../engine/kpi'
import type { MissionId } from '../state/results'
import { Badge, Delta, DeltaLegend } from '../ui/common'
import { KPI_NAME as NAME, diffText, fmtKpi as fmt } from '../ui/kpiText'
import { Landscape } from '../ui/Landscape'

/** 디브리핑 블록 7: 미션마다 다른 한계 문장(설계안 5-6 — M1=2번, M2=5번, M3=3번) */
const LIMIT_OF: Record<MissionId, number> = { m1: 1, m2: 4, m3: 2 }

interface Props {
  scenario: Scenario
  model: Model
  missionId: MissionId
  mission: MissionData
  status: MissionStatus
  /** 확정 배분, T=15 */
  mine: Kpis
  /** 현재 실제(10일), T=15 */
  base: Kpis
  combo: LandscapeCombo
  /** 앞 미션을 플레이했으면 그 결과(15일 대 15일 비교) */
  prev: { n: number; k15: Kpis } | null
  /** 배분 지형도의 ●(다른 미션 결과) */
  others: { label: string; mean: number; worst: number }[]
  /** 블록 6 '다른 목표였다면': 다음 미션의 참고 배분. 마지막 미션이면 없다 */
  next: { id: MissionId; reference: readonly number[] } | null
  ghost: boolean
  onToggleGhost(): void
  compare: boolean
  onToggleCompare(): void
  /** 잃은 마을 묶음(읍·면)을 누르면 무대에서 그 마을들에 차가운 윤곽을 켜고 초점을 옮긴다 */
  onShowLost?(m: number, villages: number[]): void
  onNext(): void
  onAgain(): void
  onHome(): void
  /** 세계 위 결과 글에 이미 버튼이 있으면 끈다(같은 버튼이 두 번 나오지 않게) */
  showActions?: boolean
}

export function DebriefPanel(p: Props) {
  const h = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    h.current?.focus()
  }, [])
  const [more, setMore] = useState(false)
  const c = copy.missions[p.missionId]
  const deltas = kpiDeltas(p.mine, p.base)
  const gains = topGains(deltas, p.model.totalPop)
  const lost = lostVillages(p.mine, p.base, p.model.pop)
  const byEmd = new Map<number, number[]>()
  for (const i of lost.lost) {
    const m = p.model.emd[i]
    byEmd.set(m, [...(byEmd.get(m) ?? []), i])
  }
  const groups = [...byEmd.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
  const shown = more ? groups : groups.slice(0, 5)
  return (
    <>
      {/* 1 판정 */}
      <section className="block">
        <h2 className="block-title" tabIndex={-1} ref={h} style={{ fontSize: 14 }}>
          {c.title}
        </h2>
        <div className={`verdict${p.status.achieved ? '' : ' missed'}`}>
          {p.status.achieved ? copy.debrief.achieved(p.status.topPercent) : copy.debrief.missed(p.status.topPercent)}
        </div>
        <div className="badges">
          <Badge cls="REAL_DATA">실제 10일</Badge>
          <Badge cls="SIMULATION_ASSUMPTION">가정 5일</Badge>
        </div>
        <p className="small" style={{ margin: 0 }}>
          {copy.debrief.mixedEffect}
        </p>
      </section>

      {/* 2 얻은 것 / 3 잃은 것 — 같은 크기로 나란히(설계안 5-6) */}
      <div className="gain-loss">
      <section className="block">
        <div className="block-title">{copy.debrief.gained}</div>
        {gains.length === 0 ? (
          <div className="small">{copy.debrief.gainedNone}</div>
        ) : (
          <ul className="gain-list">
            {gains.map((g) => (
              <li key={g.key}>
                {NAME[g.key]} {fmt(g.key, g.base, p.base, p.scenario)} → {fmt(g.key, g.now, p.mine, p.scenario)}{' '}
                <Delta change="better" text={diffText(g)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="block">
        <div className="block-title">{copy.debrief.lost}</div>
        {lost.lost.length > 0 ? (
          <>
            <div style={{ fontWeight: 700 }} className="num">
              {copy.debrief.lostTitle(lost.lost.length, people(lost.lostPop))}
            </div>
            <ul className="lost-list">
              {shown.map(([m, list]) => (
                <li key={m}>
                  {p.onShowLost ? (
                    <button type="button" className="lost-chip" onClick={() => p.onShowLost?.(m, list)}>
                      {p.scenario.emds[m].name}
                    </button>
                  ) : (
                    <strong>{p.scenario.emds[m].name}</strong>
                  )}{' '}
                  {list.map((i) => `${p.scenario.villages[i].name} ${people(p.scenario.villages[i].pop)}`).join(', ')}
                </li>
              ))}
            </ul>
            {groups.length > 5 && (
              <button type="button" className="link-button" onClick={() => setMore(!more)}>
                {more ? copy.debrief.less : copy.debrief.more(groups.length - 5)}
              </button>
            )}
          </>
        ) : lost.thinner.length > 0 ? (
          <div className="num">{copy.debrief.lostNoneButThinner(lost.thinner.length, people(lost.thinnerPop))}</div>
        ) : (
          <div>{copy.debrief.lostNone}</div>
        )}
      </section>
      </div>

      {/* 앞 미션과 비교: 둘 다 15일이라 차이는 배분 방식의 차이다(가정 5일 효과가 섞이지 않는다). */}
      {p.prev && <CompareBlock {...p} prev={p.prev} />}

      {/* 4 6개 지표 표 */}
      <section className="block">
        <div className="block-title">{copy.debrief.table}</div>
        <table className="kpi-table">
          <thead>
            <tr>
              <th scope="col">{copy.debrief.colKpi}</th>
              <th scope="col">{copy.debrief.colBase}</th>
              <th scope="col">{copy.debrief.colMine}</th>
              <th scope="col">{copy.debrief.colDiff}</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((d) => (
              <tr key={d.key}>
                <th scope="row">{NAME[d.key]}</th>
                <td>{fmt(d.key, d.base, p.base, p.scenario)}</td>
                <td>{fmt(d.key, d.now, p.mine, p.scenario)}</td>
                <td>{d.delta === null ? '' : <Delta change={d.change} text={diffText(d)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <DeltaLegend base={copy.kpi.legendCurrent} />
      </section>

      {/* 5 배분 지형도 */}
      <section className="block">
        <div className="block-title">{copy.debrief.landscape}</div>
        <p className="small" style={{ marginTop: 0 }}>
          {copy.debrief.landscapeSentence}
        </p>
        <Landscape
          combo={p.combo}
          mine={{ mean: p.mine.meanDays, worst: p.mine.worstEmdDays }}
          current={{ mean: p.base.meanDays, worst: p.base.worstEmdDays }}
          scenario={p.scenario}
          others={p.others}
        />
      </section>

      {/* 6 다른 목표였다면(마지막 미션에는 없다, 설계안 7-4) */}
      {p.next && (
        <section className="block">
          <div className="block-title">{copy.debrief.otherGoal}</div>
          <p style={{ margin: '0 0 6px' }}>{copy.debrief.otherGoalLine(copy.missions[p.next.id].kpiName)}</p>
          <div className="small">
            <strong>{copy.missions[p.next.id].reference}</strong> — {copy.missions[p.next.id].referenceNote}
          </div>
          <div className="small num" style={{ margin: '4px 0 8px' }}>
            {p.next.reference
              .map((v, j) => (v > 0 ? `${p.scenario.facilities[j].short} ${v}` : null))
              .filter(Boolean)
              .join(' · ')}
          </div>
          <button type="button" className="toggle" aria-pressed={p.ghost} onClick={p.onToggleGhost}>
            {p.ghost ? copy.debrief.ghostHide : copy.debrief.ghostShow}
          </button>
        </section>
      )}

      {/* 7 한계 한 줄 */}
      <section className="block">
        <div className="block-title">{copy.debrief.limitTitle}</div>
        <p style={{ margin: 0 }}>{LIMITS[LIMIT_OF[p.missionId]]}</p>
      </section>

      {/* 8 버튼 */}
      {p.showActions !== false && (
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={p.onNext}>
            {p.next ? copy.debrief.next : copy.debrief.toFinale}
          </button>
          <button type="button" className="btn" onClick={p.onAgain}>
            {copy.debrief.again}
          </button>
          <button type="button" className="btn" onClick={p.onHome}>
            {copy.debrief.home}
          </button>
        </div>
      )}
    </>
  )
}

function CompareBlock(p: Props & { prev: { n: number; k15: Kpis } }) {
  const { n, k15: prev } = p.prev
  const deltas = kpiDeltas(p.mine, prev)
  const counts = villageChangeCounts(p.mine, prev)
  const emd = emdChanges(p.mine, prev)
  const list = (change: 'better' | 'worse') => {
    const xs = emd.filter((e) => e.change === change)
    if (xs.length === 0) return <span className="small">{copy.debrief.compareNone}</span>
    return xs.map((e, k) => (
      <span key={e.m}>
        {k > 0 && ' · '}
        {p.scenario.emds[e.m].name} <Delta change={change} text={signed(e.delta)} />
      </span>
    ))
  }
  return (
    <section className="block compare-block" aria-label={copy.debrief.compareTitle(n)}>
      <div className="block-title">{copy.debrief.compareTitle(n)}</div>
      <p className="num" style={{ margin: '0 0 8px' }}>
        {copy.debrief.compareLine(n, counts.better, counts.worse)}
      </p>
      <table className="kpi-table">
        <thead>
          <tr>
            <th scope="col">{copy.debrief.colKpi}</th>
            <th scope="col">{copy.debrief.compareColPrev(n)}</th>
            <th scope="col">{copy.debrief.compareColMine}</th>
            <th scope="col">{copy.debrief.colDiff}</th>
          </tr>
        </thead>
        <tbody>
          {deltas.map((d) => (
            <tr key={d.key}>
              <th scope="row">{NAME[d.key]}</th>
              <td>{fmt(d.key, d.base, prev, p.scenario)}</td>
              <td>{fmt(d.key, d.now, p.mine, p.scenario)}</td>
              <td>{d.delta === null ? '' : <Delta change={d.change} text={diffText(d)} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="emd-change num">
        <strong>{copy.debrief.compareBetter}</strong> {list('better')}
      </div>
      <div className="emd-change num">
        <strong>{copy.debrief.compareWorse}</strong> {list('worse')}
      </div>
      <button type="button" className="toggle" aria-pressed={p.compare} onClick={p.onToggleCompare}>
        {p.compare ? copy.debrief.compareStageOff : copy.debrief.compareStage(n)}
      </button>
    </section>
  )
}
