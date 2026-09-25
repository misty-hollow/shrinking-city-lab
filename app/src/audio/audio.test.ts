/**
 * 소리의 순서·습관화·방 울림(설계안 6-16 소리). 웹 오디오 없이 검사할 수 있는 부분만 본다.
 * - 소리는 빛을 따라간다: 마을 음의 시각은 실제 빛의 계획의 도착 시각에서 온다.
 * - 절제: 조작당 마을 음 많아야 네 개(기준 변경 세 개), 음 사이 130 ms 이상, 늘면 오르고 줄면 내린다.
 * - 되풀이하면 작아지고 쉬면 돌아온다. 울림은 늘 같고, 사그라지며 어두워진다.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Scenario } from '../data/types'
import { type Threshold, buildModel, computeKpis } from '../engine/kpi'
import { EMBER_MS, type LightPlan, planOp, planThreshold } from '../stage/lightPlan'
import {
  AFTER_CHAMBER_MS,
  type Cue,
  HAB_FLOOR,
  MAX_NOTES_OP,
  MAX_NOTES_THRESHOLD,
  MIN_GAP_MS,
  briefingCues,
  habituate,
  lightCues,
  pickNotes,
} from './cues'
import { pinkNoise, roomImpulse } from './room'
import { sound } from './sound'

const dataDir = resolve(__dirname, '../../public/data')
const scenario = JSON.parse(readFileSync(resolve(dataDir, 'scenario.json'), 'utf-8')) as Scenario
const model = buildModel(scenario)
const J = Object.fromEntries(scenario.facilities.map((f, j) => [f.id, j]))
const cur = scenario.current_allocation
const pan = (i: number) => Math.max(-1, Math.min(1, scenario.villages[i].x / 16))

function op(alloc: readonly number[], j: number, dir: 1 | -1, T: Threshold, reduced = false): { plan: LightPlan; cues: Cue[] } {
  const after = alloc.slice()
  after[j] += dir
  const plan = planOp(model, 1, j, dir, T, computeKpis(model, alloc, T).villageDays, computeKpis(model, after, T).villageDays, reduced)
  const level = Math.max(0, Math.ceil((dir > 0 ? after : alloc)[j]) - 1)
  return { plan, cues: lightCues(plan, { level, clinicPan: 0, villagePan: pan }) }
}

function thr(from: Threshold, to: Threshold): { plan: LightPlan; cues: Cue[] } {
  const plan = planThreshold(model, 1, from, to, cur, computeKpis(model, cur, from).villageDays, computeKpis(model, cur, to).villageDays)
  return { plan, cues: lightCues(plan, { level: 0, clinicPan: 0, villagePan: pan }) }
}

const notes = (cues: Cue[], name: 'arrive' | 'darken') => cues.filter((c) => c.name === name)

describe('sound follows the light', () => {
  it('+1: ember → chamber on landing → a few rising clear notes timed to real arrivals', () => {
    const { plan, cues } = op(cur, J.yugu, 1, 15)
    expect(plan.arrivals.length).toBeGreaterThan(8)
    expect(cues[0]).toMatchObject({ name: 'ember', at: 0, dur: EMBER_MS })
    expect(cues.find((c) => c.name === 'chamber')).toMatchObject({ at: plan.chamberMs, step: 0 })
    expect(cues.some((c) => c.name === 'spread')).toBe(true)
    const n = notes(cues, 'arrive')
    expect(n.length).toBeGreaterThanOrEqual(1)
    expect(n.length).toBeLessThanOrEqual(MAX_NOTES_OP)
    expect(notes(cues, 'darken')).toHaveLength(0)
    // 음은 실제 도착 시각에 난다(등칸 음과 겹치지 않게 첫 음만 뒤로 밀릴 수 있다)
    const times = new Set(plan.arrivals.map((a) => a.at))
    for (const c of n) expect(times.has(c.at!) || c.at === plan.chamberMs + AFTER_CHAMBER_MS).toBe(true)
    expect(n[0].at).toBe(Math.max(plan.arrivals[0].at, plan.chamberMs + AFTER_CHAMBER_MS))
    for (let q = 1; q < n.length; q++) {
      expect(n[q].at! - n[q - 1].at!).toBeGreaterThanOrEqual(MIN_GAP_MS - 1e-9)
      expect(n[q].step).toBe(n[q - 1].step! + 1)
    }
    for (const c of n) expect(c.at!).toBeLessThanOrEqual(plan.endMs)
  })

  it('+1 on a clinic that already has days starts the phrase one chamber higher', () => {
    const a = op(cur, J.tancheon, 1, 15)
    const level = Math.ceil(cur[J.tancheon] + 1) - 1
    expect(a.cues.find((c) => c.name === 'chamber')!.step).toBe(level)
    const n = notes(a.cues, 'arrive')
    if (n.length) expect(n[0].step).toBe(level)
  })

  it('−1: the lamp dims at once, then a few softer notes step down as the light withdraws', () => {
    const first = op(cur, J.yugu, 1, 15).plan
    expect(first.arrivals.length).toBeGreaterThan(0)
    const after = cur.slice()
    after[J.yugu] = 1
    const { plan, cues } = op(after, J.yugu, -1, 15)
    expect(cues[0]).toMatchObject({ name: 'retract', at: 0 })
    expect(cues.some((c) => c.name === 'ember' || c.name === 'chamber' || c.name === 'arrive')).toBe(false)
    const n = notes(cues, 'darken')
    expect(n.length).toBeGreaterThanOrEqual(1)
    expect(n.length).toBeLessThanOrEqual(MAX_NOTES_OP)
    for (let q = 1; q < n.length; q++) expect(n[q].step).toBe(n[q - 1].step! - 1)
    expect(n[n.length - 1].step).toBe(0)
    for (const c of n) expect(c.at!).toBeLessThanOrEqual(plan.endMs)
  })

  it('threshold change: a thin pad sweep and at most three notes', () => {
    const up = thr(15, 20)
    expect(up.cues[0]).toMatchObject({ name: 'sweepUp', at: 0 })
    expect(notes(up.cues, 'arrive').length).toBeLessThanOrEqual(MAX_NOTES_THRESHOLD)
    expect(notes(up.cues, 'darken')).toHaveLength(0)
    const down = thr(15, 10)
    expect(down.cues[0]).toMatchObject({ name: 'sweepDown', at: 0 })
    expect(notes(down.cues, 'darken').length).toBeLessThanOrEqual(MAX_NOTES_THRESHOLD)
    expect(notes(down.cues, 'arrive')).toHaveLength(0)
  })

  it('reduced motion: no flight or spreading sound, chamber at once and one clear note just after', () => {
    const { cues } = op(cur, J.yugu, 1, 15, true)
    expect(cues.map((c) => c.name)).toEqual(['chamber', 'arrive'])
    expect(cues[0].at).toBe(0)
    expect(cues[1].at).toBeGreaterThan(0)
    expect(cues[1].at).toBeLessThanOrEqual(150)
  })

  it('pickNotes keeps the first touch, spaces notes out and weights by residents', () => {
    const arrivals = [0, 20, 40, 60, 150, 170, 400, 405, 410, 700].map((at, i) => ({ i, at, gain: true, w: i === 9 ? 5000 : 100 }))
    const p = pickNotes(arrivals, () => 0, 3)
    expect(p).toHaveLength(3)
    expect(p[0].at).toBe(0)
    expect(p.map((x) => x.at)).toContain(700)
    for (let q = 1; q < p.length; q++) expect(p[q].at - p[q - 1].at).toBeGreaterThanOrEqual(MIN_GAP_MS)
    for (const x of p) {
      expect(x.gain).toBeGreaterThanOrEqual(0.72)
      expect(x.gain).toBeLessThanOrEqual(1)
    }
    expect(p.find((x) => x.at === 700)!.gain).toBe(1)
    expect(pickNotes([], () => 0, 4)).toEqual([])
  })

  it('briefing: one music-box note per landed real day, then the assumed days', () => {
    const cues = briefingCues([460, 555, 650], [1500, 1630])
    expect(cues.map((c) => c.name)).toEqual(['dayReal', 'dayReal', 'dayReal', 'dayAssumed', 'dayAssumed'])
    expect(cues.map((c) => c.at)).toEqual([460, 555, 650, 1500, 1630])
  })
})

describe('repetition does not tire', () => {
  it('same family in quick succession gets softer, never below the floor, and recovers after a pause', () => {
    let h = habituate(undefined, 0)
    expect(h.gain).toBe(1)
    let last = h.gain
    for (let k = 1; k <= 12; k++) {
      h = habituate(h.habit, k * 0.2)
      expect(h.gain).toBeLessThanOrEqual(last + 1e-12)
      expect(h.gain).toBeGreaterThanOrEqual(HAB_FLOOR)
      last = h.gain
    }
    expect(last).toBeLessThan(0.7)
    const rested = habituate(h.habit, 12 * 0.2 + 6)
    expect(rested.gain).toBeGreaterThan(0.95)
  })
})

describe('room and breath are generated, not recorded', () => {
  it('room impulse is deterministic, finite, wide and fades darker', () => {
    const [l, r] = roomImpulse(48000)
    const [l2] = roomImpulse(48000)
    expect(l.length).toBe(r.length)
    expect(Array.from(l.subarray(5000, 5100))).toEqual(Array.from(l2.subarray(5000, 5100)))
    let corr = 0
    let el = 0
    let er = 0
    for (let i = 0; i < l.length; i++) {
      expect(Number.isFinite(l[i]) && Number.isFinite(r[i])).toBe(true)
      corr += l[i] * r[i]
      el += l[i] * l[i]
      er += r[i] * r[i]
    }
    expect(Math.abs(corr / Math.sqrt(el * er))).toBeLessThan(0.2)
    const rms = (a: Float32Array, s: number, e: number) => Math.sqrt(a.subarray(s, e).reduce((m, x) => m + x * x, 0) / (e - s))
    const zc = (a: Float32Array, s: number, e: number) => {
      let n = 0
      for (let i = s + 1; i < e; i++) if (a[i - 1] < 0 !== a[i] < 0) n++
      return n / (e - s)
    }
    const early = [Math.floor(0.03 * 48000), Math.floor(0.2 * 48000)] as const
    const late = [Math.floor(1.2 * 48000), Math.floor(1.6 * 48000)] as const
    expect(20 * Math.log10(rms(l, ...early) / rms(l, ...late))).toBeGreaterThan(20)
    expect(zc(l, ...late)).toBeLessThan(zc(l, ...early))
  })

  it('pink noise is soft (more low than high) and bounded', () => {
    const p = pinkNoise(48000, 1)
    let v = 0
    let dv = 0
    for (let i = 1; i < p.length; i++) {
      expect(Math.abs(p[i])).toBeLessThan(1)
      v += p[i] * p[i]
      dv += (p[i] - p[i - 1]) ** 2
    }
    // 흰 잡음이면 차분 분산이 원래의 약 2배다. 분홍 잡음은 훨씬 작다.
    expect(dv / v).toBeLessThan(0.5)
  })
})

describe('sound engine without Web Audio', () => {
  it('stays silent and harmless before audio is unlocked, and remembers mute', () => {
    expect(() => sound.play('goal')).not.toThrow()
    expect(() => sound.cues([{ name: 'arrive', at: 100 }], 'light')).not.toThrow()
    expect(() => sound.cancel('light')).not.toThrow()
    expect(sound.debug().played).toBe(0)
    sound.setMuted(true)
    expect(window.localStorage.getItem('scl.sound')).toBe('off')
    sound.setMuted(false)
    expect(window.localStorage.getItem('scl.sound')).toBe('on')
  })
})
