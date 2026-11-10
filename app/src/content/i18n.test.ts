/**
 * 언어 지원(한국어 · English · Tiếng Việt) 검사.
 * - 영어·베트남어 문구가 한국어와 같은 모양이고(배열 길이·함수), 금지어(정책 추천·순위·「이동시간」)가 없다.
 * - 한국어 표기는 언어 지원 전과 글자 하나까지 같다(숫자·단위).
 * - 자료와 한계의 manifest 문장, 지명 161+10+10곳이 모두 번역·로마자로 있다.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { AppData, Manifest, Scenario } from '../data/types'
import { allocDays, allocShort, dayCount, days1, missionDays, people, roadMinutes, signed, weekDays } from '../engine/format'
import { APPROVED_NEGATIONS, type Copy, copy, ko, LIMITS, LIMITS_KO } from './copy'
import { en, LIMITS_EN } from './en'
import { initialLang, setLang } from './i18n'
import { getLang } from './lang'
import { MANIFEST_TEXT, mtext } from './manifestText'
import { EMD_ROMAN, FACILITY_ROMAN, localizeData, villageRoman } from './places'
import { LIMITS_VI, vi } from './vi'

const dataDir = resolve(__dirname, '../../public/data')
const read = <T,>(name: string): T => JSON.parse(readFileSync(resolve(dataDir, name), 'utf-8')) as T
const scenario = read<Scenario>('scenario.json')
const manifest = read<Manifest>('manifest.json')

afterEach(() => setLang('ko'))

/** 함수는 자리표시 값으로 불러 글로 펼친다 */
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

/** 같은 모양: 열쇠·배열 길이·종류(글·함수·묶음) */
function shapeDiff(a: unknown, b: unknown, path = ''): string[] {
  const kind = (x: unknown) => (Array.isArray(x) ? `array${(x as unknown[]).length}` : typeof x)
  if (kind(a) !== kind(b)) return [`${path}: ${kind(a)} ≠ ${kind(b)}`]
  if (a && typeof a === 'object') {
    const ka = Object.keys(a)
    const kb = Object.keys(b as object)
    const out = ka.filter((k) => !kb.includes(k)).map((k) => `${path}.${k}: 없음`)
    for (const k of ka) if (kb.includes(k)) out.push(...shapeDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`))
    return out
  }
  return []
}

const LANGS: [string, Copy, readonly string[]][] = [
  ['en', en, LIMITS_EN],
  ['vi', vi, LIMITS_VI],
]

/** 한국어 금지어(forbidden.test.ts)와 같은 뜻의 영어·베트남어. 설계안이 부정문으로 고정한 문장만 예외 */
const FORBIDDEN: Record<string, string[]> = {
  en: ['optimal', 'best allocation', 'recommend', 'correct answer', 'score', 'ranking', 'rank ', 'winner', '1st', 'travel time', 'budget', 'cost', 'savings', 'closure', 'shut down', 'the elderly', 'should', 'must', 'Pareto', 'OSRM', 'p90', 'population-weighted', 'matrix', '!'],
  vi: ['tối ưu', 'tốt nhất', 'khuyến nghị', 'đáp án', 'điểm số', 'chấm điểm', 'xếp hạng', 'hạng nhất', 'thời gian di chuyển', 'ngân sách', 'chi phí', 'tiết kiệm', 'đóng cửa', 'giải thể', 'người già', 'phải tăng', 'cần tăng', 'Pareto', 'OSRM', 'p90', '!'],
}

function approved(c: Copy, limits: readonly string[]): string[] {
  return [c.start.notPolicy, c.briefing.assumption, c.dataPage.whatNot, limits[1], limits[8]]
}

describe('language copy', () => {
  it('Korean is still the source and the default', () => {
    expect(getLang()).toBe('ko')
    expect(copy).toBe(ko)
    expect(LIMITS).toBe(LIMITS_KO)
    expect(APPROVED_NEGATIONS).toContain(ko.start.notPolicy)
  })

  for (const [lang, c, limits] of LANGS) {
    it(`${lang}: same shape as Korean (keys, list lengths, functions)`, () => {
      expect(shapeDiff(ko, c)).toEqual([])
      expect(limits).toHaveLength(LIMITS_KO.length)
    })

    it(`${lang}: every string is filled and has no Korean left`, () => {
      const all = [...flatten(c), ...limits]
      // 수를 받는 문장(0곳이면 빈 줄)은 자리표시 값으로 부르면 한국어도 빈 글이다. 그 개수만큼만 허용
      const emptyKo = flatten(ko).filter((s) => s.trim() === '').length
      expect(all.filter((s) => s.trim() === '')).toHaveLength(emptyKo)
      expect(all.filter((s) => /[가-힣]/.test(s))).toEqual([])
    })

    it(`${lang}: no policy recommendation, ranking or "travel time" outside the fixed negations`, () => {
      const ok = approved(c, limits)
      const bad = [...flatten(c), ...limits].flatMap((s) => {
        let t = s
        for (const a of ok) t = t.split(a).join('')
        return FORBIDDEN[lang].filter((w) => t.toLowerCase().includes(w.toLowerCase())).map((w) => `${w} ← ${s}`)
      })
      expect(bad).toEqual([])
    })

    it(`${lang}: the 15-day split and the assumption sentence keep their meaning`, () => {
      const n = lang === 'en' ? ['10 real', '5 assumed'] : ['10 ngày thật', '5 ngày giả định']
      for (const s of [c.briefing.resource, c.finale.basis, c.finale.allocTotalValue, c.pool.caption]) for (const w of n) expect(s).toContain(w)
      expect(c.missions.m1.title.endsWith(c.missions.m1.name)).toBe(true)
      expect(c.missions.m2.title.endsWith(c.missions.m2.name)).toBe(true)
      expect(c.missions.m3.title.endsWith(c.missions.m3.name)).toBe(true)
    })
  }

  it('switching the language swaps copy, limits and the document language', () => {
    setLang('vi')
    expect(copy).toBe(vi)
    expect(LIMITS).toBe(LIMITS_VI)
    expect(document.documentElement.lang).toBe('vi')
    expect(document.title).toBe(vi.docTitle)
    setLang('en')
    expect(copy.scenario).toBe('Days Within Reach')
    setLang('ko')
    expect(copy).toBe(ko)
    expect(document.title).toBe(ko.docTitle)
  })

  it('first language: ?lang= → remembered choice → Korean (no guessing from the browser)', () => {
    window.localStorage.removeItem('scl.lang')
    expect(initialLang('')).toBe('ko')
    expect(initialLang('?lang=vi')).toBe('vi')
    expect(initialLang('?lang=xx')).toBe('ko')
    setLang('en', true)
    expect(initialLang('')).toBe('en')
    expect(initialLang('?lang=ko')).toBe('ko')
    window.localStorage.removeItem('scl.lang')
  })
})

describe('number and unit formats', () => {
  it('Korean output is unchanged', () => {
    expect(people(40204)).toBe('40,204명')
    expect(weekDays(2.44)).toBe('주 2.4일')
    expect(weekDays(0)).toBe('주 0일')
    expect(missionDays(0.99, 1)).toBe('주 0.99일')
    expect(allocDays(3)).toBe('주 3일')
    expect(allocDays(2.5)).toBe('주 2.5일')
    expect(allocShort(2.5)).toBe('2.5일')
    expect(allocShort(0)).toBe('0일')
    expect(dayCount('+1')).toBe('+1일')
    expect(roadMinutes(225)).toBe('도로망 23분')
    expect(signed(-5752, 0)).toBe('−5,752')
    expect(signed(0.66)).toBe('+0.7')
  })

  it('English uses its units and plural forms', () => {
    setLang('en')
    expect(people(40204)).toBe('40,204 people')
    expect(people(1)).toBe('1 person')
    expect(weekDays(2.44)).toBe('2.4 days/wk')
    expect(allocDays(1)).toBe('1 day/wk')
    expect(allocShort(2.5)).toBe('2.5 days')
    expect(dayCount('−1')).toBe('−1 day')
    expect(roadMinutes(225)).toBe('23 min by road')
  })

  it('Vietnamese uses a decimal comma and dot thousands', () => {
    setLang('vi')
    expect(people(40204)).toBe('40.204 người')
    expect(weekDays(2.44)).toBe('2,4 ngày/tuần')
    expect(days1(0.5)).toBe('0,5')
    expect(missionDays(0.99, 1)).toBe('0,99 ngày/tuần')
    expect(signed(-5752, 0)).toBe('−5.752')
    expect(roadMinutes(225)).toBe('23 phút đường bộ')
  })
})

describe('data-source sentences (Data & limits)', () => {
  const s = manifest.sources
  const shown = [
    s.population.title,
    s.population.license,
    s.population.attribution,
    s.schedule.publisher,
    s.schedule.title,
    s.schedule.conversion_rule,
    s.schedule.usage_status,
    s.facilities.coordinates,
    s.facilities.attribution,
    s.road_network.publisher,
    s.road_network.license,
    s.routing.conditions,
    s.routing.profile_detail,
    s.boundaries.publisher,
    s.boundaries.license,
    s.terrain.publisher,
    s.terrain.license,
    manifest.semantics.current_total,
    ...manifest.classification.filter((c) => c.class === 'SIMULATION_ASSUMPTION').map((c) => c.item),
  ]

  it('every manifest sentence on the page has an English and a Vietnamese version', () => {
    const missing = shown.filter((t) => /[가-힣]/.test(t) && !MANIFEST_TEXT.some((e) => e.ko === t))
    expect(missing).toEqual([])
    for (const lang of ['en', 'vi'] as const) {
      setLang(lang)
      expect(shown.map(mtext).filter((t) => /[가-힣]/.test(t.replace(/「[^」]*」/g, '').replace(/\([^()]*[가-힣][^()]*\)/g, '')))).toEqual([])
    }
  })

  it('official titles keep their original Korean name next to the translation', () => {
    setLang('en')
    expect(mtext(s.population.title)).toContain(`「${s.population.title}」`)
    expect(mtext(s.schedule.publisher)).toContain('(공주시보건소)')
    setLang('ko')
    expect(mtext(s.population.title)).toBe(s.population.title)
  })
})

describe('place names', () => {
  it('all 10 districts, 10 clinics and 161 villages have a romanized name', () => {
    expect(scenario.emds.filter((e) => !EMD_ROMAN[e.id])).toEqual([])
    expect(scenario.facilities.filter((f) => !FACILITY_ROMAN[f.id])).toEqual([])
    const bad = scenario.villages.map((v) => villageRoman(v.name)).filter((r) => !/^[A-Z][a-z]+-ri$/.test(r))
    expect(bad).toEqual([])
  })

  it('district names end with -eup / -myeon like their Korean names', () => {
    for (const e of scenario.emds) expect(EMD_ROMAN[e.id].endsWith(e.name.endsWith('읍') ? '-eup' : '-myeon')).toBe(true)
  })

  it('localized data changes names only (numbers, ids and order stay the same object data)', () => {
    const data = { scenario, geometry: {}, landscape: {}, manifest, terrain: new ArrayBuffer(8) } as unknown as AppData
    expect(localizeData(data, 'ko')).toBe(data)
    const v = localizeData(data, 'vi')
    expect(v.scenario.villages.map((x) => [x.id, x.pop, x.x, x.y])).toEqual(scenario.villages.map((x) => [x.id, x.pop, x.x, x.y]))
    expect(v.scenario.matrix).toBe(scenario.matrix)
    expect(v.scenario.current_allocation).toBe(scenario.current_allocation)
    expect(v.scenario.emds[0].name).toBe('Yugu-eup')
    expect(v.scenario.facilities.find((f) => f.id === 'uidang')?.short).toBe('Uidang')
    expect(v.scenario.villages[0].name).toBe('Baekgyo-ri')
    expect(v.manifest).toBe(manifest)
  })
})
