/**
 * W A S D 지도 이동(설계안 6-21): 누르고 있는 키 → 화면 방향의 속도. 카메라와 무관한 순수 계산이라 따로 시험한다.
 * 키는 물리 자리(`KeyboardEvent.code`)로 읽는다: 한글 입력 상태에서도 W 자리는 W다(e.key는 'ㅈ'이나 'Process'가 된다).
 * 속도는 화면 기준 단위(1 = 최고 속도)이고, 대각선도 1을 넘지 않는다. 실제 거리는 StageController가 카메라 거리로 곱한다.
 */

/** 화면 방향: x = 오른쪽(+) · 왼쪽(−), y = 위(+, 화면 안쪽) · 아래(−) */
export const PAN_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, 1],
  KeyS: [0, -1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
}

/** 출발 시간 상수(초): 약 0.2초에 최고 속도의 95% */
export const PAN_TAU_START = 0.07
/** 멈춤 시간 상수(초): 놓으면 약 0.4초 안에 미끄러지듯 선다(최고 속도의 2% 아래는 바로 0) */
export const PAN_TAU_STOP = 0.1
/** 최고 속도: 1초에 카메라 거리의 이만큼(화면 높이로 약 0.9개). 확대해도 화면에서 보이는 빠르기는 같다 */
export const PAN_SPEED = 0.45

interface KeyLike {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  target: EventTarget | null
}

/** 글을 쓰는 자리(입력창 등)이거나 다른 단축키(Ctrl·Alt·⌘와 함께)면 지도 이동이 아니다 */
export function panKeyOf(e: KeyLike): string | null {
  if (!(e.code in PAN_KEYS)) return null
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  const t = e.target as HTMLElement | null
  if (t && typeof t.closest === 'function' && t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return null
  return e.code
}

export class KeyPan {
  private readonly held = new Set<string>()
  x = 0
  y = 0

  /** 새로 눌렸으면 true(자동 반복은 false) */
  press(code: string): boolean {
    if (this.held.has(code)) return false
    this.held.add(code)
    return true
  }

  release(code: string): void {
    this.held.delete(code)
  }

  /** 창을 떠나거나(키를 놓은 소식이 오지 않는다) 이동을 막을 때: 바로 선다 */
  clear(): void {
    this.held.clear()
    this.x = 0
    this.y = 0
  }

  get active(): boolean {
    return this.held.size > 0 || this.x !== 0 || this.y !== 0
  }

  /** 누르고 있는 키의 방향(길이 ≤ 1). 마주 보는 두 키는 서로 지운다 */
  want(): [number, number] {
    let x = 0
    let y = 0
    for (const c of this.held) {
      const d = PAN_KEYS[c]
      if (d) {
        x += d[0]
        y += d[1]
      }
    }
    const n = Math.hypot(x, y)
    return n > 1 ? [x / n, y / n] : [x, y]
  }

  /** dt초 진행한 속도. 움직임 줄이기면 미끄러짐 없이 바로 서고 바로 선다 */
  step(dt: number, reduced: boolean): [number, number] {
    const [wx, wy] = this.want()
    if (reduced) {
      this.x = wx
      this.y = wy
      return [wx, wy]
    }
    const tau = wx !== 0 || wy !== 0 ? PAN_TAU_START : PAN_TAU_STOP
    const k = 1 - Math.exp(-Math.max(0, dt) / tau)
    this.x += (wx - this.x) * k
    this.y += (wy - this.y) * k
    if (wx === 0 && wy === 0 && Math.hypot(this.x, this.y) < 0.02) {
      this.x = 0
      this.y = 0
    }
    return [this.x, this.y]
  }
}
