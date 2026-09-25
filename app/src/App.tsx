import { Component, type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { briefingCues, lightCues } from './audio/cues'
import { sound } from './audio/sound'
import { copy } from './content/copy'
import { loadAppData } from './data/load'
import type { AppData } from './data/types'
import { remaining } from './engine/allocation'
import { lostVillages } from './engine/compare'
import { allocDays, days1, missionDays, people, weekDays } from './engine/format'
import { type Kpis, type Threshold, buildModel, computeKpis, emdShareAtLeast } from './engine/kpi'
import { BRIEF_EMBER_MS, BRIEF_STEP_MS, BRIEF_WAIT_MS, BriefingCard, IntroCard, MobileNotice, StartCard, TutorialCard } from './screens/Cards'
import { DataLimits } from './screens/DataLimits'
import { DebriefPanel } from './screens/Debrief'
import { FinaleBoard, FinalePanel } from './screens/Finale'
import { WorldDebrief } from './screens/WorldDebrief'
import { WorldFinale } from './screens/WorldFinale'
import { type Hillshade, buildHillshade } from './stage/hillshade'
import { EMBER_MS, planOp, planThreshold } from './stage/lightPlan'
import { Stage, type StageHandle } from './stage/Stage'
import type { Emphasis, Pick, StageEvent, StageMode, StageView } from './stage/StageController'
import { Heightmap } from './stage/terrain'
import { buildWorld } from './stage/world'
import {
  type GameConfig,
  allowedOps,
  canConfirm,
  canTutorialNext,
  initialState,
  reducer,
  thresholdLocked,
} from './state/game'
import {
  type MissionId,
  comboFor,
  finaleResults,
  judge,
  makeEvaluate,
  missionNumber,
  nextMission,
  prevMission,
} from './state/results'
import { Hand } from './ui/Hand'
import { DataChip, type EmberHandle, EmberLayer, ReadingKey, SoundToggle, type Toast, Toasts, useAudioUnlock } from './ui/Hud'
import { ClinicMarkers, type Pop, type VillagePin, VillagePins } from './ui/Markers'
import { EmdList, FacilityDock, GOAL_TILE, KpiLedger, MissionCard, RegionCard, dockOrder } from './ui/PlayPanel'
import { type PreviewInfo, buildPreview } from './ui/preview'
import { useOnSettle, useSettled } from './ui/useLight'
import { CornerTools, FinishCorner } from './ui/WorldHud'

const IDLE_MS = 90_000
const TOAST_MS = 3200
const POP_MS = 1900
/** 결산 감상: HUD 없이 불 켜진 섬을 잠시 돈다(누르면 바로 결과) */
const APPRECIATE_MS = 4200

function useWindowSize(): { w: number; h: number } {
  const [s, setS] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setS({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return s
}

function useReducedMotion(): boolean {
  const q = '(prefers-reduced-motion: reduce)'
  const [r, setR] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setR(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return r
}

export function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [error, setError] = useState(false)
  const [dataOpenMobile, setDataOpenMobile] = useState(false)
  const { w: width, h: height } = useWindowSize()
  useEffect(() => {
    loadAppData()
      .then(setData)
      .catch(() => setError(true))
  }, [])
  if (width < 768) {
    return (
      <>
        <MobileNotice onData={() => setDataOpenMobile(true)} />
        {dataOpenMobile && data && <DataLimits manifest={data.manifest} onClose={() => setDataOpenMobile(false)} />}
      </>
    )
  }
  if (error)
    return (
      <div className="loading" role="alert">
        {copy.loadError}
      </div>
    )
  if (!data)
    return (
      <div className="loading" role="status">
        {copy.loading}
      </div>
    )
  return (
    <CrashBoundary>
      <Game data={data} width={width} height={height} />
    </CrashBoundary>
  )
}

/** 그리는 도중의 예외로 빈 화면이 되지 않게: 안내 한 줄을 보인다(전시 복귀·새로고침으로 다시 시작). */
class CrashBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  render(): ReactNode {
    if (this.state.failed)
      return (
        <div className="loading" role="alert">
          {copy.crashed}
        </div>
      )
    return this.props.children
  }
}

/** 결산·세 개의 공주의 보고서 종이 폭 */
function sheetWidthFor(width: number): number {
  return width >= 1440 ? 480 : width >= 1280 ? 440 : 400
}

/**
 * 미션별로 읍·면 이름 아래 새기는 값: 미션 2 = 읍·면 평균 진료일(목표 바로 아래는 두 자리),
 * 미션 3 = 주 3일 이상 주민 비율.
 */
function emdValuesFor(m: MissionId, k: Kpis, model: ReturnType<typeof buildModel>, target: number): string[] | null {
  if (m === 'm2') return k.emdDays.map((v) => missionDays(v, target))
  if (m === 'm3') return emdShareAtLeast(model, k.villageDays, 3).map((v) => copy.village.emdThickShare(Math.round(v * 100)))
  return null
}

function rectCenter(el: Element | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

type Op = { j: number; dir: 1 | -1 }

function Game({ data, width, height }: { data: AppData; width: number; height: number }) {
  const { scenario, landscape, manifest } = data
  const model = useMemo(() => buildModel(scenario), [scenario])
  // 디오라마 세계(집·나무·지소 터)는 한 번만 만든다. 3D 무대와 S6 지도가 같은 집 묶음을 쓴다.
  const hm = useMemo(() => new Heightmap(data.geometry.terrain, data.terrain, 1), [data])
  const world = useMemo(() => buildWorld(scenario, data.geometry, hm), [scenario, data.geometry, hm])
  const order = useMemo(() => dockOrder(scenario), [scenario])
  const cfg = useMemo<GameConfig>(
    () => ({
      current: scenario.current_allocation,
      tutorialFrom: scenario.facilities.findIndex((f) => f.id === 'uidang'),
      missionBudget: scenario.rules.mission_budget,
      evaluate: makeEvaluate(model, landscape),
    }),
    [scenario, model, landscape],
  )
  const reduce = useMemo(() => reducer(cfg), [cfg])
  const [s, dispatch] = useReducer(reduce, cfg, initialState)
  const reducedMotion = useReducedMotion()
  const stage = useRef<StageHandle>(null)
  const embers = useRef<EmberHandle>(null)
  const [stageHover, setStageHover] = useState<Pick>(null)
  const [panelHoverEmd, setPanelHoverEmd] = useState<number | null>(null)
  const [emphasis, setEmphasis] = useState<Emphasis>(null)
  const [live, setLive] = useState('')
  const [finaleHover, setFinaleHover] = useState<MissionId | null>(null)
  const [finaleReturn, setFinaleReturn] = useState<MissionId | null>(null)
  const [hillshade, setHillshade] = useState<Hillshade | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [celebrate, setCelebrate] = useState(0)
  const [lostPick, setLostPick] = useState<number[] | null>(null)
  // 세계가 먼저(설계안 6-17)
  const [preview, setPreview] = useState<(Op & { src: 'marker' | 'stage' }) | null>(null)
  const [undoHover, setUndoHover] = useState(false)
  const [history, setHistory] = useState<Op[]>([])
  const [running, setRunning] = useState(false)
  const [landedSeq, setLandedSeq] = useState(-1)
  const [landing, setLanding] = useState<{ j: number; key: number } | null>(null)
  const [denied, setDenied] = useState<{ j: number; key: number } | null>(null)
  const [pops, setPops] = useState<Pop[]>([])
  const [details, setDetails] = useState(false)
  const [topView, setTopView] = useState(false)
  const [phase, setPhase] = useState<'appreciate' | 'summary'>('summary')
  const [flat, setFlat] = useState(false)
  useAudioUnlock()
  useEffect(() => {
    // 개발·검사용: 소리 엔진 상태(운영 빌드에는 없다)
    if (import.meta.env.DEV) (window as unknown as { __sclSound?: unknown }).__sclSound = sound
  }, [])

  const kiosk = useMemo(() => new URLSearchParams(window.location.search).get('kiosk') !== '0', [])
  const current = scenario.current_allocation
  const mission = landscape.missions[s.mission]
  const combo = comboFor(landscape, mission)
  const result = s.results[s.mission]
  const prevId = prevMission(s.mission)
  const prevResult = prevId ? s.results[prevId] : undefined
  const nextId = nextMission(s.mission)

  // --- 계산: 조작마다 실제 행렬로 다시 계산한다(16ms 안, 설계안 6-12) -----------------------
  const k = useMemo(() => computeKpis(model, s.alloc, s.T), [model, s.alloc, s.T])
  // 미션 판정은 화면 기준 T와 상관없이 15분(설계안 4-3).
  const judged = useMemo(() => judge(model, landscape, s.mission, s.alloc), [model, landscape, s.mission, s.alloc])
  const baseAlloc = s.baseline === 'last' && s.lastConfirmed ? s.lastConfirmed.alloc : current
  const baseK = useMemo(() => computeKpis(model, baseAlloc, s.T), [model, baseAlloc, s.T])
  const current15 = useMemo(() => computeKpis(model, current, 15), [model, current])
  const finale = useMemo(
    () => (s.screen === 'finale' ? finaleResults(s.results, landscape, cfg.evaluate) : null),
    [s.screen, s.results, landscape, cfg],
  )

  // --- 빛의 순서(설계안 6-16): 계산은 이미 끝났다. 무대와 지표가 같은 순서로 보여 준다 ------------
  const opEvent = useMemo((): StageEvent | null => {
    if (!s.lastOp) return null
    const j = s.lastOp.j
    const before = computeKpis(model, s.lastOp.before, s.T).villageDays
    const dir = s.alloc[j] > s.lastOp.before[j] ? 1 : -1
    return { plan: planOp(model, s.lastOp.seq, j, dir, s.T, before, k.villageDays, reducedMotion), t0: performance.now(), before: s.lastOp.before, after: s.alloc }
    // lastOp.seq가 바뀔 때만 새 순서를 만든다.
  }, [s.lastOp?.seq])
  const tEvent = useMemo((): StageEvent | null => {
    if (!s.lastTChange) return null
    const before = computeKpis(model, s.alloc, s.lastTChange.from).villageDays
    return { plan: planThreshold(model, s.lastTChange.seq, s.lastTChange.from, s.T, s.alloc, before, k.villageDays, reducedMotion), t0: performance.now(), before: s.alloc, after: s.alloc }
  }, [s.lastTChange?.seq])
  const lightEvent = opEvent && tEvent ? (opEvent.plan.seq > tEvent.plan.seq ? opEvent : tEvent) : (opEvent ?? tEvent)
  const interactive = s.screen === 'tutorial' || s.screen === 'play'
  const hudEvent = interactive ? lightEvent : null

  // 빛이 번지는 동안은 새 미리보기를 띄우지 않는다(방금 놓은 결과를 끝까지 보게).
  useEffect(() => {
    // 조작 화면을 빛이 번지는 도중에 떠나면(빠른 [미션 시작]) 끝 타이머가 치워지므로, 여기서 멈춤을 푼다.
    // 풀지 않으면 다음 미션에서 미리보기가 계속 막힌다.
    if (!hudEvent) {
      setRunning(false)
      return
    }
    const wait = hudEvent.t0 + hudEvent.plan.endMs - performance.now()
    if (wait <= 0) {
      setRunning(false)
      return
    }
    setRunning(true)
    const id = window.setTimeout(() => setRunning(false), wait)
    return () => window.clearTimeout(id)
  }, [hudEvent])

  // 불씨가 말풍선 칸에 앉는 순간(도착하기 전에는 그 칸이 아직 비어 있다)
  useEffect(() => {
    if (!hudEvent || hudEvent.plan.kind !== 'op' || hudEvent.plan.j === null) return
    const plan = hudEvent.plan
    const j = plan.j as number
    const land = () => {
      setLandedSeq(plan.seq)
      if (plan.dir > 0 && !reducedMotion) {
        setLanding({ j, key: plan.seq })
        window.setTimeout(() => setLanding((l) => (l && l.key === plan.seq ? null : l)), 320)
      }
    }
    const wait = hudEvent.t0 + EMBER_MS - performance.now()
    if (reducedMotion || wait <= 0) {
      land()
      return
    }
    const id = window.setTimeout(land, wait)
    return () => window.clearTimeout(id)
  }, [hudEvent])
  const inFlight = !!hudEvent && hudEvent.plan.kind === 'op' && landedSeq !== hudEvent.plan.seq && !reducedMotion

  // 불씨·소리: 새 빛의 순서가 생기는 순간(계산은 이미 끝나 있다)
  useEffect(() => {
    if (!hudEvent) return
    const plan = hudEvent.plan
    const st = stage.current
    let level = 0
    let clinicPan = 0
    if (plan.kind === 'op' && plan.j !== null) {
      const j = plan.j
      clinicPan = st?.clinicPan(j) ?? 0
      const hand = () => rectCenter(document.querySelector('.hand-stack'))
      const slot = (k: number) => rectCenter(document.querySelector(`.marker[data-j="${j}"] .mk-slot[data-k="${k}"]`)) ?? st?.chamberScreen(j, k) ?? null
      const used = s.budget - remaining(s.alloc, s.budget)
      const assumed = s.screen === 'play' && (plan.dir > 0 ? used - 1 : used) >= 10
      if (plan.dir > 0) {
        level = Math.max(0, Math.ceil(hudEvent.after[j]) - 1)
        const from = hand()
        const to = slot(level)
        if (from && to && !reducedMotion) embers.current?.fly(from, to, EMBER_MS, 0, assumed ? 'is-assumed' : '')
      } else {
        level = Math.max(0, Math.ceil(hudEvent.before[j]) - 1)
        const from = slot(level)
        const to = hand()
        if (from && to && !reducedMotion) embers.current?.fly(from, to, EMBER_MS, 0, assumed ? 'is-assumed' : '')
      }
    }
    // 소리는 빛을 따라간다(소리의 순서는 audio/cues.ts). 앞 조작의 아직 울리지 않은 음은 거둔다.
    sound.cues(lightCues(plan, { level, clinicPan, villagePan: (i) => st?.villagePan(i) ?? 0 }), 'light')
  }, [hudEvent])

  // 미션 1 브리핑: 지금의 실제 10일이 탑의 등칸에서 풀로 날아와 앉고, 가정 5일(점선 칸)이 옆에 더해진다(설계안 5-4).
  useEffect(() => {
    if (s.screen !== 'briefing' || s.mission !== 'm1' || reducedMotion) return
    const id = window.setTimeout(() => {
      const src: [number, number][] = []
      current.forEach((v, j) => {
        for (let c = 0; c < Math.floor(v); c++) src.push([j, c])
      })
      const half = current.findIndex((v) => v % 1 !== 0)
      if (half >= 0) src.push([half, Math.floor(current[half])])
      const cells = document.querySelectorAll<HTMLElement>('.center-card .pool-cells i')
      const landed: number[] = []
      src.slice(0, 10).forEach(([j, c], q) => {
        const from = rectCenter(document.querySelector(`.marker[data-j="${j}"] .mk-slot[data-k="${c}"]`)) ?? stage.current?.chamberScreen(j, c)
        const el = cells[q]
        if (!from || !el) return
        const r = el.getBoundingClientRect()
        embers.current?.fly(from, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, BRIEF_EMBER_MS, q * BRIEF_STEP_MS)
        landed.push(BRIEF_EMBER_MS + q * BRIEF_STEP_MS)
      })
      const assumed = Array.from({ length: 5 }, (_, q) => BRIEF_EMBER_MS + 10 * BRIEF_STEP_MS + 260 + q * 130)
      sound.cues(briefingCues(landed, assumed), 'brief')
    }, BRIEF_WAIT_MS)
    return () => {
      window.clearTimeout(id)
      // 연출 중에 [시작]을 누르면 남은 오르골 음은 거둔다
      sound.cancel('brief')
    }
  }, [s.screen, s.mission])

  // 빛이 다 닿으면: 말풍선 위로 숫자 하나가 떠올라 사라진다(기준 변경은 가운데 한 줄)
  useOnSettle(hudEvent, (ev) => {
    const plan = ev.plan
    const T = (plan.kind === 'threshold' ? plan.front.to : plan.dir > 0 ? plan.front.to : plan.front.from) as Threshold
    const fromT = (plan.kind === 'threshold' ? plan.front.from : T) as Threshold
    const b = computeKpis(model, ev.before, fromT).villageDays
    const a = computeKpis(model, ev.after, T).villageDays
    let newly = 0
    let newlyPop = 0
    let lost = 0
    let lostPop = 0
    let up = 0
    let down = 0
    for (let i = 0; i < model.nV; i++) {
      if (b[i] < 1 && a[i] >= 1) {
        newly++
        newlyPop += model.pop[i]
      } else if (b[i] >= 1 && a[i] < 1) {
        lost++
        lostPop += model.pop[i]
      }
      if (a[i] > b[i]) up++
      else if (a[i] < b[i]) down++
    }
    if (plan.kind === 'op' && plan.j !== null) {
      const j = plan.j
      const fac = scenario.facilities[j].short
      let text: string
      let big: string
      let tone: Pop['tone']
      if (plan.dir > 0) {
        text = newly > 0 ? copy.toast.gain(fac, newly, people(newlyPop)) : up > 0 ? copy.toast.thicker(fac, up) : copy.toast.none(fac, '+1일')
        big = newly > 0 ? `+${people(newlyPop)}` : up > 0 ? '+1일' : '±0'
        tone = up > 0 ? 'gain' : 'same'
      } else {
        text = lost > 0 ? copy.toast.loss(fac, lost, people(lostPop)) : down > 0 ? copy.toast.thinner(fac, down) : copy.toast.none(fac, '−1일')
        big = lost > 0 ? `−${people(lostPop)}` : down > 0 ? '−1일' : '±0'
        tone = down > 0 ? 'loss' : 'same'
      }
      const id = plan.seq
      setPops((p) => [...p.filter((x) => x.j !== j).slice(-3), { id, j, big, small: text, tone }])
      window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), POP_MS)
      return
    }
    const text = newly > 0 ? copy.toast.tGain(fromT, T, newly, people(newlyPop)) : lost > 0 ? copy.toast.tLoss(fromT, T, lost, people(lostPop)) : copy.toast.tSame(fromT, T)
    const tone: Toast['tone'] = newly > 0 ? 'gain' : lost > 0 ? 'loss' : 'same'
    const id = plan.seq
    setToasts((t) => [...t.filter((x) => x.id !== id && x.text !== text).slice(-1), { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS)
  })
  // 목표 달성 순간: 판정값이 빛을 따라 바뀐 뒤(미션 깃발에 인장 + 장면 빛 + 화음)
  const shownJudged = useSettled(judged, hudEvent)
  const lastAchieved = useRef<boolean | null>(null)
  useEffect(() => {
    lastAchieved.current = null
  }, [s.screen, s.mission])
  useEffect(() => {
    if (s.screen !== 'play') return
    const now = shownJudged.status.achieved
    if (lastAchieved.current === false && now) {
      sound.play('goal')
      setCelebrate((c) => c + 1)
    }
    lastAchieved.current = now
  }, [shownJudged, s.screen])

  // --- 라이브 영역: 조작마다 한 문장(설계안 5-11). 빛과 상관없이 바로, 정확한 값 -------------------
  useEffect(() => {
    if (!s.lastOp) return
    const f = scenario.facilities[s.lastOp.j]
    setLive(copy.live(f.short, allocDays(s.alloc[s.lastOp.j]), weekDays(k.meanDays), people(k.zeroPop)))
  }, [s.lastOp?.seq])
  useEffect(() => {
    if (!s.lastTChange) return
    setLive(copy.liveThreshold(s.T, weekDays(k.meanDays), people(k.zeroPop)))
  }, [s.lastTChange?.seq])

  // --- 조작: 말풍선·무대·키보드가 같은 길로 --------------------------------------------------
  const deny = (j: number, dir: 1 | -1) => {
    sound.play('deny')
    // 막힌 까닭은 미리보기(aria-hidden)에만 있었다 — 스크린리더에도 한 문장으로 알린다(설계안 5-11 라이브 영역).
    const t = copy.world.preview
    const why =
      s.screen === 'tutorial' ? t.blockedTutorial : dir < 0 ? t.blockedNone : remaining(s.alloc, s.budget) <= 0 ? t.blockedEmpty : t.blockedMax
    setLive(`${scenario.facilities[j].short}: ${why}`)
    const key = performance.now()
    setDenied({ j, key })
    window.setTimeout(() => setDenied((d) => (d && d.key === key ? null : d)), 320)
  }
  const doOp = (j: number, dir: 1 | -1, record = true) => {
    const ok = allowedOps(s, cfg, j)
    if (dir > 0 ? !ok.inc : !ok.dec) {
      deny(j, dir)
      return
    }
    dispatch({ type: dir > 0 ? 'inc' : 'dec', j })
    if (record && s.screen === 'play') setHistory((h) => [...h, { j, dir }])
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last || s.screen !== 'play') return
    setHistory((h) => h.slice(0, -1))
    setUndoHover(false)
    doOp(last.j, last.dir > 0 ? -1 : 1, false)
  }
  // 되돌리기 기록은 한 판(한 미션의 배분) 안에서만
  useEffect(() => {
    setHistory([])
    setPreview(null)
    setPops([])
    // 가리키던 요소가 화면과 함께 사라지면 mouseleave가 오지 않는다 — 가리킴 상태를 여기서 비운다.
    setUndoHover(false)
    setPanelHoverEmd(null)
    setEmphasis(null)
  }, [s.screen, s.mission])
  // 지표 자세히를 닫으면 그 안에서 가리키던 읍·면·지표 강조도 끝난다
  useEffect(() => {
    if (details) return
    setPanelHoverEmd(null)
    setEmphasis(null)
  }, [details])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && s.screen === 'play' && !s.dataOpen) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // --- 전시 모드: 90초 무입력이면 처음으로(설계안 5-1, ?kiosk=0으로 끔) ---------------------
  useEffect(() => {
    if (!kiosk || s.screen === 'start') return
    let timer = window.setTimeout(() => dispatch({ type: 'home' }), IDLE_MS)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => dispatch({ type: 'home' }), IDLE_MS)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const
    for (const e of events) window.addEventListener(e, reset, { passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const e of events) window.removeEventListener(e, reset)
    }
  }, [kiosk, s.screen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || s.dataOpen) return
      if (s.screen === 'finale' && s.finaleFocus === null) {
        dispatch({ type: 'finaleFocus', m: finaleReturn ?? 'm1' })
        return
      }
      if (details) {
        setDetails(false)
        return
      }
      if (phase === 'appreciate') {
        setPhase('summary')
        return
      }
      setPreview(null)
      dispatch({ type: 'openRegion', m: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.dataOpen, s.screen, s.finaleFocus, details, phase, finaleReturn])

  // 화면이 바뀌면: 전체 시점, 소식·표지 정리. 결산은 감상부터(움직임 줄이기면 바로 결과).
  useEffect(() => {
    if (s.screen === 'debrief' || s.screen === 'start' || s.screen === 'finale' || s.screen === 'intro') {
      stage.current?.preset('overview')
      setTopView(false)
    }
    setToasts([])
    setLostPick(null)
    setDetails(false)
    if (s.screen === 'debrief' && !reducedMotion) {
      setPhase('appreciate')
      const id = window.setTimeout(() => setPhase('summary'), APPRECIATE_MS)
      return () => window.clearTimeout(id)
    }
    setPhase('summary')
  }, [s.screen, result?.attempt])
  useEffect(() => {
    if (phase === 'summary' && s.screen === 'debrief') stage.current?.preset('overview')
  }, [phase])
  useEffect(() => {
    if (phase !== 'appreciate') return
    const skip = () => setPhase('summary')
    window.addEventListener('pointerdown', skip)
    return () => window.removeEventListener('pointerdown', skip)
  }, [phase])

  // S6 지도 바탕: 무대의 땅 그림(같은 해질녘 빛)을 위에서 본 것. 무대가 없으면 높이 음영으로.
  useEffect(() => {
    if (s.screen === 'finale' && !hillshade) {
      const url = stage.current?.landImage(900) ?? null
      const g = data.geometry.terrain
      const w = (g.cols - 1) * g.cell_km
      const hgt = (g.rows - 1) * g.cell_km
      setHillshade(url ? { url, x0: g.x0, y1: g.y0 + hgt, width: w, height: hgt } : buildHillshade(data.geometry, data.terrain))
    }
    if (s.screen !== 'finale') setFinaleReturn(null)
  }, [s.screen])

  const finaleBoard = s.screen === 'finale' && s.finaleFocus === null
  const showSheet = (s.screen === 'debrief' && details) || finaleBoard
  const sheetWidth = showSheet ? sheetWidthFor(width) : 0
  const appreciating = s.screen === 'debrief' && phase === 'appreciate'

  // --- 무대 상태 ---------------------------------------------------------------------------
  const stageMode: StageMode = s.screen === 'intro' && s.introStep === 0 ? 'intro-villages' : s.screen === 'intro' && s.introStep === 1 ? 'intro-towers' : 'normal'
  const shown = useMemo((): {
    alloc: readonly number[]
    k: Kpis
    base: Kpis | null
    ghost: readonly number[] | null
    emdValues: string[] | null
  } => {
    if (s.screen === 'debrief' && result) {
      const cmp = s.debriefCompare && prevResult
      return {
        alloc: result.alloc,
        k: result.k15,
        base: s.deltaMode ? (cmp ? prevResult.k15 : current15) : null,
        ghost: cmp ? prevResult.alloc : s.ghost && nextId && details ? landscape.missions[nextId].reference.x : null,
        emdValues: emdValuesFor(s.mission, result.k15, model, mission.target),
      }
    }
    if (s.screen === 'finale' && finale) {
      const r = finale.find((x) => x.mission === s.finaleFocus) ?? finale[0]
      const b = s.finaleFocus ? (s.finaleBase === 'current' ? null : finale.find((x) => x.mission === s.finaleBase)) : null
      return {
        alloc: r.alloc,
        k: r.k15,
        base: s.finaleFocus ? (b ? b.k15 : current15) : null,
        ghost: s.finaleFocus ? (b ? b.alloc : current) : null,
        emdValues: null,
      }
    }
    const ghost = (s.screen === 'play' && s.deltaMode) || (s.screen === 'tutorial' && s.tutorialStep === 3) ? baseAlloc : null
    return {
      alloc: s.alloc,
      k,
      base: s.deltaMode ? baseK : null,
      ghost,
      emdValues: s.screen === 'play' ? emdValuesFor(s.mission, k, model, mission.target) : null,
    }
  }, [s.screen, s.alloc, s.deltaMode, s.ghost, s.debriefCompare, s.mission, s.finaleFocus, s.finaleBase, s.tutorialStep, result, prevResult, nextId, finale, k, baseK, baseAlloc, current15, current, landscape, model, mission.target, details])

  // 잃은 마을(결산): 현재 실제(10일) 대비 진료가 닿지 않게 된 마을. 세계 속 표지로 많아야 셋.
  const lost = useMemo(() => (s.screen === 'debrief' && result ? lostVillages(result.k15, current15, model.pop) : null), [s.screen, result, current15, model])
  const pins = useMemo((): VillagePin[] => {
    if (!lost || appreciating || details) return []
    const top = [...lost.lost].sort((a, b) => model.pop[b] - model.pop[a]).slice(0, 3)
    return top.map((i, q) => ({
      i,
      text: q === top.length - 1 && lost.lost.length > top.length ? `${copy.world.lostPin(scenario.villages[i].name, people(scenario.villages[i].pop))} · ${copy.world.lostMore(lost.lost.length - top.length)}` : copy.world.lostPin(scenario.villages[i].name, people(scenario.villages[i].pop)),
    }))
  }, [lost, appreciating, details, model, scenario])

  // --- 미리보기: 놓기 전에 결과를 본다 --------------------------------------------------------
  const lastOpRec = history[history.length - 1]
  const pvTarget: Op | null = undoHover && lastOpRec ? { j: lastOpRec.j, dir: lastOpRec.dir > 0 ? -1 : 1 } : preview
  const previewInfo = useMemo((): PreviewInfo | null => {
    if (!pvTarget || !interactive || running || inFlight) return null
    const { j, dir } = pvTarget
    const ok = allowedOps(s, cfg, j)
    const allowed = dir > 0 ? ok.inc : ok.dec
    let reason: 'empty' | 'max' | 'none' | 'tutorial' | null = null
    if (!allowed) {
      if (s.screen === 'tutorial') reason = 'tutorial'
      else if (dir > 0) reason = remaining(s.alloc, s.budget) <= 0 ? 'empty' : 'max'
      else reason = 'none'
    }
    const isPop = mission.kpi === 'cov3_pop'
    const fmt = (v: number) => (isPop ? people(v) : `${days1(v)}일`)
    const missionLine =
      s.screen === 'play'
        ? (after: readonly number[]) => {
            const v1 = judge(model, landscape, s.mission, after).status.value
            const v0 = judged.status.value
            return `${copy.missions[s.mission].kpiName} ${fmt(v0)} → ${fmt(v1)}${s.T !== 15 ? ' · 15분 판정' : ''}`
          }
        : undefined
    return buildPreview({ model, T: s.T, alloc: s.alloc, k, j, dir, fac: scenario.facilities[j].short, allowed, reason, missionLine, text: copy.world.preview })
  }, [pvTarget?.j, pvTarget?.dir, interactive, running, inFlight, s.alloc, s.T, s.screen, s.mission, s.tutorialStep, s.tutorialRemoved, s.tutorialPlaced, k, judged])
  // 미리보기 중 미션 값(왼쪽 위 hero 옆 점선 태그). 판정과 같은 계산(15분)이다.
  const previewMission = useMemo(() => {
    if (!previewInfo || previewInfo.blocked || s.screen !== 'play') return null
    const after = s.alloc.slice()
    after[previewInfo.j] = Math.max(0, Math.min(5, after[previewInfo.j] + previewInfo.dir))
    const st = judge(model, landscape, s.mission, after).status
    return mission.kpi === 'cov3_pop' ? people(st.value) : missionDays(st.value, st.target)
  }, [previewInfo, s.screen, s.alloc, s.mission, model, landscape, mission.kpi])

  const view: StageView = useMemo(
    () => ({
      mode: stageMode,
      alloc: shown.alloc,
      T: s.T,
      villageDays: shown.k.villageDays,
      baseDays: shown.base ? shown.base.villageDays : null,
      deltaMode: s.deltaMode,
      emdDays: shown.k.emdDays,
      worstEmd: s.screen === 'start' || s.screen === 'intro' || s.screen === 'briefing' ? null : shown.k.worstEmd,
      ghostAlloc: shown.ghost,
      hoverFacility: interactive ? (previewInfo && !previewInfo.blocked ? previewInfo.j : stageHover?.kind === 'facility' ? stageHover.index : null) : null,
      selectedFacility: null,
      highlightEmd: panelHoverEmd ?? s.regionEmd,
      highlightVillages: s.screen === 'debrief' ? (lostPick ?? (appreciating ? null : (lost?.lost ?? null))) : null,
      emphasis,
      event: interactive || s.screen === 'start' ? lightEvent : null,
      autoRotate: s.screen === 'start',
      reducedMotion,
      emdValues: shown.emdValues,
      report: s.screen === 'debrief',
      celebrate,
      preview: previewInfo && !previewInfo.blocked && previewInfo.villages.length ? { villages: previewInfo.villages, sign: previewInfo.dir } : null,
      appreciate: appreciating,
    }),
    [stageMode, shown, s.T, s.deltaMode, s.screen, panelHoverEmd, s.regionEmd, lostPick, lost, emphasis, lightEvent, interactive, reducedMotion, celebrate, previewInfo, stageHover, appreciating],
  )

  const onStageHover = useCallback(
    (p: Pick) => {
      setStageHover(p)
      if (!interactive) return
      if (p?.kind === 'facility') setPreview({ j: p.index, dir: 1, src: 'stage' })
      else setPreview((cur) => (cur?.src === 'stage' ? null : cur))
    },
    [interactive],
  )
  const onStageClick = (p: Pick) => {
    if (!p) {
      dispatch({ type: 'openRegion', m: null })
      return
    }
    if (p.kind === 'facility' && interactive) doOp(p.index, 1)
    if (p.kind === 'emd' && interactive) dispatch({ type: 'openRegion', m: p.index })
  }
  const onStageDbl = useCallback(
    (p: Pick) => {
      if (!p) return
      if (p.kind === 'emd') stage.current?.focusEmd(p.index)
      if (p.kind === 'facility') {
        const f = scenario.facilities[p.index]
        const m = scenario.emds.findIndex((e) => e.id === f.emd)
        stage.current?.focusEmd(m)
      }
    },
    [scenario],
  )

  // 튜토리얼 문장(설계안 5-3): 숫자는 실제 계산값이다.
  const tried = useMemo(() => {
    if (s.tutorialTriedT === null) return null
    const a = computeKpis(model, current, 15).cov1Pop
    const b = computeKpis(model, current, s.tutorialTriedT).cov1Pop
    return copy.tutorial.step2Changed(people(a), people(b))
  }, [model, current, s.tutorialTriedT])
  const tutorialResult = useMemo(() => {
    if (s.screen !== 'tutorial' || s.tutorialPlaced === null) return null
    const before = computeKpis(model, current, s.T).villageDays
    let gained = 0
    let thinner = 0
    for (let i = 0; i < model.nV; i++) {
      if (before[i] < 1 && k.villageDays[i] >= 1) gained++
      if (k.villageDays[i] < before[i]) thinner++
    }
    return copy.tutorial.step3Result(scenario.facilities[s.tutorialPlaced].short, gained, thinner)
  }, [s.screen, s.tutorialPlaced, s.T, model, current, k, scenario])

  const lastN = s.lastConfirmed ? missionNumber(s.lastConfirmed.mission) : null
  const baseLabel = s.baseline === 'last' && lastN !== null ? copy.kpi.legendLast(lastN) : copy.kpi.legendCurrent
  const openData = () => dispatch({ type: 'openData', open: true })
  const toggleTop = () => {
    const next = !topView
    setTopView(next)
    stage.current?.preset(next ? 'top' : 'overview')
  }
  const showHand = s.screen === 'play' || (s.screen === 'tutorial' && s.tutorialStep === 3)
  // 말풍선에 보이는 배분: 불씨가 날아가는 동안에는 앞 값(+1) — 앉는 순간 칸이 켜진다
  const markerAlloc = inFlight && hudEvent && hudEvent.plan.dir > 0 ? hudEvent.before : shown.alloc
  const handLeft = inFlight && hudEvent && hudEvent.plan.dir < 0 ? remaining(hudEvent.before, s.budget) : remaining(s.alloc, s.budget)
  const coachJ = s.screen === 'tutorial' && s.tutorialStep === 3 && !s.tutorialRemoved ? cfg.tutorialFrom : null

  // 무대가 비켜 설 가장자리: 시작 화면은 왼쪽 글, 결산은 오른쪽 결과 글·보고서 종이. 나머지는 HUD 판(data-occlude)을 피한다.
  const rightSide = s.screen === 'debrief' && !appreciating ? Math.max(sheetWidth, Math.min(500, Math.round(width * 0.34))) : sheetWidth
  const insets = useMemo(
    () => ({ left: s.screen === 'start' ? Math.min(600, Math.round(width * 0.4)) : 0, right: rightSide, top: 16, bottom: 20 }),
    [s.screen, width, rightSide],
  )
  const layoutKey = `${s.screen}|${s.mission}|${s.introStep}|${s.tutorialStep}|${s.finaleFocus}|${details}|${phase}|${s.regionEmd !== null}|${width}x${height}`
  const anchorsHidden = s.screen === 'intro' && s.introStep === 0

  return (
    <div className={`app screen-${s.screen}${appreciating ? ' is-appreciating' : ''}${details && interactive ? ' has-details' : ''}`} style={{ ['--sheet' as string]: `${sheetWidthFor(width)}px` }}>
      <Stage
        ref={stage}
        data={data}
        model={model}
        world={world}
        hm={hm}
        view={view}
        insets={insets}
        layoutKey={layoutKey}
        onHover={onStageHover}
        onClick={onStageClick}
        onDoubleClick={onStageDbl}
        onFailed={() => setFlat(true)}
        anchors={
          <>
            {!anchorsHidden && !finaleBoard && (
              <ClinicMarkers
                scenario={scenario}
                order={order}
                alloc={markerAlloc}
                ghost={shown.ghost}
                interactive={interactive && !flat}
                allowed={(j) => allowedOps(s, cfg, j)}
                preview={previewInfo}
                previewUndo={undoHover}
                landing={landing}
                denied={denied}
                pops={pops}
                onPreview={(j, dir = 1) => setPreview(j === null ? null : { j, dir, src: 'marker' })}
                onInc={(j) => doOp(j, 1)}
                onDec={(j) => doOp(j, -1)}
                onDenied={deny}
                coach={coachJ}
              />
            )}
            {pins.length > 0 && <VillagePins pins={pins} />}
          </>
        }
      />
      <EmberLayer ref={embers} />

      {/* 시작 */}
      {s.screen === 'start' && (
        <>
          <StartCard onStart={() => dispatch({ type: 'start' })} onData={openData} />
          <div className="start-corner">
            <SoundToggle />
          </div>
          <ul className="start-legend" aria-hidden="true">
            <li>
              <i className="lg-house lit" />
              {copy.legend.villageFull}
            </li>
            <li>
              <i className="lg-house" />
              {copy.legend.villageEmpty}
            </li>
          </ul>
        </>
      )}

      {s.screen !== 'start' && !appreciating && !finaleBoard && (
        <CornerTools
          T={s.T}
          onT={(T: Threshold) => dispatch({ type: 'setT', T })}
          tLocked={thresholdLocked(s)}
          coachT={s.screen === 'tutorial' && s.tutorialStep === 2}
          undo={s.screen === 'play' ? { enabled: history.length > 0 && !inFlight, onUndo: undo, onHover: setUndoHover } : null}
          top={topView}
          onTop={toggleTop}
          details={interactive ? { open: details, onToggle: () => setDetails(!details) } : null}
        />
      )}

      {!appreciating && !finaleBoard && s.screen !== 'start' && (
        <div className="corner-bl" data-occlude>
          <ReadingKey
            deltaMode={s.deltaMode && (interactive || s.screen === 'debrief' || s.screen === 'finale')}
            neutral={stageMode !== 'normal'}
            ghost={shown.ghost !== null}
            coached={s.screen === 'tutorial' && s.tutorialStep === 1}
          />
          <DataChip manifest={manifest} onData={openData} floating={false} />
          <button type="button" className="link-button data-link" onClick={openData}>
            {copy.dataAndLimits}
          </button>
        </div>
      )}

      {s.screen === 'intro' && (
        <div className="hud-left" data-occlude>
          <IntroCard step={s.introStep} scenario={scenario} manifest={manifest} onNext={() => dispatch({ type: 'introNext' })} onSkip={() => dispatch({ type: 'introSkip' })} />
        </div>
      )}
      {s.screen === 'briefing' && (
        <BriefingCard
          mission={s.mission}
          targetText={mission.kpi === 'cov3_pop' ? people(mission.target) : weekDays(mission.target)}
          scheduleDate={manifest.display_dates.schedule}
          reducedMotion={reducedMotion}
          onBegin={() => dispatch({ type: 'beginPlay' })}
          onSkip={() => dispatch({ type: 'skipMission' })}
        />
      )}

      {interactive && (
        <>
          <div className="hud-left" data-occlude>
            {s.screen === 'tutorial' ? (
              <TutorialCard
                step={s.tutorialStep}
                triedText={tried}
                needReturn={s.tutorialTriedT !== null && s.T !== 15}
                canNext={canTutorialNext(s)}
                result={tutorialResult}
                onNext={() => dispatch({ type: 'tutorialNext' })}
                onSkip={() => dispatch({ type: 'tutorialSkip' })}
                onStartMission={() => dispatch({ type: 'toBriefing' })}
              />
            ) : (
              <MissionCard
                missionId={s.mission}
                mission={mission}
                status={shownJudged.status}
                k15={shownJudged.k15}
                scenario={scenario}
                T={s.T}
                last={lastN !== null ? { n: lastN, on: s.baseline === 'last', onToggle: (on) => dispatch({ type: 'compareLast', on }) } : null}
                previewValue={previewMission}
              />
            )}
            <KpiLedger
              compact
              k={k}
              base={s.screen === 'tutorial' && s.tutorialPlaced === null ? null : baseK}
              T={s.T}
              scenario={scenario}
              onEmphasis={setEmphasis}
              goal={s.screen === 'play' ? GOAL_TILE[s.mission] : undefined}
              event={hudEvent}
              baseLabel={baseLabel}
            />
            <div className="hud-links">
              <button type="button" className="toggle" aria-expanded={details} onClick={() => setDetails(!details)}>
                {details ? copy.hud.emdClose : copy.hud.emdOpen}
              </button>
              {s.screen === 'play' && (
                <button type="button" className="toggle" aria-pressed={s.deltaMode} onClick={() => dispatch({ type: 'toggleDelta' })}>
                  {s.deltaMode ? copy.controls.deltaOn : copy.controls.deltaOff}
                </button>
              )}
            </div>
          </div>
          {showHand && <Hand left={handLeft} budget={s.budget} mission={s.screen === 'play'} />}
          {s.screen === 'play' && (
            <FinishCorner
              canConfirm={canConfirm(s)}
              left={remaining(s.alloc, s.budget)}
              onConfirm={() => {
                sound.play('confirm')
                dispatch({ type: 'confirm' })
              }}
            />
          )}
          {details && (
            <aside className="details" aria-label={copy.world.details} data-occlude>
              <div className="details-head">
                <h2 className="sheet-title">{copy.world.detailsTitle}</h2>
                <button type="button" className="btn btn-small" onClick={() => setDetails(false)}>
                  {copy.region.close}
                </button>
              </div>
              <label className="baseline-field">
                <span>{copy.baseline.label}</span>
                <select
                  className="select baseline-select"
                  value={s.baseline}
                  disabled={s.screen !== 'play'}
                  onChange={(e) => dispatch({ type: 'setBaseline', baseline: e.target.value as 'current' | 'last' })}
                >
                  <option value="current">{copy.baseline.current(manifest.display_dates.schedule)}</option>
                  {lastN !== null && <option value="last">{copy.baseline.last(lastN)}</option>}
                </select>
              </label>
              <KpiLedger
                k={k}
                base={s.screen === 'tutorial' && s.tutorialPlaced === null ? null : baseK}
                T={s.T}
                scenario={scenario}
                onEmphasis={setEmphasis}
                goal={s.screen === 'play' ? GOAL_TILE[s.mission] : undefined}
                event={hudEvent}
                baseLabel={baseLabel}
              />
              {s.regionEmd === null ? (
                <EmdList
                  k={k}
                  base={s.screen === 'tutorial' && s.tutorialPlaced === null ? null : baseK}
                  scenario={scenario}
                  model={model}
                  highlight={panelHoverEmd ?? (stageHover?.kind === 'emd' ? stageHover.index : null)}
                  onHover={setPanelHoverEmd}
                  onOpen={(m) => {
                    // 누른 행이 지역 카드로 바뀌어 사라지므로 가리킴 강조를 여기서 끝낸다
                    setPanelHoverEmd(null)
                    dispatch({ type: 'openRegion', m })
                    stage.current?.focusEmd(m)
                  }}
                />
              ) : (
                <RegionCard
                  m={s.regionEmd}
                  k={k}
                  scenario={scenario}
                  model={model}
                  alloc={s.alloc}
                  populationDate={manifest.display_dates.population}
                  onClose={() => dispatch({ type: 'openRegion', m: null })}
                />
              )}
            </aside>
          )}
          {!details && s.regionEmd !== null && (
            <RegionCard
              m={s.regionEmd}
              k={k}
              scenario={scenario}
              model={model}
              alloc={s.alloc}
              populationDate={manifest.display_dates.population}
              onClose={() => dispatch({ type: 'openRegion', m: null })}
            />
          )}
          {flat && (
            <FacilityDock
              scenario={scenario}
              model={model}
              alloc={s.alloc}
              T={s.T}
              allowed={(j) => allowedOps(s, cfg, j)}
              onInc={(j) => doOp(j, 1)}
              onDec={(j) => doOp(j, -1)}
              onDenied={deny}
              hover={null}
              stageHover={null}
              selected={null}
              onHover={() => {}}
              onSelect={() => {}}
            />
          )}
          <Toasts items={toasts} />
        </>
      )}

      {/* 결산: 감상 → 세계 위 결과 글 */}
      {appreciating && (
        <button type="button" className="appreciate-skip" onClick={() => setPhase('summary')}>
          {copy.world.appreciateSkip}
        </button>
      )}
      {s.screen === 'debrief' && result && lost && !appreciating && !details && (
        <WorldDebrief
          key={`${s.mission}-${result.attempt}`}
          scenario={scenario}
          missionId={s.mission}
          status={result.status}
          mine={result.k15}
          base={current15}
          lost={lost}
          nextLabel={nextId ? copy.debrief.next : copy.debrief.toFinale}
          onNext={() => dispatch({ type: 'nextMission' })}
          onAgain={() => dispatch({ type: 'replay' })}
          detailsOpen={details}
          onDetails={() => setDetails(true)}
        />
      )}

      {/* S6: 같은 세계 위에서 미션을 고른다 */}
      {s.screen === 'finale' && finale && s.finaleFocus !== null && (
        <WorldFinale
          results={finale}
          scenario={scenario}
          focus={s.finaleFocus}
          onFocus={(m) => dispatch({ type: 'finaleFocus', m })}
          base={s.finaleBase}
          onBase={(base) => dispatch({ type: 'finaleBase', base })}
          onBoard={() => {
            setFinaleReturn(s.finaleFocus)
            dispatch({ type: 'finaleFocus', m: null })
          }}
          onHome={() => dispatch({ type: 'home' })}
        />
      )}
      {finaleBoard && finale && (
        <FinaleBoard
          results={finale}
          scenario={scenario}
          geometry={data.geometry}
          model={model}
          manifest={manifest}
          hillshade={hillshade}
          world={world}
          hover={finaleHover}
          onHover={setFinaleHover}
          onOpen={(m) => {
            setFinaleHover(null)
            dispatch({ type: 'finaleFocus', m })
          }}
          returnFocus={finaleReturn}
        />
      )}

      {showSheet && (
        <aside className={`panel panel-${s.screen}`} aria-label={copy.panelLabel} style={{ width: sheetWidth }} data-occlude>
          {s.screen === 'debrief' && result && (
            <>
              <div className="sheet-head">
                <button type="button" className="btn btn-small" onClick={() => setDetails(false)}>
                  {copy.world.debriefDetailsClose}
                </button>
              </div>
              <DebriefPanel
                key={`${s.mission}-${result.attempt}`}
                scenario={scenario}
                model={model}
                missionId={s.mission}
                mission={mission}
                status={result.status}
                mine={result.k15}
                base={current15}
                combo={combo}
                prev={prevId && prevResult ? { n: missionNumber(prevId), k15: prevResult.k15 } : null}
                others={Object.values(s.results)
                  .filter((r) => r.mission !== s.mission)
                  .map((r) => ({ label: copy.debrief.otherPoint(missionNumber(r.mission)), mean: r.k15.meanDays, worst: r.k15.worstEmdDays }))}
                next={nextId ? { id: nextId, reference: landscape.missions[nextId].reference.x } : null}
                ghost={s.ghost}
                onToggleGhost={() => dispatch({ type: 'toggleGhost' })}
                compare={s.debriefCompare}
                onToggleCompare={() => dispatch({ type: 'toggleCompare' })}
                onShowLost={(m, villages) => {
                  setLostPick(villages)
                  stage.current?.focusEmd(m)
                }}
                onNext={() => dispatch({ type: 'nextMission' })}
                onAgain={() => dispatch({ type: 'replay' })}
                onHome={() => dispatch({ type: 'home' })}
                showActions={false}
              />
            </>
          )}
          {finaleBoard && finale && (
            <>
              <div className="sheet-head">
                <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'finaleFocus', m: finaleReturn ?? 'm1' })}>
                  {copy.world.finaleBoardClose}
                </button>
              </div>
              <FinalePanel results={finale} scenario={scenario} model={model} hover={finaleHover} focus={s.finaleFocus} onHome={() => dispatch({ type: 'home' })} onData={openData} />
            </>
          )}
        </aside>
      )}
      {s.dataOpen && <DataLimits manifest={manifest} onClose={() => dispatch({ type: 'openData', open: false })} />}
      <div className="sr-only" aria-live="polite" role="status">
        {live}
      </div>
      <span hidden data-testid="pool-remaining">
        {remaining(s.alloc, s.budget)}
      </span>
      <span hidden data-testid="light-until">
        {hudEvent ? String(Math.round(hudEvent.t0 + hudEvent.plan.endMs)) : '0'}
      </span>
      <span hidden data-testid="game-state">
        {JSON.stringify({ screen: s.screen, mission: s.mission, results: Object.fromEntries(Object.entries(s.results).map(([m, r]) => [m, { alloc: r.alloc, attempt: r.attempt, achieved: r.status.achieved }])) })}
      </span>
    </div>
  )
}
