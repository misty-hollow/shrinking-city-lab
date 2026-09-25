/**
 * 무대 색(설계안 6-16 v0.4 「불빛이 닿는 골짜기」). 밝은 것은 하나뿐 — 진료의 빛.
 *
 * 데이터 채널은 셋이다: 빛(창·번짐·길의 빛 = 진료가 닿는다), 등칸 수(진료일), ▲▼ 깃발(기준선 대비 증감).
 * 땅·나무·지붕 색은 풍경 표현이며 데이터가 아니다. 풍경은 빛보다 밝거나 채도가 높을 수 없다.
 */

export const PALETTE = {
  // 빛 — 데이터
  windowOn: '#FFD27A',
  glow: '#FFB347',
  chamberOn: '#FFCF6E',
  windowOff: '#2F3A45',
  chamberOff: '#26313B',
  // 땅 — 풍경 표현, 자료 아님
  paddy: '#D6B25E',
  paddyLate: '#C99A48',
  paddyGreen: '#B9B062',
  field: '#A7B07A',
  forest: '#58804F',
  forestDeep: '#34563E',
  water: '#6F9AAA',
  waterLight: '#8DB2BF',
  sand: '#D8CBA8',
  lane: '#DDCB9C',
  road: '#EAD9B0',
  roadEdge: '#8F7A58',
  villageGround: '#C9B38A',
  tracing: '#ECE6DA',
  topsoil: '#4A3A2B',
  soil: '#6E513A',
  soilBand: '#86684A',
  soilDeep: '#5B4330',
  // 건물 — 집은 채도를 낮춘 무작위 지붕, 지소는 범주 색
  wall: '#EFE6D6',
  door: '#6A5240',
  roofs: ['#6F7F8C', '#9A5A45', '#B8734E', '#6E7A55', '#8C8378'] as const,
  clinicWall: '#F4F1EA',
  clinicRoof: '#2F5D50',
  forecourt: '#D9D0C0',
  mastFrame: '#2B3036',
  // 변화와 조작
  better: '#3C7BD6',
  worse: '#B5533C',
  select: '#8FD6CB',
  ghost: '#A9BBC8',
  lost: '#8FB8E0',
  /** 미리보기·사건 표시 테두리: 얻음(따뜻한 흰빛) · 잃음(산호빛) */
  markGain: '#FFF1D6',
  markLoss: '#E08A76',
  worstLine: '#E3ECF4',
  // 조명(서남서 해, 고도 약 26°)
  sun: '#FFD9A8',
  sky: '#9DB4D3',
  ground: '#6B5A45',
  haze: '#B8A88E',
} as const

/** 해가 있는 쪽(월드: x 동, y 위, z 남). 방위 247.5°(서남서), 고도 26°. */
export const SUN_DIR = (() => {
  const az = (247.5 * Math.PI) / 180
  const el = (26 * Math.PI) / 180
  const east = Math.sin(az) * Math.cos(el)
  const north = Math.cos(az) * Math.cos(el)
  const up = Math.sin(el)
  return [east, up, -north] as const
})()

export const LIGHT = {
  sun: 1.08,
  sky: 0.8,
  bounce: 0.16,
} as const
