/**
 * 판 도중의 언어 고르기(설계안 6-30). 시작 화면의 세 칸 단추(LangSwitch)와 달리, 플레이 화면에서는 눈에 덜 띄는
 * 작은 고르기 하나(지구 표시 + 지금 언어 이름)만 둔다. 브라우저 기본 고르기라 키보드·화면 낭독기에서 그대로 쓴다.
 * 언어 이름은 늘 그 언어로 적어서, 지금 화면 언어를 읽지 못해도 자기 언어를 찾을 수 있다.
 * 바꾸면 게임 화면을 새로 그리지만 배분·결과·단계는 이어 간다(App의 resume).
 */

import { useEffect, useRef } from 'react'

import { copy } from '../content/copy'
import { LANG_NAMES, LANGS, type Lang } from '../content/i18n'

/** 단추에 보이는 짧은 표시(펼친 목록에는 언어 이름 전체) */
const CODE: Record<Lang, string> = { ko: 'KO', en: 'EN', vi: 'VI' }

export function LangSelect({ value, onChange, focus = false }: { value: Lang; onChange(l: Lang): void; focus?: boolean }) {
  const ref = useRef<HTMLSelectElement>(null)
  // 언어를 바꿔 새로 그린 화면: 고르기로 포커스를 돌려준다(키보드로 고른 사람이 자리를 잃지 않게)
  useEffect(() => {
    if (focus) ref.current?.focus()
  }, [])
  return (
    <label className="lang-select" title={`${copy.language} · ${LANG_NAMES[value]}`}>
      <svg className="lang-globe" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <ellipse cx="10" cy="10" rx="3.2" ry="7.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3 10h14M4.2 6.4h11.6M4.2 13.6h11.6" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
      <span className="lang-code" aria-hidden="true">
        {CODE[value]}
      </span>
      <select ref={ref} value={value} aria-label={copy.language} onChange={(e) => onChange(e.target.value as Lang)}>
        {LANGS.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  )
}
