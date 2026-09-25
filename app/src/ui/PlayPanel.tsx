/**
 * 플레이 HUD 조각(설계안 6-16, 6-17, UI_DESIGN_SYSTEM §8·§9). 미션 깃발과 **6개 지표(작게, 늘 함께 — 10-1 4번)**가
 * 왼쪽 위에 배경판 없이 표 한 개로 서고, 지소는 세계 속 말풍선(ui/Markers.tsx)으로 조작한다. 여기의 지소 도크(FacilityDock)는
 * 3D를 쓸 수 없는 브라우저의 대체 조작이다(키보드만으로도 플레이, 5-11). 자세한 지표·읍·면 목록은 [지표 자세히] Sheet에서.
 */

import { useState } from 'react'

import { copy } from '../content/copy'
import type { MissionData, Scenario } from '../data/types'
import { type KpiDelta, type MissionStatus, kpiDeltas } from '../engine/compare'
import { allocDays, days1, minutes, missionDays, nearDays, pct, people, signed, weekDays } from '../engine/format'
import { type Kpis, type Model, type Threshold, villagesReachedBy } from '../engine/kpi'
import type { Emphasis, StageEvent } from '../stage/StageController'
import type { MissionId } from '../state/results'
import { Cells, Delta, DeltaLegend } from './common'
import { diffText } from './kpiText'
import { useFollowNumber, useSettled } from './useLight'

/** 미션마다 목표가 되는 KPI 줄 */
export const GOAL_TILE: Record<MissionId, string> = { m1: 'mean', m2: 'worst', m3: 'cov3' }

// --- 지소 도크: 서쪽 → 동쪽(카드 자리가 지도 자리를 닮게) -----------------------------------------

interface DockProps {
  scenario: Scenario
  model: Model
  alloc: readonly number[]
  T: Threshold
  allowed(j: number): { inc: boolean; dec: boolean }
  onInc(j: number): void
  onDec(j: number): void
  hover: number | null
  stageHover: number | null
  selected: number | null
  onHover(j: number | null): void
  onSelect(j: number | null): void
  /** 카드 더블클릭 = 그 지소 읍·면으로 카메라 초점(설계안 5-5 ③). 한 번 클릭은 카메라를 움직이지 않는다. */
  onFocusCamera?(j: number): void
  /** 막힌 조작(풀이 비었는데 + 등): 소리·흔들림으로만 알린다 */
  onDenied?(j: number): void
  coached?: boolean
}

/** 지소를 서쪽에서 동쪽 순서로(동률이면 원래 순서) */
export function dockOrder(scenario: Scenario): number[] {
  return scenario.facilities.map((_, j) => j).sort((a, b) => scenario.facilities[a].x - scenario.facilities[b].x || a - b)
}

export function FacilityDock(p: DockProps) {
  const emdName = new Map(p.scenario.emds.map((e) => [e.id, e.name]))
  const order = dockOrder(p.scenario)
  const onKey = (j: number) => (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    const ok = p.allowed(j)
    if (e.key === '+' || e.key === '=' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (ok.inc) p.onInc(j)
      else p.onDenied?.(j)
    } else if (e.key === '-' || e.key === '_' || e.key === 'ArrowLeft') {
      e.preventDefault()
      if (ok.dec) p.onDec(j)
      else p.onDenied?.(j)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const cards = (e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('.fac-row') ?? []) as NodeListOf<HTMLElement>
      const at = order.indexOf(j)
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? order.length - 1 : at + (e.key === 'ArrowDown' ? 1 : -1)
      cards[Math.max(0, Math.min(order.length - 1, next))]?.focus()
    }
  }
  return (
    <section className={`dock${p.coached ? ' coach' : ''}`} aria-label={copy.facility.listLabel} data-occlude>
      <ul className="fac-list">
        {order.map((j) => {
          const f = p.scenario.facilities[j]
          const reach = villagesReachedBy(p.model, j, p.T)
          const reachPop = reach.reduce((s, i) => s + p.model.pop[i], 0)
          const ok = p.allowed(j)
          const days = p.alloc[j]
          const sub = copy.facility.reach(p.T, reach.length, people(reachPop))
          const cls = [
            'fac-row',
            p.hover === j || p.stageHover === j ? 'is-hover' : '',
            p.selected === j ? 'is-selected' : '',
            days <= 0 ? 'is-closed' : '',
          ].join(' ')
          return (
            <li
              key={f.id}
              className={cls}
              data-j={j}
              data-facility={f.short}
              tabIndex={0}
              title={`${f.name} · ${sub}`}
              aria-label={`${f.name} ${emdName.get(f.emd)} ${days <= 0 ? copy.facility.closed : allocDays(days)}. ${sub}. ${copy.facility.keysHint}`}
              onKeyDown={onKey(j)}
              onFocus={(e) => {
                if (e.target === e.currentTarget) {
                  p.onHover(j)
                  p.onSelect(j)
                }
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) p.onHover(null)
              }}
              onMouseEnter={() => p.onHover(j)}
              onMouseLeave={() => p.onHover(null)}
              onClick={() => p.onSelect(j)}
              onDoubleClick={() => p.onFocusCamera?.(j)}
            >
              <div className="fac-top">
                <strong className="fac-name">{f.short}</strong>
                <span className={`fac-value num${days <= 0 ? ' closed' : ''}`}>{days <= 0 ? copy.facility.closed : allocDays(days)}</span>
              </div>
              <Cells value={days} />
              <div className="fac-controls">
                <button
                  type="button"
                  className="step-btn"
                  aria-label={copy.facility.dec(f.short)}
                  disabled={!ok.dec}
                  onClick={(e) => {
                    e.stopPropagation()
                    p.onDec(j)
                  }}
                >
                  −
                </button>
                <button
                  type="button"
                  className="step-btn"
                  aria-label={copy.facility.inc(f.short)}
                  disabled={!ok.inc}
                  onClick={(e) => {
                    e.stopPropagation()
                    p.onInc(j)
                  }}
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="sr-only">{copy.facility.keysHint}</p>
    </section>
  )
}

// --- 6개 지표: 빛을 따라 오르는 숫자 --------------------------------------------------------

interface KpiProps {
  k: Kpis
  base: Kpis | null
  T: Threshold
  scenario: Scenario
  onEmphasis(e: Emphasis): void
  /** 이 미션의 목표 줄 id(GOAL_TILE) */
  goal?: string
  /** 직전 조작의 빛 순서(없으면 바로) */
  event?: StageEvent | null
  /** 세계 위 작은 목록(이름 · 값 · 증감만). 설명·보조 줄은 [지표 자세히]의 전체 목록에 */
  compact?: boolean
  /** 증감 범례의 기준선 이름(현재 실제(10일) / 미션 n 배분) */
  baseLabel?: string
}

function Follow({ v, ev, fmt }: { v: number; ev: StageEvent | null; fmt: (n: number) => string }) {
  return <>{fmt(useFollowNumber(v, ev))}</>
}

export function KpiLedger({ k, base, T, scenario, onEmphasis, goal, event = null, compact = false, baseLabel = copy.kpi.legendCurrent }: KpiProps) {
  const [info, setInfo] = useState<string | null>(null)
  const total = scenario.totals.pop
  // 증감과 가장 불리한 읍·면 이름은 빛이 다 닿은 뒤에 바뀐다(정확한 순간값).
  const settledK = useSettled(k, event)
  const settledBase = useSettled(base, event)
  const deltas = settledBase ? kpiDeltas(settledK, settledBase) : null
  const d = (key: KpiDelta['key']) => {
    const v = deltas?.find((x) => x.key === key)
    return v && v.delta !== null ? <Delta change={v.change} text={diffText(v)} /> : null
  }
  const e = copy.kpi.explain
  const worstName = scenario.emds[settledK.worstEmd].name
  const rows: { id: string; name: string; value: React.ReactNode; short?: React.ReactNode; sub?: React.ReactNode; delta: React.ReactNode; explain: string; emphasis: Emphasis }[] = [
    { id: 'mean', name: copy.kpi.meanDays, value: <Follow v={k.meanDays} ev={event} fmt={weekDays} />, sub: copy.kpi.meanDaysSub(T), delta: d('meanDays'), explain: e.meanDays(T), emphasis: null },
    {
      id: 'cov1',
      name: copy.kpi.cov1,
      value: <Follow v={k.cov1Pop} ev={event} fmt={(n) => `${people(n)} (${pct(n, total)})`} />,
      sub: copy.kpi.cov1Sub(people(settledK.zeroPop)),
      delta: d('cov1Pop'),
      explain: e.cov1(T),
      emphasis: 'zero',
    },
    { id: 'cov3', name: copy.kpi.cov3, value: <Follow v={k.cov3Pop} ev={event} fmt={(n) => `${people(n)} (${pct(n, total)})`} />, delta: d('cov3Pop'), explain: e.cov3(T), emphasis: 'thick' },
    {
      id: 'worst',
      name: copy.kpi.worst,
      value: worstName,
      short: (
        <>
          {worstName} <Follow v={k.worstEmdDays} ev={event} fmt={weekDays} />
        </>
      ),
      sub: <Follow v={k.worstEmdDays} ev={event} fmt={(n) => copy.region.days(weekDays(n))} />,
      delta: d('worstEmdDays'),
      explain: e.worst,
      emphasis: 'worst',
    },
    {
      id: 'gap',
      name: copy.kpi.gap,
      value: <Follow v={k.gapDays} ev={event} fmt={(n) => copy.kpi.gapValue(days1(n))} />,
      short: <Follow v={k.gapDays} ev={event} fmt={weekDays} />,
      sub: copy.kpi.gapSub(scenario.emds[settledK.bestEmd].name, days1(settledK.emdDays[settledK.bestEmd]), worstName, days1(settledK.worstEmdDays)),
      delta: d('gapDays'),
      explain: e.gap,
      emphasis: 'worst',
    },
    {
      id: 'p90',
      name: copy.kpi.p90,
      // 운영 지소가 생기거나 모두 없어지는 순간(값 ↔ 없음)도 빛이 다 닿은 뒤에 바뀐다.
      value:
        settledK.p90Tenths === null ? (
          <span className="kpi-value none">{copy.kpi.none}</span>
        ) : (
          <Follow v={k.p90Tenths ?? settledK.p90Tenths} ev={event} fmt={minutes} />
        ),
      sub: settledK.timeBandPop ? <TimeBands bands={settledK.timeBandPop} total={total} /> : null,
      delta: d('p90Tenths'),
      explain: e.p90,
      emphasis: null,
    },
  ]
  // 세계 위 작은 표(§8.1): 행 28px · 이름 · 값 · 증감. 미션 지표는 굵게 + 왼쪽 2px 크림 선(태그는 Sheet의 한 행에만)
  if (compact)
    return (
      <section className="kpi-list" aria-label={copy.debrief.table}>
        <div className="kpi-grid">
          {rows.map((t) => (
            <div
              key={t.id}
              className={`kpi${goal === t.id ? ' is-goal' : ''}`}
              onMouseEnter={() => onEmphasis(t.emphasis)}
              onMouseLeave={() => onEmphasis(null)}
            >
              <span className="kpi-name">{t.name}</span>
              <span className="kpi-value num">{t.short ?? t.value}</span>
              {t.delta ?? <span />}
            </div>
          ))}
        </div>
        {base && <DeltaLegend base={baseLabel} />}
      </section>
    )
  return (
    <section className="hud-panel ledger" aria-label={copy.debrief.table} data-occlude>
      <div className="block-title">
        <span>{copy.hud.kpiTitle}</span>
        {base && <DeltaLegend base={baseLabel} />}
      </div>
      <div className="kpi-grid-full">
        {rows.map((t) => (
          <div
            key={t.id}
            className={`kpi${goal === t.id ? ' is-goal' : ''}${info === t.id ? ' is-info' : ''}`}
            onMouseEnter={() => onEmphasis(t.emphasis)}
            onMouseLeave={() => onEmphasis(null)}
          >
            <div className="kpi-head">
              <span className="kpi-name">{t.name}</span>
              <button
                type="button"
                className="info-btn"
                aria-label={`${t.name} ${copy.kpi.info}`}
                aria-expanded={info === t.id}
                onClick={() => setInfo(info === t.id ? null : t.id)}
                onFocus={() => onEmphasis(t.emphasis)}
                onBlur={() => onEmphasis(null)}
              >
                i
              </button>
              {goal === t.id && <span className="goal-tag">{copy.missionCard.goalTag}</span>}
              {t.delta}
            </div>
            <div className="kpi-line">
              <div className="kpi-value num">{t.value}</div>
            </div>
            {t.sub && <div className="kpi-sub">{t.sub}</div>}
            {info === t.id && (
              <div className="popover" role="note">
                <p>{t.explain}</p>
                <span className="badge badge-DERIVED">{copy.classes.DERIVED}</span>{' '}
                <span className="badge badge-SIMULATION_ASSUMPTION">{copy.classes.SIMULATION_ASSUMPTION}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

const BAND_COLORS = ['#F2B84B', '#C98F2A', '#7A6A4A', '#3A3B3F']

function TimeBands({ bands, total }: { bands: number[]; total: number }) {
  return (
    <>
      <div className="bands" aria-hidden="true">
        {bands.map((b, k) => (b > 0 ? <i key={k} style={{ flex: b, background: BAND_COLORS[k] }} /> : null))}
      </div>
      <div className="bands-legend num">{copy.kpi.bands.map((name, k) => `${name} ${pct(bands[k], total)}`).join(' · ')}</div>
      <div className="kpi-sub">{copy.kpi.p90Sub}</div>
    </>
  )
}

// --- 읍·면 목록(서랍) ------------------------------------------------------------------

interface EmdListProps {
  k: Kpis
  base: Kpis | null
  scenario: Scenario
  model: Model
  highlight: number | null
  onHover(m: number | null): void
  onOpen(m: number): void
}

export function EmdList(p: EmdListProps) {
  const [sort, setSort] = useState<'low' | 'name'>('low')
  const zeroVillages = (m: number) => {
    let n = 0
    for (let i = 0; i < p.model.nV; i++) if (p.model.emd[i] === m && p.k.villageDays[i] < 1) n++
    return n
  }
  const order = p.scenario.emds.map((_, m) => m)
  if (sort === 'low') order.sort((a, b) => p.k.emdDays[a] - p.k.emdDays[b] || p.k.emdZeroPop[b] - p.k.emdZeroPop[a] || a - b)
  else order.sort((a, b) => p.scenario.emds[a].name.localeCompare(p.scenario.emds[b].name, 'ko'))
  return (
    <section className="emd-block" aria-label={copy.emdList.title}>
      <div className="block-title">
        <span>{copy.emdList.title}</span>
        <span className="sort">
          <button type="button" aria-pressed={sort === 'low'} onClick={() => setSort('low')}>
            {copy.emdList.sortLow}
          </button>
          <button type="button" aria-pressed={sort === 'name'} onClick={() => setSort('name')}>
            {copy.emdList.sortName}
          </button>
        </span>
      </div>
      <ul className="emd-list">
        {order.map((m) => {
          const e = p.scenario.emds[m]
          const v = p.k.emdDays[m]
          const b = p.base?.emdDays[m]
          const dd = b === undefined ? null : v - b
          const change = dd === null ? 'same' : dd >= 0.05 ? 'better' : dd <= -0.05 ? 'worse' : 'same'
          const zero = copy.emdList.zeroVillages(zeroVillages(m))
          return (
            <li key={e.id}>
              <button
                type="button"
                className={`emd-row${p.highlight === m ? ' is-hover' : ''}${p.k.worstEmd === m ? ' is-worst' : ''}`}
                onMouseEnter={() => p.onHover(m)}
                onMouseLeave={() => p.onHover(null)}
                onFocus={() => p.onHover(m)}
                onBlur={() => p.onHover(null)}
                onClick={() => p.onOpen(m)}
              >
                <span className="name">
                  {e.name}
                  <span className="zero">
                    {zero}
                    {p.k.worstEmd === m ? ` · ${copy.village.worstTag}` : ''}
                  </span>
                </span>
                <span className="num">{weekDays(v)}</span>
                {dd === null ? <span /> : <Delta change={change} text={change === 'same' ? '±0' : signed(dd)} />}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// --- 미션 깃발 ---------------------------------------------------------------------------

interface MissionCardProps {
  missionId: MissionId
  mission: MissionData
  status: MissionStatus
  /** 미션 판정 기준(15분) 결과. 화면 기준 T와 상관없다 */
  k15: Kpis
  scenario: Scenario
  T: Threshold
  /** 확정 버튼(세계 HUD에서는 오른쪽 아래 모서리에 따로 있다) */
  canConfirm?: boolean
  onConfirm?(): void
  /** 기준선 `직전 확정 배분`으로 바로 비교(있을 때만) */
  last?: { n: number; on: boolean; onToggle(on: boolean): void } | null
  /** 가리키는 조작을 하면 바뀔 미션 값(점선 태그로 hero 아래에) */
  previewValue?: string | null
}

/** hero 숫자: `주 1.2일` → 단위는 작게, 숫자는 크게(한 덩어리로 끊지 않는다) */
function HeroValue({ text }: { text: string }) {
  const m = /^(주 )?([\d.,]+)(.*)$/.exec(text)
  if (!m) return <>{text}</>
  return (
    <>
      {m[1] && <span className="hv-unit">{m[1]}</span>}
      <span className="hv-num">{m[2]}</span>
      {m[3] && <span className="hv-unit">{m[3]}</span>}
    </>
  )
}

export function MissionCard(p: MissionCardProps) {
  const { mission, status } = p
  const c = copy.missions[p.missionId]
  const isPop = mission.kpi === 'cov3_pop'
  const fmt = (v: number) => (isPop ? people(v) : weekDays(v))
  const value = isPop ? people(status.value) : missionDays(status.value, status.target)
  const lead = c.title.slice(0, c.title.length - c.name.length)
  return (
    <section className={`hud-panel mission-card${status.achieved ? ' is-achieved' : ''}`} aria-label={c.title} data-occlude>
      <h2 className="flag-title">
        <span className="flag-lead">
          {lead.replace(/ · $/, '')}
          <span className="sr-only"> · </span>
        </span>
        {c.name}
      </h2>
      <div className="kpi-name">{c.kpiName} · 15분</div>
      <div className="mission-values">
        {/* key = 값: 바뀔 때마다 짧게 튄다. 판정값이라 보간하지 않고 정확한 값을 보인다(빛이 다 닿은 뒤). */}
        <span key={value} className="value num tick">
          {p.missionId === 'm2' && <small>{p.scenario.emds[p.k15.worstEmd].name} </small>}
          <HeroValue text={value} />
        </span>
        <span className="num target">{copy.missionCard.targetLabel(fmt(status.target))}</span>
      </div>
      {p.missionId === 'm1' && (
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(status.progress * 100)}
          aria-label={copy.missionCard.targetLabel(fmt(status.target))}
        >
          <i style={{ width: `${status.progress * 100}%` }} />
        </div>
      )}
      {p.missionId === 'm2' && <EmdStrip k={p.k15} scenario={p.scenario} target={status.target} />}
      {p.missionId === 'm3' && <ThicknessBar k={p.k15} total={p.scenario.totals.pop} target={status.target} />}
      <div className="small num flag-status">
        <span>
          {status.achieved
            ? copy.missionCard.achieved(status.topPercent)
            : `${isPop ? copy.missionCard.remainingPop(people(status.remaining)) : copy.missionCard.remainingDays(days1(status.remaining))} · ${copy.missionCard.notYet(status.topPercent)}`}
        </span>
        {p.previewValue && <span className="hv-preview">{copy.world.preview.hud(p.previewValue)}</span>}
      </div>
      {status.achieved && (
        <span key="stamp" className="stamp" aria-hidden="true">
          {copy.hud.goalReached}
        </span>
      )}
      {p.T !== 15 && <div className="chip-note">{copy.missionCard.judgedAt15}</div>}
      {p.last && (
        <button type="button" className="toggle compare-last" aria-pressed={p.last.on} onClick={() => p.last?.onToggle(!p.last.on)}>
          {p.last.on ? copy.missionCard.compareLastOff : copy.missionCard.compareLast(p.last.n)}
        </button>
      )}
      {p.onConfirm && (
        <div className="actions">
          <button type="button" className="btn btn-primary" disabled={!p.canConfirm} onClick={p.onConfirm}>
            {copy.missionCard.confirm}
          </button>
          {!p.canConfirm && <span className="small">{copy.pool.fillFirst}</span>}
        </div>
      )}
    </section>
  )
}

/** 미션 2: 읍·면 10곳을 낮은 순으로 세우고 목표 가로선을 긋는다. 목표 아래 막대는 빗금(색만으로 구분하지 않는다). */
function EmdStrip({ k, scenario, target }: { k: Kpis; scenario: Scenario; target: number }) {
  const order = scenario.emds.map((_, m) => m).sort((a, b) => k.emdDays[a] - k.emdDays[b] || k.emdZeroPop[b] - k.emdZeroPop[a] || a - b)
  const below = order.filter((m) => k.emdDays[m] < target).length
  const label = order.map((m) => `${scenario.emds[m].name} ${missionDays(k.emdDays[m], target)}`).join(', ')
  return (
    <div className="emd-strip">
      <div className="small">{copy.missionCard.emdStrip(weekDays(target))}</div>
      <div className="emd-strip-plot" role="img" aria-label={`${copy.missionCard.emdStrip(weekDays(target))}. ${label}`}>
        <div className="emd-strip-target" style={{ bottom: `${(target / 5) * 100}%` }} aria-hidden="true" />
        {order.map((m) => (
          <div key={m} className="emd-strip-col" aria-hidden="true">
            <i className={`${k.emdDays[m] < target ? 'below' : ''}${m === k.worstEmd ? ' worst' : ''}`} style={{ height: `${Math.max(2, (k.emdDays[m] / 5) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="emd-strip-names" aria-hidden="true">
        {order.map((m) => (
          <span key={m} className={m === k.worstEmd ? 'worst' : ''}>
            {scenario.emds[m].name.slice(0, 2)}
            <b className="num">{nearDays(k.emdDays[m], target)}</b>
          </span>
        ))}
      </div>
      <div className="small num emd-strip-foot">
        <span>{copy.missionCard.belowTarget(below)}</span>
        <span>{copy.missionCard.gapLine(days1(k.gapDays))}</span>
      </div>
    </div>
  )
}

/** 미션 3: 주민을 진료 두께(주 3일 이상 / 1~2일 / 닿지 않음)로 쌓은 막대와 목표 세로선. */
function ThicknessBar({ k, total, target }: { k: Kpis; total: number; target: number }) {
  const parts = [k.cov3Pop, k.cov1Pop - k.cov3Pop, k.zeroPop]
  const names = copy.missionCard.thickParts
  const label = names.map((n, i) => `${n} ${people(parts[i])}`).join(', ')
  return (
    <div className="thick">
      <div className="small">{copy.missionCard.thickness(people(target))}</div>
      <div className="thick-bar" role="img" aria-label={`${copy.missionCard.thickness(people(target))}. ${label}`}>
        {parts.map((v, i) => (v > 0 ? <i key={i} className={`t${i}`} style={{ flex: v }} aria-hidden="true" /> : null))}
        <span className="thick-target" style={{ left: `${(target / total) * 100}%` }} aria-hidden="true" />
      </div>
      <ul className="thick-legend num" aria-hidden="true">
        {parts.map((v, i) => (
          <li key={i}>
            <i className={`t${i}`} />
            {names[i]} {people(v)}
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- 지역 카드 -----------------------------------------------------------------------

interface RegionCardProps {
  m: number
  k: Kpis
  scenario: Scenario
  model: Model
  alloc: readonly number[]
  populationDate: string
  onClose(): void
}

export function RegionCard(p: RegionCardProps) {
  const e = p.scenario.emds[p.m]
  const zero = p.scenario.villages.map((v, i) => ({ v, i })).filter(({ i }) => p.model.emd[i] === p.m && p.k.villageDays[i] < 1)
  const fj = p.scenario.facilities.findIndex((f) => f.emd === e.id)
  return (
    <aside className="hud-panel region-card" aria-label={e.name} data-occlude>
      <div className="block-title">
        <h3>{e.name}</h3>
        <button type="button" className="btn btn-small" onClick={p.onClose}>
          {copy.region.close}
        </button>
      </div>
      <div className="num">{copy.region.pop(people(e.pop))}</div>
      <div>
        {copy.region.pop65(e.pop65_pct.toFixed(1))} <span className="badge badge-REAL_DATA">{copy.region.pop65Badge(p.populationDate)}</span>
      </div>
      <div className="num region-days">{copy.region.days(weekDays(p.k.emdDays[p.m]))}</div>
      {fj >= 0 && <div className="small">{copy.region.facility(p.scenario.facilities[fj].name, p.alloc[fj] <= 0 ? copy.facility.closed : allocDays(p.alloc[fj]))}</div>}
      <div className="block-title region-zero-title">{copy.region.zeroTitle}</div>
      {zero.length === 0 ? (
        <div className="small">{copy.region.zeroNone}</div>
      ) : (
        <ul className="num region-zero">
          {zero.map(({ v }) => (
            <li key={v.id}>
              {v.name} · {people(v.pop)}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
