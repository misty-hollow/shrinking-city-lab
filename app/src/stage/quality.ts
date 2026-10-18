/**
 * 적응 화질의 판단(설계안 6-12 5항, 6-16 성능, 6-18). 무대는 이어서 그린 프레임 약 90개(또는 3초)마다 간격의 가운데값을 넘겨주고,
 * 여기서 단계를 정한다. 단계를 무엇에 쓰는지는 무대가 정한다(StageController: 0 모두 · 1 해 그림자 끔 · 2 단순한 나무 ·
 * 그다음 픽셀 비율 칸들(최대 2부터) · 마지막 한 칸 = 나무 절반, 설계안 6-25).
 *
 *   느리다(가운데값 > 26 ms)  한 칸 내린다.
 *   넉넉하다(≤ 18 ms, 약 55fps 이상). 단계를 바꾼 지 5초가 지났으면 한 칸 올린다(일시적 멈춤 뒤 되돌아오게).
 *   올리고 6초 안에 다시 느려지면 그 칸은 이 판에서 다시 올리지 않는다(오르내림 반복 방지).
 *   정지 화면 확인: 무대는 움직일 때만 그리므로, 내려간 단계에서 화면이 멈춰 있으면 되돌릴 근거(프레임)가 없다.
 *   그래서 5초가 지나면 판단 한 묶음만큼 같은 화면을 다시 그려 본다. 넉넉하지 않았으면 다음 확인까지 두 배씩(최대 60초) 기다린다.
 *
 * 데이터 표현(집·창·빛 번짐·길의 빛·진료등)은 어느 단계에서도 줄이지 않는다. 움직임 줄이기와는 관계가 없다
 * (움직임 줄이기는 화면이 멈춰 있어 프레임을 덜 그릴 뿐, 단계를 바꾸지 않는다).
 */

/** 단계가 무대에서 하는 일(설계안 6-25): 해 그림자 → 단순한 나무 → 픽셀 비율 칸들 → 나무 절반 순서로 내려간다 */
export interface QualityLadder {
  shadow: boolean
  detailedTrees: boolean
  /** 픽셀 비율 목록의 몇 번째 칸 */
  pixelRatioIndex: number
  halfTrees: boolean
}

/** 픽셀 비율 앞의 두 칸: 0 모두 · 1 해 그림자 끔 · 2부터 단순한 나무 */
export const LADDER_EXTRAS = 2

export function qualityLadder(level: number, pixelRatios: number): QualityLadder {
  return {
    shadow: level < 1,
    detailedTrees: level < LADDER_EXTRAS,
    pixelRatioIndex: Math.min(Math.max(0, level - LADDER_EXTRAS), pixelRatios - 1),
    halfTrees: level >= LADDER_EXTRAS + pixelRatios,
  }
}

/** 가장 낮은 단계(나무 절반) */
export function lowestQualityLevel(pixelRatios: number): number {
  return LADDER_EXTRAS + pixelRatios
}

export const SLOW_MS = 26
/** 이보다 느리면 한 번에 두 칸 내린다 */
export const VERY_SLOW_MS = 60
export const FAST_MS = 18
/** 단계를 바꾼 뒤 다시 올려 보기까지 기다리는 시간 */
export const RAISE_AFTER_MS = 5000
/** 올린 뒤 이 시간 안에 느려지면 그 칸을 잠근다 */
export const RAISE_TRIAL_MS = 6000

export interface QualityState {
  level: number
  /** 올라갈 수 있는 가장 높은 단계(작을수록 높은 화질) */
  ceiling: number
  changedAt: number
  raisedAt: number
}

export function initialQuality(): QualityState {
  return { level: 0, ceiling: 0, changedAt: 0, raisedAt: -1e9 }
}

/** 가운데값 med(ms)를 보고 다음 상태. maxLevel = 가장 낮은 단계(나무 절반 단계). 바뀌지 않으면 같은 객체 */
export function nextQuality(s: QualityState, med: number, now: number, maxLevel: number): QualityState {
  if (med > SLOW_MS) {
    if (s.level >= maxLevel) return s
    // 아주 느리면(가운데값 > 60 ms, 약 16fps 아래) 두 칸씩: 약한 기기가 편한 단계까지 빨리 내려가게
    const level = Math.min(maxLevel, s.level + (med > VERY_SLOW_MS ? 2 : 1))
    const ceiling = now - s.raisedAt < RAISE_TRIAL_MS ? Math.max(s.ceiling, s.level + 1) : s.ceiling
    return { level, ceiling, changedAt: now, raisedAt: s.raisedAt }
  }
  if (med <= FAST_MS && s.level > s.ceiling && now - s.changedAt >= RAISE_AFTER_MS) {
    return { level: s.level - 1, ceiling: s.ceiling, changedAt: now, raisedAt: now }
  }
  return s
}

/** 프레임 간격 묶음의 가운데값. 90개가 모이거나, 아주 느린 GPU에서는 3초 동안 12개 이상이면 판단한다(그 전엔 null) */
export function windowMedian(gaps: number[]): number | null {
  const n = gaps.length
  if (n < 90 && !(n >= 12 && gaps.reduce((a, b) => a + b, 0) >= 3000)) return null
  const sorted = [...gaps].sort((a, b) => a - b)
  return sorted[sorted.length >> 1]
}

/** 정지 화면 확인 간격 */
export const PROBE_MAX_GAP_MS = 60000

export interface ProbeState {
  at: number
  gap: number
}

export function initialProbe(): ProbeState {
  return { at: -1e9, gap: RAISE_AFTER_MS }
}

/** 화면이 멈춰 있을 때 확인 그리기를 시작할지: 올라갈 칸이 있고, 바꾼 지와 지난 확인에서 충분히 지났을 때 */
export function probeDue(q: QualityState, p: ProbeState, now: number): boolean {
  return q.level > q.ceiling && now - q.changedAt >= RAISE_AFTER_MS && now - p.at >= p.gap
}

/** 확인 한 묶음을 판단한 뒤: 올렸으면 기본 간격, 아니면 간격을 두 배로 */
export function afterProbe(p: ProbeState, raised: boolean, now: number): ProbeState {
  return { at: now, gap: raised ? RAISE_AFTER_MS : Math.min(PROBE_MAX_GAP_MS, p.gap * 2) }
}
