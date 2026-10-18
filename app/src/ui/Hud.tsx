/**
 * HUD 조각(설계안 6-16·6-17): 불씨(진료일 말) 비행, 기준 변경 한 줄, 읽는 법, 기준일, 소리 끄기.
 * 모두 무대 위에 얹히되 가운데를 비워 둔다. 장식은 모서리 깎기 하나뿐이다.
 */

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useSyncExternalStore } from 'react'

import { sound } from '../audio/sound'
import { copy } from '../content/copy'
import type { Manifest } from '../data/types'
import { CAMERA_SETTLED } from '../stage/events'
import { ClinicGlyph, HouseGlyph } from './common'
import { type Box, clearOffset } from './toastPlace'

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
/**
 * 소식 판이 지소 말풍선 머리·결과 판이나 HUD 판을 가리면 가장 가까운 빈자리로 옮긴다(ui/toastPlace).
 * 지금 자리가 비어 있으면 그대로 둔다(두 번째 소식이 붙을 때 먼저 뜬 소식이 튀지 않게).
 */
function placeToasts(el: HTMLElement): void {
  const r = el.getBoundingClientRect()
  if (r.width === 0) return
  const box = (e: Element): Box => {
    const b = e.getBoundingClientRect()
    return { x: b.left, y: b.top, w: b.width, h: b.height }
  }
  // 보이지 않는 판(visibility hidden)은 비킬 이유가 아니다. 막 뜨는 결과 판은 불투명도 0에서 시작하므로 불투명도는 보지 않는다
  const shown = (e: Element) => e.checkVisibility?.({ checkVisibilityCSS: true }) ?? true
  const blockers: Box[] = []
  // HUD 판이 들어오는 애니메이션(시트 sheet-in 240ms) 중이면 몇 px 어긋나게 재지만, 배치가 바뀐 뒤 0.7초에 다시 잰다(Toasts)
  for (const e of document.querySelectorAll('[data-occlude]')) if (shown(e)) blockers.push(box(e))
  for (const a of document.querySelectorAll<HTMLElement>('.stage-anchors .anchor')) {
    if (a.style.visibility === 'hidden' || a.classList.contains('is-occluded')) continue
    for (const e of a.querySelectorAll('.mk-head, .mk-preview, .vpin > span, .marker-pop')) if (shown(e)) blockers.push(box(e))
  }
  const o = clearOffset({ x: r.left, y: r.top, w: r.width, h: r.height }, blockers.filter((b) => b.w > 0 && b.h > 0), window.innerWidth, window.innerHeight)
  if (o.dx === 0 && o.dy === 0) return
  const cur = (name: string) => Number.parseFloat(el.style.getPropertyValue(name)) || 0
  el.style.setProperty('--toast-dx', `${cur('--toast-dx') + o.dx}px`)
  el.style.setProperty('--toast-dy', `${cur('--toast-dy') + o.dy}px`)
}

/**
 * layout: HUD 배치(지표 자세히 열림·화면). 소식이 떠 있는 동안 바뀌면 슬롯 기본 자리에서 다시 잰다.
 * pops: 말풍선 위 결과 판(id 목록). 소식이 떠 있는 동안 새 결과 판이 뜨면 지금 자리가 비어 있는지 다시 본다.
 */
export function Toasts({ items, layout, pops }: { items: Toast[]; layout: string; pops: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const lastLayout = useRef(layout)
  const shown = items.slice(-2)
  const key = shown.map((t) => t.id).join(',')
  // 소식이 나타나거나 바뀔 때, HUD 배치·결과 판이 바뀔 때 잰다(프레임마다 재지 않는다). 소식이 다 사라지면 슬롯 기본 자리로.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const relaid = lastLayout.current !== layout
    lastLayout.current = layout
    if (!key || relaid) {
      el.style.setProperty('--toast-dx', '0px')
      el.style.setProperty('--toast-dy', '0px')
    }
    if (key) placeToasts(el)
  }, [key, layout, pops])
  // 배치가 바뀌면 무대도 섬을 다시 맞추고(카메라 600ms) 시트가 미끄러져 들어온다(240ms). 다 옮겨 간 뒤 한 번 더 본다.
  // 소식·결과 판이 그 사이에 바뀌어도 이 타이머는 지워지지 않는다(배치가 다시 바뀔 때만 새로 건다. 의존성은 일부러 layout 하나)
  const hasToast = key !== ''
  useEffect(() => {
    const el = ref.current
    if (!el || !hasToast) return
    const id = window.setTimeout(() => placeToasts(el), 700)
    return () => window.clearTimeout(id)
  }, [layout])
  // 소식이 떠 있는 동안 카메라를 끌거나 W A S D로 옮겼으면, 멈춘 뒤 한 번 다시 잰다(말풍선이 소식 밑으로 들어온 경우)
  useEffect(() => {
    const el = ref.current
    if (!el || !hasToast) return
    const on = () => placeToasts(el)
    window.addEventListener(CAMERA_SETTLED, on)
    return () => window.removeEventListener(CAMERA_SETTLED, on)
  }, [hasToast])
  return (
    <div className="toasts" aria-hidden="true" ref={ref}>
      {shown.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <i aria-hidden="true" />
          {t.text}
        </div>
      ))}
    </div>
  )
}

// --- 읽는 법(범례) ------------------------------------------------------------------------

export type KeyPanel = 'legend' | 'controls' | null

interface KeyProps {
  deltaMode: boolean
  neutral: boolean
  ghost: boolean
  coached: boolean
  /** 열린 판: 읽는 법 · 조작법(같은 자리라 하나만) */
  panel: KeyPanel
  onPanel(p: KeyPanel): void
  /** 진료일을 놓고 뺄 수 있는 화면(튜토리얼·미션)이면 조작법에 진료일 줄도 */
  canAllocate: boolean
  /** ? 키로 열었으면 조작법 제목으로 포커스를 옮긴다(단추로 열면 단추에 머문다) */
  focusHelp: boolean
}

function HelpRows({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>
            <kbd>{k}</kbd>
          </dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 조작법(설계안 6-22): 지도 · 진료일 · 그 밖. 키보드·마우스 조작을 한 판에 */
function ControlsHelp({ canAllocate, focus }: { canAllocate: boolean; focus: boolean }) {
  const title = useRef<HTMLHeadingElement>(null)
  // 열릴 때 한 번만(뒤 화면이 다시 그려질 때마다 포커스가 튀지 않게)
  const focusOnOpen = useRef(focus)
  useEffect(() => {
    if (focusOnOpen.current) title.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div className={`key-panel controls-help${canAllocate ? ' is-wide' : ''}`} id="controls-help">
      <h3 tabIndex={-1} ref={title}>
        {copy.help.title}
      </h3>
      {/* 두 칸(지도 · 그 밖 | 진료일): 한 칸으로 쌓으면 1024×768 튜토리얼에서 위 카드의 단추까지 올라간다 */}
      <div className="help-groups">
        <section className="help-map">
          <h4>{copy.help.mapTitle}</h4>
          <HelpRows rows={copy.help.map} />
        </section>
        {canAllocate && (
          <section className="help-alloc">
            <h4>{copy.help.allocTitle}</h4>
            <HelpRows rows={copy.help.alloc} />
          </section>
        )}
        <section className="help-other">
          <h4>{copy.help.otherTitle}</h4>
          <HelpRows rows={copy.help.other} />
        </section>
      </div>
    </div>
  )
}

export function ReadingKey(p: KeyProps) {
  const shown = p.panel === 'legend' || (p.coached && p.panel === null)
  const help = p.panel === 'controls'
  return (
    <section className={`reading-key legend${p.coached && shown ? ' is-coached' : ''}${shown || help ? ' is-open' : ''}`} aria-label={copy.legend.title} data-occlude>
      <div className="key-toggles">
        <button type="button" className="key-toggle" onClick={() => p.onPanel(p.panel === 'legend' ? null : 'legend')} aria-expanded={shown}>
          <span aria-hidden="true">?</span>
          {shown ? copy.legend.collapse : copy.legend.expand}
        </button>
        <button type="button" className="key-toggle help-toggle" data-return-focus="help" onClick={() => p.onPanel(help ? null : 'controls')} aria-expanded={help} aria-controls={help ? 'controls-help' : undefined} aria-keyshortcuts="?">
          {/* 읽는 법의 ? 동그라미와 헷갈리지 않게 자판 그림. ? 키는 튜토리얼 한 줄과 판의 마지막 줄이 알린다 */}
          <svg className="kb-glyph" viewBox="0 0 20 14" aria-hidden="true">
            <rect x="1" y="1" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4.5 4.5h1M8 4.5h1M11.5 4.5h1M15 4.5h.5M4.5 7.5h1M8 7.5h1M11.5 7.5h1M15 7.5h.5M6 10.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {help ? copy.help.close : copy.help.open}
        </button>
      </div>
      {help && <ControlsHelp canAllocate={p.canAllocate} focus={p.focusHelp} />}
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
                <HouseGlyph tier={2} ground />
                {copy.legend.villageFull}
              </li>
              <li>
                <HouseGlyph tier={1} ground />
                {copy.legend.villageHalf}
              </li>
              <li>
                <HouseGlyph tier={0} ground />
                {copy.legend.villageEmpty}
              </li>
              <li className="key-note">{copy.legend.ground}</li>
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
      aria-label={copy.sound.label}
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
