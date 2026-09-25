/**
 * Shrinking City Lab 브라우저 QA — 실제 앱을 실제 브라우저(Edge)로 처음부터 끝까지 한 판 돌린다.
 *
 * 무엇을 보나: S0 → S1(3장) → S2(3단계) → S3 → S4(키보드로 15일 배분) → S5 → S8
 *   → 미션 2(S3·S4·S5, 목표 경계 미달/달성, 10·20분에서도 15분 판정, 다시 배분) → 미션 3(같은 검사)
 *   → S6 세 개의 공주(세 결과·15일 분해·크게 보기·돌아오기), 건너뛰기만 한 판(참고 배분 칩), 콘솔 오류,
 *   KPI가 조작마다 바뀌는지, 풀 제한(0~5·총량), 확정 버튼 활성 조건, 1024·1440 폭 레이아웃 넘침.
 *   v0.4(설계안 6-16): 지표가 빛을 따라 오르는지(조작 직후엔 이전 값, 빛이 다 닿으면 새 값), 라이브 문장은 즉시,
 *   불씨·소식 한 줄, 도크 서→동 순서, 기준일 칩 상시 표시, 소리 끄기(버튼·저장), 무대 성능 창(개발 서버에서만).
 *   소리(개발 서버에서만): 첫 입력 전 무음, 오프라인 렌더로 최고 레벨 상한·빨리 누르기·앞 조작의 남은 음 거두기, 끈 채 시작하면 무예약.
 *   v0.5(설계안 6-17 「세계가 먼저」): 지소 말풍선으로 놓기·빼기(키보드·클릭·− 손잡이), 놓기 전 미리보기 숫자 = 놓은 뒤 결과,
 *   되돌리기(↶, 미리보기 포함), 위에서 보기(같은 원근 세계), 막힌 조작 피드백, 결산 감상(건너뛰기)·세계 위 결과 글·잃은 마을 표지,
 *   S6 세계 탭(미션 고르기 · 6개 지표 한 표) ↔ 세 배분 나란히 보기.
 *   목표 경계 배분은 파이썬 전처리가 만든 golden.json(boundary_*)에서 읽는다.
 * 무엇을 못 보나: 사람의 이해도·시각 품질 판단(스크린샷을 사람이 본다), 통합 GPU 전시 기기 성능.
 *
 * 실행
 *   1. cd app && npx vite --port 5199 --strictPort --host 127.0.0.1
 *   2. npm i --no-save playwright-core@1.63.0     (프로젝트 의존성에 넣지 않는다)
 *   3. npm run qa:browser                          (QA_BASE_URL, QA_BROWSER_CHANNEL 환경변수)
 *   결과: qa-shots/*.png, qa-shots/report.json (.gitignore)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:5199/?kiosk=0'
const CHANNEL = process.env.QA_BROWSER_CHANNEL ?? 'msedge'
const OUT = new URL('../qa-shots/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const golden = JSON.parse(readFileSync(new URL('../public/data/golden.json', import.meta.url), 'utf-8'))
const boundary = (name) => golden.cases.find((c) => c.name === name && c.threshold_min === 15).x

const results = []
const pass = (name, detail = '') => results.push({ status: 'PASS', name, detail })
const fail = (name, detail = '') => results.push({ status: 'FAIL', name, detail })
const check = (cond, name, detail = '') => (cond ? pass(name, detail) : fail(name, detail))

async function shot(page, name) {
  await page.waitForTimeout(350)
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname.replace(/^\/([A-Za-z]:)/, '$1') })
}

async function kpiText(page) {
  return page.locator('.kpi-grid').innerText()
}

async function gameState(page) {
  return JSON.parse(await page.getByTestId('game-state').textContent())
}

/** 빛이 다 닿을 때까지(무대·지표 표시가 조작 결과에 도착할 때까지) 기다린다. 계산은 이미 끝나 있다. */
async function settle(page) {
  await page.waitForFunction(() => performance.now() > Number(document.querySelector('[data-testid="light-until"]')?.textContent ?? 0) + 80, null, {
    timeout: 6000,
  })
}

/** 시나리오 순서 j의 지소 카드(도크는 서쪽→동쪽이라 화면 순서와 다르다) */
const row = (page, j) => page.locator(`.fac-row[data-j="${j}"]`)

/** 키보드로 지소 행을 골라 배분을 from → to로 바꾼다(빼기 먼저, 풀을 비운 뒤 더하기). */
async function setAlloc(page, from, to) {
  for (const phase of ['-', '+']) {
    for (let j = 0; j < to.length; j++) {
      const d = to[j] - from[j]
      const n = phase === '-' ? Math.max(0, -d) : Math.max(0, d)
      if (n === 0) continue
      await row(page, j).focus()
      for (let k = 0; k < n; k++) await page.keyboard.press(phase)
    }
  }
  await settle(page)
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** 확정 뒤: 감상(HUD 없이 섬을 돈다)을 건너뛰고 세계 위 결과 글을 기다린다 */
async function toSummary(page) {
  const skip = page.locator('.appreciate-skip')
  if (await skip.count()) await skip.click()
  await page.waitForSelector('.world-result')
}

async function openDetails(page) {
  await page.getByRole('button', { name: '결과 자세히 · 배분 지형도' }).click()
  await page.waitForSelector('.panel .verdict')
}

async function closeDetails(page) {
  await page.locator('.panel').getByRole('button', { name: '결과 자세히 닫기' }).click()
  await page.waitForSelector('.world-result')
}
const BANNED = ['최적', '최선', '추천', '정답', '가장 좋은 배분', '1등', '점수', '순위', '늘려야', '이동시간']

/** S6 세 개의 공주: 세 결과 · 15일 분해 · 금지어 없음 · hover · 크게 보기(키보드) · 돌아오기 */
async function finaleChecks(page, tag, full, allocs) {
  await page.waitForSelector('#s6-title')
  await page.waitForTimeout(600)
  // 같은 세계 위에서 미션을 고른다(설계안 6-17): 탭 셋 · 6개 지표 한 표 · 고정 문장
  const tabs = page.getByRole('tab')
  check((await tabs.count()) === 3 && (await tabs.nth(0).getAttribute('aria-selected')) === 'true', `${tag} S6 세계: 미션 탭 셋, 미션 1부터`)
  const wf = await page.locator('.wf-table').innerText()
  check((await page.locator('.wf-kpis tbody tr').count()) === 6 && (await page.locator('.wf-kpis td.is-goal').count()) === 3, `${tag} S6 세계: 6개 지표 × 세 배분, 목표 칸 셋`)
  check(wf.includes('실제 10일 + 가정 5일 = 15일 기준') && /진료가 닿지 않는 마을은 \d+ · \d+ · \d+곳이에요/.test(wf), `${tag} S6 세계: 15일 분해 · 고정 문장`)
  const worldText = (await page.locator('.wf-top').innerText()) + wf + (await page.locator('.wf-end').innerText())
  const badW = BANNED.filter((w) => worldText.includes(w))
  check(badW.length === 0, `${tag} S6 세계: 순위·점수·정답·추천 표현 없음`, badW.join(','))
  const m1Marks = await page.locator('.marker').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-j')), e.querySelectorAll('.mk-slot.on').length]))
  const m1Days = Object.fromEntries(m1Marks)
  check(allocs[0].every((v, j) => m1Days[j] === Math.floor(v)), `${tag} S6 세계: 말풍선 칸 = 미션 1 확정 배분`, JSON.stringify(m1Marks))
  await tabs.nth(1).click()
  await page.waitForTimeout(300)
  const m2Days = Object.fromEntries(await page.locator('.marker').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-j')), e.querySelectorAll('.mk-slot.on').length])))
  check(allocs[1].every((v, j) => m2Days[j] === Math.floor(v)), `${tag} S6 세계: 미션 2 탭 → 말풍선 칸 = 미션 2 배분`)
  if (full) await shot(page, `${tag}-s6-world`)
  await noHorizontalOverflow(page, `${tag} S6 세계`)
  check(await page.getByRole('radio', { name: '10분' }).isDisabled(), `${tag} S6: 기준 스위치 잠김(15분 결과)`)
  await page.getByRole('button', { name: '세 배분 나란히 보기' }).click()
  await page.waitForSelector('.finale-board')
  await page.waitForTimeout(400)
  const board = await page.locator('.finale-board').innerText()
  const panel = await page.locator('.panel').innerText()
  check((await page.locator('.finale-col').count()) === 3 && (await page.locator('.finale-col svg.minimap').count()) === 3, `${tag} S6: 세 배분 · 위에서 본 지도 세 장`)
  const chips = await page.locator('.finale-col .finale-chip').allInnerTexts()
  check(chips.length === 3 && chips.every((c) => /^(달성|미달) · 상위 \d+%$/.test(c)), `${tag} S6: 세 열 모두 플레이한 결과`, chips.join(' | '))
  const strips = await page.locator('.alloc-strip').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  const nums = strips.map((s) => [...s.matchAll(/ (\d)(?:,|$)/g)].map((x) => Number(x[1])))
  check(same(nums, allocs), `${tag} S6: 각 열 배분 = 그 미션 확정 배분`, JSON.stringify(nums))
  check(board.includes('세 배분 모두 같은 주 15일을 나눴지만') && board.includes('실제 10일 + 가정 5일 = 15일 기준'), `${tag} S6: 같은 15일 · 분해 문장(무대)`)
  check(panel.includes('주 15일 = 실제 10일 + 가정 5일') && panel.includes('지금 실제로 운영하는 주 10일과는 다른 가상 배분'), `${tag} S6: 15일 분해 · 현재 실제와 구분(패널)`)
  check((await page.locator('.panel .badge-REAL_DATA, .panel .badge-DERIVED, .panel .badge-SIMULATION_ASSUMPTION').count()) >= 3, `${tag} S6: 실제 자료·계산값·게임 가정 배지`)
  check(/진료가 닿지 않는 마을은 \d+ · \d+ · \d+곳이에요/.test(panel) && panel.includes('같은 자원이라도 목표에 따라 좋은 배분이 달라요'), `${tag} S6: 데이터 문장 · 마지막 문장`)
  const goals = await page.locator('.finale-col .finale-fact.is-goal dt').allInnerTexts()
  check(goals.length === 3 && goals[0].includes('평균 진료일') && goals[1].includes('가장 불리한 읍·면') && goals[2].includes('주 3일 이상'), `${tag} S6: 열마다 자기 목표만 표시`, goals.join(' | '))
  const bad = BANNED.filter((w) => (board + panel).includes(w))
  check(bad.length === 0, `${tag} S6: 순위·점수·정답·추천 표현 없음`, bad.join(','))
  await noHorizontalOverflow(page, `${tag} S6`)
  if (full) await shot(page, `${tag}-s6-three`)
  await page.locator('.finale-col').nth(0).hover()
  check((await page.locator('.finale-col.is-dim').count()) === 2 && (await page.locator('.finale-table th.is-hover').count()) >= 1, `${tag} S6: hover한 열만 선명(표 열도 강조)`)
  if (full) {
    await page.locator('.panel').evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await shot(page, `${tag}-s6-panel-end`)
    await page.locator('.panel').evaluate((el) => el.scrollTo(0, 0))
  }
  // 크게 보기(키보드) → 같은 세계의 그 미션 탭 + 증감 기준
  await page.getByRole('button', { name: '어디에도 빈 곳이 없게 배분을 무대에서 크게 보기' }).focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('.wf-top')
  const top = await page.locator('.wf-top').innerText()
  check(
    (await page.locator('.finale-board').count()) === 0 && top.includes('2 · 어디에도 빈 곳이 없게') && (await page.getByRole('tab', { selected: true }).innerText()).includes('어디에도') && (await page.locator('.legend').count()) === 1,
    `${tag} S6: 크게 보기 = 세계의 미션 2 탭(범례 · 증감)`,
  )
  await page.getByRole('radio', { name: '미션 1 (15일)' }).click()
  check((await page.getByRole('radio', { name: '미션 1 (15일)' }).getAttribute('aria-checked')) === 'true' && (await page.getByRole('radio', { name: '미션 2 (15일)' }).count()) === 0, `${tag} S6: 증감 기준을 다른 미션으로(자기 자신은 없음)`)
  if (full) await shot(page, `${tag}-s6-focus`)
  await page.getByRole('button', { name: '세 배분 나란히 보기' }).click()
  await page.waitForSelector('.finale-board')
  const focused = await page.evaluate(() => document.activeElement?.id)
  check(focused === 'finale-open-m2', `${tag} S6: 나란히 보기로 돌아오면 그 열로 포커스`, focused)
  await page.keyboard.press('Escape')
  await page.waitForSelector('.wf-top')
  check((await page.locator('.finale-board').count()) === 0, `${tag} S6: Esc로 세계로 돌아가기`)
  await page.getByRole('button', { name: '세 배분 나란히 보기' }).click()
  await page.locator('.finale-col').nth(2).click()
  await page.waitForSelector('.wf-top')
  check((await page.getByRole('tab', { selected: true }).innerText()).includes('두껍게'), `${tag} S6: 열을 누르면 그 미션 탭`)
}

async function panelTop(page) {
  // 플레이 HUD는 스크롤하지 않는다(보고서 종이만 스크롤).
  if ((await page.locator('.panel').count()) === 0) return
  await page.locator('.panel').evaluate((el) => el.scrollTo(0, 0))
}

/** 미션 2·3 한 판: 브리핑 → 목표 바로 아래(미달) → 10·20분 → 목표(달성) → 확정 → 디브리핑 */
async function missionRound(page, tag, full, m) {
  const n = m === 'm2' ? 2 : 3
  const title = m === 'm2' ? '미션 2 · 어디에도 빈 곳이 없게' : '미션 3 · 두껍게 닿게'
  await page.waitForSelector('#s3-title')
  const brief = await page.locator('.center-card').innerText()
  check(brief.includes(title), `${tag} S3 M${n}: 제목`, brief.slice(0, 80))
  check(brief.includes('실제 10일 + 가정 5일') && brief.includes('가상 정책실험') && brief.includes('게임 가정') && brief.includes('실제 자료'), `${tag} S3 M${n}: 15일 분해·두 배지·가정 설명`)
  check((await page.locator('.center-card .pool-anim').count()) === 0 && (await page.locator('.center-card .pool-cells i.assumed').count()) === 5, `${tag} S3 M${n}: 풀 연출 없이 실선 10 + 점선 5`)
  check(brief.includes('앞 미션의 배분은 그대로 보관돼요'), `${tag} S3 M${n}: 결과 보관 안내`)
  if (full) await shot(page, `${tag}-s3-m${n}-briefing`)
  await page.getByRole('button', { name: '배분 시작' }).click()
  await page.waitForSelector('.mission-card')
  const confirm = page.getByRole('button', { name: '이 배분으로 확정' })
  check(await confirm.isDisabled(), `${tag} S4 M${n}: 빈 풀로 시작, 확정 비활성`)
  check((await page.getByTestId('pool-remaining').textContent()) === '15', `${tag} S4 M${n}: 풀 15일`)

  const below = boundary(`boundary_${m}_below`)
  const at = boundary(`boundary_${m}_at`)
  await setAlloc(page, new Array(10).fill(0), below)
  check((await page.getByTestId('pool-remaining').textContent()) === '0', `${tag} S4 M${n}: 경계 아래 배분 15일`)
  await panelTop(page)
  let mc = await page.locator('.mission-card').innerText()
  check(!mc.includes('목표 달성') && mc.includes('목표까지'), `${tag} S4 M${n}: 목표 바로 아래 → 미달`, mc.replace(/\n/g, ' ').slice(0, 160))
  if (m === 'm2') {
    check(mc.includes('주 0.99일'), `${tag} S4 M2: 반올림하면 1.0이지만 미달 → 두 자리`, mc.replace(/\n/g, ' ').slice(0, 120))
    check(/목표보다 낮은 읍·면 \d+곳/.test(mc) && /읍·면 격차 주 [\d.]+일/.test(mc), `${tag} S4 M2: 최악 지역·격차가 미션 카드 중심`)
    check((await page.locator('.emd-strip-col').count()) === 10, `${tag} S4 M2: 읍·면 10곳 막대`)
    const labels = ((await page.locator('.stage-labels').getAttribute('data-emd-values')) ?? '').split(' | ')
    check(labels.some((t) => /주 [\d.]+일/.test(t)), `${tag} S4 M2: 무대 읍·면 이름 아래에 평균 진료일`, labels.slice(0, 3).join(' | '))
  } else {
    check(mc.includes('주 3일 이상') && mc.includes('주 1~2일') && mc.includes('닿지 않음'), `${tag} S4 M3: 진료 두께 막대`)
    const labels = ((await page.locator('.stage-labels').getAttribute('data-emd-values')) ?? '').split(' | ')
    check(labels.some((t) => /3일 이상 \d+%/.test(t)), `${tag} S4 M3: 무대 읍·면 이름 아래에 두께 비율`, labels.slice(0, 3).join(' | '))
  }
  check(mc.includes(`직전 확정 배분(미션 ${n - 1})과 비교하며 보기`), `${tag} S4 M${n}: 앞 미션과 비교 버튼`)
  // 기준을 20분으로 바꿔도 15분 판정(경계 아래는 20분이면 넘는 배분이다)
  await page.getByRole('radio', { name: '20분' }).click()
  await settle(page)
  mc = await page.locator('.mission-card').innerText()
  check(!mc.includes('목표 달성') && mc.includes('미션 판정은 15분 기준이에요'), `${tag} S4 M${n}: 20분에서도 15분 판정(미달 유지)`)
  await page.getByRole('radio', { name: '15분' }).click()
  await settle(page)

  await setAlloc(page, below, at)
  check((await page.getByTestId('pool-remaining').textContent()) === '0', `${tag} S4 M${n}: 경계 배분 15일`)
  await panelTop(page)
  mc = await page.locator('.mission-card').innerText()
  check(/목표 달성 · 가능한 배분 중 상위 \d+%/.test(mc), `${tag} S4 M${n}: 목표 충족 → 달성`, mc.replace(/\n/g, ' ').slice(0, 160))
  // 10분으로 바꿔도 달성 유지(경계 배분은 10분이면 못 미친다)
  await page.getByRole('radio', { name: '10분' }).click()
  await settle(page)
  mc = await page.locator('.mission-card').innerText()
  check(mc.includes('목표 달성') && mc.includes('미션 판정은 15분 기준이에요'), `${tag} S4 M${n}: 10분에서도 15분 판정(달성 유지)`)
  await page.getByRole('radio', { name: '15분' }).click()
  await settle(page)
  // 지소당 5일·총량 15일
  await row(page, at.findIndex((v) => v < 5)).focus()
  await page.keyboard.press('+')
  check((await page.getByTestId('pool-remaining').textContent()) === '0', `${tag} S4 M${n}: 풀 0이면 더 놓을 수 없다(총량 15일)`)
  // 세계 위 6개 지표 표: 미션 지표 행은 굵게 + 왼쪽 크림 선(태그는 [지표 자세히] Sheet의 한 행에만, UI_DESIGN_SYSTEM §9.2)
  const goal = await page.locator('.kpi-list .kpi.is-goal').innerText()
  check((await page.locator('.kpi-list .kpi.is-goal').count()) === 1 && goal.includes(m === 'm2' ? '가장 불리한 읍·면' : '주 3일 이상 닿는 주민'), `${tag} S4 M${n}: 목표 지표 행 표시`)
  // 앞 미션과 비교하며 보기 → 기준선 직전 확정 배분 + 증감
  await page.getByRole('button', { name: `직전 확정 배분(미션 ${n - 1})과 비교하며 보기` }).click()
  check(
    (await page.locator('.kpi-list .delta-legend').innerText()).includes(`미션 ${n - 1} 배분 대비`) && (await page.getByRole('button', { name: '증감 보기 켬' }).count()) === 1,
    `${tag} S4 M${n}: 앞 미션 비교(기준선·증감)`,
  )
  if (full) await shot(page, `${tag}-s4-m${n}-play`)
  await page.getByRole('button', { name: '현재 실제와 비교로 돌아가기' }).click()
  await noHorizontalOverflow(page, `${tag} S4 M${n}`)
  await confirm.click()
  await toSummary(page)
  const wr = await page.locator('.world-result').innerText()
  check(wr.includes(title) && wr.includes('달성 · 가능한 배분 중 상위') && (await page.locator('.wr-row').count()) === 6, `${tag} S5 M${n}: 세계 위 결과 글(판정 · 6개 지표)`)
  if (m === 'm2') check((await page.getByRole('button', { name: '다음 미션' }).count()) === 1, `${tag} S5 M2: [다음 미션]`)
  else check((await page.getByRole('button', { name: '세 개의 공주 보기' }).count()) === 1, `${tag} S5 M3: [세 개의 공주 보기]`)
  await openDetails(page)
  const deb = await page.locator('.panel').innerText()
  check(deb.includes(title) && deb.includes('달성 · 가능한 배분 중 상위'), `${tag} S5 M${n}: 판정`)
  check(deb.includes('5일이 늘어난 효과도 섞여') && deb.includes('실제 10일') && deb.includes('가정 5일'), `${tag} S5 M${n}: 15일 기준 문장·배지`)
  check(deb.includes(`미션 ${n - 1} 배분과 비교 · 둘 다 15일`) && /좋아진 마을 \d+곳, 나빠진 마을 \d+곳/.test(deb), `${tag} S5 M${n}: 앞 미션과 15일 대 15일 비교`)
  check(deb.includes('다른 미션 결과 (15일)'), `${tag} S5 M${n}: 배분 지형도에 다른 미션 ●`)
  if (m === 'm2') check(deb.includes('참고 배분 · 두꺼운 서비스형') && deb.includes('민간 의원, 다른 시군의 시설은 모델에 없어요'), `${tag} S5 M2: 다른 목표(M3 참고)·한계 5번`)
  else check(!deb.includes('다른 목표였다면') && deb.includes('진료일은 게임용 단위예요'), `${tag} S5 M3: 다른 목표 없음·한계 3번`)
  check(await page.getByRole('radio', { name: '10분' }).isDisabled(), `${tag} S5 M${n}: 결과 화면에서 기준 스위치 잠김`)
  await page.getByRole('button', { name: `무대에서 미션 ${n - 1} 배분과 비교` }).click()
  check((await page.getByRole('button', { name: '무대 비교 끄기' }).count()) === 1 && (await page.getByRole('button', { name: '참고 배분 보기' }).count()) === (m === 'm2' ? 1 : 0), `${tag} S5 M${n}: 무대 비교 켬(참고 탑은 꺼짐)`)
  if (full) {
    await shot(page, `${tag}-s5-m${n}-debrief`)
    await page.locator('.compare-block').scrollIntoViewIfNeeded()
    await shot(page, `${tag}-s5-m${n}-compare`)
  }
  await noHorizontalOverflow(page, `${tag} S5 M${n}`)
  await closeDetails(page)
  return at
}

async function noHorizontalOverflow(page, label) {
  const o = await page.evaluate(() => {
    const out = []
    const vw = window.innerWidth
    for (const el of document.querySelectorAll(
      '.panel *, .hud-left *, .corner-tools *, .hand *, .finish *, .corner-bl > *, .details *, .world-result *, .wf-top *, .wf-table *, .wf-end *, .toasts *',
    )) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) out.push(`${el.className || el.tagName} ${Math.round(r.left)}..${Math.round(r.right)}`)
    }
    const panel = document.querySelector('.panel')
    const pscroll = panel ? panel.scrollWidth - panel.clientWidth : 0
    return { out: out.slice(0, 5), pscroll }
  })
  check(o.out.length === 0 && o.pscroll <= 1, `${label}: 가로 넘침 없음`, JSON.stringify(o))
}

async function run(width, height, full, reducedMotion = 'no-preference') {
  const browser = await chromium.launch({ channel: CHANNEL, headless: true, args: ['--use-angle=d3d11', '--enable-webgl'] })
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion })
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  const tag = `${width}x${height}`
  await page.goto(BASE)
  await page.waitForSelector('.center-card h1', { timeout: 30000 })
  await page.waitForTimeout(1500)
  check(await page.locator('canvas').count() === 1, `${tag} S0: WebGL 무대 canvas`)
  check((await page.locator('.center-card').innerText()).includes('정책을 추천하지 않아요'), `${tag} S0: 한계 한 줄`)
  const snd = page.locator('.sound-toggle')
  check((await snd.count()) === 1 && (await snd.getAttribute('aria-pressed')) !== null, `${tag} S0: 소리 켬/끔 버튼(aria-pressed)`, await snd.getAttribute('aria-label'))
  // 자동재생 규칙: 첫 사용자 입력 전에는 오디오 문맥을 만들지 않는다(개발 서버의 검사용 창으로 본다)
  const snd00 = await page.evaluate(() => (window.__sclSound ? window.__sclSound.debug() : null))
  if (snd00) check(snd00.state === 'none' && snd00.played === 0, `${tag} S0: 첫 입력 전에는 오디오를 열지 않는다`, JSON.stringify(snd00))
  await shot(page, `${tag}-s0-start`)

  await page.getByRole('button', { name: '시작', exact: true }).click()
  for (let k = 0; k < 3; k++) {
    await page.waitForSelector('.corner-card')
    if (full) await shot(page, `${tag}-s1-intro-${k + 1}`)
    const text = await page.locator('.corner-card').innerText()
    if (k === 0) check(text.includes('40,204명') && text.includes('2026-08-31'), `${tag} S1-1: 인구·기준일(manifest)`, text)
    if (k === 1) check(text.includes('2026-04-13') && text.includes('4곳'), `${tag} S1-2: 일정 기준일`, text)
    await page.locator('.corner-card').getByRole('button', { name: '다음' }).click()
  }

  // S2 튜토리얼
  await page.waitForSelector('.marker.is-live')
  check((await page.locator('.corner-card').innerText()).includes('불이 꺼진'), `${tag} S2-1: 범례 코치(집·창의 불)`)
  await page.locator('.corner-card').getByRole('button', { name: '다음' }).click()
  const nextBtn = page.locator('.corner-card').getByRole('button', { name: '다음' })
  check(await nextBtn.isDisabled(), `${tag} S2-2: 기준을 바꾸기 전 [다음] 비활성`)
  const kpi15 = await kpiText(page)
  await page.getByRole('radio', { name: '10분' }).click()
  await settle(page)
  const kpi10 = await kpiText(page)
  check(kpi10 !== kpi15, `${tag} S2-2: 10분으로 바꾸자 지표 변화`)
  const tried = await page.locator('.corner-card').innerText()
  check(/명에서 .*명으로 바뀌었어요/.test(tried), `${tag} S2-2: 실제 계산 문장`, tried)
  if (full) await shot(page, `${tag}-s2-threshold-10`)
  check(await nextBtn.isDisabled(), `${tag} S2-2: 15분으로 돌려놓기 전 [다음] 비활성`)
  await page.getByRole('radio', { name: '15분' }).click()
  await settle(page)
  check(!(await nextBtn.isDisabled()), `${tag} S2-2: 15분 복귀 후 [다음] 활성`)
  await nextBtn.click()
  // 3단계: 의당 − 후 신풍 +
  await page.getByRole('button', { name: '의당 진료일 하루 빼기' }).click()
  await page.getByRole('button', { name: '신풍 진료일 하루 더하기' }).click()
  const res = await page.locator('.corner-card').innerText()
  check(/신풍에 하루를 놓/.test(res) && /의당 쪽 \d+개 마을/.test(res), `${tag} S2-3: 결과 문장(실제 계산)`, res)
  if (full) await shot(page, `${tag}-s2-moved`)
  await page.getByRole('button', { name: '미션 시작' }).click()

  // S3 브리핑
  await page.waitForSelector('#s3-title')
  const brief = await page.locator('.center-card').innerText()
  check(brief.includes('실제 10일 + 가정 5일') && brief.includes('가상 정책실험') && brief.includes('뜻은 아니에요'), `${tag} S3: 15일 분해·가정 설명`)
  check(brief.includes('게임 가정') && brief.includes('실제 자료'), `${tag} S3: 두 배지`)
  await shot(page, `${tag}-s3-briefing`)
  await page.getByRole('button', { name: '배분 시작' }).click()

  // S4 플레이: 키보드만으로 배분
  await page.waitForSelector('.mission-card')
  const confirm = page.getByRole('button', { name: '이 배분으로 확정' })
  check(await confirm.isDisabled(), `${tag} S4: 풀이 남으면 확정 비활성`)
  const order = await page.locator('.fac-row').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-j'))))
  check(same(order, [0, 9, 8, 2, 7, 1, 6, 5, 3, 4]), `${tag} S4: 말풍선 Tab 순서는 서쪽→동쪽(유구 … 반포)`, JSON.stringify(order))
  if (width >= 1280) check(await page.locator('.corner-bl .data-chip').isVisible(), `${tag} S4: 기준일 칩이 늘 보인다(왼쪽 아래)`)
  check((await page.locator('.hand').innerText()).includes('실제 10') && (await page.locator('.hand').innerText()).includes('가정 5'), `${tag} S4: 손 = 남은 15일(실제 10 · 가정 5 배지)`)
  // 놓기 전 미리보기(가리키기): 숫자 하나와 한 줄. 놓은 뒤 떠오르는 결과 숫자와 같아야 한다.
  await page.locator('.marker[data-j="3"] .mk-bubble').hover()
  await page.waitForSelector('.marker[data-j="3"] .mk-preview')
  const pv = await page.locator('.marker[data-j="3"] .mk-preview').innerText()
  const pvBig = await page.locator('.marker[data-j="3"] .mk-preview .pv-main b').innerText()
  check(/^\+[\d,]+명$/.test(pvBig) && pv.includes('계룡에 1일 놓으면') && pv.includes('새로 닿아요') && pv.includes('계룡 주 0일 → 1일'), `${tag} S4: 놓기 전 미리보기(계룡 +1, 점선 판)`, pv.replace(/\n/g, ' '))
  check((await page.locator('.marker[data-j="3"].is-preview').count()) === 1, `${tag} S4: 미리보는 말풍선은 판이 뒤집힌다(선택 상태)`)
  await page.locator('.marker[data-j="3"] .mk-bubble').click()
  await settle(page)
  const pop = await page.locator('.marker[data-j="3"] .marker-pop').innerText()
  check(pop.split('\n')[0] === pvBig && pop.includes('계룡 +1일'), `${tag} S4: 미리보기 숫자 = 놓은 뒤 결과`, `${pvBig} / ${pop.replace(/\n/g, ' ')}`)
  // 되돌리기: 가리키면 거꾸로 미리보기(−), 누르면 같은 순서를 거꾸로
  await page.getByRole('button', { name: '되돌리기' }).hover()
  await page.waitForSelector('.marker[data-j="3"] .mk-preview')
  const upv = await page.locator('.marker[data-j="3"] .mk-preview').innerText()
  const upvBig = await page.locator('.marker[data-j="3"] .mk-preview .pv-main b').innerText()
  check(/^−[\d,]+명$/.test(upvBig) && upv.includes('닿지 않게 돼요') && upv.includes('Ctrl Z'), `${tag} S4: 되돌리기 미리보기(−)`, upv.replace(/\n/g, ' '))
  await page.getByRole('button', { name: '되돌리기' }).click()
  await settle(page)
  check(
    (await page.getByTestId('pool-remaining').textContent()) === '15' && (await row(page, 3).innerText()).includes('미운영') && (await page.getByRole('button', { name: '되돌리기' }).isDisabled()),
    `${tag} S4: 되돌리기 — 15일로 돌아오고 되돌릴 것이 없어진다`,
  )
  await page.mouse.move(8, height / 2)
  // 위에서 보기: 같은 원근 세계(말풍선이 그대로 선다)
  await page.getByRole('button', { name: '위에서 보기' }).click()
  await page.waitForTimeout(900)
  const vis = await page.locator('.marker').evaluateAll((els) => els.filter((e) => e.closest('.anchor')?.style.visibility !== 'hidden').length)
  check((await page.getByRole('button', { name: '비스듬히 보기' }).getAttribute('aria-pressed')) === 'true' && vis === 10, `${tag} S4: 위에서 보기(말풍선 10개가 그대로)`, String(vis))
  if (full) await shot(page, `${tag}-s4-top`)
  await page.getByRole('button', { name: '비스듬히 보기' }).click()
  await page.waitForTimeout(700)
  const kBefore = await kpiText(page)
  await row(page, 0).focus()
  await page.keyboard.press('+')
  const kImmediate = await kpiText(page)
  const ember = await page.locator('.ember').count()
  // 라이브 문장은 useEffect로 다음 프레임에 들어온다: 빛(약 1초)이 끝나기 한참 전(0.3초 안)이면 "즉시"다.
  await page.waitForFunction(() => /^유구 /.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: 300 }).catch(() => {})
  const live = await page.locator('[role=status]').innerText()
  check(/유구 주 1일\. 평균 진료일 주 [\d.]+일\. 닿지 않는 주민 [\d,]+명\./.test(live), `${tag} S4: 라이브 문장은 조작 즉시(정확한 값)`, live)
  await settle(page)
  const kAfter = await kpiText(page)
  check(kBefore !== kAfter, `${tag} S4: 키보드 + 한 번에 KPI 갱신(빛이 다 닿은 뒤 최종값)`)
  if (reducedMotion === 'reduce') check(ember === 0, `${tag} S4: 움직임 줄이기 — 불씨 없이 바로`)
  else {
    check(kImmediate === kBefore, `${tag} S4: 숫자보다 땅이 먼저 — 조작 직후 지표는 아직 이전 값`)
    check(ember > 0, `${tag} S4: 풀에서 지소로 불씨가 난다`, String(ember))
  }
  // 소리: 첫 입력(시작 누름)에서 오디오가 열리고, 조작마다 소리를 예약한다(개발 서버의 검사용 창으로 센다). 끄기 상태면 0.
  const snd0 = await page.evaluate(() => (window.__sclSound ? window.__sclSound.debug() : null))
  if (snd0) check(snd0.state === 'running' && snd0.played > 0, `${tag} S4: 소리 — 오디오가 열리고 조작마다 소리를 예약`, JSON.stringify(snd0))
  // 소리의 세기와 되풀이(설계안 6-16 소리): 실제 엔진을 같은 그래프로 오프라인 렌더링해 잰다(개발 서버에서만)
  if (snd0 && full) {
    const lv = await page.evaluate(async () => {
      const s = window.__sclSound
      const peakOf = (b) => {
        let p = 0
        let bad = 0
        for (let c = 0; c < b.numberOfChannels; c++) {
          const d = b.getChannelData(c)
          for (let i = 0; i < d.length; i++) {
            const v = Math.abs(d[i])
            if (!Number.isFinite(v)) bad++
            else if (v > p) p = v
          }
        }
        return { db: Math.round(20 * Math.log10(p + 1e-12) * 10) / 10, bad }
      }
      const energyAfter = (b, t) => {
        const d = b.getChannelData(0)
        let e = 0
        for (let i = Math.floor(t * b.sampleRate); i < d.length; i++) e += d[i] * d[i]
        return e
      }
      const op = [
        { name: 'ember', at: 0, dur: 380 },
        { name: 'chamber', at: 380, step: 2 },
        { name: 'spread', at: 380, dur: 570 },
        ...[480, 620, 760, 900].map((at, q) => ({ name: 'arrive', at, step: 2 + q })),
      ]
      const one = peakOf(await s.render([{ at: 0, cues: op, group: 'light' }], 3.2))
      const burst = peakOf(await s.render(Array.from({ length: 6 }, (_, k) => ({ at: k * 150, cues: op, group: 'light' })), 4.2))
      const goal = peakOf(await s.render([{ at: 0, cues: [{ name: 'goal' }] }], 3.2))
      const late = [{ name: 'arrive', at: 900, step: 3 }]
      const kept = energyAfter(await s.render([{ at: 0, cues: late, group: 'light' }], 2.6), 0.85)
      const cut = energyAfter(await s.render([{ at: 0, cues: late, group: 'light' }, { at: 100, cues: [], group: 'light' }], 2.6), 0.85)
      return { one, burst, goal, kept, cut }
    })
    check(lv.one.bad === 0 && lv.burst.bad === 0 && lv.one.db < -14 && lv.goal.db < -14, `${tag} 소리: 한 조작·목표 달성의 최고 레벨 −14 dBFS 아래(낮은 음량, 깨짐 없음)`, JSON.stringify({ one: lv.one, goal: lv.goal }))
    check(lv.burst.db <= lv.one.db + 3, `${tag} 소리: 0.15초 간격으로 여섯 번 눌러도 한 번보다 3 dB 넘게 커지지 않는다(습관화·거두기)`, JSON.stringify({ one: lv.one.db, burst: lv.burst.db }))
    check(lv.kept > 0 && lv.cut < lv.kept * 1e-4, `${tag} 소리: 새 조작이 앞 조작의 아직 울리지 않은 마을 음을 거둔다`, JSON.stringify({ kept: lv.kept, cut: lv.cut }))
  }
  const toast = await page.locator('.marker[data-j="0"] .marker-pop').allInnerTexts()
  check(toast.some((t) => /유구 \+1일 · /.test(t)), `${tag} S4: 빛이 다 닿으면 말풍선 위로 결과 숫자`, toast.join(' | '))
  for (let n = 0; n < 7; n++) await page.keyboard.press('ArrowRight')
  await settle(page)
  check((await row(page, 0).innerText()).includes('주 5일'), `${tag} S4: 지소당 최대 5일`)
  await page.keyboard.press('+')
  check((await page.locator('.marker[data-j="0"].is-denied').count()) === 1 && (await page.locator('.marker[data-j="0"] .mk-slot.on').count()) === 5, `${tag} S4: 5일에서 더 누르면 막힘(말풍선이 고개를 젓는다)`)
  // 계룡 5, 우성 5 → 총 15
  for (const idx of [3, 7]) {
    await row(page, idx).focus()
    for (let n = 0; n < 5; n++) await page.keyboard.press('+')
  }
  await settle(page)
  const left = await page.getByTestId('pool-remaining').textContent()
  check(left === '0', `${tag} S4: 총량 15일 모두 배분`, left)
  await row(page, 1).focus()
  await page.keyboard.press('+')
  check((await row(page, 1).innerText()).includes('미운영'), `${tag} S4: 풀 0이면 더 놓을 수 없다`)
  check(!(await confirm.isDisabled()), `${tag} S4: 풀 0에서 확정 활성`)
  const mc = await page.locator('.mission-card').innerText()
  check(/목표 달성 · 가능한 배분 중 상위 \d+%/.test(mc), `${tag} S4: 목표 달성 표시`, mc)
  // 증감 보기
  await page.getByRole('button', { name: '증감 보기 끔' }).click()
  const deltaText = await page.locator('.kpi-grid').innerText()
  check(deltaText.includes('좋아짐') || deltaText.includes('나빠짐'), `${tag} S4: 증감이 글자로도 읽힌다(색만 아님)`)
  await page.getByRole('radio', { name: '20분' }).click()
  check((await page.locator('.mission-card').innerText()).includes('미션 판정은 15분 기준이에요'), `${tag} S4: 기준 변경 시 판정 칩`)
  await page.getByRole('radio', { name: '15분' }).click()
  await settle(page)
  await noHorizontalOverflow(page, `${tag} S4`)
  // 읍·면 목록(지표 자세히) → 행 클릭 → 지역 카드
  await page.locator('.hud-links').getByRole('button', { name: '지표 자세히', exact: true }).click()
  await page.locator('.emd-row').first().click()
  await page.waitForSelector('.region-card')
  check((await page.locator('.region-card').innerText()).includes('65세 이상'), `${tag} S4: 지역 카드`)
  await shot(page, `${tag}-s4-play`)
  await page.locator('.region-card').getByRole('button', { name: '닫기', exact: true }).click()
  await page.locator('.hud-links').getByRole('button', { name: '지표 자세히 닫기' }).click()

  await confirm.click()
  if (reducedMotion === 'reduce') check((await page.locator('.world-result').count()) === 1, `${tag} S5: 움직임 줄이기 — 감상 없이 바로 결과 글`)
  else {
    await page.waitForSelector('.appreciate-skip')
    check((await page.locator('.world-result').count()) === 0 && (await page.locator('.hud-left').count()) === 0, `${tag} S5: 확정하면 HUD 없이 섬을 잠시 본다(감상)`)
    if (full) await shot(page, `${tag}-s5-appreciate`)
  }
  await toSummary(page)
  const wr = await page.locator('.world-result').innerText()
  check(/달성 · 가능한 배분 중 상위 \d+%/.test(wr) && (await page.locator('.wr-row').count()) === 6 && wr.includes('5일이 늘어난 효과도 섞여'), `${tag} S5 세계: 판정 · 6개 지표 · 15일 기준 문장`, wr.slice(0, 120))
  const lostLine = await page.locator('.wr-lost').innerText()
  const pins = await page.locator('.vpin').count()
  check(lostLine.includes('닿지 않게 된 마을') ? pins >= 1 && pins <= 3 : pins === 0, `${tag} S5 세계: 잃은 마을은 세계 속 표지(많아야 셋)`, `${lostLine.replace(/\n/g, ' ')} · 표지 ${pins}`)
  await shot(page, `${tag}-s5-world`)
  await openDetails(page)
  const deb = await page.locator('.panel').innerText()
  check(deb.includes('5일이 늘어난 효과도 섞여'), `${tag} S5: 15일 기준·5일 효과 혼합 문장`)
  check(deb.includes('잃은 것') && deb.includes('얻은 것'), `${tag} S5: 얻은 것/잃은 것`)
  check(deb.includes('현재 실제 (10일)') && deb.includes('내 배분 (15일)'), `${tag} S5: 표 열 이름`)
  check(deb.includes('우열 없는 배분'), `${tag} S5: 배분 지형도`)
  check(deb.includes('참고 배분 · 보장형'), `${tag} S5: 다른 목표였다면`)
  check(deb.includes('실제 개인의 이동시간'), `${tag} S5: 한계 문장(2번)`)
  await shot(page, `${tag}-s5-debrief`)
  await page.locator('.panel').evaluate((el) => el.scrollTo(0, el.scrollHeight / 2))
  await shot(page, `${tag}-s5-debrief-2`)
  await noHorizontalOverflow(page, `${tag} S5`)

  await page.getByRole('button', { name: '자료와 한계' }).first().click()
  await page.waitForSelector('#s8-title')
  const s8 = await page.locator('.data-sheet').innerText()
  check(s8.includes('2026-08-31') && s8.includes('2026-04-13') && s8.includes('2026-09-10'), `${tag} S8: 세 기준일(manifest)`)
  check((s8.match(/\n/g) ?? []).length > 20 && s8.includes('미션의 진료일 15일 중 5일은'), `${tag} S8: 한계 9문장`)
  if (full) await shot(page, `${tag}-s8-data`)
  await page.keyboard.press('Escape')
  check((await page.locator('#s8-title').count()) === 0 && (await page.locator('.verdict').count()) === 1, `${tag} S8: 닫아도 상태 유지`)

  // 미션 2 → (다시 배분) → 미션 3 → S6
  const m1Alloc = (await gameState(page)).results.m1.alloc
  await closeDetails(page)
  await page.getByRole('button', { name: '다음 미션' }).click()
  const m2At = await missionRound(page, tag, full, 'm2')
  await page.getByRole('button', { name: '다시 배분' }).click()
  await page.waitForSelector('.mission-card')
  const from = m2At.findIndex((v) => v >= 1)
  const to = m2At.findIndex((v, j) => v < 5 && j !== from)
  const m2b = m2At.map((v, j) => (j === from ? v - 1 : j === to ? v + 1 : v))
  await setAlloc(page, m2At, m2b)
  await page.getByRole('button', { name: '이 배분으로 확정' }).click()
  await toSummary(page)
  let st = await gameState(page)
  check(
    same(st.results.m1.alloc, m1Alloc) && st.results.m1.attempt === 1 && st.results.m2.attempt === 2 && same(st.results.m2.alloc, m2b) && !st.results.m3,
    `${tag} 다시 배분: 미션 2 결과만 갱신(미션 1 그대로)`,
    JSON.stringify(st.results),
  )
  await page.getByRole('button', { name: '다음 미션' }).click()
  const m3At = await missionRound(page, tag, full, 'm3')
  await page.getByRole('button', { name: '세 개의 공주 보기' }).click()
  await finaleChecks(page, tag, full, [m1Alloc, m2b, m3At])
  st = await gameState(page)
  check(st.screen === 'finale' && same(st.results.m1.alloc, m1Alloc) && same(st.results.m2.alloc, m2b) && same(st.results.m3.alloc, m3At), `${tag} S6 뒤에도 세 결과 보존`)

  // 성능: 조작 한 번 재계산 시간
  const ms = await page.evaluate(async () => {
    const t0 = performance.now()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return performance.now() - t0
  })
  pass(`${tag} 프레임 2개 왕복`, `${ms.toFixed(1)}ms (headless 참고값)`)
  // 무대 성능 창(개발 서버에서만 있다): 한 장면을 그리고 GPU가 끝날 때까지의 시간
  const bench = await page.evaluate(() => {
    const st = window.__sclStage
    if (!st) return null
    const info = st.info()
    return { gpuFrameMs: +st.bench(30).toFixed(2), calls: info.calls, triangles: info.triangles }
  })
  if (bench) check(bench.gpuFrameMs < 16, `${tag} 무대 한 장면 GPU 시간 < 16ms(이 PC)`, JSON.stringify(bench))
  check(errors.length === 0, `${tag} 콘솔 오류 없음`, errors.slice(0, 5).join(' | '))
  await browser.close()
}

async function extras() {
  const browser = await chromium.launch({ channel: CHANNEL, headless: true })
  // <768: 플레이 대신 안내 한 화면(설계안 5-10)
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await m.goto(BASE)
  await m.waitForSelector('.mobile')
  const mt = await m.locator('.mobile').innerText()
  check(mt.includes('데스크톱 화면에서 플레이') && (await m.locator('canvas').count()) === 0, '390x844 모바일 안내 화면(3D 없음)')
  await m.getByRole('button', { name: '자료와 한계' }).click()
  check((await m.locator('#s8-title').count()) === 1, '390x844 모바일에서도 자료와 한계')
  await shot(m, '390x844-mobile')
  // 소리 끄기는 이 브라우저에 남는다(자동재생 전에는 소리가 나지 않고, 끈 선택은 새로고침 뒤에도 그대로).
  const sp = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await sp.goto(BASE)
  await sp.waitForSelector('.center-card h1')
  const t1 = sp.locator('.sound-toggle')
  const before = await t1.getAttribute('aria-pressed')
  await t1.click()
  const after = await t1.getAttribute('aria-pressed')
  await sp.reload()
  await sp.waitForSelector('.center-card h1')
  const persisted = await sp.locator('.sound-toggle').getAttribute('aria-pressed')
  check(before === 'true' && after === 'false' && persisted === 'false', '1280x800 소리 끄기: 버튼으로 끄고 새로고침 뒤에도 꺼져 있다', `${before}→${after}→${persisted}`)
  const mutedDbg = await sp.evaluate(() => (window.__sclSound ? window.__sclSound.debug() : null))
  if (mutedDbg) {
    await sp.getByRole('button', { name: '시작', exact: true }).click()
    await sp.waitForSelector('.corner-card')
    const d = await sp.evaluate(() => window.__sclSound.debug())
    check(d.muted === true && d.played === 0, '1280x800 소리 끄기: 꺼 둔 채로 시작하면 아무 소리도 예약하지 않는다', JSON.stringify(d))
    await sp.goto(BASE)
    await sp.waitForSelector('.center-card h1')
  }
  await sp.locator('.sound-toggle').click()
  // 90초 무입력 → 처음으로(전시 모드 기본 켬). 가짜 시계로 앞당긴다.
  const k = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await k.clock.install()
  await k.goto(BASE.replace('kiosk=0', 'kiosk=1'))
  await k.waitForSelector('.center-card h1')
  await k.getByRole('button', { name: '시작', exact: true }).click()
  await k.waitForSelector('.corner-card')
  await k.clock.fastForward(60_000)
  check((await k.locator('.corner-card').count()) === 1, '1280x800 60초 무입력: 아직 그 화면')
  await k.clock.fastForward(31_000)
  await k.waitForSelector('#s0-title', { timeout: 5000 }).catch(() => {})
  check((await k.locator('#s0-title').count()) === 1, '1280x800 90초 무입력: 시작 화면으로 복귀')
  // 전시에서 미션을 모두 건너뛰어도 S6은 세 결과(참고 배분)로 채워진다(설계안 3-1, 7-5).
  const sk = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const skErrors = []
  sk.on('pageerror', (e) => skErrors.push(String(e)))
  await sk.goto(BASE)
  await sk.waitForSelector('.center-card h1')
  await sk.getByRole('button', { name: '시작', exact: true }).click()
  await sk.locator('.corner-card').getByRole('button', { name: '건너뛰기' }).click()
  await sk.locator('.corner-card').getByRole('button', { name: '건너뛰기' }).click()
  for (const n of [1, 2, 3]) {
    await sk.waitForSelector('#s3-title')
    check((await sk.locator('#s3-title').innerText()).startsWith(`미션 ${n}`), `1280x800 건너뛰기: 미션 ${n} 브리핑`)
    await sk.locator('.center-card').getByRole('button', { name: '건너뛰기' }).click()
  }
  await sk.waitForSelector('#s6-title')
  await sk.getByRole('button', { name: '세 배분 나란히 보기' }).click()
  await sk.waitForSelector('.finale-board')
  const chips = await sk.locator('.finale-col .finale-chip').allInnerTexts()
  check(chips.length === 3 && chips.every((c) => c === '참고 배분'), '1280x800 건너뛰기: S6 세 열 모두 참고 배분 칩', chips.join(' | '))
  check((await sk.locator('.panel').innerText()).includes('건너뛴 미션은 그 지표만 보면 가장 높은 배분 하나'), '1280x800 건너뛰기: 참고 배분 안내')
  check(same((await gameState(sk)).results, {}), '1280x800 건너뛰기: 보관된 미션 결과 없음')
  check(skErrors.length === 0, '1280x800 건너뛰기: 페이지 오류 없음', skErrors.join(' | '))
  await browser.close()
}

await run(1440, 900, true)
await run(1024, 768, false)
await run(1280, 800, false, 'reduce')
await extras()
writeFileSync(new URL('report.json', OUT), JSON.stringify(results, null, 1))
for (const r of results) console.log(`${r.status} ${r.name}${r.detail ? `  — ${r.detail.slice(0, 160)}` : ''}`)
const fails = results.filter((r) => r.status === 'FAIL').length
console.log(`\n${results.length - fails} PASS / ${fails} FAIL`)
process.exit(fails ? 1 : 0)
