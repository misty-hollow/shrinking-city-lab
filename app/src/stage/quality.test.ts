/**
 * 적응 화질 판단(quality.ts): 느리면 내리고, 넉넉하면 기다렸다 되돌리고, 올렸다 곧 느려진 칸은 잠근다.
 */

import { describe, expect, it } from 'vitest'

import { FAST_MS, VERY_SLOW_MS, PROBE_MAX_GAP_MS, RAISE_AFTER_MS, RAISE_TRIAL_MS, SLOW_MS, afterProbe, initialProbe, initialQuality, lowestQualityLevel, nextQuality, probeDue, qualityLadder, windowMedian } from './quality'

const MAX = 3 // 픽셀 비율 세 칸(예: 1.25 · 1 · 0.75) + 나무 절반

describe('adaptive quality', () => {
  it('stays at the top while frames keep up (a fast desktop never steps down)', () => {
    let s = initialQuality()
    for (let t = 0; t < 120_000; t += 1500) s = nextQuality(s, 5.6, t, MAX)
    expect(s.level).toBe(0)
    for (let t = 0; t < 120_000; t += 1500) s = nextQuality(s, 16.7, t, MAX)
    expect(s.level).toBe(0)
  })

  it('steps down one level per slow window, trees last, and not below the floor', () => {
    let s = initialQuality()
    const seen: number[] = []
    for (let k = 0; k < 6; k++) {
      s = nextQuality(s, 40, k * 1000, MAX)
      seen.push(s.level)
    }
    expect(seen).toEqual([1, 2, 3, 3, 3, 3])
  })

  it('recovers after a transient stall once frames are fast again for long enough', () => {
    let s = initialQuality()
    s = nextQuality(s, 60, 1000, MAX) // 한 번 멈칫
    expect(s.level).toBe(1)
    s = nextQuality(s, 16.7, 1000 + RAISE_AFTER_MS - 1, MAX)
    expect(s.level).toBe(1) // 아직 기다린다
    s = nextQuality(s, 16.7, 1000 + RAISE_AFTER_MS, MAX)
    expect(s.level).toBe(0)
  })

  it('does not raise on middling frames (between FAST and SLOW)', () => {
    let s = nextQuality(initialQuality(), 40, 0, MAX)
    s = nextQuality(s, (FAST_MS + SLOW_MS) / 2, 60_000, MAX)
    expect(s.level).toBe(1)
  })

  it('locks a level that turned slow right after raising (no oscillation)', () => {
    let s = initialQuality()
    s = nextQuality(s, 40, 0, MAX) // 0 → 1
    s = nextQuality(s, 16, RAISE_AFTER_MS, MAX) // 1 → 0 시험
    expect(s.level).toBe(0)
    s = nextQuality(s, 40, RAISE_AFTER_MS + RAISE_TRIAL_MS - 1, MAX) // 곧 느려짐 → 1, 0은 잠김
    expect(s.level).toBe(1)
    expect(s.ceiling).toBe(1)
    let changes = 0
    for (let t = 30_000; t < 300_000; t += 1500) {
      const n = nextQuality(s, 16, t, MAX)
      if (n !== s) changes++
      s = n
    }
    expect(s.level).toBe(1)
    expect(changes).toBe(0)
  })

  it('a slow window long after a raise is a new slowdown, not a failed trial', () => {
    let s = nextQuality(initialQuality(), 40, 0, MAX)
    s = nextQuality(s, 16, RAISE_AFTER_MS, MAX)
    s = nextQuality(s, 40, RAISE_AFTER_MS + RAISE_TRIAL_MS + 1, MAX)
    expect(s.level).toBe(1)
    expect(s.ceiling).toBe(0)
  })

  it('judges a window of 90 frames, or 12+ frames spanning 3 s on very slow GPUs', () => {
    expect(windowMedian(new Array(89).fill(16))).toBeNull()
    expect(windowMedian(new Array(90).fill(16))).toBe(16)
    expect(windowMedian(new Array(11).fill(300))).toBeNull()
    expect(windowMedian(new Array(12).fill(260))).toBe(260)
    // 가운데값이라 몇 프레임의 큰 멈춤에 흔들리지 않는다
    expect(windowMedian([...new Array(80).fill(6), ...new Array(10).fill(100)])).toBe(6)
  })

  it('checks a still screen only when there is a level to win back, then backs off', () => {
    const top = initialQuality()
    expect(probeDue(top, initialProbe(), 60_000)).toBe(false) // 최고 단계면 확인하지 않는다
    let q = nextQuality(top, 40, 1000, MAX)
    let p = initialProbe()
    expect(probeDue(q, p, 1000 + RAISE_AFTER_MS - 1)).toBe(false) // 바꾼 직후는 기다린다
    expect(probeDue(q, p, 1000 + RAISE_AFTER_MS)).toBe(true)
    // 확인 그리기가 넉넉하면 올라간다 → 다음 확인은 기본 간격
    const t1 = 1000 + RAISE_AFTER_MS + 500
    const q1 = nextQuality(q, 5.6, t1, MAX)
    expect(q1.level).toBe(0)
    p = afterProbe(p, q1.level < q.level, t1)
    expect(p.gap).toBe(RAISE_AFTER_MS)
    // 넉넉하지 않으면 간격을 두 배씩, 60초까지
    q = nextQuality(top, 40, 0, MAX)
    p = initialProbe()
    for (let k = 0; k < 8; k++) p = afterProbe(p, false, 10_000 * k)
    expect(p.gap).toBe(PROBE_MAX_GAP_MS)
    expect(probeDue(q, p, p.at + PROBE_MAX_GAP_MS - 1)).toBe(false)
    expect(probeDue(q, p, p.at + PROBE_MAX_GAP_MS)).toBe(true)
  })

  it('a locked level is never probed again', () => {
    let s = nextQuality(initialQuality(), 40, 0, MAX)
    s = nextQuality(s, 16, RAISE_AFTER_MS, MAX)
    s = nextQuality(s, 40, RAISE_AFTER_MS + 100, MAX)
    expect(s.ceiling).toBe(1)
    expect(probeDue(s, initialProbe(), 10 * 60_000)).toBe(false)
  })
})

describe('quality ladder (설계안 6-25)', () => {
  it('drops the sun shadow first, then the detailed trees, then pixel ratios, then half the trees', () => {
    const n = 3 // 픽셀 비율 세 칸
    const steps = Array.from({ length: lowestQualityLevel(n) + 1 }, (_, l) => qualityLadder(l, n))
    expect(steps[0]).toEqual({ shadow: true, detailedTrees: true, pixelRatioIndex: 0, halfTrees: false })
    expect(steps[1]).toEqual({ shadow: false, detailedTrees: true, pixelRatioIndex: 0, halfTrees: false })
    expect(steps[2]).toEqual({ shadow: false, detailedTrees: false, pixelRatioIndex: 0, halfTrees: false })
    expect(steps.slice(2, 5).map((s) => s.pixelRatioIndex)).toEqual([0, 1, 2])
    expect(steps[lowestQualityLevel(n)]).toEqual({ shadow: false, detailedTrees: false, pixelRatioIndex: 2, halfTrees: true })
  })

  it('every step changes something (no dead levels) and never turns a feature back on', () => {
    for (const n of [1, 2, 4]) {
      const steps = Array.from({ length: lowestQualityLevel(n) + 1 }, (_, l) => qualityLadder(l, n))
      for (let l = 1; l < steps.length; l++) {
        expect(JSON.stringify(steps[l])).not.toBe(JSON.stringify(steps[l - 1]))
        if (!steps[l - 1].shadow) expect(steps[l].shadow).toBe(false)
        if (!steps[l - 1].detailedTrees) expect(steps[l].detailedTrees).toBe(false)
        expect(steps[l].pixelRatioIndex).toBeGreaterThanOrEqual(steps[l - 1].pixelRatioIndex)
      }
    }
  })
})

describe('very slow devices', () => {
  it('drop two levels per window when frames are slower than VERY_SLOW_MS, never past the floor', () => {
    let s = initialQuality()
    s = nextQuality(s, VERY_SLOW_MS + 40, 1000, 5)
    expect(s.level).toBe(2)
    s = nextQuality(s, VERY_SLOW_MS + 40, 2000, 5)
    expect(s.level).toBe(4)
    s = nextQuality(s, VERY_SLOW_MS + 40, 3000, 5)
    expect(s.level).toBe(5)
  })
})
