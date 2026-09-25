/**
 * 지표가 빛을 따라 오른다(설계안 6-16). 계산은 조작 순간에 끝나 있고, 여기서는 **보이는 값**만 늦춘다.
 * 무대와 같은 빛의 순서(lightPlan)를 읽어, 도착을 마친 마을의 무게만큼 숫자가 옮겨 간다(최대 약 0.8초 + 불씨 0.38초).
 * 검사 환경·움직임 줄이기·rAF 없는 환경에서는 늘 바로 최종값이다(숫자가 틀린 순간이 없어야 한다).
 * 스크린리더 문장(라이브 영역)은 이 지연과 상관없이 조작 즉시 정확한 값을 읽는다.
 */

import { useEffect, useRef, useState } from 'react'

import { progressAt } from '../stage/lightPlan'
import type { StageEvent } from '../stage/StageController'

function live(): boolean {
  if (import.meta.env.MODE === 'test') return false
  if (typeof requestAnimationFrame !== 'function') return false
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

function progressOf(ev: StageEvent | null): number {
  if (!ev || !live()) return 1
  return progressAt(ev.plan, performance.now() - ev.t0)
}

function doneOf(ev: StageEvent | null): boolean {
  if (!ev || !live()) return true
  return performance.now() - ev.t0 >= ev.plan.endMs
}

/** 이 사건이 끝날 때까지 프레임마다 다시 그린다. */
function useTick(ev: StageEvent | null): void {
  const [, force] = useState(0)
  const running = !doneOf(ev)
  useEffect(() => {
    if (!running) return
    let raf = 0
    const tick = () => {
      force((x) => x + 1)
      if (!doneOf(ev)) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ev, running])
}

/** 숫자: 사건이 시작될 때 보이던 값에서 새 값으로, 빛의 도착만큼 옮겨 간다. */
export function useFollowNumber(value: number, ev: StageEvent | null): number {
  useTick(ev)
  const from = useRef(value)
  const shown = useRef(value)
  const evRef = useRef<StageEvent | null>(ev)
  if (evRef.current !== ev) {
    evRef.current = ev
    from.current = shown.current
  }
  const p = progressOf(ev)
  const out = ev && p < 1 ? from.current + (value - from.current) * p : value
  shown.current = out
  return out
}

/** 값 전체: 사건이 끝날 때까지는 앞 값을, 끝나면 새 값을(미션 판정처럼 정확한 순간값이 중요한 곳). */
export function useSettled<T>(value: T, ev: StageEvent | null): T {
  useTick(ev)
  const prev = useRef(value)
  const evRef = useRef<StageEvent | null>(ev)
  const held = useRef(value)
  if (evRef.current !== ev) {
    evRef.current = ev
    held.current = prev.current
  }
  const done = doneOf(ev)
  const out = done ? value : held.current
  prev.current = out
  return out
}

/** 사건이 끝나는 순간 한 번 부른다(소식 한 줄·소리·달성 인장). */
export function useOnSettle(ev: StageEvent | null, fn: (ev: StageEvent) => void): void {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!ev) return
    const wait = live() ? Math.max(0, ev.t0 + ev.plan.endMs - performance.now()) : 0
    const id = window.setTimeout(() => fnRef.current(ev), wait)
    return () => window.clearTimeout(id)
  }, [ev])
}
