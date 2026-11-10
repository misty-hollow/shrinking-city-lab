/**
 * 표기 규칙(설계안 4-6 마지막 문단): 진료일 소수 1자리, 인구 천 단위 구분 + 백분율 정수,
 * 시간은 분 정수. 값이 없으면 숫자 대신 문구(화면에서 다른 글꼴로 쓴다).
 *
 * 화면 언어(content/i18n.ts)에 따라 단위와 숫자 구분 기호가 바뀐다. 한국어 표기는 언어 지원 전과 글자 하나까지 같다.
 * - 한국어 `주 2.4일` · `40,204명` · `25분` · `도로망 25분`
 * - 영어 `2.4 days/wk` · `40,204 people` · `25 min` · `25 min by road`
 * - 베트남어 `2,4 ngày/tuần` · `40.204 người` · `25 phút` · `25 phút đường bộ`(소수점은 쉼표, 천 단위는 점)
 */

import { getLang } from '../content/lang'
import { tenthsToMinutes } from './kpi'

/** 숫자 문자열의 소수점·천 단위 기호를 화면 언어에 맞춘다(입력은 `1234.5` 꼴). */
function localDigits(s: string): string {
  if (getLang() !== 'vi') return s
  return s.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'))
}

/** 정수 천 단위 구분(한국어·영어 `40,204`, 베트남어 `40.204`) */
export function int(n: number): string {
  return localDigits(Math.round(n).toLocaleString('en-US'))
}

/** 소수 자리 고정(`49.4` / 베트남어 `49,4`) */
export function dec(v: number, digits: number): string {
  return localDigits(v.toFixed(digits))
}

export function days1(v: number): string {
  const r = Math.round(v * 10) / 10
  return r === 0 ? '0' : dec(r, 1)
}

/** 숫자 뒤에 진료일 단위(주당) — `주 2.4일` / `2.4 days/wk` / `2,4 ngày/tuần` */
function perWeek(n: string): string {
  const l = getLang()
  if (l === 'en') return `${n} ${n === '1' ? 'day' : 'days'}/wk`
  if (l === 'vi') return `${n} ngày/tuần`
  return `주 ${n}일`
}

/** 숫자 뒤에 날 수만(주당 표시 없이) — `2.5일` / `2.5 days` / `2,5 ngày` */
export function dayCount(n: string): string {
  const l = getLang()
  if (l === 'en') return `${n} ${n === '1' || n === '+1' || n === '−1' ? 'day' : 'days'}`
  if (l === 'vi') return `${n} ngày`
  return `${n}일`
}

/** `주 2.4일` */
export function weekDays(v: number): string {
  return perWeek(days1(v))
}

/**
 * 미션 카드의 진료일 값. 소수 1자리로 반올림하면 목표와 같아 보이는데 실제로는 못 미치면
 * (예: 0.99 → 1.0) 소수 2자리로 보여 "같은데 미달"로 읽히지 않게 한다.
 */
export function missionDays(v: number, target: number): string {
  return perWeek(nearDays(v, target))
}

/** missionDays의 숫자만(막대 라벨용). */
export function nearDays(v: number, target: number): string {
  return v < target && Math.round(v * 10) / 10 >= target ? dec(Math.floor(v * 100) / 100, 2) : days1(v)
}

/** 지소 배분값의 숫자: 정수는 그대로, 격주 평균(0.5)은 소수 1자리 */
function allocNum(v: number): string {
  return Number.isInteger(v) ? String(v) : dec(v, 1)
}

/** 지소 배분값: 정수는 그대로, 격주 평균(0.5)은 소수 1자리. `주 3일` / `주 2.5일` */
export function allocDays(v: number): string {
  return perWeek(allocNum(v))
}

/** 지소 배분값의 짧은 꼴(주당 표시 없이, 목록의 둘째 항목부터·미리보기): `2.5일` / `2.5 days` / `0일` */
export function allocShort(v: number): string {
  return dayCount(v <= 0 ? '0' : allocNum(v))
}

export function people(n: number): string {
  return popUnit(int(n))
}

/** 숫자 문자열 뒤에 사람 단위 — `40,204명` / `40,204 people` / `40.204 người` */
export function popUnit(s: string): string {
  const l = getLang()
  if (l === 'en') return `${s} ${s === '1' || s === '+1' || s === '−1' ? 'person' : 'people'}`
  if (l === 'vi') return `${s} người`
  return `${s}명`
}

export function pct(n: number, total: number): string {
  return `${Math.round((n / total) * 100)}%`
}

/** 분 단위 뒤붙이기(숫자 문자열) */
export function minUnit(n: string): string {
  const l = getLang()
  if (l === 'en') return `${n} min`
  if (l === 'vi') return `${n} phút`
  return `${n}분`
}

export function minutes(tenths: number): string {
  return minUnit(String(tenthsToMinutes(tenths)))
}

/** 도로망 접근시간 표기. 화면에서 '이동시간'이라고 쓰지 않는다(설계안 5-12). */
export function roadMinutes(tenths: number): string {
  const m = tenthsToMinutes(tenths)
  const l = getLang()
  if (l === 'en') return `${m} min by road`
  if (l === 'vi') return `${m} phút đường bộ`
  return `도로망 ${m}분`
}

/** 부호 붙은 차이. 마이너스는 U+2212, 반올림해 0이면 `±0`(단위 없이). */
export function signed(v: number, digits = 1): string {
  const r = digits === 0 ? Math.round(v) : Math.round(v * 10 ** digits) / 10 ** digits
  if (r === 0) return '±0'
  const s = digits === 0 ? int(Math.abs(r)) : dec(Math.abs(r), digits)
  return `${r > 0 ? '+' : '−'}${s}`
}

/** 설명문 안의 진료일 값(`주 5일`, `5 days/wk`)을 찾는 식: 줄에서 끊지 않으려고 쓴다(UI_DESIGN_SYSTEM §4.2). */
export function weekDaysPattern(): RegExp {
  const l = getLang()
  if (l === 'en') return /(\d+(?:\.\d+)? days?\/wk)/
  if (l === 'vi') return /(\d+(?:,\d+)? ngày\/tuần)/
  return /(주 \d+(?:\.\d+)?일)/
}
