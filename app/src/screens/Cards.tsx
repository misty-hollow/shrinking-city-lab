import { useEffect, useRef } from 'react'

import { copy } from '../content/copy'
import type { Manifest, Scenario } from '../data/types'
import { allocDays, people } from '../engine/format'
import type { MissionId } from '../state/results'
import { Badge } from '../ui/common'
import { ArrowIcon } from '../ui/WorldHud'

/** 새 화면이 열리면 제목에 포커스를 준다(키보드·스크린리더 사용자가 길을 잃지 않게). */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}

// --- S0 시작 -------------------------------------------------------------------------

/** 시작(UI_DESIGN_SYSTEM 01): 사실 한 줄 → 질문 하나 → Primary 하나. 숫자와 단위, 질문의 어절은 끊지 않는다. */
export function StartCard({ onStart, onData }: { onStart(): void; onData(): void }) {
  const h = useFocusOnMount<HTMLHeadingElement>()
  const [factLead, factNum] = copy.start.fact
  const [q1, q2] = copy.start.question
  return (
    <section className="center-card hero" aria-labelledby="s0-title">
      <div className="eyebrow">
        {copy.product} · {copy.scenario}
      </div>
      <h1 id="s0-title" tabIndex={-1} ref={h} aria-label={copy.start.headline}>
        <span className="hero-fact" aria-hidden="true">
          {factLead}
          <span className="nw">{factNum}</span>
        </span>
        <span className="hero-question" aria-hidden="true">
          <span className="nw">{q1}</span>
          <br />
          <span className="nw">{q2}</span>
        </span>
      </h1>
      <p className="sub">{copy.start.sub}</p>
      <div className="actions">
        <button type="button" className="btn btn-primary btn-big" onClick={onStart}>
          {copy.start.begin}
          <ArrowIcon />
        </button>
        <button type="button" className="link-button" onClick={onData}>
          {copy.dataAndLimits}
        </button>
      </div>
      <ol className="hero-steps" aria-label={copy.start.stepsLabel}>
        {copy.start.steps.map((s, i) => (
          <li key={s}>
            <b>{i + 1}</b>
            {s}
          </li>
        ))}
      </ol>
      <p className="small" style={{ marginTop: 16, marginBottom: 0 }}>
        {copy.start.notPolicy}
      </p>
    </section>
  )
}

// --- S1 소개 3장 ----------------------------------------------------------------------

interface IntroProps {
  step: 0 | 1 | 2
  scenario: Scenario
  manifest: Manifest
  onNext(): void
  onSkip(): void
}

export function IntroCard({ step, scenario, manifest, onNext, onSkip }: IntroProps) {
  const h = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    h.current?.focus()
  }, [step])
  const d = manifest.display_dates
  const open = scenario.facilities
    .map((f, j) => ({ f, v: scenario.current_allocation[j] }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
  const list = open.map((x, k) => `${x.f.short} ${k === 0 ? allocDays(x.v) : allocDays(x.v).replace('주 ', '')}`).join(', ')
  return (
    <section className="corner-card" aria-label={copy.stage.intro}>
      <div className="steps" aria-hidden="true">
        {[0, 1, 2].map((k) => (
          <i key={k} className={k <= step ? 'on' : ''} />
        ))}
      </div>
      {step === 0 && (
        <>
          <p tabIndex={-1} ref={h}>
            {copy.intro.card1(people(scenario.totals.pop), scenario.totals.pop65_pct.toFixed(1))}
          </p>
          <div className="badges">
            <Badge cls="REAL_DATA">{copy.intro.card1Small(d.population)}</Badge>
          </div>
          <div className="small">{copy.intro.card1Scope}</div>
        </>
      )}
      {step === 1 && (
        <>
          <p tabIndex={-1} ref={h}>
            {copy.intro.card2(open.length, list)}
          </p>
          <div className="badges">
            <Badge cls="REAL_DATA">{copy.intro.card2Small(d.schedule)}</Badge>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p tabIndex={-1} ref={h}>
            {copy.intro.card3}
          </p>
          <div className="pool-cells pool-anim" aria-hidden="true" style={{ margin: '8px 0' }}>
            {Array.from({ length: 10 }, (_, k) => (
              <i key={k} className="used" style={{ animationDelay: `${k * 60}ms` }} />
            ))}
          </div>
          <div className="badges">
            <Badge cls="REAL_DATA">{copy.intro.card3SmallReal(d.schedule)}</Badge>
            <Badge cls="SIMULATION_ASSUMPTION">{copy.intro.card3SmallAssumption}</Badge>
          </div>
        </>
      )}
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          {copy.intro.next}
        </button>
        <button type="button" className="link-button" onClick={onSkip}>
          {copy.intro.skip}
        </button>
      </div>
    </section>
  )
}

// --- S2 튜토리얼 코치 카드 ----------------------------------------------------------------

interface TutorialProps {
  step: 1 | 2 | 3
  triedText: string | null
  needReturn: boolean
  canNext: boolean
  result: string | null
  onNext(): void
  onSkip(): void
  onStartMission(): void
}

export function TutorialCard(p: TutorialProps) {
  const h = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    h.current?.focus()
  }, [p.step, p.result])
  return (
    <section className="corner-card" aria-label={copy.tutorial.title}>
      <div className="steps" aria-hidden="true">
        {[1, 2, 3].map((k) => (
          <i key={k} className={k <= p.step ? 'on' : ''} />
        ))}
      </div>
      <div className="small" style={{ fontWeight: 700 }}>
        {copy.tutorial.title} · {p.step}/3
      </div>
      {p.step === 1 && (
        <p tabIndex={-1} ref={h}>
          {copy.tutorial.step1}
        </p>
      )}
      {p.step === 2 && (
        <>
          <p tabIndex={-1} ref={h}>
            {copy.tutorial.step2}
          </p>
          {p.triedText && (
            <p aria-live="polite" className="num">
              {p.triedText}
            </p>
          )}
          {p.needReturn && <p className="small">{copy.tutorial.step2Return}</p>}
        </>
      )}
      {p.step === 3 && (
        <p tabIndex={-1} ref={h} aria-live="polite">
          {p.result ?? copy.tutorial.step3}
        </p>
      )}
      <div className="actions">
        {p.step < 3 && (
          <button type="button" className="btn btn-primary" onClick={p.onNext} disabled={!p.canNext}>
            {copy.tutorial.next}
          </button>
        )}
        {p.step === 3 && p.result && (
          <button type="button" className="btn btn-primary" onClick={p.onStartMission}>
            {copy.tutorial.startMission}
          </button>
        )}
        <button type="button" className="link-button" onClick={p.onSkip}>
          {copy.tutorial.skip}
        </button>
      </div>
    </section>
  )
}

// --- S3 미션 브리핑 -----------------------------------------------------------------------

/** 미션 1 브리핑 연출: 카드가 자리 잡으면(대기) 실제 10일이 탑의 등칸에서 불씨로 날아와 풀 칸에 앉는다(비행, 칸 사이 간격 ms). */
export const BRIEF_WAIT_MS = 380
export const BRIEF_EMBER_MS = 460
export const BRIEF_STEP_MS = 95
const BRIEF_LAND_MS = BRIEF_WAIT_MS + BRIEF_EMBER_MS

interface BriefingProps {
  mission: MissionId
  targetText: string
  scheduleDate: string
  reducedMotion: boolean
  onBegin(): void
  onSkip(): void
}

export function BriefingCard({ mission, targetText, scheduleDate, reducedMotion, onBegin, onSkip }: BriefingProps) {
  const h = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    h.current?.focus()
  }, [mission])
  const c = copy.missions[mission]
  // 풀 연출(실제 10칸이 올라오고 점선 5칸이 더해진다)은 미션 1 브리핑에서만(설계안 5-4). 미션 2·3은 같은 칸을 정지 상태로.
  const animate = mission === 'm1' && !reducedMotion
  return (
    <section className="center-card" aria-labelledby="s3-title" data-mission={mission}>
      <h2 id="s3-title" tabIndex={-1} ref={h}>
        {c.title}
      </h2>
      <p style={{ fontSize: 16, margin: '0 0 14px' }}>{c.goal(targetText)}</p>
      <div className="block" style={{ marginBottom: 12 }}>
        <div className="block-title">{copy.briefing.resource}</div>
        <div key={mission} className={`pool-cells${animate ? ' pool-anim' : ''}`} aria-hidden="true">
          {Array.from({ length: 15 }, (_, k) => (
            <i
              key={k}
              className={k >= 10 ? 'assumed' : ''}
              style={animate ? { animationDelay: `${k < 10 ? BRIEF_LAND_MS + k * BRIEF_STEP_MS : BRIEF_LAND_MS + 10 * BRIEF_STEP_MS + 260 + (k - 10) * 130}ms` } : undefined}
            />
          ))}
        </div>
        <div className="badges">
          <Badge cls="REAL_DATA">{copy.briefing.realBadge(scheduleDate)}</Badge>
          <Badge cls="SIMULATION_ASSUMPTION">{copy.briefing.assumptionBadge}</Badge>
        </div>
        <p style={{ margin: '6px 0 0' }}>{copy.briefing.assumption}</p>
      </div>
      <p className="small">{copy.briefing.judged}</p>
      {mission !== 'm1' && <p className="small">{copy.briefing.kept}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary btn-big" onClick={onBegin}>
          {copy.briefing.begin}
        </button>
        <button type="button" className="link-button" onClick={onSkip}>
          {copy.briefing.skip}
        </button>
      </div>
    </section>
  )
}

// --- <768 안내 ---------------------------------------------------------------------------

export function MobileNotice({ onData }: { onData(): void }) {
  return (
    <main className="mobile">
      <div className="small">
        {copy.product} · {copy.scenario}
      </div>
      <h1>{copy.start.headline}</h1>
      <p>{copy.mobile.body}</p>
      <p className="small">{copy.start.notPolicy}</p>
      <button type="button" className="btn" onClick={onData}>
        {copy.dataAndLimits}
      </button>
    </main>
  )
}
