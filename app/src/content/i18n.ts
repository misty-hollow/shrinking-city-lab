/**
 * 화면 언어 바꾸기(한국어 · English · Tiếng Việt).
 * - 처음 언어: 주소의 `?lang=ko|en|vi` → 이 브라우저에서 전에 고른 언어 → 한국어. 브라우저 언어로 짐작하지 않는다
 *   (한국어 화면이 기본이고, 다른 언어는 시작 화면의 언어 단추에서 한 번에 고른다).
 * - 고른 언어는 이 브라우저에만 남긴다(localStorage, 쓸 수 없으면 이번 방문 동안만). 서버로 보내지 않는다.
 */

import { applyCopy, ko, LIMITS_KO } from './copy'
import { en, LIMITS_EN } from './en'
import { getLang, isLang, type Lang, setCurrentLang } from './lang'
import { LIMITS_VI, vi } from './vi'

export { getLang, LANGS, type Lang } from './lang'

/** 언어 이름은 늘 그 언어로 적는다(어떤 화면 언어에서도 자기 언어를 찾을 수 있게) */
export const LANG_NAMES: Record<Lang, string> = { ko: '한국어', en: 'English', vi: 'Tiếng Việt' }

/** 문서 언어 속성(화면 낭독기의 발음·글꼴 고르기) */
const HTML_LANG: Record<Lang, string> = { ko: 'ko', en: 'en', vi: 'vi' }

const STORE_KEY = 'scl.lang'

export function initialLang(search = typeof window !== 'undefined' ? window.location.search : ''): Lang {
  const q = new URLSearchParams(search).get('lang')
  if (isLang(q)) return q
  try {
    const saved = window.localStorage.getItem(STORE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // 저장소를 쓸 수 없으면(사생활 보호 창 등) 기본값
  }
  return 'ko'
}

/** 문구·표기·문서 속성을 그 언어로. remember = 이 브라우저에 기억(플레이어가 직접 골랐을 때) */
export function setLang(l: Lang, remember = false): void {
  setCurrentLang(l)
  if (l === 'en') applyCopy(en, LIMITS_EN)
  else if (l === 'vi') applyCopy(vi, LIMITS_VI)
  else applyCopy(ko, LIMITS_KO)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = HTML_LANG[l]
    const c = l === 'en' ? en : l === 'vi' ? vi : ko
    document.title = c.docTitle
    document.querySelector('meta[name="description"]')?.setAttribute('content', c.docDescription)
  }
  if (remember) {
    try {
      window.localStorage.setItem(STORE_KEY, l)
    } catch {
      // 기억하지 못해도 이번 방문에는 그 언어로 보인다
    }
  }
}

/** 지금 언어가 한국어인지(한국어 전용 표기 분기에만) */
export function isKorean(): boolean {
  return getLang() === 'ko'
}
