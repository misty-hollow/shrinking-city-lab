/**
 * HUD 조각(설계안 6-16·6-17): 불씨(진료일 말) 비행, 기준 변경 한 줄, 읽는 법, 기준일, 소리 끄기.
 * 모두 무대 위에 얹히되 가운데를 비워 둔다. 장식은 모서리 깎기 하나뿐이다.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from 'react'

import { sound } from '../audio/sound'
import { copy } from '../content/copy'
import type { Manifest } from '../data/types'
import { ClinicGlyph, HouseGlyph } from './common'

// --- 불씨 -------------------------------------------------------------------------------

export interface EmberHandle {
  /** from → to(화면 좌표)로 불씨(진료일 말) 하나. 포물선, dur ms. cls = 말 모양(가정한 날은 'is-assumed') */
  fly(from: { x: number; y: number }, to: { x: number; y: number }, dur: number, delay?: number, cls?: string): void
}

export const EmberLayer = forwardRef<EmberHandle>(function EmberLayer(_, ref) {
  const host = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => ({
    fly(from, to, dur, delay = 0, cls = '') {
      const el = host.current
      if (!el || typeof document === 'undefined') return
      const e = document.createElement('i')
      e.className = cls ? `ember ${cls}` : 'ember'
      el.appendChild(e)
      const lift = 40 + 0.18 * Math.hypot(to.x - from.x, to.y - from.y)
      const cx = (from.x + to.x) / 2
      const cy = Math.min(from.y, to.y) - lift
      const frames: Keyframe[] = []
      for (let k = 0; k <= 12; k++) {
        const t = k / 12
        const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x
        const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y
        // 손에서 들리며 조금 커졌다가, 칸에 가까워질수록 칸 크기로 줄어든다(말이 판에 앉는 느낌)
        const s = 1 + 0.35 * Math.sin(Math.PI * t) - 0.45 * t
        frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`, opacity: k === 0 ? 0.6 : k === 12 ? 0 : 1 })
      }
      if (typeof e.animate !== 'function') {
        e.remove()
        return
      }
      const a = e.animate(frames, { duration: dur, delay, easing: 'cubic-bezier(.35,.05,.35,1)', fill: 'both' })
      a.onfinish = () => e.remove()
      a.oncancel = () => e.remove()
    },
  }))
  return <div className="ember-layer" ref={host} aria-hidden="true" />
})

// --- 소식 한 줄 ---------------------------------------------------------------------------

export interface Toast {
  id: number
  text: string
  tone: 'gain' | 'loss' | 'same'
}

/** 조작의 빛이 다 닿은 뒤 도크 위 가운데에 한 줄. 3.2초 뒤 사라지고, 많아야 두 줄. */
export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="toasts" aria-hidden="true">
      {items.slice(-2).map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <i aria-hidden="true" />
          {t.text}
        </div>
      ))}
    </div>
  )
}

// --- 읽는 법(범례) ------------------------------------------------------------------------

interface KeyProps {
  deltaMode: boolean
  neutral: boolean
  ghost: boolean
  coached: boolean
}

export function ReadingKey(p: KeyProps) {
  const [open, setOpen] = useState(false)
  const shown = open || p.coached
  return (
    <section className={`reading-key legend${p.coached ? ' is-coached' : ''}${shown ? ' is-open' : ''}`} aria-label={copy.legend.title} data-occlude>
      <button type="button" className="key-toggle" onClick={() => setOpen(!open)} aria-expanded={shown}>
        <span aria-hidden="true">?</span>
        {shown ? copy.legend.collapse : copy.legend.expand}
      </button>
      {shown && (
        <ul>
          {p.neutral ? (
            <li>
              <HouseGlyph tier={3} />
              {copy.legend.house}
            </li>
          ) : (
            <>
              <li>
                <HouseGlyph tier={2} />
                {copy.legend.villageFull}
              </li>
              <li>
                <HouseGlyph tier={1} />
                {copy.legend.villageHalf}
              </li>
              <li>
                <HouseGlyph tier={0} />
                {copy.legend.villageEmpty}
              </li>
              <li className="key-note">{copy.legend.house}</li>
            </>
          )}
          <li>
            <ClinicGlyph days={3} size={26} />
            {copy.legend.tower}
          </li>
          {!p.neutral && (
            <li>
              <svg className="swatch" viewBox="0 0 22 14" aria-hidden="true">
                <path d="M1 11 C6 2, 12 13, 21 3" fill="none" stroke="#FFB347" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" />
                <path d="M1 11 C6 2, 12 13, 21 3" fill="none" stroke="#FFE3A8" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {copy.legend.route}
            </li>
          )}
          {p.ghost && (
            <li>
              <svg className="swatch" viewBox="0 0 22 22" aria-hidden="true">
                <rect x="8" y="4" width="6" height="16" fill="#A9BBC8" opacity="0.6" />
              </svg>
              {copy.legend.ghost}
            </li>
          )}
          {p.deltaMode && (
            <li>
              <span className="delta better">{copy.legend.better}</span>
              <span className="delta worse">{copy.legend.worse}</span>
              <span className="small">({copy.legend.deltaOf})</span>
            </li>
          )}
          {!p.neutral && (
            <li>
              <svg className="swatch" viewBox="0 0 22 10" aria-hidden="true">
                <path d="M1 5 H21" stroke="#E3ECF4" strokeWidth="2.2" strokeDasharray="4 3" />
              </svg>
              {copy.legend.worst}
            </li>
          )}
          <li>
            <svg className="swatch" viewBox="0 0 22 16" aria-hidden="true">
              <rect x="1" y="2" width="20" height="12" fill="#ECE6DA" opacity="0.55" />
            </svg>
            {copy.legend.cityCore}
          </li>
          <li className="key-note">{copy.legend.landscape}</li>
        </ul>
      )}
    </section>
  )
}

// --- 카메라·기준일 ------------------------------------------------------------------------

/** 늘 보이는 기준일 칩(8-1). 날짜는 manifest에서 온다. 플레이 중에는 6개 지표 아래, 그 밖에는 아래 가장자리. */
export function DataChip({ manifest, onData, floating }: { manifest: Manifest; onData(): void; floating: boolean }) {
  const d = manifest.display_dates
  return (
    <button type="button" className={`data-chip${floating ? ' is-floating' : ''}`} onClick={onData}>
      {copy.dataChip(d.population, d.schedule, d.road_network)}
    </button>
  )
}

// --- 소리 ------------------------------------------------------------------------------

function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => sound.subscribe(() => cb()),
    () => sound.muted,
    () => true,
  )
}

export function SoundToggle() {
  const muted = useMuted()
  return (
    <button
      type="button"
      className="sound-toggle"
      aria-pressed={!muted}
      aria-label={muted ? copy.sound.off : copy.sound.on}
      onClick={() => {
        sound.unlock()
        sound.setMuted(!muted)
        if (muted) sound.play('soundOn')
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor" />
        {muted ? (
          <path d="M13 7.5l4.5 5M17.5 7.5l-4.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <>
            <path d="M13 7.2c1 .8 1.5 1.7 1.5 2.8s-.5 2-1.5 2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M15.2 5.2c1.6 1.3 2.4 2.9 2.4 4.8s-.8 3.5-2.4 4.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span className="sr-only">{copy.sound.label}</span>
      <span className="rb-tip" aria-hidden="true">
        {muted ? copy.sound.off : copy.sound.on}
      </span>
    </button>
  )
}

/** 첫 사용자 입력에서 오디오를 연다(자동재생 규칙). */
export function useAudioUnlock(): void {
  useEffect(() => {
    const on = () => sound.unlock()
    window.addEventListener('pointerdown', on, { passive: true })
    window.addEventListener('keydown', on)
    return () => {
      window.removeEventListener('pointerdown', on)
      window.removeEventListener('keydown', on)
    }
  }, [])
}
