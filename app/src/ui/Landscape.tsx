/**
 * 배분 지형도(설계안 4-8, 5-6 블록 5). 축 고정: x 평균 진료일, y 가장 불리한 읍·면.
 * 구름 = B=15·T=15 가능한 배분 전부의 밀도(단일 색상 4단), ★ 내 배분, ◇ 현재 실제(10일),
 * ○ 우열 없는 배분. 모양이 정체를 말하고(색만 쓰지 않는다) 표 보기로도 읽을 수 있다.
 * 최적해를 제시하지 않는다. 우열 없는 배분이 여럿이라는 사실을 보인다.
 */

import { useState } from 'react'

import { copy } from '../content/copy'
import type { LandscapeCombo, Scenario } from '../data/types'
import { days1, people } from '../engine/format'

/** 어두운 Sheet 위(UI_DESIGN_SYSTEM §5): 밀도는 무채 4단, 표지는 크림 + 판 색 테두리. 호박빛(데이터의 빛)은 쓰지 않는다 */
const RAMP = ['#33353B', '#484B53', '#63676F', '#858990']
const INK = '#EEE7DA'
const GROUND = '#1C1D21'

interface Pt {
  mean: number
  worst: number
}

interface Props {
  combo: LandscapeCombo
  mine: Pt
  current: Pt
  scenario: Scenario
  /** 다른 미션에서 확정한 배분(●, 설계안 4-8) */
  others?: (Pt & { label: string })[]
}

export function Landscape({ combo, mine, current, scenario, others = [] }: Props) {
  const [tip, setTip] = useState<string | null>(null)
  const W = 360
  const H = 250
  const m = { l: 40, r: 12, t: 12, b: 36 }
  const step = combo.density.step
  const cells = combo.density.cells
  const xMax = Math.max(...cells.map((c) => (c[0] + 1) * step), mine.mean, current.mean, ...others.map((o) => o.mean)) + 0.1
  const yMax = Math.max(...cells.map((c) => (c[1] + 1) * step), mine.worst, current.worst, ...others.map((o) => o.worst)) + 0.1
  const sx = (v: number) => m.l + (v / xMax) * (W - m.l - m.r)
  const sy = (v: number) => H - m.b - (v / yMax) * (H - m.t - m.b)
  const logs = cells.map((c) => Math.log10(c[2]))
  const lmax = Math.max(...logs)
  const bin = (l: number) => Math.min(3, Math.floor((l / lmax) * 4))
  const xticks = Array.from({ length: Math.floor(xMax) + 1 }, (_, k) => k)
  const yticks = Array.from({ length: Math.floor(yMax) + 1 }, (_, k) => k)
  const pointTip = (name: string, p: Pt, extra = '') =>
    `${name} · 평균 진료일 주 ${days1(p.mean)}일 · 가장 불리한 읍·면 주 ${days1(p.worst)}일${extra}`
  return (
    <div className="landscape">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${copy.debrief.landscape}. ${copy.debrief.landscapeSentence}`}>
        {xticks.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={m.t} y2={H - m.b} stroke="#2E2F33" strokeWidth="1" />
            <text x={sx(t)} y={H - m.b + 14} fontSize="10" textAnchor="middle" fill="#8C8880">
              {t}
            </text>
          </g>
        ))}
        {yticks.map((t) => (
          <g key={`y${t}`}>
            <line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} stroke="#2E2F33" strokeWidth="1" />
            <text x={m.l - 6} y={sy(t) + 3} fontSize="10" textAnchor="end" fill="#8C8880">
              {t}
            </text>
          </g>
        ))}
        <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="#4A4B50" />
        <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} stroke="#4A4B50" />
        {cells.map((c, k) => (
          <rect
            key={k}
            x={sx(c[0] * step) + 0.5}
            y={sy((c[1] + 1) * step) + 0.5}
            width={Math.max(1, sx(step) - sx(0) - 1)}
            height={Math.max(1, sy(0) - sy(step) - 1)}
            fill={RAMP[bin(logs[k])]}
          />
        ))}
        {combo.front.map((f, k) => (
          <g
            key={`f${k}`}
            onMouseEnter={() =>
              setTip(pointTip(copy.debrief.legendFront, { mean: f.mean_days, worst: f.worst_emd_days }, ` · 주 3일 이상 ${people(f.cov3_pop)}`))
            }
            onMouseLeave={() => setTip(null)}
          >
            <circle cx={sx(f.mean_days)} cy={sy(f.worst_emd_days)} r="12" fill="transparent" />
            <circle cx={sx(f.mean_days)} cy={sy(f.worst_emd_days)} r="5.5" fill={GROUND} stroke={INK} strokeWidth="2" />
          </g>
        ))}
        <g onMouseEnter={() => setTip(pointTip(copy.debrief.legendCurrent, current))} onMouseLeave={() => setTip(null)}>
          <circle cx={sx(current.mean)} cy={sy(current.worst)} r="12" fill="transparent" />
          <path
            d={`M ${sx(current.mean)} ${sy(current.worst) - 7} l 7 7 l -7 7 l -7 -7 Z`}
            fill={GROUND}
            stroke={INK}
            strokeWidth="2"
          />
          <text
            x={sx(current.mean) - 9}
            y={sy(current.worst) - 10}
            fontSize="10"
            fill={INK}
            fontWeight="600"
            textAnchor="end"
            stroke={GROUND}
            strokeWidth="3"
            paintOrder="stroke"
          >
            {copy.debrief.legendCurrent}
          </text>
        </g>
        {others.map((o) => (
          <g key={o.label} onMouseEnter={() => setTip(pointTip(o.label, o))} onMouseLeave={() => setTip(null)}>
            <circle cx={sx(o.mean)} cy={sy(o.worst)} r="12" fill="transparent" />
            <circle cx={sx(o.mean)} cy={sy(o.worst)} r="5.5" fill={INK} stroke={GROUND} strokeWidth="1.5" />
            <text
              x={sx(o.mean) + 8}
              y={sy(o.worst) + 4}
              fontSize="10"
              fill={INK}
              fontWeight="700"
              stroke={GROUND}
              strokeWidth="3"
              paintOrder="stroke"
            >
              {o.label}
            </text>
          </g>
        ))}
        <g onMouseEnter={() => setTip(pointTip(copy.debrief.legendMine, mine))} onMouseLeave={() => setTip(null)}>
          <circle cx={sx(mine.mean)} cy={sy(mine.worst)} r="13" fill="transparent" />
          <Star cx={sx(mine.mean)} cy={sy(mine.worst)} />
          <text
            x={sx(mine.mean) + (sx(mine.mean) > W - 60 ? 6 : 0)}
            y={sy(mine.worst) + (sy(mine.worst) < 30 ? 22 : -13)}
            fontSize="11"
            fill={INK}
            fontWeight="700"
            textAnchor={sx(mine.mean) > W - 60 ? 'end' : 'middle'}
            stroke={GROUND}
            strokeWidth="3"
            paintOrder="stroke"
          >
            {copy.debrief.legendMine}
          </text>
        </g>
        <text x={(m.l + W - m.r) / 2} y={H - 4} fontSize="11" textAnchor="middle" fill="#8C8880">
          {copy.debrief.landscapeX}
        </text>
        <text x={10} y={(m.t + H - m.b) / 2} fontSize="11" textAnchor="middle" fill="#8C8880" transform={`rotate(-90 10 ${(m.t + H - m.b) / 2})`}>
          {copy.debrief.landscapeY}
        </text>
      </svg>
      <div className="chart-tip" aria-live="polite" style={{ visibility: tip ? 'visible' : 'hidden' }}>
        {tip ?? '·'}
      </div>
      <div className="landscape-legend">
        <span>
          <svg width="16" height="16" aria-hidden="true">
            <Star cx={8} cy={8} r={6} />
          </svg>
          {copy.debrief.legendMine}
        </span>
        <span>
          <svg width="16" height="16" aria-hidden="true">
            <path d="M 8 2 l 6 6 l -6 6 l -6 -6 Z" fill={GROUND} stroke={INK} strokeWidth="1.6" />
          </svg>
          {copy.debrief.legendCurrent}
        </span>
        <span>
          <svg width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="5" fill={GROUND} stroke={INK} strokeWidth="1.8" />
          </svg>
          {copy.debrief.legendFront} ({combo.front.length}개)
        </span>
        {others.length > 0 && (
          <span>
            <svg width="16" height="16" aria-hidden="true">
              <circle cx="8" cy="8" r="5" fill={INK} />
            </svg>
            {copy.debrief.legendOthers}
          </span>
        )}
        <span>
          <svg width="40" height="10" aria-hidden="true">
            {RAMP.map((c, k) => (
              <rect key={c} x={k * 10} y="0" width="9" height="10" fill={c} />
            ))}
          </svg>
          {copy.debrief.legendDensity(combo.n_alloc.toLocaleString('ko-KR'))}
        </span>
      </div>
      <details>
        <summary>{copy.debrief.tableView}</summary>
        <table className="kpi-table">
          <thead>
            <tr>
              <th>배분</th>
              <th>평균 진료일</th>
              <th>가장 불리한 읍·면</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{copy.debrief.legendMine}</td>
              <td>{days1(mine.mean)}</td>
              <td>{days1(mine.worst)}</td>
            </tr>
            <tr>
              <td>{copy.debrief.legendCurrent}</td>
              <td>{days1(current.mean)}</td>
              <td>{days1(current.worst)}</td>
            </tr>
            {others.map((o) => (
              <tr key={o.label}>
                <td>{o.label}</td>
                <td>{days1(o.mean)}</td>
                <td>{days1(o.worst)}</td>
              </tr>
            ))}
            {combo.front.map((f, k) => (
              <tr key={k}>
                <td>
                  {copy.debrief.legendFront} {k + 1}
                  <div className="small">
                    {f.x
                      .map((v, j) => (v > 0 ? `${scenario.facilities[j].short} ${v}` : null))
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </td>
                <td>{days1(f.mean_days)}</td>
                <td>{days1(f.worst_emd_days)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function Star({ cx, cy, r = 8 }: { cx: number; cy: number; r?: number }) {
  const pts: string[] = []
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const rr = k % 2 === 0 ? r : r * 0.45
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`)
  }
  return <polygon points={pts.join(' ')} fill={INK} stroke={GROUND} strokeWidth="2" paintOrder="stroke" />
}
