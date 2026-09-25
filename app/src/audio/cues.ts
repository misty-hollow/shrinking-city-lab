/**
 * 빛의 순서 → 소리의 순서(설계안 6-16 소리). 웹 오디오를 쓰지 않는 순수 함수라 검사할 수 있다.
 *
 * - 소리는 빛을 따라간다: 음의 시각은 빛의 계획(lightPlan.ts)의 도착 시각에서 온다.
 * - 절제: 마을에 닿는 음은 조작당 많아야 네 개(기준 변경은 세 개). 가까이 붙은 도착은 100 ms로 묶고,
 *   첫 도착 + 주민 무게가 큰 묶음을 130 ms 이상 떨어뜨려 고른다.
 * - 늘어남은 오르는 음, 줄어듦은 한 옥타브 아래에서 내려오는 음(경고음이 아니라 사그라짐).
 * - 움직임 줄이기(모든 시각 0): 등칸 음과 맑은 음 하나만 살짝 어긋나게.
 */

import type { Arrival, LightPlan } from '../stage/lightPlan'

export type SoundName =
  | 'ember'
  | 'chamber'
  | 'spread'
  | 'arrive'
  | 'darken'
  | 'retract'
  | 'sweepUp'
  | 'sweepDown'
  | 'goal'
  | 'deny'
  | 'confirm'
  | 'select'
  | 'soundOn'
  | 'dayReal'
  | 'dayAssumed'

export interface Cue {
  name: SoundName
  /** 지금부터 몇 ms 뒤 */
  at?: number
  /** 5음 음계 칸(목소리마다 기준음이 다르다) */
  step?: number
  /** −1 왼쪽 … 1 오른쪽 */
  pan?: number
  gain?: number
  /** 이어지는 소리(바람·패드)의 길이 ms */
  dur?: number
}

export const MAX_NOTES_OP = 4
export const MAX_NOTES_THRESHOLD = 3
export const CLUSTER_MS = 100
export const MIN_GAP_MS = 130
/** 첫 맑은 음은 등칸 음보다 이만큼 뒤(두 소리가 한 덩어리로 뭉개지지 않게) */
export const AFTER_CHAMBER_MS = 90
const REDUCED_NOTE_MS = 110

export interface NotePick {
  at: number
  pan: number
  /** 0.72..1 — 주민 무게가 클수록 조금 크게 */
  gain: number
}

/** 도착들(시각 순) 가운데 소리를 낼 몇 개를 고른다 */
export function pickNotes(arrivals: readonly Arrival[], panOf: (i: number) => number, max: number): NotePick[] {
  if (arrivals.length === 0 || max <= 0) return []
  const clusters: { at: number; w: number; pw: number }[] = []
  for (const a of arrivals) {
    const c = clusters[clusters.length - 1]
    if (c && a.at - c.at < CLUSTER_MS) {
      c.w += a.w
      c.pw += a.w * panOf(a.i)
    } else clusters.push({ at: a.at, w: a.w, pw: a.w * panOf(a.i) })
  }
  const chosen = [clusters[0]]
  const rest = clusters.slice(1).sort((x, y) => y.w - x.w || x.at - y.at)
  for (const c of rest) {
    if (chosen.length >= max) break
    if (chosen.every((k) => Math.abs(k.at - c.at) >= MIN_GAP_MS)) chosen.push(c)
  }
  chosen.sort((x, y) => x.at - y.at)
  const wMax = Math.max(...chosen.map((c) => c.w))
  return chosen.map((c) => ({
    at: c.at,
    pan: c.w > 0 ? c.pw / c.w : 0,
    gain: wMax > 0 ? 0.72 + 0.28 * Math.sqrt(c.w / wMax) : 1,
  }))
}

export interface LightCueContext {
  /** 조작한 지소의 등칸(0..4, 켜지거나 꺼진 칸) */
  level: number
  clinicPan: number
  villagePan(i: number): number
}

/** 빛의 계획 하나에 맞춘 소리들 */
export function lightCues(plan: LightPlan, c: LightCueContext): Cue[] {
  const out: Cue[] = []
  const reduced = plan.endMs <= 0
  const level = Math.max(0, Math.min(4, c.level))
  // +1·기준 늘림은 진료일이 늘어난 마을만, −1·기준 줄임은 줄어든 마을만 바뀐다.
  const rising = plan.dir > 0
  const list = plan.arrivals.filter((a) => a.gain === rising)
  let floor = 0
  if (plan.kind === 'op' && plan.j !== null) {
    if (plan.dir > 0) {
      if (!reduced) out.push({ name: 'ember', at: 0, pan: c.clinicPan, dur: plan.chamberMs })
      out.push({ name: 'chamber', at: plan.chamberMs, step: level, pan: c.clinicPan })
      if (!reduced) out.push({ name: 'spread', at: plan.chamberMs, pan: c.clinicPan, dur: Math.max(240, plan.front.durMs) })
      floor = plan.chamberMs + AFTER_CHAMBER_MS
    } else {
      out.push({ name: 'retract', at: 0, step: level, pan: c.clinicPan })
      floor = AFTER_CHAMBER_MS
    }
  } else {
    out.push({ name: plan.dir > 0 ? 'sweepUp' : 'sweepDown', at: 0, dur: Math.max(240, plan.front.durMs) })
  }
  const max = reduced ? 1 : plan.kind === 'op' ? MAX_NOTES_OP : MAX_NOTES_THRESHOLD
  const notes = pickNotes(list, c.villagePan, max)
  // 오름: 등칸 칸에서 시작해 한 칸씩(예: 레-미-파#-라). 내림: 두 칸 위에서 한 칸씩 내려온다.
  const base = plan.kind === 'op' ? level : 0
  notes.forEach((n, q) => {
    const at = reduced ? REDUCED_NOTE_MS : Math.max(n.at, floor)
    if (rising) out.push({ name: 'arrive', at, step: base + q, pan: n.pan, gain: n.gain })
    else out.push({ name: 'darken', at, step: base + notes.length - 1 - q, pan: n.pan, gain: n.gain })
  })
  return out
}

/** 미션 1 브리핑의 오르골: 실제 날(칸이 앉을 때마다 한 음) 뒤에 가정 날(속 빈 음)이 이어진다 */
const BRIEF_MELODY = [0, 2, 3, 4, 3, 5, 4, 3, 2, 3]
const BRIEF_ASSUMED = [1, 2, 3, 4, 6]

export function briefingCues(real: readonly number[], assumed: readonly number[]): Cue[] {
  return [
    ...real.map((at, k): Cue => ({ name: 'dayReal', at, step: BRIEF_MELODY[k % BRIEF_MELODY.length], gain: 1 - 0.025 * k })),
    ...assumed.map((at, q): Cue => ({ name: 'dayAssumed', at, step: BRIEF_ASSUMED[q % BRIEF_ASSUMED.length] })),
  ]
}

// --- 반복해도 피로하지 않게 ---------------------------------------------------------------

/** 같은 갈래의 소리가 잇달아 나면 조금씩 작아지고(습관화), 쉬면 1.4초 시간 상수로 돌아온다 */
export const HAB_TAU_S = 1.4
export const HAB_K = 0.32
export const HAB_FLOOR = 0.5

export interface Habit {
  level: number
  t: number
}

export function habituate(prev: Habit | undefined, now: number, floor = HAB_FLOOR): { habit: Habit; gain: number } {
  const level = prev ? prev.level * Math.exp(-(now - prev.t) / HAB_TAU_S) + 1 : 1
  return { habit: { level, t: now }, gain: Math.max(floor, 1 / (1 + HAB_K * (level - 1))) }
}

/** 습관화를 함께 세는 갈래 */
export const FAMILY: Record<SoundName, string> = {
  ember: 'ember',
  chamber: 'light',
  spread: 'light',
  arrive: 'light',
  darken: 'light',
  retract: 'light',
  sweepUp: 'light',
  sweepDown: 'light',
  goal: 'goal',
  deny: 'deny',
  confirm: 'confirm',
  select: 'select',
  soundOn: 'select',
  dayReal: 'brief',
  dayAssumed: 'brief',
}
