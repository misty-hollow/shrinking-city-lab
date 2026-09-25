/**
 * 세계 속 표지(설계안 6-17 「세계가 먼저」).
 *
 * 지소 말풍선: 지형 위 지소에 선 말풍선 하나가 그 지소의 전부다 — 이름과 진료일 다섯 칸. 누르면 손의 진료일 하나가
 * 날아가 빈 칸에 앉고(+1), 오른쪽 끝의 작은 − 손잡이(또는 오른쪽 클릭)를 누르면 하루를 손으로 가져온다(−1).
 * 손잡이는 판 오른쪽의 따로 된 한 칸이다(놓으려다 빼는 일이 없게). 터치 화면을 위해 진료일이 있으면 늘 보인다. 가리키거나
 * 키보드로 고르면 판이 뒤집히고(night 면 + 크림 테두리) 놓기 전 결과가 점선 판에 미리 보인다(UI_DESIGN_SYSTEM §8.2·§8.3).
 * 키보드: 말풍선마다 Tab으로 간다(서쪽 → 동쪽). + − 또는 → ← 로 놓고 빼고, ↑ ↓ Home End로 옆 지소로 옮긴다.
 *
 * 마을 표지: 결산에서 진료가 닿지 않게 된 마을 몇 곳에 선다(세계 속 표지, 옆 패널 목록이 아니다).
 *
 * 자리(화면 좌표)는 무대가 맞춘다: 바깥 상자의 `data-anchor`.
 */

import type React from 'react'

import { copy } from '../content/copy'
import type { Scenario } from '../data/types'
import { allocDays } from '../engine/format'
import type { PreviewInfo } from './preview'

export interface Pop {
  id: number
  j: number
  big: string
  small: string
  tone: 'gain' | 'loss' | 'same'
}

interface MarkersProps {
  scenario: Scenario
  /** 서쪽 → 동쪽 */
  order: number[]
  /** 보이는 배분(불씨가 앉기 전에는 앞 값) */
  alloc: readonly number[]
  /** 비교하는 배분(참고 배분·앞 미션): 칸 둘레에 점선 고리 */
  ghost?: readonly number[] | null
  interactive: boolean
  allowed(j: number): { inc: boolean; dec: boolean }
  preview: PreviewInfo | null
  /** 미리보기가 되돌리기 버튼에서 왔는가(판 아래 안내 문구만 다르다) */
  previewUndo?: boolean
  /** 불씨가 막 앉은 지소(한 번 눌렸다 펴진다) */
  landing: { j: number; key: number } | null
  /** 막힌 조작을 한 지소(짧게 고개를 젓는다) */
  denied: { j: number; key: number } | null
  pops: Pop[]
  onPreview(j: number | null, dir?: 1 | -1): void
  onInc(j: number): void
  onDec(j: number): void
  onDenied(j: number, dir: 1 | -1): void
  /** 튜토리얼 코치: 이 지소를 가리킨다 */
  coach?: number | null
}

export function ClinicMarkers(p: MarkersProps) {
  const emdName = new Map(p.scenario.emds.map((e) => [e.id, e.name]))
  const onKey = (j: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!p.interactive) return
    const ok = p.allowed(j)
    if (e.key === '+' || e.key === '=' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (ok.inc) p.onInc(j)
      else p.onDenied(j, 1)
    } else if (e.key === '-' || e.key === '_' || e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      if (ok.dec) p.onDec(j)
      else p.onDenied(j, -1)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      const at = p.order.indexOf(j)
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? p.order.length - 1 : at + (e.key === 'ArrowDown' ? 1 : -1)
      const nj = p.order[Math.max(0, Math.min(p.order.length - 1, next))]
      document.querySelector<HTMLElement>(`.marker[data-j="${nj}"]`)?.focus()
    }
  }
  return (
    <div className="markers" role={p.interactive ? 'group' : undefined} aria-label={p.interactive ? copy.world.markersLabel : undefined}>
      {p.order.map((j) => {
        const f = p.scenario.facilities[j]
        const days = p.alloc[j]
        const ok = p.allowed(j)
        const pv = p.preview && p.preview.j === j ? p.preview : null
        const filled = Math.ceil(days - 1e-9)
        const target = pv && pv.dir > 0 && !pv.blocked ? filled : -1
        const removing = pv && pv.dir < 0 && !pv.blocked ? filled - 1 : -1
        const pops = p.pops.filter((x) => x.j === j)
        const cls = [
          'marker',
          'fac-row',
          days <= 0 ? 'is-closed' : '',
          pv ? 'is-preview' : '',
          p.interactive ? 'is-live' : '',
          p.coach === j ? 'is-coached' : '',
          p.landing?.j === j ? 'is-landing' : '',
          p.denied?.j === j ? 'is-denied' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const value = days <= 0 ? copy.facility.closed : allocDays(days)
        return (
          <div key={f.id} className="anchor" data-anchor={`j:${j}`}>
            <div
              className={cls}
              data-j={j}
              data-facility={f.short}
              tabIndex={p.interactive ? 0 : -1}
              role={p.interactive ? 'group' : undefined}
              aria-label={p.interactive ? `${copy.world.markerAria(f.name, emdName.get(f.emd) ?? '', value)} ${copy.facility.keysHint}` : undefined}
              aria-hidden={p.interactive ? undefined : true}
              onKeyDown={onKey(j)}
              onFocus={(e) => {
                if (e.target === e.currentTarget && p.interactive) p.onPreview(j, 1)
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) p.onPreview(null)
              }}
              onMouseLeave={() => p.interactive && p.onPreview(null)}
              onContextMenu={(e) => {
                if (!p.interactive) return
                e.preventDefault()
                if (ok.dec) p.onDec(j)
                else p.onDenied(j, -1)
              }}
            >
              <div className="mk-head">
              <button
                type="button"
                className="mk-bubble"
                tabIndex={-1}
                aria-label={copy.facility.inc(f.short)}
                disabled={!p.interactive}
                onMouseEnter={() => p.interactive && p.onPreview(j, 1)}
                onClick={() => {
                  if (ok.inc) p.onInc(j)
                  else p.onDenied(j, 1)
                }}
              >
                <span className="mk-name">{f.short}</span>
                <span className="mk-slots" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((k) => {
                    const fk = days - k
                    const g = p.ghost ? p.ghost[j] - k : -1
                    const c = [
                      'mk-slot',
                      fk >= 1 ? 'on' : fk >= 0.5 ? 'half' : '',
                      k === target ? 'target' : '',
                      k === removing ? 'remove' : '',
                      g >= 1 ? 'ghost' : g >= 0.5 ? 'ghost-half' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return <i key={k} className={c} data-k={k} />
                  })}
                </span>
              </button>
              {p.interactive && ok.dec && days > 0 && (
                <button
                  type="button"
                  className="mk-minus"
                  tabIndex={-1}
                  aria-label={copy.facility.dec(f.short)}
                  onMouseEnter={() => p.onPreview(j, -1)}
                  onMouseLeave={() => p.onPreview(j, 1)}
                  onClick={(e) => {
                    e.stopPropagation()
                    p.onDec(j)
                  }}
                >
                  <span aria-hidden="true">−</span>
                </button>
              )}
              </div>
              <span className="sr-only fac-value">{value}</span>
              <i className="mk-tail" aria-hidden="true" />
              <i className="mk-stem" aria-hidden="true" />
              {pv && (
                <div className={`mk-preview tone-${pv.tone}${pv.blocked ? ' is-blocked' : ''}`} aria-hidden="true" ref={keepOnScreen}>
                  {pv.blocked ? (
                    <span className="mk-preview-line">{pv.blocked}</span>
                  ) : (
                    <>
                      <span className="pv-head">
                        <span>{pv.dir > 0 ? copy.world.preview.headInc(f.short) : copy.world.preview.headDec(f.short)}</span>
                        <span className="pv-tag">{copy.world.preview.tag}</span>
                      </span>
                      <span className="pv-main">
                        <b className="num">{pv.big}</b>
                        <span className="mk-preview-line">{pv.line}</span>
                      </span>
                      <span className="pv-rows num">
                        {pv.detail.split(' · ').map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </span>
                      <span className="pv-hint">{p.previewUndo ? copy.world.preview.hintUndo : pv.dir > 0 ? copy.world.preview.hintInc : copy.world.preview.hintDec}</span>
                    </>
                  )}
                </div>
              )}
              {pops.map((x) => (
                <div key={x.id} className={`marker-pop tone-${x.tone}`} aria-hidden="true">
                  <b className="num">{x.big}</b>
                  <span>{x.small}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 미리보기 판이 화면 오른쪽 밖으로 나가면 말풍선 왼쪽에 선다(한 번 재고 표시만 남긴다). */
function keepOnScreen(el: HTMLDivElement | null): void {
  if (!el || el.dataset.flip !== undefined || typeof window === 'undefined') return
  if (el.getBoundingClientRect().right > window.innerWidth - 16) el.dataset.flip = ''
}

export interface VillagePin {
  i: number
  text: string
}

/** 결산: 진료가 닿지 않게 된 마을에 선 표지(세계 속) */
export function VillagePins({ pins }: { pins: VillagePin[] }) {
  return (
    <div className="village-pins" aria-hidden="true">
      {pins.map((v) => (
        <div key={v.i} className="anchor" data-anchor={`v:${v.i}`}>
          <div className="vpin">
            <span>{v.text}</span>
            <i className="vpin-tail" />
            <i className="mk-stem" />
          </div>
        </div>
      ))}
    </div>
  )
}
