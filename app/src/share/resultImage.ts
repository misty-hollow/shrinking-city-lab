/**
 * 결과 이미지(S6 「세 개의 공주」를 한 장으로). 브라우저의 2D 캔버스에서 그린다 — 서버·계정·외부 호출 없음.
 *
 * 무엇을 담나: 작품 제목과 플레이 날짜(이름·모둠은 적었을 때만), S6 머리 문장, 실제 자료·게임 가정 배지와 15일 분해,
 * 미션 셋의 열(판정 칩 · 미션 이름 · 위에서 본 지도 · 보건지소별 진료일 탑 · 평균 진료일 · 가장 불리한 읍·면 · 주 3일 이상 닿는 주민
 * · 닿지 않는 마을), 지도 읽는 법, S6 맺음 문장, 자료 기준일과 「정책을 추천하지 않아요」.
 * 문장은 화면과 같은 문구(copy.finale.* 등)를 그대로 쓴다. 순위·점수·추천은 만들지 않는다(S6과 같다).
 * 지도는 MiniMap(SVG)과 같은 기호·같은 색을 캔버스에 다시 그린 것이다.
 *
 * 크기: 폭 1600 논리 픽셀 × 1.5 = 2400 px PNG(과제 문서·발표 자료에 넣어도 글자가 선명한 크기). 높이는 글 길이에 따라
 * 약 1000(×1.5)이다 — 언어마다 줄 수가 달라서, 다 그린 뒤 아래 여백까지 잘라 낸다.
 */

import { copy } from '../content/copy'
import { getLang } from '../content/lang'
import type { Geometry, Manifest, PolygonRings, Scenario, XY } from '../data/types'
import { zeroVillages } from '../engine/compare'
import { people, weekDays } from '../engine/format'
import { type Model, tierOf } from '../engine/kpi'
import { chipOf, type FinaleResults, finaleLead } from '../screens/Finale'
import type { Hillshade } from '../stage/hillshade'
import type { World } from '../stage/world'
import { missionNumber } from '../state/results'
import { dockOrder } from '../ui/PlayPanel'

export const IMAGE_W = 1600
/** 그릴 때의 최대 높이(다 그린 뒤 실제 높이로 자른다) */
export const IMAGE_H_MAX = 1200
export const IMAGE_SCALE = 1.5

/** 화면과 같은 색(styles/app.css :root) */
const C = {
  night: '#15161a',
  card: '#1c1d21',
  rule: 'rgba(243, 240, 234, 0.12)',
  rule2: 'rgba(243, 240, 234, 0.2)',
  text: '#f3f0ea',
  text2: '#b9b5ad',
  text3: '#8c8880',
  cream: '#eee7da',
  creamInk: '#1b1a18',
  amber: '#f2b84b',
  chamberOff: '#2e2f33',
}

const SITE = 'geoleobom.kr'

export interface ResultImageInput {
  results: FinaleResults
  scenario: Scenario
  geometry: Geometry
  model: Model
  manifest: Manifest
  hillshade: Hillshade | null
  world: World | null
  /** 이름·모둠(선택, 비면 적지 않는다) */
  name: string
  /** 플레이 날짜 YYYY-MM-DD */
  date: string
}

function uiFamily(): string {
  return getLang() === 'vi'
    ? "'Inter Variable', 'Pretendard Variable', 'Segoe UI', system-ui, sans-serif"
    : "'Pretendard Variable', 'Pretendard', 'Malgun Gothic', system-ui, sans-serif"
}

/** 이 이미지에 쓰이는 글자의 글꼴 조각을 미리 받는다(동적 부분 글꼴이라 아직 안 받은 글자가 있을 수 있다). */
async function loadFonts(texts: string[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const sample = [...new Set(texts.join(''))].join('')
  const fam = uiFamily()
  await Promise.all([400, 600, 700, 800].map((w) => document.fonts.load(`${w} 16px ${fam}`, sample).catch(() => [])))
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** 낱말 단위 줄바꿈(한국어·영어·베트남어 모두 띄어쓰기로 끊는다) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= maxW || !line) line = next
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

/** 폭을 넘으면 글자 크기를 줄여 한 줄에 맞춘다 */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, px: number, maxW: number, minPx = 9): void {
  const fam = uiFamily()
  let size = px
  ctx.font = `${weight} ${size}px ${fam}`
  while (size > minPx && ctx.measureText(text).width > maxW) {
    size -= 0.5
    ctx.font = `${weight} ${size}px ${fam}`
  }
}

function setFont(ctx: CanvasRenderingContext2D, weight: number, px: number): void {
  ctx.font = `${weight} ${px}px ${uiFamily()}`
}

/** 배지(실제 자료 = 실선, 게임 가정 = 점선). 오른쪽 끝 x를 돌려준다 */
function badge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, dashed: boolean): number {
  setFont(ctx, 600, 12)
  const w = ctx.measureText(text).width + 12
  ctx.save()
  ctx.strokeStyle = C.text2
  ctx.lineWidth = 1
  if (dashed) ctx.setLineDash([3, 2])
  ctx.strokeRect(x + 0.5, y + 0.5, w, 20)
  ctx.restore()
  ctx.fillStyle = C.text
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + 6, y + 11)
  ctx.textBaseline = 'alphabetic'
  return x + w
}

// --- 지도(MiniMap과 같은 기호) ------------------------------------------------------------

interface MapBox {
  x: number
  y: number
  w: number
  h: number
}

interface Projection {
  X(x: number): number
  Y(y: number): number
  /** 1 km의 픽셀 */
  k: number
}

function projectionFor(g: Geometry, box: MapBox): Projection {
  let minx = Infinity
  let miny = Infinity
  let maxx = -Infinity
  let maxy = -Infinity
  for (const p of g.outer.polygons)
    for (const [x, y] of p[0]) {
      minx = Math.min(minx, x)
      miny = Math.min(miny, y)
      maxx = Math.max(maxx, x)
      maxy = Math.max(maxy, y)
    }
  const k = Math.min(box.w / (maxx - minx), box.h / (maxy - miny))
  const ox = box.x + (box.w - (maxx - minx) * k) / 2
  const oy = box.y + (box.h - (maxy - miny) * k) / 2
  return { X: (x) => ox + (x - minx) * k, Y: (y) => oy + (maxy - y) * k, k }
}

function pathOf(polys: PolygonRings[], P: Projection): Path2D {
  const path = new Path2D()
  for (const p of polys)
    for (const ring of p) {
      ring.forEach(([x, y]: XY, i) => (i === 0 ? path.moveTo(P.X(x), P.Y(y)) : path.lineTo(P.X(x), P.Y(y))))
      path.closePath()
    }
  return path
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  box: MapBox,
  input: ResultImageInput,
  r: FinaleResults[number],
  land: HTMLImageElement | null,
): void {
  const { geometry: g, scenario, world, hillshade } = input
  const P = projectionFor(g, box)
  // MiniMap의 1 단위 = 0.1 km
  const u = P.k / 10
  const outer = pathOf(g.outer.polygons, P)
  ctx.save()
  ctx.clip(outer)
  if (land && hillshade) ctx.drawImage(land, P.X(hillshade.x0), P.Y(hillshade.y1), hillshade.width * P.k, hillshade.height * P.k)
  else {
    ctx.fillStyle = '#6E7C57'
    ctx.fill(outer)
  }
  ctx.globalAlpha = 0.34
  ctx.fillStyle = '#10151B'
  ctx.fill(outer)
  ctx.globalAlpha = 0.5
  ctx.fillStyle = '#C4BEB2'
  ctx.fill(pathOf(g.city_core.polygons, P))
  ctx.restore()

  const emdPaths = scenario.emds.map((e) => pathOf(g.emds.find((x) => x.id === e.id)?.polygons ?? [], P))
  ctx.save()
  ctx.strokeStyle = 'rgba(239, 230, 212, 0.3)'
  ctx.lineWidth = 0.8
  ctx.setLineDash([3, 2.4])
  emdPaths.forEach((p) => ctx.stroke(p))
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(239, 230, 212, 0.55)'
  ctx.lineWidth = 1.2
  ctx.stroke(outer)
  ctx.strokeStyle = '#E3ECF4'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.stroke(emdPaths[r.k15.worstEmd])
  ctx.restore()

  const villages = scenario.villages.map((v, i) => {
    const t = tierOf(r.k15.villageDays[i])
    const pts: [number, number][] = world ? world.villages[i].houses.map((h) => [P.X(world.houses[h].x), P.Y(world.houses[h].y)]) : [[P.X(v.x), P.Y(v.y)]]
    return { t, pts }
  })
  // 빛 번짐 → 집 → 창의 빛
  for (const { t, pts } of villages) {
    if (t !== 2) continue
    for (const [x, y] of pts) {
      const rad = 5.2 * u
      const grd = ctx.createRadialGradient(x, y, 0, x, y, rad)
      grd.addColorStop(0, 'rgba(255, 179, 71, 0.62)')
      grd.addColorStop(1, 'rgba(255, 179, 71, 0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.fillStyle = '#E9DFCC'
  ctx.strokeStyle = '#2A2F35'
  ctx.lineWidth = Math.max(0.3, 0.35 * u)
  for (const { pts } of villages)
    for (const [x, y] of pts) {
      ctx.fillRect(x - 1.05 * u, y - 0.8 * u, 2.1 * u, 1.6 * u)
      ctx.strokeRect(x - 1.05 * u, y - 0.8 * u, 2.1 * u, 1.6 * u)
    }
  ctx.fillStyle = '#FFD27A'
  for (const { t, pts } of villages) {
    if (t === 0) continue
    for (const [x, y] of pts) {
      ctx.beginPath()
      ctx.arc(x, y, (t === 2 ? 1.25 : 0.8) * u, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // 보건지소 명판: 둥근 판 + 점 다섯(켜진 점 = 진료일). 이미지에서는 조금 크게(1.25배) 그린다
  const q = u * 1.25
  scenario.facilities.forEach((f, j) => {
    const cx = P.X(f.x)
    const cy = P.Y(f.y)
    ctx.beginPath()
    ctx.roundRect(cx - 7.4 * q, cy - 2.8 * q, 14.8 * q, 5.6 * q, 2.8 * q)
    ctx.fillStyle = '#15191E'
    ctx.fill()
    ctx.strokeStyle = 'rgba(239, 230, 212, 0.8)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    for (let c = 0; c < 5; c++) {
      const v = r.alloc[j] - c
      ctx.fillStyle = v >= 1 ? '#FFCF6E' : v >= 0.5 ? '#B08A45' : '#3A444F'
      ctx.beginPath()
      ctx.arc(cx - 5.2 * q + c * 2.6 * q, cy, 1 * q, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

// --- 한 장 ---------------------------------------------------------------------------------

/** 미션 열 하나 */
function drawColumn(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, input: ResultImageInput, r: FinaleResults[number], land: HTMLImageElement | null): void {
  const { scenario, model } = input
  const m = r.mission
  const k = r.k15
  const pad = 18
  const inner = w - pad * 2
  ctx.fillStyle = C.card
  ctx.strokeStyle = C.rule
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 6)
  ctx.fill()
  ctx.stroke()

  let cy = y + pad
  // 머리: 미션 n · 판정 칩
  setFont(ctx, 600, 13)
  ctx.fillStyle = C.text2
  ctx.textBaseline = 'middle'
  ctx.fillText(copy.finale.col(missionNumber(m)), x + pad, cy + 10)
  const chip = chipOf(r)
  setFont(ctx, 600, 12)
  const cw = ctx.measureText(chip).width + 12
  ctx.save()
  ctx.strokeStyle = C.text3
  if (r.source === 'reference') ctx.setLineDash([3, 2])
  ctx.strokeRect(x + w - pad - cw + 0.5, cy + 0.5, cw, 20)
  ctx.restore()
  ctx.fillStyle = C.text2
  ctx.fillText(chip, x + w - pad - cw + 6, cy + 11)
  ctx.textBaseline = 'alphabetic'
  cy += 30

  // 미션 이름
  ctx.fillStyle = C.text
  fitText(ctx, copy.missions[m].name, 700, 20, inner)
  ctx.fillText(copy.missions[m].name, x + pad, cy + 18)
  cy += 32

  // 지도
  const mapH = 310
  drawMap(ctx, { x: x + pad, y: cy, w: inner, h: mapH }, input, r, land)
  cy += mapH + 14

  // 보건지소별 진료일(서→동, 칸 하나 = 1일)
  setFont(ctx, 600, 11)
  ctx.fillStyle = C.text3
  ctx.fillText(copy.share.allocHead, x + pad, cy + 10)
  cy += 18
  const order = dockOrder(scenario)
  const slot = inner / order.length
  order.forEach((j, n) => {
    const sx = x + pad + slot * n + slot / 2
    const v = r.alloc[j]
    for (let c = 0; c < 5; c++) {
      ctx.fillStyle = v - c >= 1 ? C.amber : C.chamberOff
      ctx.fillRect(sx - 7, cy + (4 - c) * 6, 14, 4.5)
    }
    ctx.textAlign = 'center'
    setFont(ctx, 700, 13)
    ctx.fillStyle = v < 1 ? C.text3 : C.text
    ctx.fillText(String(v), sx, cy + 46)
    fitText(ctx, scenario.facilities[j].short, 500, 10.5, slot - 2, 8)
    ctx.fillStyle = C.text3
    ctx.fillText(scenario.facilities[j].short, sx, cy + 61)
    ctx.textAlign = 'left'
  })
  cy += 74

  // 세 지표(목표 지표는 왼쪽 크림 선 + 굵게 + 「목표」)
  const goalKey = m === 'm1' ? 'mean' : m === 'm2' ? 'worst' : 'cov3'
  const facts: [string, string, string][] = [
    ['mean', copy.finale.factMean, weekDays(k.meanDays)],
    ['worst', copy.finale.factWorst, `${scenario.emds[k.worstEmd].name} ${weekDays(k.worstEmdDays)}`],
    ['cov3', copy.finale.factCov3, people(k.cov3Pop)],
  ]
  for (const [key, name, value] of facts) {
    const goal = key === goalKey
    ctx.fillStyle = C.rule
    ctx.fillRect(x + pad, cy, inner, 1)
    if (goal) {
      ctx.fillStyle = C.cream
      ctx.fillRect(x + pad, cy + 1, 2, 31)
    }
    setFont(ctx, 700, 14)
    const vw = ctx.measureText(value).width
    ctx.fillStyle = C.text
    ctx.fillText(value, x + pad + inner - vw, cy + 21)
    let nx = x + pad + 10
    const tagW = goal ? (setFont(ctx, 600, 11), ctx.measureText(copy.finale.goalShort).width + 8) : 0
    const nameMax = inner - vw - 26 - (goal ? tagW + 6 : 0)
    ctx.fillStyle = goal ? C.text : C.text2
    fitText(ctx, name, goal ? 700 : 500, 13.5, nameMax)
    ctx.fillText(name, nx, cy + 21)
    nx += ctx.measureText(name).width + 6
    if (goal) {
      ctx.fillStyle = C.cream
      ctx.beginPath()
      ctx.roundRect(nx, cy + 8, tagW, 16, 2)
      ctx.fill()
      setFont(ctx, 600, 11)
      ctx.fillStyle = C.creamInk
      ctx.fillText(copy.finale.goalShort, nx + 4, cy + 20)
    }
    cy += 32
  }
  ctx.fillStyle = C.rule
  ctx.fillRect(x + pad, cy, inner, 1)
  cy += 8
  // 닿지 않는 마을
  const zero = zeroVillages(k)
  const zeroPop = zero.reduce((s, i) => s + model.pop[i], 0)
  ctx.fillStyle = C.text2
  fitText(ctx, copy.finale.factZero(zero.length, people(zeroPop)), 500, 13, inner)
  ctx.fillText(copy.finale.factZero(zero.length, people(zeroPop)), x + pad, cy + 16)
}

/** 지도 읽는 법 한 줄(이미지만 보는 사람을 위해). 마지막 줄의 y를 돌려준다 */
function drawLegend(ctx: CanvasRenderingContext2D, x: number, y: number, maxX: number): number {
  const items: [(cx: number, cy: number) => void, string][] = [
    [
      (cx, cy) => {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8)
        g.addColorStop(0, 'rgba(255,179,71,0.5)')
        g.addColorStop(1, 'rgba(255,179,71,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#FFD27A'
        ctx.beginPath()
        ctx.arc(cx, cy, 2.8, 0, Math.PI * 2)
        ctx.fill()
      },
      copy.legend.villageFull,
    ],
    [
      (cx, cy) => {
        ctx.fillStyle = '#E9DFCC'
        ctx.fillRect(cx - 5, cy - 4, 10, 8)
        ctx.fillStyle = '#FFD27A'
        ctx.beginPath()
        ctx.arc(cx, cy, 2, 0, Math.PI * 2)
        ctx.fill()
      },
      copy.legend.villageHalf,
    ],
    [
      (cx, cy) => {
        ctx.fillStyle = '#E9DFCC'
        ctx.fillRect(cx - 5, cy - 4, 10, 8)
        ctx.strokeStyle = '#2A2F35'
        ctx.lineWidth = 1
        ctx.strokeRect(cx - 5, cy - 4, 10, 8)
      },
      copy.legend.villageEmpty,
    ],
    [
      (cx, cy) => {
        ctx.fillStyle = '#15191E'
        ctx.strokeStyle = 'rgba(239,230,212,0.8)'
        ctx.beginPath()
        ctx.roundRect(cx - 9, cy - 4, 18, 8, 4)
        ctx.fill()
        ctx.stroke()
        for (let c = 0; c < 3; c++) {
          ctx.fillStyle = c < 2 ? '#FFCF6E' : '#3A444F'
          ctx.beginPath()
          ctx.arc(cx - 5 + c * 5, cy, 1.4, 0, Math.PI * 2)
          ctx.fill()
        }
      },
      copy.share.legendPlate,
    ],
    [
      (cx, cy) => {
        ctx.save()
        ctx.strokeStyle = '#E3ECF4'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(cx - 9, cy)
        ctx.lineTo(cx + 9, cy)
        ctx.stroke()
        ctx.restore()
      },
      copy.legend.worst,
    ],
  ]
  setFont(ctx, 500, 12)
  let cx = x
  let cy = y
  for (const [mark, text] of items) {
    const w = 24 + ctx.measureText(text).width
    if (cx + w > maxX && cx > x) {
      cx = x
      cy += 22
    }
    mark(cx + 9, cy - 4)
    setFont(ctx, 500, 12)
    ctx.fillStyle = C.text2
    ctx.fillText(text, cx + 24, cy)
    cx += w + 22
  }
  return cy
}

/** 이미지 안의 글(글꼴을 미리 받는 데 쓴다) */
function allTexts(input: ResultImageInput): string[] {
  const { results, scenario, manifest } = input
  const d = manifest.display_dates
  const out = [
    copy.product,
    copy.scenario,
    copy.subtitle,
    input.name,
    copy.share.played(input.date),
    finaleLead(results),
    copy.briefing.realBadge(d.schedule),
    copy.briefing.assumptionBadge,
    copy.finale.basis,
    copy.finale.closing,
    copy.share.madeWith,
    copy.dataChip(d.population, d.schedule, d.road_network),
    copy.start.notPolicy,
    copy.share.allocHead,
    copy.finale.goalShort,
    copy.finale.factMean,
    copy.finale.factWorst,
    copy.finale.factCov3,
    copy.legend.villageFull,
    copy.legend.villageHalf,
    copy.legend.villageEmpty,
    copy.share.legendPlate,
    copy.legend.worst,
    SITE,
    '0123456789.,·%−+/',
  ]
  for (const r of results) {
    out.push(copy.finale.col(missionNumber(r.mission)), chipOf(r), copy.missions[r.mission].name, weekDays(r.k15.meanDays), people(r.k15.cov3Pop))
    out.push(scenario.emds[r.k15.worstEmd].name)
  }
  for (const f of scenario.facilities) out.push(f.short)
  out.push(copy.finale.factZero(0, people(0)))
  return out
}

/** 결과 이미지를 그린 캔버스(2400×1500). 2D 캔버스가 없으면 null */
export async function renderResultImage(input: ResultImageInput): Promise<HTMLCanvasElement | null> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(IMAGE_W * IMAGE_SCALE)
  canvas.height = Math.round(IMAGE_H_MAX * IMAGE_SCALE)
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = canvas.getContext('2d')
  } catch {
    return null
  }
  if (!ctx) return null
  await loadFonts(allTexts(input))
  const land = input.hillshade ? await loadImage(input.hillshade.url) : null
  ctx.scale(IMAGE_SCALE, IMAGE_SCALE)
  const W = IMAGE_W
  const H = IMAGE_H_MAX
  const M = 48
  const { manifest, results } = input
  const d = manifest.display_dates

  // 바탕: 밤빛 + 위쪽의 옅은 해질녘 빛
  ctx.fillStyle = C.night
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.5, -120, 40, W * 0.5, -120, W * 0.7)
  glow.addColorStop(0, 'rgba(242, 184, 75, 0.10)')
  glow.addColorStop(1, 'rgba(242, 184, 75, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // 머리: 제품 · 제목 · 부제 / 오른쪽: 이름 · 날짜
  ctx.fillStyle = C.text3
  setFont(ctx, 600, 13)
  ctx.fillText(copy.product, M, M + 10)
  ctx.fillStyle = C.text
  setFont(ctx, 800, 40)
  ctx.fillText(copy.scenario, M, M + 56)
  const titleW = ctx.measureText(copy.scenario).width
  ctx.fillStyle = C.text2
  fitText(ctx, copy.subtitle, 500, 16, W - M * 2 - titleW - 380)
  ctx.fillText(copy.subtitle, M + titleW + 20, M + 54)
  ctx.textAlign = 'right'
  const name = input.name.trim()
  if (name) {
    ctx.fillStyle = C.text
    fitText(ctx, name, 700, 20, 360)
    ctx.fillText(name, W - M, M + 30)
  }
  ctx.fillStyle = C.text3
  setFont(ctx, 500, 13)
  ctx.fillText(copy.share.played(input.date), W - M, name ? M + 54 : M + 30)
  ctx.textAlign = 'left'

  // S6 머리 문장 + 배지
  let y = M + 96
  ctx.fillStyle = C.text2
  setFont(ctx, 500, 15)
  for (const line of wrap(ctx, finaleLead(results), W - M * 2).slice(0, 2)) {
    ctx.fillText(line, M, y)
    y += 22
  }
  y += 2
  let bx = badge(ctx, M, y, copy.briefing.realBadge(d.schedule), false)
  bx = badge(ctx, bx + 8, y, copy.briefing.assumptionBadge, true)
  ctx.fillStyle = C.text3
  setFont(ctx, 500, 12)
  ctx.textBaseline = 'middle'
  ctx.fillText(copy.finale.basis, bx + 12, y + 11)
  ctx.textBaseline = 'alphabetic'
  y += 36

  // 미션 셋
  const gap = 16
  const colW = (W - M * 2 - gap * 2) / 3
  const colH = 640
  results.forEach((r, n) => drawColumn(ctx, M + n * (colW + gap), y, colW, colH, input, r, land))
  y += colH + 26

  // 읽는 법
  y = drawLegend(ctx, M, y, W - M) + 36

  // 맺음 문장
  ctx.fillStyle = C.text
  setFont(ctx, 600, 15)
  for (const line of wrap(ctx, copy.finale.closing, W - M * 2).slice(0, 3)) {
    ctx.fillText(line, M, y)
    y += 22
  }

  // 바닥: 자료 기준 · 정책을 추천하지 않음 · 주소
  y += 8
  ctx.fillStyle = C.rule2
  ctx.fillRect(M, y, W - M * 2, 1)
  y += 24
  const foot = [`${copy.share.madeWith} · ${copy.dataChip(d.population, d.schedule, d.road_network)}`, copy.start.notPolicy]
  for (const line of foot) {
    ctx.fillStyle = C.text3
    fitText(ctx, line, 500, 12, W - M * 2 - 160)
    ctx.fillText(line, M, y)
    y += 18
  }
  ctx.textAlign = 'right'
  setFont(ctx, 700, 13)
  ctx.fillStyle = C.text2
  ctx.fillText(SITE, W - M, y - 18)
  ctx.textAlign = 'left'

  // 실제 높이로 자른다(아래 여백 ≈ 옆 여백)
  const outH = Math.min(H, Math.ceil(y - 18 + M * 0.8))
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = Math.round(outH * IMAGE_SCALE)
  out.getContext('2d')?.drawImage(canvas, 0, 0)
  return out
}

/** 파일 이름: `닿는날_결과_2026-11-10.png` (이름을 적었으면 뒤에 붙인다. 파일 이름에 못 쓰는 글자는 뺀다) */
export function imageFileName(date: string, name: string): string {
  const safe = name
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40)
  return `${copy.share.fileName}_${date}${safe ? `_${safe}` : ''}.png`
}

/** 오늘 날짜(이 컴퓨터의 시간대) YYYY-MM-DD */
export function todayLocal(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
