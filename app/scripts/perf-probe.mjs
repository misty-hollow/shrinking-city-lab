/**
 * 전시 성능 점검(사람 보조, CI 밖). 운영 빌드(vite preview)를 실제 브라우저로 열어 잰다.
 *
 *   1. npm run build && npx vite preview --port 5198 --strictPort --host 127.0.0.1
 *   2. npm i --no-save playwright-core@1.63.0
 *   3. node scripts/perf-probe.mjs                 # 이 PC의 GPU + 저사양 흉내(CPU 4배 느리게, 소프트웨어 GL)
 *      PERF_PROFILES=gpu PERF_HEADED=1 node scripts/perf-probe.mjs   # 전시 기기에서: 실제 창·실제 화면으로 한 번
 *
 * 재는 것(설계안 6-12 5항: 통합 GPU 1080p 60fps, 첫 상호작용 5초):
 *   - 첫 화면 조작 가능까지(탐색 시작 → S0 제목·시작 버튼) · 무대 준비 표시(scl-stage-ready)
 *   - S0 회전 무대 6초, S4 조작 뒤 빛이 번지는 3초, 위에서 보기 카메라 이동 동안의 프레임 간격(가운데값·95%·20 ms 넘는 비율)
 *   - 조작 → 결과 숫자가 뜰 때까지(계산은 즉시, 표시는 빛을 따른다)
 *   - 긴 작업(50 ms 넘는 메인 스레드 작업) 수·최대, JS 힙, 내려받은 바이트, 적응 화질이 낮춘 픽셀 비율
 * headless 창의 프레임은 실제 모니터 vsync와 다를 수 있다 — 전시 기기에서는 PERF_HEADED=1로 다시 잰다.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5198/?kiosk=0'
const CHANNEL = process.env.QA_BROWSER_CHANNEL ?? 'msedge'
const HEADED = process.env.PERF_HEADED === '1'
const W = Number(process.env.PERF_WIDTH ?? 1920)
const H = Number(process.env.PERF_HEIGHT ?? 1080)
const OUT = new URL('../qa-shots/perf/', import.meta.url)

const PROFILES = {
  gpu: { args: ['--use-angle=d3d11', '--enable-webgl'], cpu: 1, note: '이 PC의 GPU' },
  'gpu-cpu4x': { args: ['--use-angle=d3d11', '--enable-webgl'], cpu: 4, note: '이 PC의 GPU + CPU 4배 느리게(저사양 CPU 흉내)' },
  swiftshader: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'], cpu: 1, note: '소프트웨어 GL(가장 약한 GPU 하한)' },
  'swiftshader-cpu2x': { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'], cpu: 2, note: '소프트웨어 GL + CPU 2배 느리게' },
}
const pick = (process.env.PERF_PROFILES ?? Object.keys(PROFILES).join(',')).split(',')

const RECORDER = () => {
  const w = window
  w.__perf = {
    long: [],
    frames(ms) {
      return new Promise((resolve) => {
        const gaps = []
        let last = performance.now()
        const end = last + ms
        const tick = (t) => {
          gaps.push(t - last)
          last = t
          if (t < end) requestAnimationFrame(tick)
          else resolve(gaps)
        }
        requestAnimationFrame(tick)
      })
    },
  }
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__perf.long.push(e.duration)
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    /* longtask 미지원 */
  }
}

function stats(gaps) {
  const g = gaps.slice(1).sort((a, b) => a - b)
  if (!g.length) return null
  const q = (p) => g[Math.min(g.length - 1, Math.floor(p * g.length))]
  const mean = g.reduce((a, b) => a + b, 0) / g.length
  return {
    frames: g.length,
    fps: +(1000 / mean).toFixed(1),
    median_ms: +q(0.5).toFixed(1),
    p95_ms: +q(0.95).toFixed(1),
    max_ms: +g[g.length - 1].toFixed(1),
    over20ms_pct: +((g.filter((x) => x > 20).length / g.length) * 100).toFixed(1),
  }
}

const dpr = (page) => page.evaluate(() => {
  const c = document.querySelector('canvas')
  return c ? +(c.width / c.clientWidth).toFixed(2) : null
})

async function toPlay(page) {
  await page.getByRole('button', { name: '시작', exact: true }).click()
  for (let k = 0; k < 3; k++) {
    await page.waitForSelector('.corner-card')
    await page.locator('.corner-card').getByRole('button', { name: '다음' }).click()
  }
  await page.waitForSelector('.marker.is-live')
  await page.locator('.corner-card').getByRole('button', { name: '다음' }).click()
  await page.getByRole('radio', { name: '10분' }).click()
  await page.getByRole('radio', { name: '15분' }).click()
  await page.locator('.corner-card').getByRole('button', { name: '다음' }).click()
  await page.getByRole('button', { name: '의당 진료일 하루 빼기' }).click()
  await page.getByRole('button', { name: '신풍 진료일 하루 더하기' }).click()
  await page.getByRole('button', { name: '미션 시작' }).click()
  await page.waitForSelector('#s3-title')
  await page.getByRole('button', { name: '배분 시작' }).click()
  await page.waitForSelector('.mission-card')
  await page.waitForTimeout(1500)
}

async function probe(name) {
  const p = PROFILES[name]
  const browser = await chromium.launch({ channel: CHANNEL, headless: !HEADED, args: p.args })
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript(RECORDER)
  if (p.cpu > 1) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu })
  }
  const t0 = Date.now()
  await page.goto(BASE)
  await page.getByRole('button', { name: '시작', exact: true }).waitFor({ timeout: 60000 })
  const firstInteractiveMs = Date.now() - t0
  const load = await page.evaluate(() => {
    const ready = performance.getEntriesByName('scl-stage-ready')[0]
    const res = performance.getEntriesByType('resource')
    const nav = performance.getEntriesByType('navigation')[0]
    const bytes = res.reduce((a, r) => a + (r.encodedBodySize || 0), 0) + (nav?.encodedBodySize ?? 0)
    const gl = document.createElement('canvas').getContext('webgl2')
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      stage_ready_ms: ready ? Math.round(ready.startTime) : null,
      dom_content_loaded_ms: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      downloaded_kb: Math.round(bytes / 1024),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl ? 'webgl2' : 'no webgl2',
    }
  })
  const dpr0 = await dpr(page)
  // S0는 계속 그린다(회전 무대). 적응 화질은 느린 프레임 90개를 모아야 한 칸 내려가므로 20초를 재고 앞·뒤 6초를 나눠 본다.
  const s0gaps = await page.evaluate(() => window.__perf.frames(20000))
  const cut = (from, to) => {
    let t = 0
    return s0gaps.filter((g) => ((t += g), t >= from && t < to))
  }
  const s0 = stats(cut(0, 6000))
  const s0late = stats(cut(14000, 20000))
  const dprS0 = await dpr(page)

  await toPlay(page)
  const longBefore = await page.evaluate(() => window.__perf.long.length)
  // 조작 순간부터 3초: 빛이 번지는 동안의 프레임(기록을 먼저 켜고 누른다)
  await page.evaluate(() => (window.__perf.playGaps = window.__perf.frames(3000)))
  const ta = Date.now()
  await page.locator('.marker[data-j="3"] .mk-bubble').click()
  await page.waitForSelector('.marker[data-j="3"] .marker-pop', { timeout: 10000 })
  const resultShownMs = Date.now() - ta
  const play = stats(await page.evaluate(() => window.__perf.playGaps))
  await page.getByRole('button', { name: '위에서 보기' }).click()
  const top = stats(await page.evaluate(() => window.__perf.frames(1500)))
  await page.getByRole('button', { name: '비스듬히 보기' }).click()
  await page.waitForTimeout(800)
  const tail = await page.evaluate((n) => {
    const l = window.__perf.long
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null
    return { longtasks_total: l.length, longtasks_in_play: l.length - n, longtask_max_ms: l.length ? Math.round(Math.max(...l)) : 0, js_heap_mb: heap }
  }, longBefore)
  const dprEnd = await dpr(page)
  await page.screenshot({ path: new URL(`${name}-s4.png`, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1') })
  await browser.close()
  return {
    profile: name,
    note: p.note,
    viewport: `${W}x${H}`,
    headed: HEADED,
    first_interactive_ms: firstInteractiveMs,
    ...load,
    s0_rotating_first6s: s0,
    s0_rotating_last6s: s0late,
    s4_after_click: play,
    s4_to_top_view: top,
    click_to_result_ms: resultShownMs,
    pixel_ratio: { start: dpr0, after_s0: dprS0, end: dprEnd },
    ...tail,
    errors: errors.slice(0, 5),
  }
}

mkdirSync(OUT, { recursive: true })
const out = []
for (const name of pick) {
  const r = await probe(name)
  out.push(r)
  console.log(JSON.stringify(r))
}
writeFileSync(new URL('perf.json', OUT), JSON.stringify(out, null, 1))
