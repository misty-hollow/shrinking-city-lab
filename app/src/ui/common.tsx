import { type ReactNode, useId } from 'react'

import { copy } from '../content/copy'
import type { DataClass } from '../data/types'
import type { Change } from '../engine/compare'

/** 데이터 배지. 세 분류는 모양이 다르다(설계안 8-2): 꽉 찬 사각 / 테두리 사각 / 둥근 점선. */
export function Badge({ cls, children }: { cls: DataClass; children?: ReactNode }) {
  return (
    <span className={`badge badge-${cls}`}>
      <span className="sr-only">{copy.classes[cls]}: </span>
      {children ?? copy.classes[cls]}
    </span>
  )
}

/**
 * 증감 표시(UI_DESIGN_SYSTEM §9.1). 부호는 값의 방향(+0.7일, −7분), 색은 좋아짐/나빠짐. 화살표는 쓰지 않는다.
 * 색만으로 전하지 않도록 좋아짐/나빠짐 낱말을 화면 낭독용으로 함께 두고, 화면에는 범례(DeltaLegend)가 선다.
 */
export function Delta({ change, text }: { change: Change; text: string }) {
  const word = change === 'better' ? copy.kpi.better : change === 'worse' ? copy.kpi.worse : copy.kpi.same
  return (
    <span className={`delta ${change}`}>
      <span className="sr-only">{word} </span>
      {text}
    </span>
  )
}

/** 증감 범례: "현재 실제(10일) 대비 ■좋아짐 ■나빠짐" — 색 + 글자로 이중 표기 */
export function DeltaLegend({ base }: { base: string }) {
  return (
    <div className="delta-legend">
      <span>{copy.kpi.legendBase(base)}</span>
      <span className="dl-item">
        <i className="dl-sw better" aria-hidden="true" />
        {copy.kpi.better}
      </span>
      <span className="dl-item">
        <i className="dl-sw worse" aria-hidden="true" />
        {copy.kpi.worse}
      </span>
    </div>
  )
}

/** 진료등 등칸 다섯(도크·명판·표 공용). 켜진 칸 = 진료일, 격주 평균(0.5)은 반 칸. */
export function Cells({ value }: { value: number }) {
  return (
    <span className="cells" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((k) => {
        const f = value - k
        return <i key={k} className={f >= 1 ? 'on' : f >= 0.5 ? 'half' : ''} />
      })}
    </span>
  )
}

const WIN_ON = '#FFD27A'
const WIN_OFF = '#2F3A45'

/**
 * 무대와 같은 마을 기호(설계안 6-16): 집 두 채. 0 창이 어둡다 / 1 벽마다 창 하나 / 2 모든 창 + 빛 번짐 / 3 중립(창 없음).
 * 벽·지붕 색은 모든 단계에서 같다(0일 마을도 사람이 사는 집이다).
 */
export function HouseGlyph({ tier, size = 22 }: { tier: 0 | 1 | 2 | 3; size?: number }) {
  const gid = `hg${useId().replace(/:/g, '')}`
  const lit = (slot: number) => (tier === 3 ? null : tier === 2 || (tier === 1 && slot === 0) ? WIN_ON : WIN_OFF)
  const house = (x: number, y: number, s: number, roof: string) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-5" y="-4" width="10" height="7" fill="#EFE6D6" />
      <path d="M-6.2 -3.6 L0 -8.4 L6.2 -3.6 Z" fill={roof} />
      {lit(0) && <rect x="-3.6" y="-2" width="2.2" height="2.4" fill={lit(0)!} />}
      {lit(1) && <rect x="1.4" y="-2" width="2.2" height="2.4" fill={lit(1)!} />}
    </g>
  )
  return (
    <svg className="swatch house-glyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {tier === 2 && <ellipse cx="12" cy="15" rx="11" ry="7" fill={`url(#${gid})`} />}
      <defs>
        <radialGradient id={gid}>
          <stop offset="0" stopColor="#FFB347" stopOpacity="0.75" />
          <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
        </radialGradient>
      </defs>
      {house(8, 15, 0.95, '#6F7F8C')}
      {house(16.5, 18, 0.8, '#B8734E')}
    </svg>
  )
}

/** 무대와 같은 진료등 탑 기호: 등칸 다섯, 켜진 칸 = 진료일(아래부터). 격주 평균은 반 칸. */
export function ClinicGlyph({ days, size = 20 }: { days: number; size?: number }) {
  const H = 34
  return (
    <svg className="swatch clinic" width={(size * 16) / H} height={size} viewBox={`0 0 16 ${H}`} aria-hidden="true">
      <path d="M3.5 5 L8 1.5 L12.5 5 Z" fill="#2F5D50" />
      <rect x="4.5" y="5" width="7" height="26.5" fill="#2B3036" />
      {[0, 1, 2, 3, 4].map((k) => {
        const f = Math.max(0, Math.min(1, days - k))
        const y = 30.5 - (k + 1) * 5
        return (
          <g key={k}>
            <rect x="5.5" y={y + 0.6} width="5" height="4.2" fill="#26313B" />
            {f > 0 && <rect x="5.5" y={y + 0.6 + 4.2 * (1 - f)} width="5" height={4.2 * f} fill="#FFCF6E" />}
          </g>
        )
      })}
      <rect x="3" y="31.5" width="10" height="2" fill="#2B3036" />
    </svg>
  )
}
