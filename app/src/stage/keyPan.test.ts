import { describe, expect, it } from 'vitest'

import { KeyPan, PAN_KEYS, panKeyOf } from './keyPan'

const ev = (code: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: EventTarget | null }> = {}) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: null,
  ...extra,
})

/** 60fps로 sec초 진행 */
function run(p: KeyPan, sec: number, reduced = false): [number, number] {
  let v: [number, number] = [0, 0]
  for (let t = 0; t < sec - 1e-9; t += 1 / 60) v = p.step(1 / 60, reduced)
  return v
}

describe('W A S D 키 고르기', () => {
  it('키보드 자리(code)로 읽는다: 한글 입력 상태의 e.key와 무관', () => {
    expect(Object.keys(PAN_KEYS).sort()).toEqual(['KeyA', 'KeyD', 'KeyS', 'KeyW'])
    expect(panKeyOf(ev('KeyW'))).toBe('KeyW')
    expect(panKeyOf(ev('ArrowUp'))).toBeNull()
    expect(panKeyOf(ev('KeyZ'))).toBeNull()
  })

  it('Ctrl·Alt·⌘와 함께 누른 키는 다른 단축키다', () => {
    expect(panKeyOf(ev('KeyS', { ctrlKey: true }))).toBeNull()
    expect(panKeyOf(ev('KeyD', { altKey: true }))).toBeNull()
    expect(panKeyOf(ev('KeyW', { metaKey: true }))).toBeNull()
  })

  it('입력창·글 편집 자리에서는 지도를 옮기지 않는다', () => {
    const input = document.createElement('input')
    const area = document.createElement('textarea')
    const edit = document.createElement('div')
    edit.setAttribute('contenteditable', 'true')
    const inner = document.createElement('span')
    edit.appendChild(inner)
    const button = document.createElement('button')
    for (const t of [input, area, inner]) expect(panKeyOf(ev('KeyW', { target: t }))).toBeNull()
    expect(panKeyOf(ev('KeyW', { target: button }))).toBe('KeyW')
  })
})

describe('W A S D 속도', () => {
  it('누르고 있으면 약 0.2초에 최고 속도에 가깝고, 놓으면 0.3초 안에 선다', () => {
    const p = new KeyPan()
    p.press('KeyD')
    expect(run(p, 0.05)[0]).toBeLessThan(0.6)
    expect(run(p, 0.17)[0]).toBeGreaterThan(0.93)
    expect(run(p, 1)[0]).toBeCloseTo(1, 3)
    p.release('KeyD')
    expect(run(p, 0.1)[0]).toBeGreaterThan(0)
    expect(run(p, 0.5)).toEqual([0, 0])
    expect(p.active).toBe(false)
  })

  it('방향: W = 위(+y), S = 아래, A = 왼쪽(−x), D = 오른쪽', () => {
    for (const [code, want] of [
      ['KeyW', [0, 1]],
      ['KeyS', [0, -1]],
      ['KeyA', [-1, 0]],
      ['KeyD', [1, 0]],
    ] as const) {
      const p = new KeyPan()
      p.press(code)
      const [x, y] = run(p, 2)
      expect(x).toBeCloseTo(want[0], 3)
      expect(y).toBeCloseTo(want[1], 3)
    }
  })

  it('대각선은 한 방향보다 빠르지 않다', () => {
    const p = new KeyPan()
    p.press('KeyW')
    p.press('KeyD')
    const [x, y] = run(p, 2)
    expect(Math.hypot(x, y)).toBeCloseTo(1, 3)
    expect(x).toBeCloseTo(y, 6)
  })

  it('마주 보는 두 키는 서로 지운다', () => {
    const p = new KeyPan()
    p.press('KeyA')
    p.press('KeyD')
    expect(run(p, 1)).toEqual([0, 0])
  })

  it('자동 반복은 새 누름이 아니다', () => {
    const p = new KeyPan()
    expect(p.press('KeyW')).toBe(true)
    expect(p.press('KeyW')).toBe(false)
  })

  it('움직임 줄이기: 미끄러짐 없이 바로 움직이고 바로 선다', () => {
    const p = new KeyPan()
    p.press('KeyS')
    expect(p.step(1 / 60, true)).toEqual([0, -1])
    p.release('KeyS')
    expect(p.step(1 / 60, true)).toEqual([0, 0])
    expect(p.active).toBe(false)
  })

  it('창을 떠나면(clear) 누른 키를 잊고 바로 선다', () => {
    const p = new KeyPan()
    p.press('KeyW')
    run(p, 0.5)
    p.clear()
    expect(p.active).toBe(false)
    expect(p.step(1 / 60, false)).toEqual([0, 0])
  })
})
