/**
 * 화면 언어 값 하나만 둔다(문구·표기·지명이 함께 읽는다). 바꾸는 일은 i18n.ts의 setLang이 한다.
 * 한국어가 기본이다. 영어·베트남어는 플레이어가 시작 화면에서 고르거나 주소의 `?lang=en|vi`로 연다.
 */

export type Lang = 'ko' | 'en' | 'vi'

export const LANGS: readonly Lang[] = ['ko', 'en', 'vi']

let current: Lang = 'ko'

export function getLang(): Lang {
  return current
}

/** i18n.ts의 setLang만 부른다 */
export function setCurrentLang(l: Lang): void {
  current = l
}

export function isLang(v: unknown): v is Lang {
  return v === 'ko' || v === 'en' || v === 'vi'
}
