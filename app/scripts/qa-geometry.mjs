/**
 * 브라우저 QA의 DOM 기하 검사(browser-qa.mjs가 부른다). 스크린샷을 사람이 보기 전에 잡을 수 있는 배치 문제만 잰다.
 *
 * 1. HUD 판과 세계 라벨 겹침: 무대가 피하는 판(`[data-occlude]`, UI_DESIGN_SYSTEM §8.1 슬롯)과 세계에 붙은 HTML 라벨
 *    (지소 말풍선 머리·미리보기 판·결과 판, 잃은 마을 표지, 마을 이름·도로망 시간 태그)이 화면에서 겹치지 않는다.
 *    HUD는 배경 없이 씬 위에 바로 쓰므로, 라벨이 그 위에 그려지면 글자를 가린다. 지형에 새긴 읍·면 이름(캔버스)은 재지 못한다.
 *    가운데 위 소식 한 줄(`.toast`)도 HUD 판과 겹치거나 시트 밑에 잘리지 않고, 지소 말풍선 머리·미리보기·결과 판·잃은 마을 표지를
 *    가리지 않는다(소식은 3.2초만 떠 있어 그때 보이는 것만 잰다 — 하네스가 기준을 바꾼 직후에 부른다).
 * 2. 세계 라벨이 화면 가장자리에서 잘리지 않는다: 보이는 라벨은 화면 안에 다 들어온다(화면 밖으로 나간 말풍선만 숨긴다, §8.2).
 *    무대는 전체 시점을 벗어나면 HUD 판 뒤나 화면 끝에 걸린 말풍선을 흐려 숨긴다(`.anchor.is-occluded`). 전체 시점(`overview`)에서는
 *    흐린 말풍선이 없어야 하고, 겹침 검사가 시점 맞춤(섬과 말풍선 머리가 HUD를 피해 놓이는지)을 잰다.
 * 3. 판 안 가로 잘림: 판·시트(`[data-occlude]`, `.data-sheet`, `.mobile`) 안에서 가로로 스크롤되거나 넘친 내용이 잘리는 요소가 없다.
 *    말줄임(text-overflow: ellipsis)과 화면 낭독 전용 글(.sr-only)은 의도된 것이라 뺀다.
 */

/** 이 픽셀 이하로 겹치거나 넘치는 것은 반올림·테두리로 보고 넘긴다 */
const TOL = 1

/**
 * @param {import('playwright-core').Page} page
 * @param {string} label 검사 이름 앞머리(예: `1440x900 S4`)
 * @param {(cond: boolean, name: string, detail?: string) => void} check
 * @param {{ overview?: boolean }} [opts] overview: 카메라가 전체 시점(가까이 보기 전)일 때
 */
export async function layoutGeometry(page, label, check, opts = {}) {
  const g = await page.evaluate((tol) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const seen = (el) => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return null
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null
      return r
    }
    const name = (el) => {
      const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : el.tagName.toLowerCase()
      const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)
      return text ? `${cls}「${text}」` : cls
    }
    const box = (r) => `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`

    // 1·2. 세계 라벨
    const hud = []
    for (const el of document.querySelectorAll('[data-occlude]')) {
      const r = seen(el)
      if (r) hud.push({ el, r })
    }
    const worldSel = '.stage-anchors .mk-head, .stage-anchors .mk-preview, .stage-anchors .marker-pop, .stage-anchors .vpin > span, .stage-labels .stage-label'
    const overlaps = []
    const edges = []
    for (const el of document.querySelectorAll(worldSel)) {
      const r = seen(el)
      if (!r) continue
      for (const h of hud) {
        const w = Math.min(r.right, h.r.right) - Math.max(r.left, h.r.left)
        const ht = Math.min(r.bottom, h.r.bottom) - Math.max(r.top, h.r.top)
        if (w > tol && ht > tol) overlaps.push(`${name(el)} ${box(r)} ↔ ${name(h.el)} ${box(h.r)}`)
      }
      if (r.left < -tol || r.top < -tol || r.right > vw + tol || r.bottom > vh + tol) edges.push(`${name(el)} ${box(r)}`)
    }

    const toasts = []
    const toastOver = []
    const bubbles = []
    for (const el of document.querySelectorAll('.stage-anchors .mk-head, .stage-anchors .mk-preview, .stage-anchors .marker-pop, .stage-anchors .vpin > span')) {
      const r = seen(el)
      if (r) bubbles.push({ el, r })
    }
    for (const el of document.querySelectorAll('.toasts .toast')) {
      const r = seen(el)
      if (!r) continue
      for (const b of bubbles) {
        const w = Math.min(r.right, b.r.right) - Math.max(r.left, b.r.left)
        const ht = Math.min(r.bottom, b.r.bottom) - Math.max(r.top, b.r.top)
        if (w > tol && ht > tol) toastOver.push(`${name(el)} ${box(r)} ↔ ${name(b.el)} ${box(b.r)}`)
      }
      for (const h of hud) {
        const w = Math.min(r.right, h.r.right) - Math.max(r.left, h.r.left)
        const ht = Math.min(r.bottom, h.r.bottom) - Math.max(r.top, h.r.top)
        if (w > tol && ht > tol) toasts.push(`${name(el)} ${box(r)} ↔ ${name(h.el)} ${box(h.r)}`)
      }
      if (r.left < -tol || r.right > vw + tol) toasts.push(`${name(el)} ${box(r)} 화면 밖`)
    }

    // 3. 판 안 가로 잘림
    const clips = []
    const roots = new Set([...document.querySelectorAll('[data-occlude], .data-sheet, .mobile')])
    const checked = new Set()
    for (const root of roots) {
      if (!seen(root)) continue
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (checked.has(el)) continue
        checked.add(el)
        if (el.closest('.sr-only')) continue
        const cs = getComputedStyle(el)
        if (cs.overflowX === 'visible' || cs.textOverflow === 'ellipsis') continue
        if (el.clientWidth <= 1 || !seen(el)) continue
        const over = el.scrollWidth - el.clientWidth
        if (over > tol) clips.push(`${name(el)} 내용 ${el.scrollWidth} > 보이는 폭 ${el.clientWidth}`)
      }
    }
    const occluded = [...document.querySelectorAll('.stage-anchors .anchor.is-occluded')].map((el) => name(el.firstElementChild ?? el))
    return { overlaps, toasts, toastOver, edges, clips, occluded }
  }, TOL)
  check(g.overlaps.length === 0, `${label}: HUD 판과 세계 라벨(말풍선·결과 판·표지·마을 이름) 겹침 없음`, g.overlaps.slice(0, 4).join(' | '))
  check(g.toasts.length === 0, `${label}: 소식 한 줄이 HUD 판과 겹치지 않음`, g.toasts.slice(0, 4).join(' | '))
  check(g.toastOver.length === 0, `${label}: 소식 한 줄이 말풍선·결과 판·표지를 가리지 않음`, g.toastOver.slice(0, 4).join(' | '))
  check(g.edges.length === 0, `${label}: 보이는 세계 라벨이 화면 가장자리에서 잘리지 않음`, g.edges.slice(0, 4).join(' | '))
  check(g.clips.length === 0, `${label}: 판 안 가로 잘림 없음`, g.clips.slice(0, 4).join(' | '))
  if (opts.overview) check(g.occluded.length === 0, `${label}: 전체 시점에서 HUD 판·화면 끝에 걸려 숨긴 말풍선·표지 없음`, g.occluded.slice(0, 4).join(' | '))
}
