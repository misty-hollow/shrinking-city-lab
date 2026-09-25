/**
 * 숫자 보간(설계안 6-9 "KPI 값: 숫자 보간 300ms"). 값이 바뀌면 이전 표시값에서 새 값으로 짧게 미끄러진다.
 * 움직임 줄이기 설정·rAF 없는 환경·검사 환경에서는 바로 새 값을 보인다(숫자가 틀린 순간이 없어야 한다).
 * 미션 판정값처럼 정확한 순간값이 중요한 곳에는 쓰지 않는다.
 */

import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 300

function animatable(): boolean {
  if (import.meta.env.MODE === 'test') return false
  if (typeof requestAnimationFrame !== 'function') return false
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

export function useAnimatedNumber(value: number): number {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  useEffect(() => {
    const from = shownRef.current
    if (from === value) return
    if (!animatable()) {
      shownRef.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / DURATION_MS)
      const e = 1 - (1 - k) ** 3
      const v = k >= 1 ? value : from + (value - from) * e
      shownRef.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return shown
}

export function Num({ v, fmt }: { v: number; fmt: (n: number) => string }) {
  return <>{fmt(useAnimatedNumber(v))}</>
}
