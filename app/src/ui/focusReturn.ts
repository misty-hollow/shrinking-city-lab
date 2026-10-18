import { useLayoutEffect, useRef } from 'react'

/**
 * 판을 닫으면 키보드 포커스를 연 자리로 돌려준다(RELEASE_READINESS 8절 「닫을 때 포커스가 문서 처음으로」).
 * - 열 때 포커스가 있던 요소(연 단추)를 기억했다가, 닫혀서 포커스가 몸(body)으로 빠졌으면 그리로 돌려준다.
 * - 연 단추가 판과 함께 사라졌으면(결과 글의 [결과 자세히], 읍·면 목록의 줄) `data-return-focus={key}`가 붙은 요소로.
 * - 포커스가 다른 곳에 있으면(마우스로 다른 것을 눌러 닫음) 건드리지 않는다. 처음 그릴 때는 아무것도 하지 않는다.
 */
export function useReturnFocus(open: boolean, key: string): void {
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(open)
  useLayoutEffect(() => {
    if (open) {
      if (!wasOpen.current) {
        const a = document.activeElement
        opener.current = a instanceof HTMLElement && a !== document.body ? a : null
      }
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    const el = opener.current
    opener.current = null
    const a = document.activeElement
    if (a && a !== document.body) return
    const target = el && el.isConnected ? el : document.querySelector<HTMLElement>(`[data-return-focus="${key}"]`)
    target?.focus({ preventScroll: true })
  }, [open, key])
}
