/**
 * 3D 무대(설계안 6절, 6-16 v0.4 「불빛이 닿는 골짜기」). React와 떨어진 명령형 three.js 장면이다.
 * 화면 상태는 update(view)로만 받는다.
 *
 * 9월 말 해질녘의 공주 디오라마: 땅 덩어리·나무 덩이 위에 마을의 집(한 채 ≈ 주민 50명), 보건지소 건물과 진료등 탑.
 * 데이터 채널은 셋뿐이다 — 빛(진료가 닿는다), 등칸 수(진료일), ▲▼ 깃발(기준선 대비). 서비스권 원·버퍼·등시선 면은
 * 그리지 않는다(6-6): 도달은 마을의 빛으로 보이고, 개별 관계는 가리킬 때 실제 도로망 경로의 빛과 `도로망 n분`으로 읽는다.
 * 조작의 계산은 이미 끝나 있다. 무대는 그 결과를 빛의 순서(lightPlan)대로 보여 줄 뿐이다.
 *
 * v0.5(설계안 6-17 「세계가 먼저」): 지소 말풍선·마을 표지는 React가 그린 HTML이고, 무대는 그 자리(세계 좌표 → 화면)만
 * 맞춘다(`data-anchor="j:3"`, `"v:12"`). 놓기 전 미리보기는 바뀔 마을의 집 테두리 빛, 놓은 뒤에는 빛이 닿는 순간 불빛으로 바뀐다.
 * 위에서 보기도 같은 원근 카메라를 높이 올린 것이라 집·나무·받침이 그대로 보인다(평면 지도로 바꾸지 않는다).
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

import { copy } from '../content/copy'
import type { AppData, PolygonRings } from '../data/types'
import { glyphSize } from '../engine/compare'
import { allocDays, people, roadMinutes, weekDays } from '../engine/format'
import { type Model, type Threshold, facilitiesReaching, tierOf, villagesReachedBy } from '../engine/kpi'
import { ClinicLayer, CHAMBERS } from './clinics'
import { EngravedLabels } from './engraved'
import { FlagLayer } from './flags'
import { HouseLayer, type VillageLevel } from './houses'
import type { LightPlan } from './lightPlan'
import { LightPaths } from './lightPaths'
import { PALETTE } from './palette'
import { type GlowUniforms, makeGlowUniforms, makeSceneUniforms, type SceneUniforms } from './shaders'
import { BASE_Y, bakeTerrain } from './terrainBake'
import { type Heightmap, drapePath, pointInPolygons } from './terrain'
import { TreeLayer } from './trees'
import type { World } from './world'

export type Pick = { kind: 'facility' | 'village' | 'emd'; index: number } | null
export type Emphasis = 'worst' | 'zero' | 'thick' | null
export type StageMode = 'normal' | 'intro-villages' | 'intro-towers'

export interface StageEvent {
  plan: LightPlan
  /** 계획 시작(performance.now) */
  t0: number
  before: readonly number[]
  after: readonly number[]
}

export interface StageView {
  mode: StageMode
  alloc: readonly number[]
  T: Threshold
  villageDays: Float64Array
  baseDays: Float64Array | null
  deltaMode: boolean
  emdDays: number[]
  worstEmd: number | null
  ghostAlloc: readonly number[] | null
  hoverFacility: number | null
  selectedFacility: number | null
  highlightEmd: number | null
  /** 디브리핑에서 고른 마을 묶음(차가운 윤곽) */
  highlightVillages?: readonly number[] | null
  emphasis: Emphasis
  /** 직전 조작·기준 변경의 빛 순서 */
  event: StageEvent | null
  autoRotate: boolean
  reducedMotion: boolean
  /** 읍·면 이름 아래 줄(미션 2 = 읍·면 평균 진료일, 미션 3 = 주 3일 이상 주민 비율). 없으면 이름만 */
  emdValues?: readonly string[] | null
  /** 결산(보고서 빛): 장면이 조금 밝아진다 */
  report?: boolean
  /** 목표 달성 순간(값이 바뀌면 장면 빛이 0.6초 따뜻해진다) */
  celebrate?: number
  /** 놓기 전 미리보기: 이 조작으로 단계가 바뀔 마을과 방향(없으면 끔) */
  preview?: { villages: readonly number[]; sign: 1 | -1 } | null
  /** 결산의 감상 시간: 카메라가 천천히 한 바퀴 일부를 돈다 */
  appreciate?: boolean
}

export interface StageCallbacks {
  onHover(p: Pick): void
  onClick(p: Pick): void
  onDoubleClick(p: Pick): void
}

export interface Insets {
  left: number
  right: number
  top: number
  bottom: number
}

/** 섬이 가리지 말아야 할 HUD 판(화면 좌표 px) */
export interface ScreenRect {
  x: number
  y: number
  w: number
  h: number
}

const EL_DEFAULT = (47 * Math.PI) / 180
/** 위에서 보기: 같은 원근 카메라를 높이(72°) 올린다 — 받침의 두께·집·나무가 그대로 남는다 */
const EL_TOP = (72 * Math.PI) / 180
const FOV = 28
const CELEBRATE_MS = 650

type Rect = { x: number; y: number; w: number; h: number }

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function levelOf(days: number): 0 | 1 | 2 {
  return tierOf(days)
}

type Tween = { t0: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; fromPos: THREE.Vector3; toPos: THREE.Vector3 }

export class StageController {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly persp: THREE.PerspectiveCamera
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  /** 지금 시점(전체 비스듬히 / 위에서) */
  private viewMode: 'overview' | 'top' = 'overview'
  /** React가 그린 말풍선·표지 층(자리만 맞춘다) */
  private anchorLayer: HTMLElement | null = null
  private anchorObserver: MutationObserver | null = null
  private readonly hm: Heightmap
  private readonly model: Model
  private readonly world: World
  private readonly u: SceneUniforms
  private readonly gu: GlowUniforms
  /** 섬 윤곽 표본(윗면·받침 바닥): 전체 시점 맞추기 */
  private readonly fitPts: THREE.Vector3[] = []
  private fitTarget = new THREE.Vector3()
  private fitTop = { dist: 60, target: new THREE.Vector3() }
  private readonly houses: HouseLayer
  private readonly trees: TreeLayer
  /** 적응 화질: 이어서 그린 프레임 간격(ms)과 지금 단계(픽셀 비율 목록의 칸) */
  private readonly frameGaps: number[] = []
  private qualityLevel = 0
  private readonly pixelRatios: number[]
  private renderedLast = false
  private readonly clinics: ClinicLayer
  private readonly paths: LightPaths
  private readonly flags: FlagLayer
  private readonly engraved: EngravedLabels
  private readonly emdPolys: PolygonRings[][]
  private readonly center: THREE.Vector3
  private readonly extent: { w: number; h: number }
  private fitDistance = 60
  private insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 }
  private occluders: ScreenRect[] = []
  private layoutKey = ''
  /** 사용자가 카메라를 움직이지 않았으면 배치가 바뀔 때 전체 시점을 다시 맞춘다 */
  private atOverview = true
  private width = 1
  private height = 1
  private view: StageView | null = null
  private dirty = true
  private raf = 0
  private lastFrame = performance.now()
  private pointer: { x: number; y: number } | null = null
  private pointerMoved = false
  private downAt: { x: number; y: number } | null = null
  private stageHover: Pick = null
  private tween: Tween | null = null
  private lastEventSeq = -1
  private lastCelebrate = -1
  private celebrateAt = -1e9
  private worstKey = ''
  private highlightKey = ''
  private worstLine: THREE.Group = new THREE.Group()
  private highlightLine: THREE.Group = new THREE.Group()
  private readonly worstMat: LineMaterial
  private readonly highlightMat: LineMaterial
  private readonly lineMats: LineMaterial[] = []
  private readonly raycaster = new THREE.Raycaster()
  private readonly labels: HTMLElement
  private readonly villageLabels: (HTMLDivElement | null)[]
  private timeLabels: { el: HTMLDivElement; pos: THREE.Vector3 }[] = []
  private timeKey = ''
  private readonly tooltip: HTMLDivElement
  private readonly emdLabelPos: { x: number; y: number }[] = []
  private readonly villageTops: THREE.Vector3[]
  private readonly cb: StageCallbacks
  private readonly data: AppData
  private readonly ro: ResizeObserver
  private disposed = false

  constructor(container: HTMLElement, labels: HTMLElement, data: AppData, model: Model, world: World, hm: Heightmap, cb: StageCallbacks) {
    this.cb = cb
    this.data = data
    this.model = model
    this.labels = labels
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.pixelRatios = [dpr, 1.5, 1, 0.75].filter((r, k, a) => r <= dpr && a.indexOf(r) === k)
    this.renderer.setPixelRatio(this.pixelRatios[0])
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.setAttribute('aria-hidden', 'true')

    const sc = data.scenario
    this.hm = hm
    this.world = world
    this.u = makeSceneUniforms()
    this.gu = makeGlowUniforms()
    this.scene.fog = new THREE.Fog(PALETTE.haze, 60, 200)
    this.emdPolys = sc.emds.map((e) => data.geometry.emds.find((g) => g.id === e.id)!.polygons)

    const bake = bakeTerrain(this.hm, data.geometry, this.world, this.u, this.renderer.capabilities.getMaxAnisotropy())
    this.scene.add(bake.mesh, bake.plinth)
    this.terrainMat = bake.mesh.material as THREE.MeshBasicMaterial
    this.plinthMat = bake.plinth.material as THREE.MeshBasicMaterial
    this.topView = bake.topView
    const trees = new TreeLayer(this.world.trees, this.hm, bake.shadowAt, this.u)
    this.trees = trees
    this.houses = new HouseLayer(this.world, this.hm, bake.shadowAt, this.u, this.gu)
    this.clinics = new ClinicLayer(this.world.clinics, this.hm, bake.shadowAt, this.u, this.gu)
    const minutesOf = (i: number, j: number) => model.tenths[i * model.nF + j] / 10
    const outline = data.geometry.outer.polygons.map((p) => [p[0]])
    this.paths = new LightPaths(this.hm, data.geometry.routes.pairs, minutesOf, this.clinics.feet, model.nF, (x, y) => pointInPolygons(x, y, outline))
    this.paths.warm()
    this.villageTops = sc.villages.map((_, i) => this.houses.topOf(i))
    this.flags = new FlagLayer(this.villageTops)
    this.scene.add(trees.group, this.houses.group, this.clinics.group, this.paths.group, this.flags.mesh)

    // 읍·면 이름 자리: 그 읍·면 지소와 4 km 안이면 반대쪽으로 민다(명판과 겹치지 않게).
    sc.emds.forEach((e, m) => {
      let [lx, ly] = data.geometry.emds[m].label
      const f = sc.facilities.find((ff) => ff.emd === e.id)
      if (f) {
        let dx = lx - f.x
        let dy = ly - f.y
        const d = Math.hypot(dx, dy)
        if (d < 4) {
          if (d < 0.3) {
            dx = 0
            dy = -1
          } else {
            dx /= d
            dy /= d
          }
          lx = f.x + dx * 4
          ly = f.y + dy * 4
        }
      }
      this.emdLabelPos.push({ x: lx, y: ly })
    })
    const cl = data.geometry.city_core.label
    this.engraved = new EngravedLabels(this.hm, this.emdLabelPos, { x: cl[0], y: cl[1] })
    this.engraved.onRedraw = () => {
      this.dirty = true
    }
    this.scene.add(this.engraved.group)

    let minx = Infinity
    let miny = Infinity
    let maxx = -Infinity
    let maxy = -Infinity
    for (const p of data.geometry.outer.polygons) for (const [x, y] of p[0]) {
      minx = Math.min(minx, x)
      miny = Math.min(miny, y)
      maxx = Math.max(maxx, x)
      maxy = Math.max(maxy, y)
    }
    this.center = new THREE.Vector3((minx + maxx) / 2, 0.1, -(miny + maxy) / 2)
    this.extent = { w: maxx - minx, h: maxy - miny }
    this.fitTarget.copy(this.center)
    for (const p of data.geometry.outer.polygons) {
      const ring = p[0]
      const step = Math.max(1, Math.floor(ring.length / 160))
      for (let k = 0; k < ring.length; k += step) {
        const [x, y] = ring[k]
        this.fitPts.push(new THREE.Vector3(x, this.hm.sample(x, y) + 0.08, -y), new THREE.Vector3(x, BASE_Y, -y))
      }
    }

    this.persp = new THREE.PerspectiveCamera(FOV, 1, 1, 3000)
    this.camera = this.persp
    this.controls = new OrbitControls(this.persp, this.renderer.domElement)
    this.controls.target.copy(this.center)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.minPolarAngle = 0
    this.controls.maxPolarAngle = (60 * Math.PI) / 180
    this.controls.screenSpacePanning = false
    this.controls.autoRotateSpeed = 0.5
    this.controls.addEventListener('change', () => this.clampTarget(this.controls))
    this.controls.addEventListener('start', () => {
      this.atOverview = false
    })

    this.worstMat = this.lineMat(PALETTE.worstLine, 3.2, 0.95, true, 0.5, 0.32)
    this.highlightMat = this.lineMat(PALETTE.select, 2.6, 0.95)
    this.scene.add(this.worstLine, this.highlightLine)

    // HTML 라벨: 마을 이름(가까이서만), 시간, 마을 명판. 지소 말풍선은 React가 그린다(setAnchors).
    this.villageLabels = sc.villages.map(() => null)
    this.tooltip = this.div('stage-tooltip')
    this.tooltip.style.display = 'none'

    const el = this.renderer.domElement
    el.addEventListener('pointermove', this.onPointerMove)
    el.addEventListener('pointerleave', this.onPointerLeave)
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointerup', this.onPointerUp)
    el.addEventListener('dblclick', this.onDblClick)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
    this.preset('overview', true)
    this.raf = requestAnimationFrame(this.frame)
    performance.mark('scl-stage-ready')
    // 개발·검사용 성능 창(운영 빌드에는 없다): 드로우 수·삼각형 수·마지막 그리기 시간
    if (import.meta.env.DEV) {
      ;(window as unknown as { __sclStage?: unknown }).__sclStage = {
        info: () => ({ ...this.renderer.info.render, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, lastRenderMs: this.lastRenderMs }),
        /** n번 그리고 1픽셀을 읽어 GPU가 끝날 때까지 기다린다: 한 장면의 실제 비용(ms) */
        bench: (n = 30) => {
          const gl = this.renderer.getContext()
          const px = new Uint8Array(4)
          this.renderer.render(this.scene, this.camera)
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
          const t0 = performance.now()
          for (let k = 0; k < n; k++) {
            this.renderer.render(this.scene, this.camera)
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
          }
          return (performance.now() - t0) / n
        },
      }
    }
  }

  private lastRenderMs = 0

  private readonly terrainMat: THREE.MeshBasicMaterial
  private readonly plinthMat: THREE.MeshBasicMaterial
  private readonly topView: (w: number) => string | null

  // --- 공개 API -------------------------------------------------------------------

  update(view: StageView): void {
    const prev = this.view
    this.view = view
    const now = performance.now()
    const reduced = view.reducedMotion
    const intro = view.mode !== 'normal'
    this.clinics.setRise(view.mode === 'intro-villages' ? 0 : 1, now, reduced || !prev)

    // 1) 새 빛의 순서: 그 계획대로 시각을 잡는다.
    const ev = view.event
    const fresh = ev && ev.plan.seq !== this.lastEventSeq
    if (ev && fresh) {
      this.lastEventSeq = ev.plan.seq
      const plan = ev.plan
      if (plan.kind === 'op' && plan.j !== null) this.clinics.setLevel(plan.j, view.alloc[plan.j], ev.t0 + plan.chamberMs)
      if (!intro) {
        for (const a of plan.arrivals) {
          // 단계가 바뀌는 마을은 빛이 닿을 때까지 테두리 빛(미리보기에서 본 그 마을)이 남는다
          const was = this.houses.targetOf(a.i)
          const next = levelOf(view.villageDays[a.i])
          if (!reduced && was !== 3 && was !== next) this.houses.markUntil(a.i, next > was ? 1 : -1, ev.t0 + a.at)
          this.houses.retime(a.i, next, ev.t0 + a.at)
        }
      }
      if (!reduced && !intro) this.paths.pulse(plan, ev.t0, ev.before, ev.after)
    }
    // 2) 나머지는 바로(미션 전환·결산 등).
    this.data.scenario.facilities.forEach((_, j) => {
      const days = view.mode === 'intro-villages' ? 0 : view.alloc[j]
      if (!prev) this.clinics.setLevelNow(j, days)
      else this.clinics.setLevel(j, days, now)
      this.clinics.setGhost(j, view.ghostAlloc ? view.ghostAlloc[j] : null)
    })
    for (let i = 0; i < this.model.nV; i++) {
      const level: VillageLevel = intro ? 3 : levelOf(view.villageDays[i])
      if (!prev) this.houses.setNow(i, level)
      else this.houses.setTarget(i, level, now)
    }
    this.houses.setEmphasis(view.emphasis === 'zero' || view.emphasis === 'thick' ? view.emphasis : null)
    this.houses.setHighlight(view.highlightVillages ?? null)
    this.houses.setPreview(intro ? null : (view.preview?.villages ?? null), view.preview?.sign ?? 1)
    this.clinics.setSelected(intro ? null : view.selectedFacility)
    // 3) ▲▼ 깃발
    for (let i = 0; i < this.model.nV; i++) {
      if (!view.deltaMode || !view.baseDays || intro) this.flags.set(i, 0, true, now)
      else {
        const size = glyphSize(view.villageDays[i], view.baseDays[i])
        this.flags.set(i, size, view.villageDays[i] > view.baseDays[i], now)
      }
    }
    this.paths.setContext(view.T, view.alloc)
    this.rebuildWorst(view)
    this.rebuildHighlight(view.highlightEmd)
    this.updateEngraved(view)
    this.controls.autoRotate = (view.autoRotate || !!view.appreciate) && !reduced
    this.controls.autoRotateSpeed = view.appreciate ? 1.8 : 0.5
    if (view.celebrate !== undefined && view.celebrate !== this.lastCelebrate) {
      if (this.lastCelebrate !== -1 && !reduced) this.celebrateAt = now
      this.lastCelebrate = view.celebrate
    }
    this.renderer.domElement.dataset.mode = view.mode
    this.dirty = true
  }

  /** HUD 배치: 가장자리 여백과 섬이 피해야 할 판들. 사용자가 카메라를 움직이지 않았으면 전체 시점을 다시 맞춘다. */
  setLayout(i: Insets, rects: ScreenRect[]): void {
    const key = JSON.stringify([i, rects.map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)])])
    if (key === this.layoutKey) return
    const first = this.layoutKey === ''
    this.layoutKey = key
    this.insets = { ...i }
    this.occluders = rects
    this.resize(true)
    if (this.atOverview) this.preset(this.viewMode, first || !this.view || !!this.view.reducedMotion)
  }

  preset(name: 'overview' | 'north' | 'top', instant = false): void {
    if (name === 'north') {
      const target = this.controls.target.clone()
      const dist = this.persp.position.distanceTo(this.controls.target)
      const el = Math.PI / 2 - this.controls.getPolarAngle()
      this.moveCamera(target, new THREE.Vector3(target.x, target.y + dist * Math.sin(el), target.z + dist * Math.cos(el)), instant || !!this.view?.reducedMotion)
      return
    }
    this.viewMode = name
    const top = name === 'top'
    const target = top ? this.fitTop.target.clone() : this.fitTarget.clone()
    const dist = top ? this.fitTop.dist : this.fitDistance
    const el = top ? EL_TOP : EL_DEFAULT
    const pos = new THREE.Vector3(target.x, target.y + dist * Math.sin(el), target.z + dist * Math.cos(el))
    this.moveCamera(target, pos, instant || !!this.view?.reducedMotion)
    this.atOverview = true
  }

  /** 지금 시점이 위에서 보기인가 */
  get isTop(): boolean {
    return this.viewMode === 'top'
  }

  /** React가 그린 말풍선·표지 층. 자식이 바뀌면 다음 프레임에 자리를 다시 맞춘다. */
  setAnchors(el: HTMLElement | null): void {
    this.anchorObserver?.disconnect()
    this.anchorLayer = el
    if (el) {
      this.anchorObserver = new MutationObserver(() => {
        this.dirty = true
      })
      this.anchorObserver.observe(el, { childList: true, subtree: true })
    }
    this.dirty = true
  }

  /** 읍·면 초점 이동(설계안 6-2: 읍·면 클릭·더블클릭만 카메라를 움직인다). */
  focusEmd(m: number): void {
    const polys = this.emdPolys[m]
    let minx = Infinity
    let miny = Infinity
    let maxx = -Infinity
    let maxy = -Infinity
    for (const p of polys) for (const [x, y] of p[0]) {
      minx = Math.min(minx, x)
      miny = Math.min(miny, y)
      maxx = Math.max(maxx, x)
      maxy = Math.max(maxy, y)
    }
    const target = new THREE.Vector3((minx + maxx) / 2, 0.2, -(miny + maxy) / 2)
    this.atOverview = false
    const size = Math.max(maxx - minx, maxy - miny)
    const dist = Math.max(this.fitDistance / 6, Math.min(this.fitDistance, (this.fitDistance * size * 1.5) / Math.max(this.extent.w, this.extent.h)))
    const el = Math.PI / 2 - this.controls.getPolarAngle()
    const az = this.controls.getAzimuthalAngle()
    const pos = new THREE.Vector3(target.x + dist * Math.cos(el) * Math.sin(az), target.y + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az))
    this.moveCamera(target, pos, !!this.view?.reducedMotion)
  }

  /** 지소 j의 등칸 k(0부터)가 화면 어디에 있나(불씨가 날아갈 자리). 보이지 않으면 null. */
  chamberScreen(j: number, k: number): { x: number; y: number } | null {
    const p = this.clinics.chamberCenter(j, Math.max(0, Math.min(CHAMBERS - 1, k)))
    const s = this.project(p)
    if (!s.ok) return null
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: r.left + s.x, y: r.top + s.y }
  }

  /** 마을 i가 화면 가로 어디쯤인가(−1 왼쪽 … 1 오른쪽): 소리의 좌우 */
  villagePan(i: number): number {
    const s = this.project(this.villageTops[i])
    return Math.max(-1, Math.min(1, (s.x / this.width) * 2 - 1))
  }

  clinicPan(j: number): number {
    const s = this.project(this.clinics.tops[j])
    return Math.max(-1, Math.min(1, (s.x / this.width) * 2 - 1))
  }

  /** S6 작은 지도가 쓰는 위에서 본 땅(같은 해질녘 빛) */
  landImage(width: number): string | null {
    return this.topView(width)
  }

  /** 세계(집 자리) — S6 지도가 같은 집 묶음을 그리게 */
  get worldData(): World {
    return this.world
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerleave', this.onPointerLeave)
    el.removeEventListener('pointerdown', this.onPointerDown)
    el.removeEventListener('pointerup', this.onPointerUp)
    el.removeEventListener('dblclick', this.onDblClick)
    this.controls.dispose()
    this.anchorObserver?.disconnect()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.renderer.dispose()
    el.remove()
    this.labels.replaceChildren()
  }

  // --- 구성 -----------------------------------------------------------------------

  private div(cls: string, text = ''): HTMLDivElement {
    const el = document.createElement('div')
    el.className = cls
    el.textContent = text
    this.labels.appendChild(el)
    return el
  }

  private lineMat(color: string, width: number, opacity: number, dashed = false, dashSize = 0.55, gapSize = 0.35): LineMaterial {
    const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity, dashed, dashSize, gapSize, worldUnits: false })
    this.lineMats.push(m)
    return m
  }

  private ringsToLines(polys: PolygonRings[], mat: LineMaterial, lift: number): THREE.Group {
    const g = new THREE.Group()
    for (const p of polys) for (const r of p) {
      const lg = new LineGeometry()
      lg.setPositions(drapePath(this.hm, r, lift, 0.2))
      const line = new Line2(lg, mat)
      line.computeLineDistances()
      line.renderOrder = 6
      g.add(line)
    }
    return g
  }

  private disposeGroup(g: THREE.Group): void {
    g.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    this.scene.remove(g)
  }

  private rebuildWorst(view: StageView): void {
    const m = view.worstEmd !== null && view.mode === 'normal' ? view.worstEmd : null
    const key = String(m)
    if (key === this.worstKey) return
    this.worstKey = key
    this.disposeGroup(this.worstLine)
    this.worstLine = m === null ? new THREE.Group() : this.ringsToLines(this.emdPolys[m], this.worstMat, 0.05)
    this.scene.add(this.worstLine)
  }

  private rebuildHighlight(m: number | null): void {
    const key = String(m)
    if (key === this.highlightKey) return
    this.highlightKey = key
    this.disposeGroup(this.highlightLine)
    this.highlightLine = m === null ? new THREE.Group() : this.ringsToLines(this.emdPolys[m], this.highlightMat, 0.045)
    this.scene.add(this.highlightLine)
  }

  private updateEngraved(view: StageView): void {
    const sc = this.data.scenario
    sc.emds.forEach((e, m) => {
      const worst = view.mode === 'normal' && view.worstEmd === m
      const sub = view.mode === 'normal' ? (view.emdValues?.[m] ?? '') : ''
      this.engraved.set(m, e.name, sub, worst ? copy.village.worstTag : null)
    })
    this.engraved.set(sc.emds.length, copy.village.cityCore, '', null)
    // 검사용: 새긴 글씨의 내용(화면 읽기용이 아니다)
    this.labels.dataset.emdValues = sc.emds.map((e, m) => `${e.name} ${view.mode === 'normal' ? (view.emdValues?.[m] ?? '') : ''}`.trim()).join(' | ')
  }

  // --- 카메라 ------------------------------------------------------------------------

  private resize(refit = true): void {
    const el = this.renderer.domElement.parentElement
    if (!el) return
    const w = Math.max(1, el.clientWidth)
    const h = Math.max(1, el.clientHeight)
    if (w !== this.width || h !== this.height) refit = true
    this.width = w
    this.height = h
    this.renderer.setSize(this.width, this.height)
    const { left, right, top, bottom } = this.insets
    const aspect = this.width / this.height
    this.persp.aspect = aspect
    const ox = (right - left) / 2
    const oy = (bottom - top) / 2
    this.persp.setViewOffset(this.width, this.height, ox, oy, this.width, this.height)
    this.persp.updateProjectionMatrix()
    if (refit) this.fitCamera()
    this.gu.uPxScale.value = this.height / (2 * Math.tan((this.persp.fov * Math.PI) / 360))
    this.controls.minDistance = this.fitDistance / 6
    // 위에서 보기는 더 멀리서 맞춘다(원근이 줄어 남북이 길게 보인다): 두 시점 중 먼 쪽까지 허용
    this.controls.maxDistance = Math.max(this.fitDistance, this.fitTop.dist) * 1.1
    for (const m of this.lineMats) m.resolution.set(this.width, this.height)
    this.clinics.frameMat.resolution.set(this.width, this.height)
    this.dirty = true
  }

  /**
   * 전체 시점: 섬 윤곽(윗면·받침 바닥)을 실제로 투영해, HUD 가장자리를 뺀 빈 곳에 꼭 들어오는 거리와 초점을 찾는다.
   * 원근 때문에 가까운 쪽이 커 보이는 것까지 맞춘다.
   */
  private fitCamera(): void {
    const a = this.fitFor(EL_DEFAULT)
    if (a) {
      this.fitDistance = a.dist
      this.fitTarget.copy(a.target)
    }
    const b = this.fitFor(EL_TOP)
    if (b) this.fitTop = b
  }

  private fitFor(elev: number): { dist: number; target: THREE.Vector3 } | null {
    const { left, right, top, bottom } = this.insets
    const m = 12
    const x0 = left + m
    const x1 = this.width - right - m
    const y0 = top + m
    const y1 = this.height - bottom - m
    if (x1 - x0 < 100 || y1 - y0 < 100) return null
    const cam = this.persp.clone()
    cam.setViewOffset(this.width, this.height, (right - left) / 2, (bottom - top) / 2, this.width, this.height)
    cam.updateProjectionMatrix()
    const v = new THREE.Vector3()
    const n = this.fitPts.length
    const sx = new Float32Array(n)
    const sy = new Float32Array(n)
    const rects = this.occluders
      .map((r) => ({ x0: r.x - 6, y0: r.y - 6, x1: r.x + r.w + 6, y1: r.y + r.h + 6 }))
      .filter((r) => r.x1 > x0 && r.x0 < x1 && r.y1 > y0 && r.y0 < y1)
    const project = (target: THREE.Vector3, dist: number) => {
      cam.position.set(target.x, target.y + dist * Math.sin(elev), target.z + dist * Math.cos(elev))
      cam.lookAt(target)
      cam.updateMatrixWorld()
      for (let k = 0; k < n; k++) {
        v.copy(this.fitPts[k]).project(cam)
        sx[k] = (v.x * 0.5 + 0.5) * this.width
        sy[k] = (-v.y * 0.5 + 0.5) * this.height
      }
    }
    // 윗면 윤곽(짝수 번째 점)을 화면 다각형으로 보고 HUD 판과 겹치는지 본다.
    const inside = (px: number, py: number) => {
      let c = false
      for (let a = 0, b = n - 2; a < n; b = a, a += 2) {
        const ya = sy[a]
        const yb = sy[b]
        if (ya > py !== yb > py && px < ((sx[b] - sx[a]) * (py - ya)) / (yb - ya) + sx[a]) c = !c
      }
      return c
    }
    const fits = (target: THREE.Vector3, dist: number) => {
      project(target, dist)
      for (let k = 0; k < n; k++) if (sx[k] < x0 || sx[k] > x1 || sy[k] < y0 || sy[k] > y1) return false
      for (const r of rects) {
        for (let k = 0; k < n; k += 2) if (sx[k] > r.x0 && sx[k] < r.x1 && sy[k] > r.y0 && sy[k] < r.y1) return false
        for (const [px, py] of [
          [r.x0, r.y0],
          [r.x1, r.y0],
          [r.x0, r.y1],
          [r.x1, r.y1],
          [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2],
        ])
          if (inside(px, py)) return false
      }
      return true
    }
    let best = { dist: Infinity, target: this.center.clone() }
    const ew = this.extent.w
    const eh = this.extent.h
    for (const fx of [0, -0.07, 0.07, -0.14, 0.14, -0.21, 0.21]) {
      for (const fz of [0, -0.07, 0.07, -0.13, 0.13]) {
        const target = new THREE.Vector3(this.center.x + fx * ew, this.center.y, this.center.z + fz * eh)
        let lo = 8
        let hi = 900
        if (!fits(target, hi)) continue
        for (let k = 0; k < 24; k++) {
          const mid = (lo + hi) / 2
          if (fits(target, mid)) hi = mid
          else lo = mid
        }
        if (hi < best.dist - 0.01) best = { dist: hi, target }
      }
    }
    if (!Number.isFinite(best.dist)) return null
    return best
  }

  private clampTarget(c: OrbitControls): void {
    const t = c.target
    const hx = this.extent.w / 2 + 2
    const hz = this.extent.h / 2 + 2
    const cx = Math.min(Math.max(t.x, this.center.x - hx), this.center.x + hx)
    const cz = Math.min(Math.max(t.z, this.center.z - hz), this.center.z + hz)
    if (cx !== t.x || cz !== t.z) {
      const d = new THREE.Vector3(cx - t.x, 0, cz - t.z)
      t.add(d)
      c.object.position.add(d)
    }
    t.y = this.center.y
    this.dirty = true
  }

  private moveCamera(target: THREE.Vector3, pos: THREE.Vector3, instant: boolean): void {
    if (instant) {
      this.controls.target.copy(target)
      this.persp.position.copy(pos)
      this.controls.update()
      this.tween = null
      this.dirty = true
      return
    }
    this.tween = { t0: performance.now(), dur: 600, from: this.controls.target.clone(), to: target, fromPos: this.persp.position.clone(), toPos: pos }
  }

  /** 전체 시점 대비 확대 배율(1 = 전체) */
  private zoom(): number {
    return (this.viewMode === 'top' ? this.fitTop.dist : this.fitDistance) / Math.max(1e-3, this.persp.position.distanceTo(this.controls.target))
  }

  // --- 입력 ------------------------------------------------------------------------

  private readonly onPointerMove = (e: PointerEvent): void => {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top }
    this.pointerMoved = true
  }

  private readonly onPointerLeave = (): void => {
    this.pointer = null
    this.pointerMoved = true
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.downAt = { x: e.clientX, y: e.clientY }
  }

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.downAt) return
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y)
    this.downAt = null
    if (moved > 5 || e.button !== 0) return
    const r = this.renderer.domElement.getBoundingClientRect()
    this.cb.onClick(this.pick(e.clientX - r.left, e.clientY - r.top))
  }

  private readonly onDblClick = (e: MouseEvent): void => {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.cb.onDoubleClick(this.pick(e.clientX - r.left, e.clientY - r.top))
  }

  /** 광선과 지형의 첫 만남(높이 격자를 따라 걷는다: 12만 삼각형 광선 검사보다 싸다) */
  private rayGround(ray: THREE.Ray): THREE.Vector3 | null {
    const o = ray.origin
    const d = ray.direction
    if (d.y >= 0) return null
    // 받침 윗면 위(0 ~ 1.6 km)만 걷는다.
    const tTop = (1.7 - o.y) / d.y
    const tBot = (BASE_Y - o.y) / d.y
    const t0 = Math.max(0, tTop)
    const t1 = tBot
    const steps = 220
    const dt = (t1 - t0) / steps
    let prevAbove = true
    for (let s = 0; s <= steps; s++) {
      const t = t0 + dt * s
      const x = o.x + d.x * t
      const y = o.y + d.y * t
      const z = o.z + d.z * t
      const ground = this.hm.sample(x, -z)
      const above = y > ground
      if (!above && prevAbove && s > 0) {
        let a = t - dt
        let b = t
        for (let k = 0; k < 10; k++) {
          const mid = (a + b) / 2
          const my = o.y + d.y * mid
          if (my > this.hm.sample(o.x + d.x * mid, -(o.z + d.z * mid))) a = mid
          else b = mid
        }
        return new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b)
      }
      prevAbove = above
    }
    return null
  }

  private pick(x: number, y: number): Pick {
    const ndc = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const v = this.view
    const objs: THREE.Object3D[] = []
    if (v?.mode !== 'intro-villages') objs.push(...this.clinics.hits)
    objs.push(this.houses.hit)
    const hits = this.raycaster.intersectObjects(objs, false)
    if (hits.length > 0) {
      const facility = hits.find((h) => h.object.userData.kind === 'facility')
      if (facility) return { kind: 'facility', index: facility.object.userData.index as number }
      const h = hits[0]
      if (h.instanceId !== undefined) return { kind: 'village', index: this.houses.villageOf(h.instanceId) }
    }
    const g = this.rayGround(this.raycaster.ray)
    if (g) {
      const px = g.x
      const py = -g.z
      for (let m = 0; m < this.emdPolys.length; m++) if (pointInPolygons(px, py, this.emdPolys[m])) return { kind: 'emd', index: m }
    }
    return null
  }

  // --- 프레임 ------------------------------------------------------------------------

  private focusFacility(): number | null {
    const v = this.view
    if (!v || v.mode === 'intro-villages') return null
    if (this.stageHover?.kind === 'facility') return this.stageHover.index
    return v.hoverFacility ?? v.selectedFacility
  }

  private readonly frame = (now: number): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    const view = this.view
    const reduced = !!view?.reducedMotion
    let animating = false

    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur)
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      this.controls.target.lerpVectors(this.tween.from, this.tween.to, e)
      this.persp.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e)
      if (k >= 1) this.tween = null
      animating = true
    }
    if (this.controls.update(dt)) animating = true

    if (this.pointerMoved) {
      this.pointerMoved = false
      const p = this.pointer ? this.pick(this.pointer.x, this.pointer.y) : null
      if (JSON.stringify(p) !== JSON.stringify(this.stageHover)) {
        this.stageHover = p
        this.renderer.domElement.style.cursor = p && p.kind !== 'emd' ? 'pointer' : 'grab'
        this.cb.onHover(p)
        this.dirty = true
      }
    }

    if (view) {
      const hv = this.stageHover?.kind === 'village' && view.mode === 'normal' ? this.stageHover.index : null
      this.houses.setHover(hv)
      const fj = hv === null ? this.focusFacility() : null
      this.paths.setFocus(view.mode === 'normal' ? fj : null)
      this.clinics.setHover(fj)
      if (hv !== null) {
        const reach = facilitiesReaching(this.model, hv, view.T)
        this.paths.setVillage(hv, reach.filter((r) => view.alloc[r.j] > 0).map((r) => r.j), reach.filter((r) => view.alloc[r.j] <= 0).map((r) => r.j), now)
      } else this.paths.setVillage(null, [], [], now)
      this.updateTimeLabels(view, hv, fj)
    }

    if (this.houses.update(now, reduced)) animating = true
    if (this.clinics.update(now, reduced)) animating = true
    if (this.paths.update(now, reduced, dt)) animating = true
    if (this.flags.update(now, reduced)) animating = true

    // 가장 불리한 읍·면 강조(6개 지표의 그 타일을 가리킬 때)
    if (view?.emphasis === 'worst') {
      this.worstMat.linewidth = 3.2 + 1.8 * (0.5 + 0.5 * Math.sin(now / 160))
      animating = true
    } else if (this.worstMat.linewidth !== 3.2) {
      this.worstMat.linewidth = 3.2
      this.dirty = true
    }

    // 장면 빛: 결산은 조금 밝게, 목표 달성 순간은 0.6초 따뜻하게
    const ck = (now - this.celebrateAt) / CELEBRATE_MS
    const warm = ck >= 0 && ck <= 1 ? Math.sin(Math.PI * ck) : 0
    if (warm > 0) animating = true
    const ex = view?.report ? 1.08 : 1
    const ev = this.u.uExposure.value
    const er = ex * (1 + 0.1 * warm)
    const eg = ex * (1 + 0.04 * warm)
    const eb = ex * (1 - 0.05 * warm)
    if (ev.r !== er || ev.g !== eg || ev.b !== eb) {
      ev.setRGB(er, eg, eb)
      this.terrainMat.color.setRGB(er, eg, eb)
      this.plinthMat.color.setRGB(er, eg, eb)
      this.dirty = true
    }

    this.gu.uOrthoPx.value = 0
    // 안개: 카메라 거리에 맞춘 옅은 대기(먼 쪽 섬의 깊이감). 정보는 가리지 않는 수준.
    const dist = this.persp.position.distanceTo(this.controls.target)
    const fog = this.scene.fog as THREE.Fog
    const near = dist * 0.92
    const far = dist * 2.4
    if (fog.near !== near || fog.far !== far) {
      fog.near = near
      fog.far = far
      this.u.uFogNear.value = near
      this.u.uFogFar.value = far
    }
    if (view) {
      const az = this.controls.getAzimuthalAngle()
      const flip = Math.abs(az) > (100 * Math.PI) / 180
      this.engraved.setView(
        this.zoom(),
        (k) => k === view.worstEmd || k === view.highlightEmd || (this.stageHover?.kind === 'emd' && this.stageHover.index === k),
        !!view.emdValues,
        flip,
      )
    }

    if (!animating && !this.dirty) {
      this.renderedLast = false
      return
    }
    this.adaptQuality(dt)
    this.dirty = false
    const r0 = performance.now()
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
    this.lastRenderMs = performance.now() - r0
  }

  /**
   * 적응 화질(설계안 6-12 5항: 통합 GPU 1080p 60fps): 이어서 그린 프레임이 느리면(가운데값 26 ms 넘게, 약 90프레임)
   * 픽셀 비율을 한 칸 낮추고, 가장 낮은 칸에서도 느리면 나무를 절반으로 줄인다. 데이터 표현(집·빛·탑)은 줄이지 않는다.
   * 아주 느린 GPU(10fps 안팎)에서는 90프레임이 10초를 넘으므로, 3초 동안 12프레임 이상 모이면 그때 판단한다.
   */
  private adaptQuality(dt: number): void {
    if (this.renderedLast) this.frameGaps.push(dt * 1000)
    this.renderedLast = true
    const n = this.frameGaps.length
    if (n < 90 && !(n >= 12 && this.frameGaps.reduce((a, b) => a + b, 0) >= 3000)) return
    const sorted = [...this.frameGaps].sort((a, b) => a - b)
    const med = sorted[sorted.length >> 1]
    this.frameGaps.length = 0
    if (med <= 26) return
    if (this.qualityLevel < this.pixelRatios.length - 1) {
      this.qualityLevel++
      this.renderer.setPixelRatio(this.pixelRatios[this.qualityLevel])
      this.resize(false)
    } else if (this.qualityLevel === this.pixelRatios.length - 1) {
      this.qualityLevel++
      this.trees.thin(0.5)
    }
  }

  private project(p: THREE.Vector3): { x: number; y: number; ok: boolean } {
    const v = p.clone().project(this.camera)
    const x = (v.x * 0.5 + 0.5) * this.width
    const y = (-v.y * 0.5 + 0.5) * this.height
    return { x, y, ok: v.z < 1 && v.z > -1 && x > -40 && x < this.width + 40 && y > -40 && y < this.height + 40 }
  }

  private measure(el: HTMLElement): [number, number] {
    const key = `${el.className}|${el.textContent ?? ''}`
    if (el.dataset.mk !== key) {
      el.dataset.mk = key
      el.dataset.mw = String(el.offsetWidth)
      el.dataset.mh = String(el.offsetHeight)
    }
    return [Number(el.dataset.mw), Number(el.dataset.mh)]
  }

  private updateTimeLabels(view: StageView, hv: number | null, fj: number | null): void {
    const key = `${hv}|${fj}|${view.T}|${view.mode}`
    if (key === this.timeKey) return
    this.timeKey = key
    for (const t of this.timeLabels) t.el.remove()
    this.timeLabels = []
    if (view.mode !== 'normal') return
    const sc = this.data.scenario
    if (hv !== null) {
      for (const { j, tenths } of facilitiesReaching(this.model, hv, view.T)) {
        const el = this.div('stage-label time-label', `${sc.facilities[j].short} · ${roadMinutes(tenths)}`)
        this.timeLabels.push({ el, pos: this.clinics.feet[j].clone().add(new THREE.Vector3(0, -0.05, 0.45)) })
      }
      return
    }
    if (fj === null) return
    const targets = villagesReachedBy(this.model, fj, view.T)
    const far = [...targets].sort((a, b) => this.model.tenths[b * this.model.nF + fj] - this.model.tenths[a * this.model.nF + fj]).slice(0, 3)
    for (const i of far) {
      const el = this.div('stage-label time-label', `${sc.villages[i].name} · ${roadMinutes(this.model.tenths[i * this.model.nF + fj])}`)
      this.timeLabels.push({ el, pos: this.villageTops[i].clone().add(new THREE.Vector3(0, 0.12, 0)) })
    }
  }

  /**
   * 라벨 배치. 우선순위(지소 명판 > 시간 > 마을 이름)대로 놓고, 겹치는 낮은 순위 라벨은 그 프레임에 숨긴다.
   * 가까이 갈수록 이름이 생긴다: 마을 이름은 확대 2.2배부터, 명판의 `주 n일`은 가리키거나 확대했을 때.
   */
  private updateLabels(): void {
    const v = this.view
    if (!v) return
    const sc = this.data.scenario

    const zoom = this.zoom()
    const placed: Rect[] = []
    const claim = (el: HTMLElement, p: THREE.Vector3, anchor: 'bottom' | 'center', visible: boolean, cull: boolean): boolean => {
      const s = this.project(p)
      if (!visible || !s.ok) {
        el.style.visibility = 'hidden'
        return false
      }
      const [w, h] = this.measure(el)
      const rect = { x: s.x - w / 2, y: anchor === 'bottom' ? s.y - h : s.y - h / 2, w, h }
      if (cull && placed.some((r) => overlaps(r, rect))) {
        el.style.visibility = 'hidden'
        return false
      }
      placed.push(rect)
      el.style.visibility = 'visible'
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`
      return true
    }
    // React가 그린 말풍선·표지: 세계 자리에 붙인다(겹침 판정의 맨 앞 순위).
    // 앞(화면 아래)에 있는 것부터 놓고, 겹치는 뒤쪽 말풍선은 줄기를 늘려 위로 든다(--lift). 들어 올린 높이는 부드럽게 옮긴다.
    if (this.anchorLayer) {
      const items: { el: HTMLElement; x: number; y: number }[] = []
      for (const el of this.anchorLayer.querySelectorAll<HTMLElement>('[data-anchor]')) {
        const [kind, raw] = (el.dataset.anchor ?? '').split(':')
        const idx = Number(raw)
        const p = kind === 'j' ? this.clinics.tops[idx] : kind === 'v' ? this.villageTops[idx] : null
        if (!p) continue
        const s = this.project(p)
        if (!s.ok) {
          el.style.visibility = 'hidden'
          continue
        }
        el.style.visibility = ''
        el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`
        items.push({ el, x: s.x, y: s.y })
      }
      items.sort((a, b) => b.y - a.y)
      const bodies: Rect[] = []
      for (const it of items) {
        const body = it.el.querySelector<HTMLElement>('.mk-head, .vpin > span')
        if (!body) continue
        const [w, h0] = this.measure(body)
        const h = h0 + 10
        let lift = 0
        let rect = { x: it.x - w / 2, y: it.y - h, w, h }
        for (let k = 0; k < 10; k++) {
          const hit = bodies.find((r) => overlaps(r, rect))
          if (!hit) break
          lift += rect.y + rect.h - hit.y + 2
          rect = { ...rect, y: it.y - h - lift }
          if (lift > 110) break
        }
        const prev = Number(it.el.dataset.lift ?? 0)
        const next = Math.abs(lift - prev) < 0.5 || this.view?.reducedMotion ? lift : prev + (lift - prev) * 0.35
        if (next !== lift) this.dirty = true
        if (Math.abs(next - prev) > 0.01) {
          it.el.dataset.lift = String(next)
          it.el.style.setProperty('--lift', `${next.toFixed(1)}px`)
        }
        bodies.push(rect)
        placed.push(rect)
        // 미리보기 숫자·떠오르는 숫자 자리도 라벨이 피한다
        for (const extra of it.el.querySelectorAll<HTMLElement>('.mk-preview, .marker-pop')) {
          const r = extra.getBoundingClientRect()
          const c = this.renderer.domElement.getBoundingClientRect()
          placed.push({ x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height })
        }
      }
    }
    for (const t of this.timeLabels) claim(t.el, t.pos, 'center', true, true)
    // 마을 이름: 가까이서만, 인구 큰 마을부터
    const showNames = zoom >= 2.2 && v.mode !== 'intro-villages'
    const order = sc.villages.map((_, i) => i).sort((a, b) => sc.villages[b].pop - sc.villages[a].pop)
    for (const i of order) {
      let el = this.villageLabels[i]
      if (!showNames) {
        if (el) el.style.visibility = 'hidden'
        continue
      }
      if (!el) {
        el = this.div('stage-label village-label', sc.villages[i].name)
        this.villageLabels[i] = el
      }
      const unlit = v.mode === 'normal' && tierOf(v.villageDays[i]) === 0
      el.classList.toggle('is-unlit', unlit)
      claim(el, this.villageTops[i].clone().add(new THREE.Vector3(0, 0.06, 0)), 'bottom', true, true)
    }

    // 마을 명판(6-4 hover): 이름·읍면·인구·기준 안 지소와 도로망 시간·접근 진료일.
    const hv = this.stageHover?.kind === 'village' ? this.stageHover.index : null
    if (hv === null) {
      this.tooltip.style.display = 'none'
    } else {
      const vil = sc.villages[hv]
      const emd = sc.emds.find((e) => e.id === vil.emd)!
      const reach = facilitiesReaching(this.model, hv, v.T)
      const lines = [
        `<strong>${vil.name}</strong>`,
        copy.village.tooltipPop(emd.name, people(vil.pop)),
        v.mode === 'normal' ? `<span class="tt-days">${copy.village.tooltipDays(weekDays(v.villageDays[hv]))}</span>` : '',
        reach.length === 0
          ? copy.village.tooltipNone(v.T)
          : reach.map((r) => `${sc.facilities[r.j].short} ${roadMinutes(r.tenths)} · ${v.alloc[r.j] > 0 ? allocDays(v.alloc[r.j]) : copy.facility.closed}`).join('<br>'),
      ].filter(Boolean)
      this.tooltip.innerHTML = lines.join('<br>')
      this.tooltip.style.display = 'block'
      const s = this.project(this.villageTops[hv])
      this.tooltip.style.transform = `translate(${s.x.toFixed(1)}px, ${(s.y - 10).toFixed(1)}px)`
    }

  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
