/**
 * 표기 규칙(설계안 4-6 마지막 문단): 진료일 소수 1자리, 인구 천 단위 구분 + 백분율 정수,
 * 시간은 분 정수. 값이 없으면 숫자 대신 문구(화면에서 다른 글꼴로 쓴다).
 */

import { tenthsToMinutes } from './kpi'

export function days1(v: number): string {
  const r = Math.round(v * 10) / 10
  return r === 0 ? '0' : r.toFixed(1)
}

/** `주 2.4일` */
export function weekDays(v: number): string {
  return `주 ${days1(v)}일`
}

/**
 * 미션 카드의 진료일 값. 소수 1자리로 반올림하면 목표와 같아 보이는데 실제로는 못 미치면
 * (예: 0.99 → 1.0) 소수 2자리로 보여 "같은데 미달"로 읽히지 않게 한다.
 */
export function missionDays(v: number, target: number): string {
  return `주 ${nearDays(v, target)}일`
}

/** missionDays의 숫자만(막대 라벨용). */
export function nearDays(v: number, target: number): string {
  return v < target && Math.round(v * 10) / 10 >= target ? (Math.floor(v * 100) / 100).toFixed(2) : days1(v)
}

/** 지소 배분값: 정수는 그대로, 격주 평균(0.5)은 소수 1자리. `주 3일` / `주 2.5일` */
export function allocDays(v: number): string {
  return Number.isInteger(v) ? `주 ${v}일` : `주 ${v.toFixed(1)}일`
}

export function people(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}명`
}

export function pct(n: number, total: number): string {
  return `${Math.round((n / total) * 100)}%`
}

export function minutes(tenths: number): string {
  return `${tenthsToMinutes(tenths)}분`
}

/** 도로망 접근시간 표기. 화면에서 '이동시간'이라고 쓰지 않는다(설계안 5-12). */
export function roadMinutes(tenths: number): string {
  return `도로망 ${tenthsToMinutes(tenths)}분`
}

/** 부호 붙은 차이. 마이너스는 U+2212, 반올림해 0이면 `±0`(단위 없이). */
export function signed(v: number, digits = 1): string {
  const r = digits === 0 ? Math.round(v) : Math.round(v * 10 ** digits) / 10 ** digits
  if (r === 0) return '±0'
  const s = digits === 0 ? Math.abs(r).toLocaleString('ko-KR') : Math.abs(r).toFixed(digits)
  return `${r > 0 ? '+' : '−'}${s}`
}
