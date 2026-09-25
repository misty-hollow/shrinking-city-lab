/**
 * 세계 위의 가장자리 도구(설계안 6-17, UI_DESIGN_SYSTEM §8.1). HUD는 고정 슬롯에만 선다: 왼쪽 위 목표와 6개 지표,
 * 아래 가운데 손, 오른쪽 위 접근 시간 세그먼트 + 둥근 도구(되돌리기 · 위에서 보기 · 지표 자세히 · 소리), 오른쪽 아래 확정.
 * 아이콘 버튼은 aria-label과 hover 툴팁(한국어 동사 + 단축키)을 함께 가진다.
 */

import { copy } from '../content/copy'
import type { Threshold } from '../engine/kpi'
import { SoundToggle } from './Hud'

const THRESHOLDS: Threshold[] = [10, 15, 20]

export function ThresholdSwitch({ T, onT, locked, coach }: { T: Threshold; onT(t: Threshold): void; locked: boolean; coach: boolean }) {
  const onKey = (e: React.KeyboardEvent) => {
    if (locked) return
    const i = THRESHOLDS.indexOf(T)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      onT(THRESHOLDS[Math.min(2, i + 1)])
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      onT(THRESHOLDS[Math.max(0, i - 1)])
    }
  }
  return (
    <div className={`t-switch${coach ? ' is-coached' : ''}`} title={locked ? copy.threshold.locked : copy.threshold.help}>
      <span className="t-label" id="t-label">
        {copy.threshold.label}
      </span>
      <div className="t-group" role="radiogroup" aria-labelledby="t-label" aria-describedby="t-help" onKeyDown={onKey}>
        {THRESHOLDS.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={T === t} tabIndex={T === t ? 0 : -1} disabled={locked} onClick={() => onT(t)}>
            {copy.threshold.option(t)}
          </button>
        ))}
      </div>
      <span id="t-help" className="sr-only">
        {locked ? copy.threshold.locked : copy.threshold.help}
      </span>
    </div>
  )
}

const ICONS = {
  undo: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 5 3.5 9l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9h7.5a4.5 4.5 0 0 1 0 9H9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  top: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3.5 16.5 10 10 16.5 3.5 10Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="1.2" fill="currentColor" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 6h12M4 10h12M4 14h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
}

export function RoundButton(p: {
  icon: keyof typeof ICONS
  label: string
  /** 툴팁에 함께 보이는 단축키(있을 때만) */
  kbd?: string
  onClick(): void
  disabled?: boolean
  pressed?: boolean
  expanded?: boolean
  onHover?(on: boolean): void
}) {
  return (
    <button
      type="button"
      className="round-btn"
      aria-label={p.label}
      aria-keyshortcuts={p.kbd ? p.kbd.replace(' ', '+') : undefined}
      disabled={p.disabled}
      aria-pressed={p.pressed}
      aria-expanded={p.expanded}
      onClick={p.onClick}
      onMouseEnter={() => p.onHover?.(true)}
      onMouseLeave={() => p.onHover?.(false)}
      onFocus={() => p.onHover?.(true)}
      onBlur={() => p.onHover?.(false)}
    >
      {ICONS[p.icon]}
      <span className="rb-tip" aria-hidden="true">
        {p.label}
        {p.kbd && <kbd>{p.kbd}</kbd>}
      </span>
    </button>
  )
}

interface ToolsProps {
  T: Threshold
  onT(t: Threshold): void
  tLocked: boolean
  coachT: boolean
  /** 되돌리기(플레이 중에만). 없으면 버튼을 그리지 않는다 */
  undo?: { enabled: boolean; onUndo(): void; onHover(on: boolean): void } | null
  top: boolean
  onTop(): void
  details?: { open: boolean; onToggle(): void } | null
}

export function CornerTools(p: ToolsProps) {
  return (
    <div className="corner-tools" data-occlude>
      <ThresholdSwitch T={p.T} onT={p.onT} locked={p.tLocked} coach={p.coachT} />
      <div className="round-row">
        {p.undo && <RoundButton icon="undo" label={copy.world.undo} kbd="Ctrl Z" disabled={!p.undo.enabled} onClick={p.undo.onUndo} onHover={p.undo.onHover} />}
        <RoundButton icon="top" label={p.top ? copy.world.topOff : copy.world.topOn} pressed={p.top} onClick={p.onTop} />
        {p.details && <RoundButton icon="list" label={p.details.open ? copy.world.detailsClose : copy.world.details} expanded={p.details.open} onClick={p.details.onToggle} />}
        <SoundToggle />
      </div>
    </div>
  )
}

/** 화면의 Primary 하나(§7.1): 늘 크림 채움 필. 남은 진료일이 있을 때만 비활성 + 이유 한 줄 */
export function FinishCorner({ canConfirm, left, onConfirm }: { canConfirm: boolean; left: number; onConfirm(): void }) {
  return (
    <div className="finish" data-occlude>
      <button type="button" className="finish-btn" disabled={!canConfirm} onClick={onConfirm}>
        <span>{copy.missionCard.confirm}</span>
        <ArrowIcon />
      </button>
      {!canConfirm && <span className="finish-hint">{copy.world.finishHint(left)}</span>}
    </div>
  )
}

/** Primary 버튼 끝의 화살표(글자 → 대신 같은 굵기의 선) */
export function ArrowIcon() {
  return (
    <svg className="btn-arrow" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
