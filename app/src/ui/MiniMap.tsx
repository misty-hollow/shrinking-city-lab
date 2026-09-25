/**
 * 위에서 본 작은 지도(설계안 5-7 S6, 6-13, 6-16). 3D 무대와 같은 기호를 위에서 본 것이다:
 * 바탕 = 무대의 땅 그림과 같은 해질녘 빛, 마을 = 같은 자리의 집 묶음(한 채 ≈ 주민 50명)과 그 발치의 빛
 * (없음 / 작은 빛 / 큰 빛 + 번짐 — 크기와 채움으로 읽혀 색만 쓰지 않는다), 보건지소 = 둥근 명판의 점 다섯(켜진 점 = 진료일),
 * 가장 불리한 읍·면 = 흰 점선, 공주 시내 = 흐린 종이. 서비스권 원·버퍼는 그리지 않는다(6-6).
 */

import { memo, useId } from 'react'

import type { Geometry, PolygonRings, Scenario, XY } from '../data/types'
import { type Kpis, tierOf } from '../engine/kpi'
import type { Hillshade } from '../stage/hillshade'
import type { World } from '../stage/world'

/** 1 km = 10 단위 */
const S = 10

interface Shapes {
  minx: number
  maxy: number
  W: number
  H: number
  outer: string
  emds: string[]
  city: string
}

const cache = new WeakMap<Geometry, Shapes>()

function shapesOf(g: Geometry): Shapes {
  const hit = cache.get(g)
  if (hit) return hit
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
  const pt = ([x, y]: XY) => `${((x - minx) * S).toFixed(1)} ${((maxy - y) * S).toFixed(1)}`
  const line = (coords: XY[]) => coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${pt(c)}`).join('')
  const poly = (polys: PolygonRings[]) => polys.map((p) => p.map((r) => `${line(r)}Z`).join('')).join('')
  const s: Shapes = {
    minx,
    maxy,
    W: (maxx - minx) * S,
    H: (maxy - miny) * S,
    outer: poly(g.outer.polygons),
    emds: g.emds.map((e) => poly(e.polygons)),
    city: poly(g.city_core.polygons),
  }
  cache.set(g, s)
  return s
}

interface Props {
  geometry: Geometry
  scenario: Scenario
  /** 15분 기준 결과 */
  k: Kpis
  alloc: readonly number[]
  hillshade: Hillshade | null
  label: string
  /** 무대와 같은 집 자리(없으면 마을마다 기호 하나) */
  world?: World | null
}

export const MiniMap = memo(function MiniMap({ geometry, scenario, k, alloc, hillshade, label, world }: Props) {
  const id = useId().replace(/:/g, '')
  const sh = shapesOf(geometry)
  const X = (x: number) => (x - sh.minx) * S
  const Y = (y: number) => (sh.maxy - y) * S
  // scenario.emds 순서 = 계산 순서. geometry.emds는 id로 찾는다.
  const emdPath = scenario.emds.map((e) => sh.emds[geometry.emds.findIndex((g) => g.id === e.id)])
  const villages = scenario.villages.map((v, i) => {
    const t = tierOf(k.villageDays[i])
    const pts: [number, number][] = world ? world.villages[i].houses.map((h) => [X(world.houses[h].x), Y(world.houses[h].y)]) : [[X(v.x), Y(v.y)]]
    return { t, pts }
  })
  return (
    <svg className="minimap" viewBox={`0 0 ${sh.W.toFixed(1)} ${sh.H.toFixed(1)}`} role="img" aria-label={label}>
      <defs>
        <clipPath id={`clip${id}`}>
          <path d={sh.outer} />
        </clipPath>
        <radialGradient id={`halo${id}`}>
          <stop offset="0" stopColor="#FFB347" stopOpacity="0.62" />
          <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#clip${id})`}>
        {hillshade ? (
          <image href={hillshade.url} x={X(hillshade.x0)} y={Y(hillshade.y1)} width={hillshade.width * S} height={hillshade.height * S} preserveAspectRatio="none" />
        ) : (
          <path d={sh.outer} fill="#6E7C57" />
        )}
        {/* 해질녘 액자 안에서 빛이 보이도록 땅을 한 단계 가라앉힌다 */}
        <path d={sh.outer} fill="#10151B" opacity="0.34" />
        <path d={sh.city} fill="#ECE6DA" opacity="0.4" />
      </g>
      {emdPath.map((d, m) => (
        <path key={m} d={d} fill="none" stroke="#EFE6D4" strokeOpacity="0.3" strokeWidth="0.8" strokeDasharray="3 2.4" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={sh.outer} fill="none" stroke="#EFE6D4" strokeOpacity="0.55" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path d={emdPath[k.worstEmd]} fill="none" stroke="#E3ECF4" strokeWidth="2.2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" className="minimap-worst" />
      {/* 빛 번짐 → 집 → 창의 빛 순서로 겹친다 */}
      <g className="minimap-halos">
        {villages.map(({ t, pts }, i) => (t === 2 ? pts.map(([x, y], q) => <circle key={`${i}-${q}`} cx={x} cy={y} r="5.2" fill={`url(#halo${id})`} />) : null))}
      </g>
      <g className="minimap-houses">
        {villages.map(({ pts }, i) => pts.map(([x, y], q) => <rect key={`${i}-${q}`} x={x - 1.05} y={y - 0.8} width="2.1" height="1.6" fill="#E9DFCC" stroke="#2A2F35" strokeWidth="0.35" />))}
      </g>
      <g className="minimap-lights">
        {villages.map(({ t, pts }, i) => (t === 0 ? null : pts.map(([x, y], q) => <circle key={`${i}-${q}`} cx={x} cy={y} r={t === 2 ? 1.25 : 0.8} fill="#FFD27A" />)))}
      </g>
      {scenario.facilities.map((f, j) => {
        const cx = X(f.x)
        const cy = Y(f.y)
        return (
          <g key={f.id} className="minimap-tower">
            <rect x={cx - 7.4} y={cy - 2.8} width="14.8" height="5.6" rx="2.8" fill="#15191E" stroke="#EFE6D4" strokeOpacity="0.8" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
            {[0, 1, 2, 3, 4].map((c) => {
              const v = alloc[j] - c
              return <circle key={c} cx={cx - 5.2 + c * 2.6} cy={cy} r="1" fill={v >= 1 ? '#FFCF6E' : v >= 0.5 ? '#B08A45' : '#3A444F'} />
            })}
          </g>
        )
      })}
    </svg>
  )
})
