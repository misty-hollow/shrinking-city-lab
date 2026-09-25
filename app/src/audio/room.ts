/**
 * 소리의 공간(설계안 6-16 소리). 해질녘 골짜기 모형이 놓인 조용한 방의 울림과 부드러운 바람 소리의 재료를
 * 수식으로 만든다. 녹음한 임펄스 응답이나 음원을 쓰지 않는다(외부 파일 없음). 씨앗이 같으면 늘 같은 울림이다.
 *
 * 울림: 잘게 흩어진 잡음이 지수로 사그라지고(RT60), 높은 소리가 먼저 어두워진다(저녁 공기처럼 둥근 꼬리).
 * 딱딱한 초기 반사(한 샘플짜리 탭)는 넣지 않는다 — 짧은 소리에 금속성 떨림을 만든다.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RoomOptions {
  /** 임펄스 길이(초) */
  seconds?: number
  /** 60 dB 줄어드는 데 걸리는 시간(초) */
  rt60?: number
  /** 직접음과 울림 사이(초) */
  preDelay?: number
  /** 울림 첫머리·끝의 밝기(저역 통과 Hz) */
  brightHz?: number
  darkHz?: number
  seed?: number
}

/** 스테레오 방 울림 임펄스(좌우는 서로 다른 잡음이라 넓게 퍼진다) */
export function roomImpulse(sampleRate: number, o: RoomOptions = {}): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const seconds = o.seconds ?? 2.0
  const rt60 = o.rt60 ?? 1.8
  const pre = Math.floor((o.preDelay ?? 0.016) * sampleRate)
  const bright = o.brightHz ?? 6500
  const dark = o.darkHz ?? 1100
  const n = Math.floor(sampleRate * seconds)
  const out: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(n), new Float32Array(n)]
  for (let c = 0; c < 2; c++) {
    const rnd = mulberry32((o.seed ?? 11) * 7919 + c * 104729)
    const d = out[c]
    let y1 = 0
    let y2 = 0
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sampleRate
      // 첫 40 ms에 조금 더 촘촘한 울림 + 긴 꼬리. 시작은 8 ms에 걸쳐 둥글게 올라온다.
      const env = (0.55 * Math.exp(-t / 0.04) + Math.exp((-6.91 * t) / rt60)) * (1 - Math.exp(-t / 0.008))
      const fc = dark + (bright - dark) * Math.exp(-t / (rt60 * 0.3))
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sampleRate)
      const x = (rnd() * 2 - 1) * env
      y1 += a * (x - y1)
      y2 += a * (y1 - y2)
      d[i] = y2
    }
    // 끝 30 ms는 0으로 모은다(잘린 꼬리의 딸깍 방지)
    const fade = Math.floor(0.03 * sampleRate)
    for (let k = 0; k < fade; k++) d[n - 1 - k] *= k / fade
  }
  return out
}

/** 분홍 잡음(높은 소리가 옥타브마다 3 dB씩 약하다 — 흰 잡음보다 부드러운 바람) */
export function pinkNoise(sampleRate: number, seconds = 2, seed = 5): Float32Array<ArrayBuffer> {
  const n = Math.floor(sampleRate * seconds)
  const out = new Float32Array(n)
  const rnd = mulberry32(seed)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  // 이어 붙여 돌려도(loop) 이음매가 튀지 않게 양 끝을 겹쳐 섞는다
  const x = Math.floor(0.05 * sampleRate)
  for (let k = 0; k < x; k++) {
    const g = k / x
    out[k] = out[k] * g + out[n - x + k] * (1 - g)
  }
  return out.subarray(0, n - x).slice()
}
