/**
 * 언어 고르기: 한국어 · English · Tiếng Việt. 시작 화면 오른쪽 위(소리 단추 옆)와 모바일 안내에 있다.
 * 모양은 기준 시간 세그먼트(.t-group)와 같은 트랙 + 크림 칩이다. 언어 이름은 늘 그 언어로 적어서
 * 지금 화면 언어를 읽지 못해도 자기 언어를 찾을 수 있다. 지구 모양 표시는 "언어"라는 뜻을 글 없이 알린다.
 */

import { useEffect, useRef } from 'react'

import { copy } from '../content/copy'
import { LANG_NAMES, LANGS, type Lang } from '../content/i18n'

export function LangSwitch({ value, onChange }: { value: Lang; onChange(l: Lang): void }) {
  const group = useRef<HTMLDivElement>(null)
  // 라디오 묶음 관례: 묶음 안에 포커스가 있으면 고른 언어 단추로 포커스가 따라간다(방향키로 고를 때)
  useEffect(() => {
    const g = group.current
    if (g && g.contains(document.activeElement)) g.querySelector<HTMLElement>(`[data-lang="${value}"]`)?.focus()
  }, [value])
  const pick = (l: Lang) => {
    if (l !== value) onChange(l)
  }
  const onKey = (e: React.KeyboardEvent) => {
    const i = LANGS.indexOf(value)
    let next: Lang | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = LANGS[(i + 1) % LANGS.length]
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = LANGS[(i - 1 + LANGS.length) % LANGS.length]
    if (!next) return
    e.preventDefault()
    pick(next)
  }
  return (
    <div className="lang-switch">
      <svg className="lang-globe" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <ellipse cx="10" cy="10" rx="3.2" ry="7.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3 10h14M4.2 6.4h11.6M4.2 13.6h11.6" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
      <div ref={group} className="t-group lang-group" role="radiogroup" aria-label={copy.language} onKeyDown={onKey}>
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            lang={l}
            aria-checked={value === l}
            tabIndex={value === l ? 0 : -1}
            data-lang={l}
            onClick={() => pick(l)}
          >
            {LANG_NAMES[l]}
          </button>
        ))}
      </div>
    </div>
  )
}
