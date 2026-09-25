import { type ReactNode, forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

import { copy } from '../content/copy'
import type { AppData } from '../data/types'
import type { Model } from '../engine/kpi'
import { type Insets, type Pick, type ScreenRect, type StageCallbacks, StageController, type StageView, webglAvailable } from './StageController'
import type { Heightmap } from './terrain'
import type { World } from './world'

export interface StageHandle {
  preset(name: 'overview' | 'north' | 'top'): void
  focusEmd(m: number): void
  /** 지소 j 등칸 k의 화면 좌표(불씨 비행). 무대가 없거나 보이지 않으면 null */
  chamberScreen(j: number, k: number): { x: number; y: number } | null
  /** 소리의 좌우(−1..1) */
  villagePan(i: number): number
  clinicPan(j: number): number
  /** 위에서 본 땅 그림(S6 지도 바탕) */
  landImage(width: number): string | null
}

interface Props {
  data: AppData
  model: Model
  world: World
  hm: Heightmap
  view: StageView
  insets: Insets
  /** 배치가 바뀔 때마다 달라지는 값: 이때 `[data-occlude]` HUD 판을 다시 잰다 */
  layoutKey: string
  onHover(p: Pick): void
  onClick(p: Pick): void
  onDoubleClick(p: Pick): void
  /** 세계에 붙는 HTML(지소 말풍선·마을 표지). `data-anchor="j:3"`처럼 자리를 적으면 무대가 화면 위치를 맞춘다. */
  anchors?: ReactNode
  /** 무대를 쓸 수 없을 때(WebGL 없음) */
  onFailed?(): void
}

function measureOccluders(): ScreenRect[] {
  const out: ScreenRect[] = []
  document.querySelectorAll<HTMLElement>('[data-occlude]').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) out.push({ x: r.left, y: r.top, w: r.width, h: r.height })
  })
  return out
}

export const Stage = forwardRef<StageHandle, Props>(function Stage(props, ref) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const anchors = useRef<HTMLDivElement>(null)
  const ctl = useRef<StageController | null>(null)
  const cbRef = useRef<Props>(props)
  cbRef.current = props
  const [failed, setFailed] = useState(() => !webglAvailable())

  useEffect(() => {
    if (failed) cbRef.current.onFailed?.()
  }, [failed])

  useEffect(() => {
    if (failed || !host.current || !labels.current) return
    let c: StageController
    try {
      const cb: StageCallbacks = {
        onHover: (p) => cbRef.current.onHover(p),
        onClick: (p) => cbRef.current.onClick(p),
        onDoubleClick: (p) => cbRef.current.onDoubleClick(p),
      }
      c = new StageController(host.current, labels.current, props.data, props.model, props.world, props.hm, cb)
    } catch (e) {
      console.warn(e)
      setFailed(true)
      return
    }
    ctl.current = c
    c.setAnchors(anchors.current)
    c.update(cbRef.current.view)
    c.setLayout(cbRef.current.insets, measureOccluders())
    return () => {
      c.dispose()
      ctl.current = null
    }
    // 데이터는 한 번만 받는다.
  }, [failed])

  useEffect(() => {
    ctl.current?.update(props.view)
  }, [props.view])

  // HUD가 그려진 뒤(같은 프레임) 판을 재고, 창 크기가 바뀌면 다시 잰다.
  useLayoutEffect(() => {
    const apply = () => ctl.current?.setLayout(cbRef.current.insets, measureOccluders())
    apply()
    const id = window.setTimeout(apply, 120)
    window.addEventListener('resize', apply)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', apply)
    }
  }, [props.layoutKey, props.insets.left, props.insets.right, props.insets.top, props.insets.bottom])

  useImperativeHandle(ref, () => ({
    preset: (name) => ctl.current?.preset(name),
    focusEmd: (m) => ctl.current?.focusEmd(m),
    chamberScreen: (j, k) => ctl.current?.chamberScreen(j, k) ?? null,
    villagePan: (i) => ctl.current?.villagePan(i) ?? 0,
    clinicPan: (j) => ctl.current?.clinicPan(j) ?? 0,
    landImage: (w) => ctl.current?.landImage(w) ?? null,
  }))

  return (
    <div className="stage" data-testid="stage">
      <div className="stage-canvas" ref={host} />
      {/* 액자 가장자리를 어둡게 해 섬에 시선을 모은다. 포인터를 막지 않는다. */}
      <div className="stage-vignette" aria-hidden="true" />
      <div className={`stage-anchors${failed ? ' is-flat' : ''}`} ref={anchors}>
        {props.anchors}
      </div>
      <div className="stage-labels" ref={labels} aria-hidden="true" />
      {failed && (
        <div className="stage-fallback" role="note">
          {copy.noWebgl}
        </div>
      )}
    </div>
  )
})
