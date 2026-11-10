/** 결과 이미지의 파일 이름·날짜(그리기 자체는 브라우저 QA가 실제 PNG로 본다) */

import { afterEach, describe, expect, it } from 'vitest'

import { setLang } from '../content/i18n'
import { imageFileName, todayLocal } from './resultImage'

afterEach(() => setLang('ko'))

describe('result image file name', () => {
  it('date first, then the optional name; characters a file name cannot hold are dropped', () => {
    expect(imageFileName('2026-11-10', '')).toBe('닿는날_결과_2026-11-10.png')
    expect(imageFileName('2026-11-10', ' 3반 4모둠 ')).toBe('닿는날_결과_2026-11-10_3반_4모둠.png')
    expect(imageFileName('2026-11-10', 'a/b:c*?"<>|d')).toBe('닿는날_결과_2026-11-10_abcd.png')
    expect(imageFileName('2026-11-10', 'x'.repeat(80))).toHaveLength('닿는날_결과_2026-11-10_'.length + 40 + '.png'.length)
  })

  it('follows the screen language', () => {
    setLang('en')
    expect(imageFileName('2026-11-10', 'Group 4')).toBe('days-within-reach_results_2026-11-10_Group_4.png')
    setLang('vi')
    expect(imageFileName('2026-11-10', 'Nhóm 4')).toBe('ngay-kham-trong-tam-voi_ket-qua_2026-11-10_Nhóm_4.png')
  })

  it('uses the local calendar date', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
