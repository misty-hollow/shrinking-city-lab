/**
 * Shrinking City Lab 소리 청취 파일 — 실제 앱의 소리 엔진(src/audio)을 실제 빛의 계획(실제 행렬)으로
 * 브라우저에서 오프라인 렌더링해 WAV로 남긴다. 사람이 게임을 하지 않고도 모든 소리를 차례로 들어 볼 수 있다.
 *
 * 무엇을 만드나: qa-shots/sound/now/*.wav(48 kHz 16비트 스테레오) + qa-shots/sound/index.html(듣기 표).
 *   qa-shots/sound/before/에 같은 이름의 WAV가 있으면 표에 나란히 놓는다(비교용, 수동으로 넣는다).
 *   각 파일의 최고 레벨(dBFS)도 표에 적는다. 음량은 정규화하지 않는다(앱에서 나는 크기 그대로).
 * 무엇을 못 보나: 좋고 싫음·피로도는 사람이 듣고 판단한다. 스피커·방에 따라 다르게 들린다.
 *
 * 실행
 *   1. cd app && npx vite --port 5199 --strictPort --host 127.0.0.1
 *   2. npm i --no-save playwright-core@1.63.0     (프로젝트 의존성에 넣지 않는다)
 *   3. node scripts/sound-audition.mjs              (QA_BASE_URL, QA_BROWSER_CHANNEL 환경변수)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5199/?kiosk=0'
const CHANNEL = process.env.QA_BROWSER_CHANNEL ?? 'msedge'
const ROOT = new URL('../qa-shots/sound/', import.meta.url)
const NOW = new URL('now/', ROOT)
mkdirSync(NOW, { recursive: true })
const path = (u) => decodeURIComponent(u.pathname.replace(/^\/([A-Za-z]:)/, '$1'))

const browser = await chromium.launch({ channel: CHANNEL, headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE)
await page.waitForSelector('.center-card h1', { timeout: 30000 })

const renders = await page.evaluate(async () => {
  const { loadAppData } = await import('/src/data/load.ts')
  const { buildModel, computeKpis } = await import('/src/engine/kpi.ts')
  const { planOp, planThreshold, EMBER_MS } = await import('/src/stage/lightPlan.ts')
  const { lightCues, briefingCues } = await import('/src/audio/cues.ts')
  const { renderCues } = await import('/src/audio/sound.ts')
  const { BRIEF_EMBER_MS, BRIEF_STEP_MS } = await import('/src/screens/Cards.tsx')
  const data = await loadAppData('./data/')
  const sc = data.scenario
  const model = buildModel(sc)
  // 화면 좌우 위치의 근사(전체 보기는 북쪽 위라 동서 좌표가 곧 화면 좌우다)
  const xs = sc.villages.map((v) => v.x)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const half = (Math.max(...xs) - Math.min(...xs)) / 2
  const panX = (x) => Math.max(-1, Math.min(1, (x - cx) / half))
  const villagePan = (i) => panX(sc.villages[i].x)
  const J = Object.fromEntries(sc.facilities.map((f, j) => [f.id, j]))
  const cur = sc.current_allocation.slice()

  let seq = 1
  function op(alloc, j, dir, T, reduced = false) {
    const after = alloc.slice()
    after[j] += dir
    const b = computeKpis(model, alloc, T).villageDays
    const a = computeKpis(model, after, T).villageDays
    const plan = planOp(model, seq++, j, dir, T, b, a, reduced)
    const level = Math.max(0, Math.ceil((dir > 0 ? after : alloc)[j]) - 1)
    return { cues: lightCues(plan, { level, clinicPan: panX(sc.facilities[j].x), villagePan }), after }
  }
  function thr(alloc, from, to) {
    const b = computeKpis(model, alloc, from).villageDays
    const a = computeKpis(model, alloc, to).villageDays
    const plan = planThreshold(model, seq++, from, to, alloc, b, a, false)
    return lightCues(plan, { level: 0, clinicPan: 0, villagePan })
  }
  const one = (cues) => [{ at: 0, cues, group: 'light' }]

  const cases = []
  const add = (id, label, events) => cases.push({ id, label, events })
  add('01-ember', '+1 불씨가 풀을 떠날 때(지소에 닿기 전까지)', one([{ name: 'ember', at: 0, pan: -0.4, dur: EMBER_MS }]))
  add('02-chamber-steps', '등칸이 켜질 때 — 1~5칸', [0, 1, 2, 3, 4].map((k) => ({ at: k * 900, cues: [{ name: 'chamber', step: k }] })))
  const p1 = op(cur, J.yugu, 1, 15)
  add('03-plus-yugu', '+1 유구(0→1일): 불씨 → 점등 → 빛 번짐 → 마을 도착', one(p1.cues))
  const p2 = op(cur, J.useong, 1, 15)
  add('04-plus-usung', '+1 우성(0→1일)', one(p2.cues))
  add('05-minus-yugu', '−1 유구(1→0일): 등칸이 꺼지고 빛이 거둬진다', one(op(p1.after, J.yugu, -1, 15).cues))
  add('06-t-15-20', '기준 15 → 20분', one(thr(cur, 15, 20)))
  add('07-t-15-10', '기준 15 → 10분', one(thr(cur, 15, 10)))
  add('08-goal', '목표 달성', one([{ name: 'goal' }]))
  add('09-deny-x3', '막힌 조작 세 번(0.26초 간격)', [0, 260, 520].map((at) => ({ at, cues: [{ name: 'deny' }] })))
  add('10-confirm', '확정', one([{ name: 'confirm' }]))
  add('11-select-x3', '지소 고르기 세 번', [0, 400, 800].map((at) => ({ at, cues: [{ name: 'select' }] })))
  const landed = Array.from({ length: 10 }, (_, q) => BRIEF_EMBER_MS + q * BRIEF_STEP_MS)
  const assumed = Array.from({ length: 5 }, (_, q) => BRIEF_EMBER_MS + 10 * BRIEF_STEP_MS + 260 + q * 130)
  add('12-briefing', '미션 1 브리핑: 실제 10일이 풀에 앉고 가정 5일이 더해진다', [{ at: 0, cues: briefingCues(landed, assumed), group: 'brief' }])
  // 빨리 누르기: 우성 0→5를 0.22초 간격으로(습관화 + 앞 조작의 남은 음 거두기)
  let alloc = cur.slice()
  const rapid = []
  for (let k = 0; k < 5; k++) {
    const r = op(alloc, J.useong, 1, 15)
    rapid.push({ at: k * 220, cues: r.cues, group: 'light' })
    alloc = r.after
  }
  add('13-rapid-plus-usung-x5', '빨리 누르기: 우성 +1 다섯 번(0.22초 간격)', rapid)
  alloc = cur.slice()
  const rapidMinus = []
  for (let k = 0; k < 4; k++) {
    const r = op(alloc, J.uidang, -1, 15)
    rapidMinus.push({ at: k * 260, cues: r.cues, group: 'light' })
    alloc = r.after
  }
  add('14-rapid-minus-x4', '빨리 빼기: 의당 −1 네 번(0.26초 간격)', rapidMinus)
  add('15-sound-on', '소리 켜기', one([{ name: 'soundOn' }]))
  add('16-reduced-plus', '움직임 줄이기에서 +1 유구(모든 시각 0)', one(op(cur, J.yugu, 1, 15, true).cues))
  // 한 판의 한 토막(약 14초): 사람 속도로 더하고 빼고, 기준을 바꾸고, 막히고, 목표를 이루고 확정
  alloc = cur.slice()
  const session = []
  let t = 0
  const push = (cues, dt, group = 'light') => {
    session.push({ at: t, cues, group })
    t += dt
  }
  for (const [j, dir, dt] of [
    [J.yugu, 1, 1300],
    [J.useong, 1, 1100],
    [J.useong, 1, 900],
    [J.sinpung, -1, 1200],
    [J.banpo, 1, 1400],
  ]) {
    const r = op(alloc, j, dir, 15)
    push(r.cues, dt)
    alloc = r.after
  }
  push(thr(alloc, 15, 20), 1300)
  push(thr(alloc, 20, 15), 1300)
  push([{ name: 'select' }], 700, undefined)
  push([{ name: 'deny' }], 500, undefined)
  push([{ name: 'deny' }], 900, undefined)
  const r = op(alloc, J.tancheon, 1, 15)
  push(r.cues, 1200)
  push([{ name: 'goal' }], 2000, undefined)
  push([{ name: 'confirm' }], 0, undefined)
  add('17-session', '한 판의 한 토막(약 14초): 더하기·빼기·기준 변경·막힘·목표 달성·확정', session)

  const b64 = (f32) => {
    const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength)
    let s = ''
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
    return btoa(s)
  }
  const out = []
  for (const c of cases) {
    const last = c.events.reduce((m, e) => Math.max(m, e.at + e.cues.reduce((k, q) => Math.max(k, (q.at ?? 0) + (q.dur ?? 0)), 0)), 0)
    const buf = await renderCues(c.events, last / 1000 + 3.4)
    out.push({ id: c.id, label: c.label, sr: buf.sampleRate, L: b64(buf.getChannelData(0)), R: b64(buf.getChannelData(1)) })
  }
  return out
})

function wav(L, R, sr) {
  const n = L.length
  const b = Buffer.alloc(44 + n * 4)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 4, 4)
  b.write('WAVE', 8)
  b.write('fmt ', 12)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(2, 22)
  b.writeUInt32LE(sr, 24)
  b.writeUInt32LE(sr * 4, 28)
  b.writeUInt16LE(4, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4)
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4)
  }
  return b
}

const rows = []
for (const r of renders) {
  const L = new Float32Array(Buffer.from(r.L, 'base64').buffer.slice(0))
  const R = new Float32Array(Buffer.from(r.R, 'base64').buffer.slice(0))
  let peak = 0
  let bad = 0
  for (let i = 0; i < L.length; i++) {
    if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) bad++
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  }
  writeFileSync(path(new URL(`${r.id}.wav`, NOW)), wav(L, R, r.sr))
  const dbfs = 20 * Math.log10(peak + 1e-12)
  rows.push({ ...r, peak: dbfs, bad, before: existsSync(path(new URL(`before/${r.id}.wav`, ROOT))) })
  console.log(`${r.id.padEnd(26)} peak ${dbfs.toFixed(1).padStart(6)} dBFS${bad ? `  NaN ${bad}` : ''}  ${r.label}`)
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const hasBefore = rows.some((r) => r.before)
writeFileSync(
  path(new URL('index.html', ROOT)),
  `<!doctype html><meta charset="utf-8"><title>소리 청취 — Shrinking City Lab</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;background:#14171b;color:#e8e2d6;margin:0;padding:24px 16px}
h1{font-size:20px;margin:0 0 4px}p{color:#a9a294;margin:0 0 18px;max-width:70ch}
table{border-collapse:collapse;width:100%;max-width:1100px}td,th{padding:8px 10px;border-bottom:1px solid #2a2e34;text-align:left;vertical-align:middle}
th{font-size:12px;color:#a9a294;font-weight:600;letter-spacing:.04em}audio{width:260px;height:32px}.num{font-variant-numeric:tabular-nums;color:#a9a294;font-size:13px}
</style>
<h1>소리 청취 표</h1>
<p>실제 앱의 소리 엔진을 실제 빛의 계획으로 렌더링한 파일입니다(음량 정규화 없음 — 앱에서 나는 크기 그대로). 같은 스피커·같은 볼륨으로 차례로 들어 보세요.</p>
<table><thead><tr><th>장면</th><th>지금</th><th class="num">최고</th>${hasBefore ? '<th>이전(v0.4 첫 소리)</th>' : ''}</tr></thead><tbody>
${rows
  .map(
    (r) =>
      `<tr><td>${esc(r.label)}<div class="num">${r.id}</div></td><td><audio controls preload="none" src="now/${r.id}.wav"></audio></td><td class="num">${r.peak.toFixed(1)} dBFS</td>${
        hasBefore ? `<td>${r.before ? `<audio controls preload="none" src="before/${r.id}.wav"></audio>` : ''}</td>` : ''
      }</tr>`,
  )
  .join('\n')}
</tbody></table>`,
)
if (errors.length) console.log('page errors:', errors.join(' | '))
console.log(`→ ${path(new URL('index.html', ROOT))}`)
await browser.close()
