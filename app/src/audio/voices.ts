/**
 * 악기 목소리(설계안 6-16 소리). 모두 사인파 부분음을 더해 만든다(모달 합성). 칼림바의 쇠 혀, 오르골 빗살,
 * 펠트 망치로 친 종, 나무 말렛, 아주 얇은 패드의 성질을 빌리되 특정 악기를 흉내 내지는 않는다.
 *
 * 부드럽게 들리는 이유
 * - 어택은 2~35 ms 선형 램프로 둥글게 연다(순간 시작의 딸깍이 없다).
 * - 음마다 "몸통"(기본음 쪽, 길게)과 "빛남"(윗부분음, 짧게) 두 층이 있어 높은 소리가 먼저 사그라진다.
 * - 모든 소리가 같은 방의 울림(room.ts)을 나눠 쓴다(울림 몫은 적게·보통·많이 세 갈래).
 * - 네모·톱니파와 넓은 대역 잡음 폭발은 쓰지 않는다(바람 소리도 음계의 음에 맞춘 좁은 공명으로만 거른다).
 *
 * 가볍게 도는 이유(약한 전시 PC에서도 끊기지 않게): 한 층 = 발진기 하나(배음은 PeriodicWave 한 장에 담는다),
 * 사인만 쓰는 목소리에는 거르개를 달지 않는다, 모든 자동화에 끝이 있다(−54 dB에서 멈춘다).
 *
 * 음높이는 D 장조 5음 음계(레·미·파#·라·시)다. 어떤 음이 겹쳐도 부딪히지 않는다.
 */

export type Send = 'lo' | 'mid' | 'hi'

export interface Bus {
  ctx: BaseAudioContext
  dry: AudioNode
  /** 방 울림으로 가는 세 갈래(적게·보통·많이) */
  wet: Record<Send, AudioNode>
  noise: AudioBuffer
  /** 배음 묶음마다 한 번만 만든다 */
  waves: Map<string, PeriodicWave>
}

export interface Voice {
  /** 시작 시각(문맥 초) */
  t: number
  end: number
  /** 아직 시작하지 않았으면 소리 없이 거둔다 */
  cancel(at: number): void
}

const PENTA = [0, 2, 4, 7, 9]
/** 레(D4) */
export const D4 = 293.66
/** 꼬리를 닫는 깊이: 시간 상수의 6.2배 ≈ −54 dB(그 아래는 방 울림에 묻힌다) */
const TAIL_TAUS = 6.2
const TAIL_LEVEL = Math.exp(-TAIL_TAUS)

/** 5음 음계 k번째 음(0 = D4, 5 = D5, 10 = D6) */
export function pitch(k: number): number {
  const oct = Math.floor(k / 5)
  const step = PENTA[((k % 5) + 5) % 5]
  return D4 * 2 ** ((oct * 12 + step) / 12)
}

/** 한 층 = 발진기 하나. h는 이 층 기준음의 배음 세기(1배, 2배, 3배 …). */
interface Layer {
  /** 음의 기준 주파수에 대한 이 층 기준음의 배수 */
  r: number
  h: readonly number[]
  /** 층 세기 */
  a: number
  /** 사그라지는 시간 상수(초) */
  tau: number
  /** 어택(초) */
  atk: number
}

interface NoteOpts {
  vel: number
  pan: number
  send: Send
  /** 시작 순간 음이 이만큼(센트) 높았다가 제자리로 내려앉는다(첫 층만 — 쇠 혀·나무의 자연스러운 흔들림) */
  settle?: number
  /** 음 전체를 이만큼(센트) 휘게(내려앉는 소리) */
  bend?: number
  bendTau?: number
  detune?: number
}

function wave(b: Bus, h: readonly number[]): PeriodicWave | null {
  if (h.length === 1 && h[0] === 1) return null
  const key = h.join(',')
  let w = b.waves.get(key)
  if (!w) {
    const real = new Float32Array(h.length + 1)
    const imag = new Float32Array(h.length + 1)
    h.forEach((x, k) => {
      imag[k + 1] = x
    })
    w = b.ctx.createPeriodicWave(real, imag, { disableNormalization: true })
    b.waves.set(key, w)
  }
  return w
}

/** 목소리 출구: 세기 → (좌우) → 마른 소리 + 방 울림 갈래 하나 */
function outChain(b: Bus, o: { vel: number; pan: number; send: Send }): { input: GainNode; nodes: AudioNode[] } {
  const ctx = b.ctx
  const input = ctx.createGain()
  input.gain.value = o.vel
  const nodes: AudioNode[] = [input]
  let last: AudioNode = input
  if (o.pan !== 0 && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-0.7, Math.min(0.7, o.pan))
    input.connect(p)
    nodes.push(p)
    last = p
  }
  last.connect(b.dry)
  last.connect(b.wet[o.send])
  return { input, nodes }
}

/** 소리가 다 끝나면 노드를 떼어 낸다(오래 켜 두어도 쌓이지 않게) */
function release(last: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  last.onended = () => {
    for (const n of nodes) n.disconnect()
  }
}

function voiceOf(t: number, end: number, input: GainNode, sources: AudioScheduledSourceNode[]): Voice {
  return {
    t,
    end,
    cancel(at: number) {
      if (at >= t) return
      input.gain.cancelScheduledValues(0)
      input.gain.setValueAtTime(0, at)
      for (const s of sources) {
        try {
          s.stop(at)
        } catch {
          /* 이미 멈춘 소리 */
        }
      }
    },
  }
}

/** 층 묶음 하나 = 음 하나. 모든 자동화에 끝이 있다(끝없는 setTargetAtTime은 멈출 때까지 샘플마다 계산된다). */
function modal(b: Bus, t: number, f: number, layers: readonly Layer[], o: NoteOpts): Voice {
  const ctx = b.ctx
  const { input, nodes } = outChain(b, o)
  const sources: OscillatorNode[] = []
  let end = t
  let last: OscillatorNode | null = null
  layers.forEach((l, idx) => {
    const fr = f * l.r
    const top = fr * l.h.length
    if (l.a <= 0 || fr > ctx.sampleRate * 0.45) return
    const osc = ctx.createOscillator()
    const w = top < ctx.sampleRate * 0.45 ? wave(b, l.h) : null
    if (w) osc.setPeriodicWave(w)
    if (o.bend) {
      const target = fr * 2 ** (o.bend / 1200)
      const tau = o.bendTau ?? 0.1
      osc.frequency.setValueAtTime(fr, t)
      osc.frequency.setTargetAtTime(target, t, tau)
      osc.frequency.setValueAtTime(target, t + tau * 6)
    } else if (o.settle && idx === 0) {
      osc.frequency.setValueAtTime(fr * 2 ** (o.settle / 1200), t)
      osc.frequency.setTargetAtTime(fr, t, 0.02)
      osc.frequency.setValueAtTime(fr, t + 0.12)
    } else osc.frequency.value = fr
    if (o.detune) osc.detune.value = o.detune
    const g = ctx.createGain()
    const decayEnd = t + l.atk + l.tau * TAIL_TAUS
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(l.a, t + l.atk)
    g.gain.exponentialRampToValueAtTime(l.a * TAIL_LEVEL, decayEnd)
    osc.connect(g)
    g.connect(input)
    const stop = decayEnd + 0.01
    osc.start(t)
    osc.stop(stop)
    if (stop >= end) {
      end = stop
      last = osc
    }
    sources.push(osc)
    nodes.push(osc, g)
  })
  if (last) release(last, nodes)
  return voiceOf(t, end, input, sources)
}

export interface Touch {
  vel: number
  pan: number
  detune?: number
}

/**
 * 쇠 혀(칼림바·오르골 사이): 빛이 마을에 닿는 맑은 음.
 * 몸통 = 기본음 + 옅은 2배음, 빛남 = 5.93배의 쇠 혀 부분음(금방 사그라진다). bright 0이면 빛남 없이 둥근 음.
 */
export function tine(b: Bus, t: number, f: number, v: Touch & { bright?: number; decay?: number; atk?: number; send?: Send }): Voice[] {
  const d = (v.decay ?? 1) * (587 / f) ** 0.35
  const br = v.bright ?? 1
  const atk = v.atk ?? 0.004
  return [
    modal(
      b,
      t,
      f,
      [
        { r: 1, h: [1, 0.06], a: 1, tau: 0.3 * d, atk },
        { r: 5.93, h: [1], a: 0.07 * br, tau: 0.035, atk: Math.max(0.0018, atk * 0.5) },
      ],
      { vel: v.vel, pan: v.pan, send: v.send ?? 'mid', settle: 5, detune: v.detune },
    ),
  ]
}

/**
 * 펠트 망치 종 + 번짐: 등칸이 켜질 때(따뜻하고 짧게).
 * 종 = 기본음(몸통) + 2·3배음(빛남, 빨리 사그라진다). 번짐 = 한 옥타브 아래에서 1·2·3배음이 조금 늦게 부푼다.
 */
export function glow(b: Bus, t: number, f: number, v: Touch): Voice[] {
  return [
    modal(
      b,
      t,
      f,
      [
        { r: 1, h: [1], a: 1, tau: 0.22, atk: 0.008 },
        { r: 1, h: [0, 0.18, 0.05], a: 1, tau: 0.08, atk: 0.008 },
        { r: 0.5, h: [0.2, 0.22, 0.1], a: 1, tau: 0.18, atk: 0.035 },
      ],
      { vel: v.vel, pan: v.pan, send: 'mid', settle: 4, detune: v.detune },
    ),
  ]
}

/** 불이 사그라진다: 둥근 음이 조금 늦게 열리고 음높이가 살짝 내려앉는다(등칸이 꺼질 때) */
export function dim(b: Bus, t: number, f: number, v: Touch): Voice[] {
  return [
    modal(b, t, f, [{ r: 0.5, h: [0.35, 1, 0, 0.08], a: 1, tau: 0.21, atk: 0.016 }], {
      vel: v.vel,
      pan: v.pan,
      send: 'mid',
      bend: -70,
      bendTau: 0.12,
      detune: v.detune,
    }),
  ]
}

/** 나무 말렛(마림바 비슷, 막대 부분음 1 : 3.93). mute가 클수록 짧고 먹먹하다. */
export function wood(b: Bus, t: number, f: number, v: Touch & { mute?: number; bend?: number; atk?: number }): Voice[] {
  const m = v.mute ?? 0
  const tau = 0.15 * Math.sqrt(440 / f) * (1 - 0.55 * m)
  const atk = v.atk ?? 0.0028
  return [
    modal(
      b,
      t,
      f,
      [
        { r: 1, h: [1], a: 1, tau, atk },
        { r: 3.93, h: [1], a: 0.18 * (1 - 0.7 * m), tau: tau * 0.28, atk: Math.max(0.002, atk * 0.7) },
      ],
      { vel: v.vel, pan: v.pan, send: 'lo', bend: v.bend, bendTau: 0.07, detune: v.detune },
    ),
  ]
}

/**
 * 부드러운 숨: 분홍 잡음을 음계의 음(예: 라·레)에 맞춘 좁은 공명으로 걸러, 병 입구를 부는 듯한 음정 있는 바람을 만든다.
 * 불씨가 풀에서 지소로 날아가는 동안 조금씩 부풀며 rise 센트만큼 오르고, 닿는 순간 사라진다.
 */
export function air(b: Bus, t: number, dur: number, v: Touch & { tones: number[]; rise: number }): Voice[] {
  const ctx = b.ctx
  const { input, nodes } = outChain(b, { vel: v.vel, pan: v.pan, send: 'hi' })
  const src = ctx.createBufferSource()
  src.buffer = b.noise
  src.loop = true
  const g = ctx.createGain()
  const peak = t + dur * 0.85
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(1, peak)
  g.gain.exponentialRampToValueAtTime(1e-3, peak + 0.35)
  nodes.push(src, g)
  for (const f of v.tones) {
    // 공명 두 겹(4차): 음에서 먼 잡음은 옥타브마다 12 dB씩 빠진다
    let prev: AudioNode = src
    for (let k = 0; k < 2; k++) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 5
      bp.frequency.setValueAtTime(f, t)
      bp.frequency.exponentialRampToValueAtTime(f * 2 ** (v.rise / 1200), t + dur)
      prev.connect(bp)
      nodes.push(bp)
      prev = bp
    }
    prev.connect(g)
  }
  g.connect(input)
  const end = peak + 0.36
  src.start(t, (t * 7.3) % 1.5)
  src.stop(end)
  release(src, nodes)
  return [voiceOf(t, end, input, [src])]
}

/** 삼각파 배음(홀수 배음이 1/k²로 줄어든다) — 세기를 파형에 담아 발진기마다 세기 노드를 두지 않는다 */
function triangle(b: Bus, amp: number): PeriodicWave {
  const key = `tri:${amp}`
  let w = b.waves.get(key)
  if (!w) {
    const n = 12
    const real = new Float32Array(n + 1)
    const imag = new Float32Array(n + 1)
    for (let k = 1; k <= n; k += 2) {
      const sign = ((k - 1) / 2) % 2 === 0 ? 1 : -1
      imag[k] = ((8 / (Math.PI * Math.PI)) * amp * sign) / (k * k)
    }
    w = b.ctx.createPeriodicWave(real, imag, { disableNormalization: true })
    b.waves.set(key, w)
  }
  return w
}

/** 아주 얇은 패드: 음마다 두 개의 삼각파를 ±5센트 어긋나게 겹치고(느린 일렁임), 거르개가 천천히 열리거나 닫힌다 */
export function pad(
  b: Bus,
  t: number,
  freqs: number[],
  v: Touch & { atk: number; hold: number; rel: number; lpFrom: number; lpTo: number; lpTime: number },
): Voice[] {
  const ctx = b.ctx
  const { input, nodes } = outChain(b, { vel: v.vel, pan: v.pan, send: 'hi' })
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 0.4
  f.frequency.setValueAtTime(v.lpFrom, t)
  f.frequency.exponentialRampToValueAtTime(v.lpTo, t + v.lpTime)
  const env = ctx.createGain()
  const relEnd = t + v.atk + v.hold + v.rel * 2.3
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(1, t + v.atk)
  env.gain.setValueAtTime(1, t + v.atk + v.hold)
  env.gain.exponentialRampToValueAtTime(1e-3, relEnd)
  f.connect(env)
  env.connect(input)
  nodes.push(f, env)
  const end = relEnd + 0.01
  const tri = triangle(b, 0.5 / freqs.length)
  const sources: OscillatorNode[] = []
  for (const fr of freqs) {
    for (const cents of [-5, 5]) {
      const osc = ctx.createOscillator()
      osc.setPeriodicWave(tri)
      osc.frequency.value = fr
      osc.detune.value = cents + (v.detune ?? 0)
      osc.connect(f)
      osc.start(t)
      osc.stop(end)
      sources.push(osc)
      nodes.push(osc)
    }
  }
  release(sources[sources.length - 1], nodes)
  return [voiceOf(t, end, input, sources)]
}
