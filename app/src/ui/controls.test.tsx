/**
 * 조작 편의(설계안 6-22): 조작법 판, 상태와 상관없이 하나인 아이콘 단추 이름, 빛이 나는 동안의 ↶(포커스 유지), 판을 닫은 뒤 포커스 복귀.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { copy } from '../content/copy'
import { useReturnFocus } from './focusReturn'
import { type KeyPanel, ReadingKey } from './Hud'
import { CornerTools } from './WorldHud'

function Key({ canAllocate = true, coached = false, start = null as KeyPanel }) {
  const [panel, setPanel] = useState<KeyPanel>(start)
  return <ReadingKey deltaMode={false} neutral={false} ghost={false} coached={coached} panel={panel} onPanel={setPanel} canAllocate={canAllocate} focusHelp={false} />
}

describe('조작법 판', () => {
  it('[조작법]으로 열고 닫는다. 지도·진료일·그 밖 줄이 다 있다', () => {
    render(<Key />)
    const btn = screen.getByRole('button', { name: copy.help.open })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById('controls-help')!
    for (const [k, v] of [...copy.help.map, ...copy.help.alloc, ...copy.help.other]) {
      expect(panel.textContent).toContain(k)
      expect(panel.textContent).toContain(v)
    }
    expect(panel.textContent).toContain('W A S D')
    expect(panel.textContent).toContain('처음 시점으로')
    fireEvent.click(screen.getByRole('button', { name: copy.help.close }))
    expect(document.getElementById('controls-help')).toBeNull()
  })

  it('진료일을 놓을 수 없는 화면(결산·S6)에서는 진료일 줄을 빼고 지도 줄만', () => {
    render(<Key canAllocate={false} start="controls" />)
    const t = document.getElementById('controls-help')!.textContent ?? ''
    expect(t).toContain(copy.help.mapTitle)
    expect(t).not.toContain(copy.help.allocTitle)
    expect(t).not.toContain('Ctrl Z')
  })

  it('읽는 법과 조작법은 같은 자리에 하나만 열린다(튜토리얼 1단계의 강조된 범례도 조작법을 열면 비킨다)', () => {
    render(<Key coached />)
    expect(screen.getByRole('button', { name: copy.legend.collapse }).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: copy.help.open }))
    expect(document.getElementById('controls-help')).not.toBeNull()
    expect(screen.getByRole('button', { name: copy.legend.expand }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: copy.legend.expand }))
    expect(document.getElementById('controls-help')).toBeNull()
  })
})

describe('아이콘 단추 이름(RELEASE_READINESS 8절)', () => {
  const tools = (top: boolean, open: boolean, enabled: boolean, onUndo = () => {}) => (
    <CornerTools T={15} onT={() => {}} tLocked={false} coachT={false} undo={{ enabled, onUndo, onHover: () => {} }} top={top} onTop={() => {}} details={{ open, onToggle: () => {} }} />
  )

  it('위에서 보기·지표 자세히는 이름이 하나이고 상태는 aria-pressed·aria-expanded가 말한다(툴팁만 바뀐다)', () => {
    const { rerender } = render(tools(false, false, true))
    const top = screen.getByRole('button', { name: copy.world.topOn })
    const det = screen.getByRole('button', { name: copy.world.details })
    expect(top.getAttribute('aria-pressed')).toBe('false')
    expect(det.getAttribute('aria-expanded')).toBe('false')
    rerender(tools(true, true, true))
    expect(screen.getByRole('button', { name: copy.world.topOn })).toBe(top)
    expect(top.getAttribute('aria-pressed')).toBe('true')
    expect(top.querySelector('.rb-tip')?.textContent).toBe(copy.world.topOff)
    expect(screen.getByRole('button', { name: copy.world.details })).toBe(det)
    expect(det.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('button', { name: copy.world.topOff })).toBeNull()
  })

  it('되돌릴 수 없는 동안의 ↶는 aria-disabled: 포커스를 잃지 않고, 눌러도 아무 일도 없다', () => {
    const onUndo = vi.fn()
    const { rerender } = render(tools(false, false, true, onUndo))
    const undo = screen.getByRole('button', { name: copy.world.undo })
    undo.focus()
    rerender(tools(false, false, false, onUndo))
    expect(undo.hasAttribute('disabled')).toBe(false)
    expect(undo.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(undo)
    fireEvent.click(undo)
    expect(onUndo).not.toHaveBeenCalled()
    rerender(tools(false, false, true, onUndo))
    fireEvent.click(undo)
    expect(onUndo).toHaveBeenCalledTimes(1)
  })
})

describe('판을 닫은 뒤 포커스 복귀', () => {
  function Panel({ fallback = false }: { fallback?: boolean }) {
    const [open, setOpen] = useState(false)
    useReturnFocus(open, 'demo')
    return (
      <div>
        {!(fallback && open) && (
          <button type="button" data-return-focus={fallback ? 'demo' : undefined} onClick={() => setOpen(true)}>
            열기
          </button>
        )}
        <button type="button">다른 단추</button>
        {open && (
          <section>
            <button type="button" onClick={() => setOpen(false)}>
              닫기
            </button>
          </section>
        )}
      </div>
    )
  }

  it('[닫기]가 판과 함께 사라지면 연 단추로 돌아간다', () => {
    render(<Panel />)
    const opener = screen.getByRole('button', { name: '열기' })
    opener.focus()
    fireEvent.click(opener)
    const close = screen.getByRole('button', { name: '닫기' })
    close.focus()
    act(() => close.click())
    expect(document.activeElement).toBe(opener)
  })

  it('연 단추도 사라졌다 다시 생기면 data-return-focus 요소로', () => {
    render(<Panel fallback />)
    screen.getByRole('button', { name: '열기' }).focus()
    fireEvent.click(screen.getByRole('button', { name: '열기' }))
    const close = screen.getByRole('button', { name: '닫기' })
    close.focus()
    act(() => close.click())
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '열기' }))
  })

  it('닫을 때 포커스가 다른 곳에 있으면 건드리지 않는다', () => {
    render(<Panel />)
    fireEvent.click(screen.getByRole('button', { name: '열기' }))
    const other = screen.getByRole('button', { name: '다른 단추' })
    other.focus()
    act(() => screen.getByRole('button', { name: '닫기' }).click())
    expect(document.activeElement).toBe(other)
  })
})
