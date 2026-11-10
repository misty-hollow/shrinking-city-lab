/** 언어 고르기: 라디오 묶음(화면 낭독기), 화살표 키, 언어 이름은 그 언어로 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LangSwitch } from './LangSwitch'

describe('LangSwitch', () => {
  it('is one radio group with the three language names in their own language', () => {
    render(<LangSwitch value="ko" onChange={() => {}} />)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual(['한국어', 'English', 'Tiếng Việt'])
    expect(radios.map((r) => r.getAttribute('lang'))).toEqual(['ko', 'en', 'vi'])
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    // 고른 단추만 Tab으로 들어간다(라디오 묶음 관례)
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1])
  })

  it('click and arrow keys choose a language; choosing the current one does nothing', () => {
    const onChange = vi.fn()
    render(<LangSwitch value="en" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Tiếng Việt' }))
    expect(onChange).toHaveBeenLastCalledWith('vi')
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('ko')
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('vi')
    onChange.mockClear()
    fireEvent.click(screen.getByRole('radio', { name: 'English' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
