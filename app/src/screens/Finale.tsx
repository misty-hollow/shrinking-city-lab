/**
 * S6 「세 개의 공주」(설계안 5-7, 7-5). 미션 1·2·3의 15일 배분을 위에서 본 지도 세 장으로 나란히 놓고,
 * 같은 세 질문(평균 · 가장 불리한 읍·면 · 주 3일 이상 주민)에 세 배분이 서로 다르게 답하는 것을 보인다.
 * 순위·점수·정답·추천은 만들지 않는다. 각 열에는 그 미션이 무엇을 목표로 했는지만 표시한다.
 */

import { useEffect, useRef } from 'react'

import { copy } from '../content/copy'
import type { Geometry, Manifest, Scenario } from '../data/types'
import { zeroOverlap, zeroVillages } from '../engine/compare'
import { allocDays, days1, people, signed, weekDays } from '../engine/format'
import { type Model, emdShareAtLeast } from '../engine/kpi'
import type { Hillshade } from '../stage/hillshade'
import type { World } from '../stage/world'
import { type MissionId, type MissionResult, missionNumber } from '../state/results'
import { Badge, Cells, ClinicGlyph, Delta } from '../ui/common'
import { GOAL_KPI, KPI_KEYS, KPI_NAME, fmtKpi } from '../ui/kpiText'
import { MiniMap } from '../ui/MiniMap'

export type FinaleResults = readonly [MissionResult, MissionResult, MissionResult]

/** 평균이 "비슷하다"고 말해도 되는 폭(주 0.5일). 넘으면 값만 말한다. */
const SIMILAR_MEAN_DAYS = 0.5

/** 표 아래 고정 문장(설계안 5-7)의 값. 문장이 데이터와 어긋나지 않게 조건을 둔다. */
export function finaleSummary(results: FinaleResults): string[] {
  const ks = results.map((r) => r.k15)
  const means = ks.map((k) => weekDays(k.meanDays))
  const spread = Math.max(...ks.map((k) => k.meanDays)) - Math.min(...ks.map((k) => k.meanDays))
  const zeros = ks.map((k) => zeroVillages(k).length)
  const { union, all } = zeroOverlap(ks)
  const out = [copy.finale.meanLine(means[0], means[1], means[2], spread <= SIMILAR_MEAN_DAYS), copy.finale.zeroLine(zeros[0], zeros[1], zeros[2])]
  if (union.length === 0) out.push(copy.finale.noZero)
  else if (all.length === union.length) out.push(copy.finale.sameZero)
  else out.push(copy.finale.overlapLine(union.length, all.length))
  return out
}

export function chipOf(r: MissionResult): string {
  if (r.source === 'reference') return copy.finale.reference
  return r.status.achieved ? copy.finale.achieved(r.status.topPercent) : copy.finale.missed(r.status.topPercent)
}

function emdList(scenario: Scenario, ms: number[]): string {
  return ms.length === 0 ? copy.finale.noneEmds : ms.map((m) => scenario.emds[m].name).join(' · ')
}

// --- 무대 쪽: 세 장의 지도 -------------------------------------------------------------

interface BoardProps {
  results: FinaleResults
  scenario: Scenario
  geometry: Geometry
  model: Model
  manifest: Manifest
  hillshade: Hillshade | null
  /** 무대와 같은 집 자리(없으면 마을마다 기호 하나) */
  world?: World | null
  hover: MissionId | null
  onHover(m: MissionId | null): void
  onOpen(m: MissionId): void
  /** 돌아왔을 때 포커스를 줄 열 */
  returnFocus: MissionId | null
}

export function FinaleBoard(p: BoardProps) {
  const h = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (p.returnFocus) document.getElementById(`finale-open-${p.returnFocus}`)?.focus()
    else h.current?.focus()
    // 처음 열릴 때와 크게 보기에서 돌아올 때만.
  }, [])
  return (
    <section className="finale-board" aria-labelledby="s6-title">
      <header className="finale-head">
        <h1 id="s6-title" tabIndex={-1} ref={h}>
          {copy.finale.title}
        </h1>
        <p className="finale-lead">{copy.finale.lead}</p>
        <div className="badges">
          <Badge cls="REAL_DATA">{copy.briefing.realBadge(p.manifest.display_dates.schedule)}</Badge>
          <Badge cls="SIMULATION_ASSUMPTION">{copy.briefing.assumptionBadge}</Badge>
          <span className="small">{copy.finale.basis}</span>
        </div>
      </header>
      <div className="finale-cols" onMouseLeave={() => p.onHover(null)}>
        {p.results.map((r) => (
          <FinaleColumn key={r.mission} r={r} {...p} />
        ))}
      </div>
      <FinaleLegend />
    </section>
  )
}

function FinaleColumn({ r, scenario, geometry, model, hillshade, world, hover, onHover, onOpen }: BoardProps & { r: MissionResult }) {
  const m = r.mission
  const c = copy.missions[m]
  const k = r.k15
  const goal = GOAL_KPI[m]
  const zero = zeroVillages(k)
  const zeroPop = zero.reduce((s, i) => s + model.pop[i], 0)
  const thin = scenario.emds.map((_, e) => e).filter((e) => k.emdDays[e] < 1)
  const thick = scenario.emds.map((_, e) => e).filter((e) => k.emdDays[e] >= 3)
  const share3 = emdShareAtLeast(model, k.villageDays, 3)
  const fact = (key: 'meanDays' | 'worstEmdDays' | 'cov3Pop', name: string, value: string) => (
    <div className={`finale-fact${goal === key ? ' is-goal' : ''}`}>
      <dt>
        {name}
        {goal === key && (
          <>
            <span className="goal-tag" aria-hidden="true">
              {copy.finale.goalShort}
            </span>
            <span className="sr-only">{copy.finale.goalTag}</span>
          </>
        )}
      </dt>
      <dd className="num">{value}</dd>
    </div>
  )
  return (
    <article
      className={`finale-col${hover === m ? ' is-hover' : hover ? ' is-dim' : ''}`}
      data-mission={m}
      aria-labelledby={`finale-col-${m}`}
      onMouseEnter={() => onHover(m)}
      onClick={() => onOpen(m)}
    >
      <div className="finale-col-head">
        <span className="kicker">{copy.finale.col(missionNumber(m))}</span>
        <span className={`finale-chip${r.source === 'reference' ? ' is-reference' : ''}`}>{chipOf(r)}</span>
      </div>
      <h2 id={`finale-col-${m}`}>{c.name}</h2>
      <MiniMap
        geometry={geometry}
        scenario={scenario}
        k={k}
        alloc={r.alloc}
        hillshade={hillshade}
        world={world}
        label={copy.finale.mapLabel(c.name, zero.length, `${scenario.emds[k.worstEmd].name} ${weekDays(k.worstEmdDays)}`)}
      />
      <AllocStrip scenario={scenario} alloc={r.alloc} />
      <dl className="finale-facts">
        {fact('meanDays', copy.finale.factMean, weekDays(k.meanDays))}
        {fact('worstEmdDays', copy.finale.factWorst, `${scenario.emds[k.worstEmd].name} ${weekDays(k.worstEmdDays)}`)}
        {fact('cov3Pop', copy.finale.factCov3, people(k.cov3Pop))}
      </dl>
      <p className="finale-line num">{copy.finale.factZero(zero.length, people(zeroPop))}</p>
      <p className="finale-line">{copy.finale.thinEmds(emdList(scenario, thin))}</p>
      <p className="finale-line" title={thick.map((e) => `${scenario.emds[e].name} ${Math.round(share3[e] * 100)}%`).join(' · ')}>
        {copy.finale.thickEmds(emdList(scenario, thick))}
      </p>
      <button
        type="button"
        id={`finale-open-${m}`}
        className="link-button finale-open"
        aria-label={copy.finale.open(c.name)}
        onFocus={() => onHover(m)}
        onBlur={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          onOpen(m)
        }}
      >
        {copy.finale.openHint}
      </button>
    </article>
  )
}

/** 지소 10곳의 탑을 한 줄로(칸 1개 = 진료일 1일). 정확한 값은 패널 표에도 있다. */
function AllocStrip({ scenario, alloc }: { scenario: Scenario; alloc: readonly number[] }) {
  const label = `${copy.finale.allocStrip}: ${scenario.facilities.map((f, j) => `${f.short} ${alloc[j]}`).join(', ')}`
  return (
    <div className="alloc-strip" role="img" aria-label={label}>
      {scenario.facilities.map((f, j) => (
        <span key={f.id} className={alloc[j] < 1 ? 'is-closed' : ''} aria-hidden="true">
          <span className="alloc-tower">
            {[4, 3, 2, 1, 0].map((c) => (
              <i key={c} className={alloc[j] - c >= 1 ? 'on' : ''} />
            ))}
          </span>
          <b className="num">{alloc[j]}</b>
          <small>{f.short}</small>
        </span>
      ))}
    </div>
  )
}

function FinaleLegend() {
  return (
    <ul className="finale-legend" aria-label={copy.legend.title}>
      <li>
        <svg className="swatch" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="#FFB347" opacity="0.35" />
          <circle cx="8" cy="8" r="2.6" fill="#FFD27A" />
        </svg>
        {copy.legend.villageFull}
      </li>
      <li>
        <svg className="swatch" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="4" y="5" width="8" height="6" fill="#E9DFCC" />
          <circle cx="8" cy="8" r="1.8" fill="#FFD27A" />
        </svg>
        {copy.legend.villageHalf}
      </li>
      <li>
        <svg className="swatch" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="4" y="5" width="8" height="6" fill="#E9DFCC" stroke="#2A2F35" strokeWidth="0.8" />
        </svg>
        {copy.legend.villageEmpty}
      </li>
      <li>{copy.legend.house}</li>
      <li>
        <ClinicGlyph days={3} size={18} />
        {copy.legend.tower}
      </li>
      <li>
        <svg className="swatch" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M1 9 H17" stroke="#E3ECF4" strokeWidth="2.4" strokeDasharray="4 3" />
        </svg>
        {copy.kpi.worst}
      </li>
    </ul>
  )
}

// --- 패널: 비교 표와 문장 ---------------------------------------------------------------

/** 좁은 패널의 세 열 표: 읍·면 이름은 따로 한 줄, 격차는 행 이름이 말하므로 일수만. 값은 중간에서 끊지 않는다. */
function KpiCell({ k, kpi, scenario }: { k: MissionResult['k15']; kpi: (typeof KPI_KEYS)[number]; scenario: Scenario }) {
  if (kpi === 'worstEmdDays')
    return (
      <>
        <span className="nowrap">{scenario.emds[k.worstEmd].name}</span> <span className="nowrap">{weekDays(k.worstEmdDays)}</span>
      </>
    )
  if (kpi === 'gapDays') return <span className="nowrap">{weekDays(k.gapDays)}</span>
  return <span className="nowrap">{fmtKpi(kpi, k[kpi], k, scenario)}</span>
}

interface PanelProps {
  results: FinaleResults
  scenario: Scenario
  model: Model
  hover: MissionId | null
  focus: MissionId | null
  onHome(): void
  onData(): void
}

export function FinalePanel(p: PanelProps) {
  const col = (m: MissionId) => (p.focus === m || p.hover === m ? 'is-hover' : '')
  const anyReference = p.results.some((r) => r.source === 'reference')
  const summary = finaleSummary(p.results)
  const head = (
    <tr>
      <th scope="col" />
      {p.results.map((r) => (
        <th key={r.mission} scope="col" className={col(r.mission)}>
          {copy.finale.col(missionNumber(r.mission))}
          <div className="small">{copy.missions[r.mission].name}</div>
          {r.source === 'reference' && <div className="finale-chip is-reference">{copy.finale.reference}</div>}
        </th>
      ))}
    </tr>
  )
  const byEmdZero = (r: MissionResult) => {
    const g = new Map<number, number[]>()
    for (const i of zeroVillages(r.k15)) g.set(p.model.emd[i], [...(g.get(p.model.emd[i]) ?? []), i])
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
  }
  return (
    <>
      <section className="block" aria-label={copy.finale.basis}>
        <div className="badges">
          <Badge cls="REAL_DATA">실제 10일</Badge>
          <Badge cls="SIMULATION_ASSUMPTION">가정 5일</Badge>
        </div>
        <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{copy.finale.basis}</p>
        <p className="small" style={{ margin: 0 }}>
          {copy.finale.notCurrent}
        </p>
        {anyReference && (
          <p className="small" style={{ margin: '4px 0 0' }}>
            {copy.finale.referenceNote}
          </p>
        )}
      </section>

      <section className="block">
        <div className="block-title">
          <span>{copy.finale.tableTitle}</span>
          <Badge cls="DERIVED">{copy.classes.DERIVED}</Badge>
        </div>
        <table className="kpi-table finale-table">
          <thead>{head}</thead>
          <tbody>
            {KPI_KEYS.map((key) => (
              <tr key={key}>
                <th scope="row">{KPI_NAME[key]}</th>
                {p.results.map((r) => {
                  const goal = GOAL_KPI[r.mission] === key
                  return (
                    <td key={r.mission} className={`${col(r.mission)}${goal ? ' is-goal' : ''}`}>
                      <KpiCell k={r.k15} kpi={key} scenario={p.scenario} />
                      {goal && <span className="sr-only"> ({copy.finale.goalTag})</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="small">{copy.finale.goalLegend}</div>
      </section>

      <section className="block">
        <div className="block-title">{copy.finale.allocTitle}</div>
        <table className="kpi-table finale-table">
          <thead>{head}</thead>
          <tbody>
            {p.scenario.facilities.map((f, j) => (
              <tr key={f.id}>
                <th scope="row">{f.short}</th>
                {p.results.map((r) => (
                  <td key={r.mission} className={col(r.mission)}>
                    <span className="nowrap">
                      <Cells value={r.alloc[j]} /> <span className="num">{r.alloc[j] < 1 ? copy.facility.closed : allocDays(r.alloc[j])}</span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{copy.finale.allocTotal}</th>
              <td colSpan={3} className="finale-total">
                {copy.finale.allocTotalValue}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="block">
        <div className="block-title">{copy.finale.emdTitle}</div>
        <table className="kpi-table finale-table">
          <thead>{head}</thead>
          <tbody>
            {p.scenario.emds.map((e, m) => (
              <tr key={e.id}>
                <th scope="row">{e.name}</th>
                {p.results.map((r, c) => {
                  const v = r.k15.emdDays[m]
                  const prev = c > 0 ? p.results[c - 1].k15.emdDays[m] : null
                  const d = prev === null ? null : v - prev
                  const change = d === null ? 'same' : d >= 0.05 ? 'better' : d <= -0.05 ? 'worse' : 'same'
                  return (
                    <td key={r.mission} className={`${col(r.mission)}${r.k15.worstEmd === m ? ' is-worst' : ''}`}>
                      <span className="num">{days1(v)}</span>
                      {d !== null && change !== 'same' && <Delta change={change} text={signed(d)} />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="small">{copy.finale.emdLegend}</div>
      </section>

      <section className="block">
        {summary.map((s) => (
          <p key={s} className="num" style={{ margin: '0 0 6px' }}>
            {s}
          </p>
        ))}
        <div className="block-title" style={{ marginTop: 10 }}>
          {copy.finale.zeroTitle}
        </div>
        <ul className="finale-zero">
          {p.results.map((r) => {
            const groups = byEmdZero(r)
            return (
              <li key={r.mission} className={col(r.mission)}>
                <strong>{copy.finale.col(missionNumber(r.mission))}</strong>{' '}
                {groups.length === 0 ? (
                  copy.finale.zeroNone
                ) : (
                  <details>
                    <summary className="num">
                      {groups.map(([m, list]) => `${p.scenario.emds[m].name} ${list.length}`).join(' · ')}
                    </summary>
                    <div className="small">
                      {groups.map(([m, list]) => (
                        <div key={m}>
                          <strong>{p.scenario.emds[m].name}</strong> {list.map((i) => p.scenario.villages[i].name).join(', ')}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="block finale-closing">
        <p>{copy.finale.closing}</p>
      </section>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={p.onHome}>
          {copy.finale.home}
        </button>
        <button type="button" className="btn" onClick={p.onData}>
          {copy.dataAndLimits}
        </button>
      </div>
    </>
  )
}
