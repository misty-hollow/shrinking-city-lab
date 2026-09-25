/**
 * 소리(설계안 6-16 소리). 「불빛이 닿는 골짜기」의 저녁 디오라마 소리: 부드럽고 따뜻한 짧은 합성음.
 * 외부 음원 파일을 쓰지 않는다(브라우저 Web Audio로 만든다 — 라이선스 문제 없음, 내려받을 것 없음).
 *
 * - 소리는 정보를 더하지 않는다: 소리 없이도 모든 것을 화면에서 읽을 수 있다.
 * - 브라우저 자동재생 규칙: 첫 사용자 입력(시작 누름 등)에서만 오디오를 연다. 그 전에는 아무 소리도 나지 않는다.
 * - 끄기: 상단 막대의 [소리] 버튼. 선택은 이 브라우저에만 남는다(localStorage, 실패해도 동작).
 * - 피로하지 않게: 전체 음량을 낮게 두고, 같은 갈래의 소리가 잇달면 조금씩 작아지고(cues.ts 습관화),
 *   새 조작이 오면 앞 조작의 아직 울리지 않은 빛 번짐 음(마을 음·패드)을 거둔다. 음마다 음높이·세기가 아주 조금씩 흔들린다.
 * - 공간: 모든 소리가 수식으로 만든 방의 울림(room.ts)을 나눠 쓴다. 마지막에 부드러운 압축기가 겹침을 누른다.
 *
 * 목소리(voices.ts)와 소리의 순서(cues.ts)는 따로 있다. 이 파일은 오디오 문맥·음량·예약·거두기만 맡는다.
 */

import { type Cue, FAMILY, type Habit, type SoundName, habituate } from './cues'
import { pinkNoise, roomImpulse } from './room'
import { type Bus, type Send, type Voice, air, dim, glow, pad, pitch, tine, wood } from './voices'

export type { Cue, SoundName } from './cues'

const PREF_KEY = 'scl.sound'
/** 전체 음량(압축기 뒤) */
const MASTER = 0.7
/** 예약 여유: 오디오 시계의 다음 처리 묶음 뒤에 시작해야 어택이 잘리지 않는다 */
const LEAD_S = 0.015
/** 오디오가 열리기를 기다린 소리가 이보다 늦으면 버린다(늦게 나는 소리는 조작과 어긋난다) */
const STALE_MS = 300
/** 방 울림 몫: 나무(적게), 쇠 혀·종(보통), 숨·패드·가정한 날(많이) */
const SEND: Record<Send, number> = { lo: 0.14, mid: 0.27, hi: 0.45 }

function readPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) === 'off'
  } catch {
    return false
  }
}

function writePref(muted: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, muted ? 'off' : 'on')
  } catch {
    /* 저장이 막혀도 이번 세션에는 그대로 동작한다 */
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- 목소리 고르기 ------------------------------------------------------------------------

function voicesFor(b: Bus, t: number, c: Cue, hab: number, rnd: () => number): Voice[] {
  const pan = c.pan ?? 0
  const k = c.step ?? 0
  // 세기 ±6 %, 음높이 ±4센트: 같은 조작을 되풀이해도 기계처럼 똑같지 않게
  const g = (c.gain ?? 1) * hab * (0.94 + rnd() * 0.12)
  const detune = (rnd() - 0.5) * 8
  const dur = (c.dur ?? 0) / 1000
  switch (c.name) {
    case 'ember':
      // 불씨가 풀을 떠난다: 나무 칩을 집는 작은 소리 + 지소까지 부풀어 가는 숨
      return [
        ...wood(b, t, pitch(12), { vel: 0.012 * g, pan, mute: 0.35, detune }),
        ...(dur > 0.05 ? air(b, t, dur, { vel: 0.14 * g, pan, tones: [pitch(3), pitch(5)], rise: 300 }) : []),
      ]
    case 'chamber':
      // 등칸이 켜진다: 펠트 종 + 번짐(칸이 높을수록 한 칸 높은 음)
      return glow(b, t, pitch(k), { vel: 0.055 * g, pan, detune })
    case 'spread':
      // 빛이 길을 따라 번진다: 5도로 벌린 얇은 패드, 거르개가 빛 끝을 따라 열린다
      return pad(b, t, [pitch(5), pitch(8)], {
        vel: 0.016 * g,
        pan: pan * 0.5,
        atk: 0.14,
        hold: Math.max(0, dur - 0.14),
        rel: 0.8,
        lpFrom: 420,
        lpTo: 2000,
        lpTime: Math.max(0.2, dur),
        detune,
      })
    case 'arrive':
      // 빛이 마을에 닿는다: 맑은 쇠 혀 음(레5부터 5음 음계로 오른다)
      return tine(b, t, pitch(5 + k), { vel: 0.046 * g, pan, detune })
    case 'darken':
      // 빛이 거둬진다: 한 옥타브 아래의 둥근 음(윗소리 없이 조금 늦게 열린다)
      return tine(b, t, pitch(k), { vel: 0.036 * g, pan, bright: 0, atk: 0.012, decay: 0.75, detune })
    case 'retract':
      // 등칸이 꺼진다: 불이 사그라지듯 둥근 음이 조금 내려앉는다
      return dim(b, t, pitch(k), { vel: 0.04 * g, pan, detune })
    case 'sweepUp':
      // 기준을 늘린다: 얇은 패드가 밝아지며 퍼진다
      return pad(b, t, [pitch(5), pitch(7), pitch(8)], { vel: 0.018 * g, pan: 0, atk: 0.12, hold: dur * 0.5, rel: 0.8, lpFrom: 380, lpTo: 2400, lpTime: Math.max(0.2, dur), detune })
    case 'sweepDown':
      // 기준을 줄인다: 같은 패드가 어두워지며 가라앉는다
      return pad(b, t, [pitch(3), pitch(5)], { vel: 0.015 * g, pan: 0, atk: 0.08, hold: dur * 0.4, rel: 0.7, lpFrom: 2000, lpTo: 360, lpTime: Math.max(0.2, dur), detune })
    case 'goal': {
      // 목표 달성: 짧은 화음 한 번 — 칼림바처럼 아래에서 위로 빠르게 훑고 얇은 패드가 받친다(팡파르 없음)
      const chord = [0, 3, 5, 6, 7, 8]
      const v: Voice[] = []
      chord.forEach((s, q) => {
        v.push(...tine(b, t + q * 0.028, pitch(s), { vel: 0.04 * g * (1 - q * 0.06), pan: (q / (chord.length - 1) - 0.5) * 0.6, decay: 0.9, detune: detune + (rnd() - 0.5) * 6 }))
      })
      v.push(...pad(b, t, [pitch(0), pitch(3), pitch(7)], { vel: 0.015 * g, pan: 0, atk: 0.1, hold: 0.2, rel: 0.8, lpFrom: 700, lpTo: 1700, lpTime: 0.4 }))
      v.push(...tine(b, t + 0.2, pitch(10), { vel: 0.018 * g, pan: 0.2, bright: 1.2, decay: 1, send: 'hi' }))
      return v
    }
    case 'deny':
      // 더 놓을 수 없다: 먹먹한 나무 두 음이 살짝 내려앉는다(경고음 없음)
      return [
        ...wood(b, t, pitch(1), { vel: 0.025 * g, pan, mute: 0.65, bend: -30, atk: 0.006, detune }),
        ...wood(b, t + 0.085, pitch(0), { vel: 0.018 * g, pan, mute: 0.7, bend: -30, atk: 0.006, detune }),
      ]
    case 'confirm':
      // 확정: 나무 두 음(라 → 레)이 제자리에 앉고 아래에서 따뜻한 번짐
      return [
        ...wood(b, t, pitch(3), { vel: 0.028 * g, pan, mute: 0.2, detune }),
        ...wood(b, t + 0.11, pitch(5), { vel: 0.034 * g, pan, mute: 0.15, detune }),
        ...glow(b, t + 0.11, pitch(0), { vel: 0.02 * g, pan }),
      ]
    case 'select':
      // 지소 고르기: 아주 작은 나무 톡
      return wood(b, t, pitch(11), { vel: 0.0085 * g, pan, mute: 0.25, detune })
    case 'soundOn':
      // 소리를 켰다: 맑은 두 음
      return [...tine(b, t, pitch(8), { vel: 0.025 * g, pan: -0.1, detune }), ...tine(b, t + 0.09, pitch(10), { vel: 0.025 * g, pan: 0.1, detune })]
    case 'dayReal':
      // 브리핑: 실제 진료일이 풀에 앉는다(오르골)
      return tine(b, t, pitch(5 + k), { vel: 0.026 * g, pan, bright: 1.15, decay: 0.8, detune })
    case 'dayAssumed':
      // 가정한 날(점선 칸): 윗소리 없이 속이 빈 음, 울림을 더 많이
      return tine(b, t, pitch(5 + k), { vel: 0.02 * g, pan, bright: 0, atk: 0.022, decay: 1.1, send: 'hi', detune })
  }
}

// --- 오디오 그래프 ------------------------------------------------------------------------

interface Graph {
  bus: Bus
  master: GainNode
}

/**
 * 목소리 → (마른 소리 + 방 울림) → 낮은 소리 정리 → 윗소리 살짝 덮기 → 부드러운 압축 → 전체 음량.
 * deferRoom: 첫 누름(문맥 생성과 같은 틱)에 화면이 멈추지 않게 방 울림 만들기(약 15 ms)를 다음 틈으로 미룬다.
 */
function buildGraph(ctx: BaseAudioContext, muted: boolean, deferRoom: boolean): Graph {
  const sr = ctx.sampleRate
  const dry = ctx.createGain()
  const conv = ctx.createConvolver()
  conv.normalize = true
  const fillRoom = () => {
    const [l, r] = roomImpulse(sr)
    const ir = ctx.createBuffer(2, l.length, sr)
    ir.copyToChannel(l, 0)
    ir.copyToChannel(r, 1)
    conv.buffer = ir
  }
  if (deferRoom) setTimeout(fillRoom, 60)
  else fillRoom()
  // 방 울림 몫 세 갈래(목소리마다 보내는 노드를 따로 만들지 않는다)
  const wet = {} as Record<Send, GainNode>
  for (const [k, v] of Object.entries(SEND) as [Send, number][]) {
    wet[k] = ctx.createGain()
    wet[k].gain.value = v
    wet[k].connect(conv)
  }
  const sum = ctx.createGain()
  dry.connect(sum)
  conv.connect(sum)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 70
  hp.Q.value = 0.6
  const shelf = ctx.createBiquadFilter()
  shelf.type = 'highshelf'
  shelf.frequency.value = 6500
  shelf.gain.value = -3
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -24
  comp.knee.value = 18
  comp.ratio.value = 3
  comp.attack.value = 0.006
  comp.release.value = 0.3
  const master = ctx.createGain()
  master.gain.value = muted ? 0 : MASTER
  sum.connect(hp)
  hp.connect(shelf)
  shelf.connect(comp)
  comp.connect(master)
  master.connect(ctx.destination)
  const nb = pinkNoise(sr, 2)
  const noise = ctx.createBuffer(1, nb.length, sr)
  noise.copyToChannel(nb, 0)
  return { bus: { ctx, dry, wet, noise, waves: new Map() }, master }
}

/** 습관화 바닥(갈래마다): 막힘과 불씨 바람은 되풀이될수록 더 많이 작아진다 */
const FLOOR: Record<string, number | undefined> = { deny: 0.35, ember: 0.35 }

interface Entry {
  group: string | undefined
  name: SoundName
  t: number
  end: number
  voices: Voice[]
}

/**
 * 새 조작이 오면 거두는 소리: 빛이 번지는 층(마을 도착 음·패드·브리핑 오르골)만.
 * 불씨·점등·소등은 화면의 등칸과 짝이라 거두지 않는다(습관화로 작아질 뿐).
 */
const CANCELLABLE: ReadonlySet<SoundName> = new Set<SoundName>(['spread', 'arrive', 'darken', 'sweepUp', 'sweepDown', 'dayReal', 'dayAssumed'])

/** 한 오디오 문맥의 예약·거두기·습관화. 실제 재생과 오프라인 렌더(검사·청취용)가 같은 것을 쓴다. */
class Scheduler {
  readonly ctx: BaseAudioContext
  readonly graph: Graph
  private entries: Entry[] = []
  private habits = new Map<string, Habit>()
  private rnd: () => number
  scheduled = 0

  constructor(ctx: BaseAudioContext, muted: boolean, seed: number, deferRoom = false) {
    this.ctx = ctx
    this.graph = buildGraph(ctx, muted, deferRoom)
    this.rnd = mulberry32(seed)
  }

  run(now: number, cues: readonly Cue[], group?: string): void {
    if (group !== undefined) this.cancel(now, group)
    this.entries = this.entries.filter((e) => e.end > now)
    const gains = new Map<string, number>()
    for (const c of cues) {
      const fam = FAMILY[c.name]
      if (gains.has(fam)) continue
      if (fam === 'brief') {
        gains.set(fam, 1)
        continue
      }
      const h = habituate(this.habits.get(fam), now, FLOOR[fam])
      this.habits.set(fam, h.habit)
      gains.set(fam, h.gain)
    }
    for (const c of cues) {
      const t = now + LEAD_S + Math.max(0, (c.at ?? 0) / 1000) + (this.rnd() - 0.5) * 0.006
      const voices = voicesFor(this.graph.bus, t, c, gains.get(FAMILY[c.name]) ?? 1, this.rnd)
      this.entries.push({ group, name: c.name, t, end: voices.reduce((m, v) => Math.max(m, v.end), t), voices })
      this.scheduled++
    }
  }

  /** 이 묶음에서 아직 시작하지 않은 빛 번짐 음을 소리 없이 거둔다(이미 울리는 음은 제 꼬리대로 사그라진다) */
  cancel(now: number, group: string): void {
    const keep: Entry[] = []
    for (const e of this.entries) {
      if (e.group === group && e.t > now + 0.004 && CANCELLABLE.has(e.name)) for (const v of e.voices) v.cancel(now)
      else keep.push(e)
    }
    this.entries = keep
  }

  pending(now: number): number {
    return this.entries.filter((e) => e.t > now).length
  }

  setMuted(m: boolean, now: number): void {
    this.graph.master.gain.setTargetAtTime(m ? 0 : MASTER, now, 0.03)
  }
}

// --- 엔진 --------------------------------------------------------------------------------

export interface PlayOpts {
  /** 지금부터 몇 ms 뒤 */
  when?: number
  /** 음 순서(5음 음계 칸) */
  step?: number
  /** −1 왼쪽 … 1 오른쪽 */
  pan?: number
  gain?: number
}

export interface RenderEvent {
  /** 몇 ms에 부른 것으로 칠까 */
  at: number
  cues: Cue[]
  group?: string
}

/** 오프라인 렌더(청취용 파일·브라우저 검사): 실제 재생과 같은 그래프·예약·습관화·거두기 */
export async function renderCues(events: readonly RenderEvent[], seconds: number, sampleRate = 48000): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)
  const sch = new Scheduler(off, false, 1)
  for (const e of [...events].sort((a, b) => a.at - b.at)) sch.run(e.at / 1000, e.cues, e.group)
  return off.startRendering()
}

class SoundEngine {
  private ctx: AudioContext | null = null
  private sch: Scheduler | null = null
  private mutedFlag = typeof window !== 'undefined' ? readPref() : true
  private listeners = new Set<(m: boolean) => void>()
  private resuming = false
  /** 검사용: 실제로 예약한 소리 수(오디오가 열려 있고 켜져 있을 때만 센다) */
  played = 0

  get muted(): boolean {
    return this.mutedFlag
  }

  /** 사용자 입력 안에서 부른다(자동재생 규칙). 오디오가 없는 환경이면 조용히 넘어간다. */
  unlock(): void {
    if (typeof window === 'undefined') return
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      if (!this.ctx) {
        this.ctx = new Ctor({ latencyHint: 'interactive' })
        this.sch = new Scheduler(this.ctx, this.mutedFlag, (Date.now() & 0xffff) + 1, true)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
    } catch {
      this.ctx = null
      this.sch = null
    }
  }

  setMuted(m: boolean): void {
    this.mutedFlag = m
    writePref(m)
    if (this.ctx && this.sch) this.sch.setMuted(m, this.ctx.currentTime)
    for (const l of this.listeners) l(m)
  }

  subscribe(l: (m: boolean) => void): () => void {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  /** 검사용 상태: 오디오 문맥 상태, 예약한 소리 수, 아직 시작하지 않은 소리 수 */
  debug(): { state: string; played: number; muted: boolean; pending: number } {
    return { state: this.ctx?.state ?? 'none', played: this.played, muted: this.mutedFlag, pending: this.ctx && this.sch ? this.sch.pending(this.ctx.currentTime) : 0 }
  }

  play(name: SoundName, o: PlayOpts = {}): void {
    this.cues([{ name, at: o.when, step: o.step, pan: o.pan, gain: o.gain }])
  }

  /** 소리 여러 개를 한 번에 예약한다. group을 주면 같은 group의 아직 울리지 않은 음을 먼저 거둔다. */
  cues(list: readonly Cue[], group?: string): void {
    const ctx = this.ctx
    const sch = this.sch
    if (!ctx || !sch || this.mutedFlag) return
    if (list.length === 0) {
      if (group !== undefined && ctx.state === 'running') sch.cancel(ctx.currentTime, group)
      return
    }
    if (ctx.state === 'running') {
      sch.run(ctx.currentTime, list, group)
      this.played += list.length
      return
    }
    // 방금 연 문맥이 아직 깨어나는 중이면(첫 누름) 깨어난 뒤 바로 낸다. 너무 늦으면 버린다.
    if (ctx.state === 'suspended' && !this.resuming) {
      this.resuming = true
      const asked = performance.now()
      ctx
        .resume()
        .then(() => {
          this.resuming = false
          if (ctx.state === 'running' && !this.mutedFlag && performance.now() - asked < STALE_MS) {
            sch.run(ctx.currentTime, list, group)
            this.played += list.length
          }
        })
        .catch(() => {
          this.resuming = false
        })
    }
  }

  cancel(group: string): void {
    if (this.ctx && this.sch) this.sch.cancel(this.ctx.currentTime, group)
  }

  /** 개발·검사용 오프라인 렌더 */
  render(events: readonly RenderEvent[], seconds: number, sampleRate = 48000): Promise<AudioBuffer> {
    return renderCues(events, seconds, sampleRate)
  }
}

export const sound = new SoundEngine()
