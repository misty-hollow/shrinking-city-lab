/**
 * 금지어 검사(설계안 5-12, 10-1 7번, 10-7).
 * 화면 문구 파일과 화면 컴포넌트의 문자열에서 금지어를 찾는다. 설계안이 부정문으로
 * 고정한 문장(APPROVED_NEGATIONS)만 예외다. 주석은 화면에 나오지 않으므로 뺀다.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { APPROVED_NEGATIONS, copy, LIMITS } from './copy'

const FORBIDDEN = [
  '최적',
  '최선',
  '추천',
  '정답',
  '가장 좋은 배분',
  // 세 결과를 비교하는 S6에서 순위·점수로 읽히지 않게(이번 범위의 사용자 지시)
  '1등',
  '점수',
  '순위',
  '우승',
  '이동시간',
  '이동 시간',
  '걸리는 시간',
  '예산',
  '절감',
  '비용',
  '폐쇄',
  '폐지',
  '고령층',
  '해야 한다',
  '해야 해요',
  '늘려야',
  '추가 확보가 필요',
  '확대해야',
  'OSRM',
  'p90',
  'P90',
  'Pareto',
  '파레토',
  '인구가중',
  '인구 가중',
  '매트릭스',
  '!',
]

const src = resolve(__dirname, '..')

function uiFiles(): string[] {
  const out: string[] = [join(src, 'content', 'copy.ts')]
  for (const dir of ['screens', 'ui', 'stage']) {
    for (const f of readdirSync(join(src, dir))) {
      if (/\.(tsx|ts)$/.test(f) && !f.includes('.test.')) out.push(join(src, dir, f))
    }
  }
  return out
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

/** 소스에서 문자열 리터럴과 JSX 텍스트만 뽑는다. */
function strings(code: string): string[] {
  const out: string[] = []
  const re = /'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`|>([^<>{}]+)</g
  for (const m of code.matchAll(re)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? '').trim()
    if (s) out.push(s)
  }
  return out
}

function flatten(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (typeof v === 'function') {
    const s = (v as (...a: unknown[]) => unknown)('{a}', '{b}', '{c}', '{d}')
    return typeof s === 'string' ? [s] : []
  }
  if (Array.isArray(v)) return v.flatMap(flatten)
  if (v && typeof v === 'object') return Object.values(v).flatMap(flatten)
  return []
}

function violations(text: string): string[] {
  let t = text
  for (const ok of APPROVED_NEGATIONS) t = t.split(ok).join('')
  return FORBIDDEN.filter((w) => t.includes(w))
}

describe('forbidden words', () => {
  it('copy object has none (functions are expanded with placeholders)', () => {
    const bad = [...flatten(copy), ...LIMITS].flatMap((s) => violations(s).map((w) => `${w} ← ${s}`))
    expect(bad).toEqual([])
  })

  it('UI source strings have none', () => {
    const bad: string[] = []
    for (const f of uiFiles()) {
      const code = stripComments(readFileSync(f, 'utf-8'))
      for (const s of strings(code)) {
        // 코드 식별자·CSS·경로처럼 한글이 없는 문자열의 '!'(!==, !important)는 문구가 아니다.
        if (!/[가-힣]/.test(s)) continue
        for (const w of violations(s)) bad.push(`${f.split(/[\\/]/).slice(-2).join('/')}: ${w} ← ${s}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('the checker itself catches a forbidden word (control)', () => {
    expect(violations('이 배분이 최적이에요')).toEqual(['최적'])
    expect(violations(copy.start.notPolicy)).toEqual([])
    expect(violations('정책을 추천하지 않아요 그리고 추천 배분')).toContain('추천')
  })

  it('the fixed 15-day decomposition and assumption sentence are present', () => {
    expect(copy.briefing.resource).toContain('실제 10일 + 가정 5일')
    expect(copy.pool.caption).toBe('실제 10일 + 가정 5일')
    expect(copy.debrief.mixedEffect).toContain('5일이 늘어난 효과도 섞여')
    expect(copy.finale.basis).toContain('실제 10일 + 가정 5일 = 15일')
    expect(copy.finale.allocTotalValue).toBe('주 15일 = 실제 10일 + 가정 5일')
    expect(LIMITS).toHaveLength(9)
  })
})
