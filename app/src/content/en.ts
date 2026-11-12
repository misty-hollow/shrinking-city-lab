/**
 * English screen copy. Same shape as the Korean source (copy.ts `ko`); the type checker enforces every key.
 *
 * Voice: calm, warm, plain. Short sentences, second person, sentence case, no exclamation marks.
 * Written for a first-time player abroad (secondary school or university), not translated word by word.
 * - 보건지소 = "public health branch clinic" when introduced, then "clinic". 진료일 = "clinic day".
 * - 읍·면 = "district" (the intro explains: one town, eup, and nine townships, myeon). 마을(법정리) = "village".
 * - 닿다 = "reach". Time is always "road access time" or "{n} min by road", never "travel time" (it is not anyone's real trip).
 * - Place names are romanized, never translated (content/places.ts).
 * - No ranking, scores, "best", "optimal", "recommend", "should" (forbidden.test.ts), except the fixed negations.
 */

import type { Copy } from './copy'

/** `1 village` / `3 villages` */
const n = (k: number | string, one: string, many: string): string => `${k} ${k === 1 || k === '1' ? one : many}`
const villages = (k: number | string): string => n(k, 'village', 'villages')
const districts = (k: number | string): string => n(k, 'district', 'districts')
/** verb agreement after a count: `1 village is` / `3 villages are` */
const one = (k: number | string): boolean => k === 1 || k === '1'
const isAre = (k: number | string): string => (one(k) ? 'is' : 'are')
const has = (k: number | string): string => (one(k) ? 'has' : 'have')
const them = (k: number | string): string => (one(k) ? 'it' : 'them')

export const en: Copy = {
  product: 'Shrinking City Lab',
  scenario: 'Days Within Reach',
  subtitle: 'A simulation of sharing clinic days among Gongju’s public health branch clinics',
  dataAndLimits: 'Data & limits',
  docTitle: 'Days Within Reach — sharing clinic days among Gongju’s public health branch clinics',
  docDescription:
    'An educational simulation built on real data from Gongju, South Korea. Share weekly clinic days among 10 public clinics and see which villages they reach.',
  language: 'Language',
  badges: {
    real10: '10 real days',
    assumed5: '5 assumed days',
  },

  stage: {
    start: 'Start',
    intro: 'Introduction',
    tutorial: 'Tutorial',
    mission: (k: number) => `Mission ${k}/3`,
    finale: 'Three Gongjus',
  },

  threshold: {
    label: 'Reachable within',
    help: 'Road access time · no traffic or waiting',
    option: (t: number) => `${t} min`,
    locked: 'Confirmed results use the 15 min by road cutoff',
  },

  baseline: {
    label: 'Baseline',
    current: (date: string) => `Today’s real schedule (${date.slice(0, 7)}, 10 days)`,
    last: (k: number) => `Last confirmed allocation (Mission ${k})`,
  },

  start: {
    headline: 'Ten public clinics, open 10 days a week in total. If you had 5 more days, where would you put them?',
    fact: ['Ten public clinics, open a total of ', '10 days a week.'],
    question: ['If you had 5 more days,', 'where would you put them?'],
    sub: 'An educational game built on real data from Gongju, South Korea · about 5 min',
    begin: 'Start',
    stepsLabel: 'How it goes',
    steps: [
      'See which villages today’s 10 weekly days reach',
      'Split 10 real + 5 assumed days for three different goals',
      'Put the three allocations side by side and see which villages gain or lose',
    ],
    notPolicy: 'This game does not evaluate Gongju’s actual administration or recommend any policy.',
  },

  intro: {
    next: 'Next',
    skip: 'Skip',
    card1: (pop: string, pct: string) =>
      `Gongju is a city in South Korea. About ${pop} live in its 10 rural districts: one town (eup) and nine townships (myeon). ${pct}% of them are 65 or older.`,
    card1Small: (date: string) => `Resident registration ${date} · Real data`,
    card1Scope: 'Gongju’s city center (its urban dong areas) is not part of this game.',
    card2: (open: number, list: string) =>
      `Each district has one public health branch clinic, a small public clinic run by the city. Right now ${open} of them offer general medical care: ${list}.`,
    card2Note: 'A clinic day held every other week counts as 0.5 days a week. Each lit cell in a speech bubble is one clinic day.',
    card2Small: (date: string) => `Visiting doctor schedule ${date} · Real data`,
    card3: 'Add up the medical clinic days at all 10 branch clinics and you get 10 days a week today. One clinic day means one day a clinic is open for general care.',
    card3Note: 'A clinic day is the game’s unit. It doesn’t capture the number of doctors, specialties, or hospitals in the city center.',
    card3SmallReal: (date: string) => `10 days · Real data · ${date}`,
    card3SmallAssumption: 'Clinic-day unit · Game assumption',
  },

  tutorial: {
    title: 'Tutorial · Gongju today',
    step1:
      'Add up the clinic days of every clinic within 15 minutes of a village by road: that is how many clinic days reach the village (up to 5 a week). The more days reach it, the more windows light up. People live in the dark villages too.',
    mapControls: 'Drag or W A S D to move · Right-drag to rotate · Wheel to zoom · R to reset · ? for controls',
    step2: 'At the top right, click a different time: 10, 15 or 20 min. It changes how many minutes still count as “within reach.”',
    step2Changed: (fromT: number, from: string, toT: number, to: string) =>
      `The allocation is the same, but residents reached at least 1 day a week went from ${from} at ${fromT} min to ${to} at ${toT} min. Picking the cutoff is a choice too.`,
    step2Return: 'Set it back to 15 min to continue.',
    step3:
      'Click − at the end of Uidang’s speech bubble. One clinic day moves to your hand below. Then click another clinic’s bubble to place that day there.',
    step3Pool: (k: number) => `Clinic days to move: ${k}`,
    step3Result: (fac: string, gained: number, thinner: number) =>
      gained > 0
        ? `Placing a day at ${fac} newly reached ${villages(gained)}. In exchange, ${villages(thinner)} near Uidang now ${one(thinner) ? 'gets' : 'get'} fewer clinic days.`
        : `You placed a day at ${fac}. No village is newly reached, and ${villages(thinner)} near Uidang now ${one(thinner) ? 'gets' : 'get'} fewer clinic days.`,
    step3Next: 'In the missions you split 15 days: the real 10 plus 5 assumed days. Each mission has a different goal.',
    next: 'Next',
    skip: 'Skip',
    startMission: 'Start mission',
  },

  missions: {
    m1: {
      title: 'Mission 1 · Raise the average',
      name: 'Raise the average',
      goal: (target: string) => `Raise the number of clinic days that reach a resident within 15 minutes by road, averaged over all residents, to ${target} or more.`,
      kpiName: 'Average clinic days',
      reference: 'Reference allocation · average-focused',
      referenceNote: 'On “average clinic days” alone, this allocation is among the highest possible.',
    },
    m2: {
      title: 'Mission 2 · Lift the worst-off district',
      name: 'Lift the worst-off district',
      goal: (target: string) => `Raise the average clinic days of the worst-off district to ${target} or more.`,
      kpiName: 'Worst-off district',
      reference: 'Reference allocation · worst-off-focused',
      referenceNote: 'On the “worst-off district” alone, this allocation is among the highest possible.',
    },
    m3: {
      title: 'Mission 3 · Deeper reach',
      name: 'Deeper reach',
      goal: (target: string) => `Raise the number of residents reached at least 3 days a week within 15 minutes by road to ${target} or more.`,
      kpiName: 'Residents reached 3+ days/wk',
      reference: 'Reference allocation · depth-focused',
      referenceNote: 'On “residents reached 3+ days a week” alone, this allocation is among the highest possible.',
    },
  },

  briefing: {
    resource: 'Clinic days to split: 15 a week = 10 real + 5 assumed',
    fresh: 'Every clinic starts at 0 days. You split all 15 days from scratch.',
    realBadge: (date: string) => `Real data · schedule ${date}`,
    assumptionBadge: 'Game assumption · if 5 more days were available',
    assumption:
      'This mission is a hypothetical policy experiment. It assumes 5 more days on top of today’s 10. It does not mean 5 days should actually be added.',
    judged: 'Judged at 15 min by road',
    kept: 'Your confirmed allocations come back side by side at the end, in “Three Gongjus.”',
    begin: 'Start placing days',
    skip: 'Skip this mission',
  },

  pool: {
    title: 'Clinic day pool',
    remaining: (k: string, b: number) => `Clinic days left ${k} / ${b}`,
    caption: '10 real + 5 assumed',
    captionTutorial: '10 real days today',
    empty: 'All placed. Confirm as it is, or keep moving days around.',
    fillFirst: 'Place every remaining clinic day to confirm.',
  },

  facility: {
    closed: 'Not open',
    reach: (t: number, k: number, pop: string) => `Within ${t} min: ${villages(k)} · ${pop}`,
    dec: (name: string) => `Remove a clinic day from ${name}`,
    inc: (name: string) => `Add a clinic day to ${name}`,
    keysHint: 'Select a bubble, then press + − or → ← to place or remove a day. ↑ ↓ moves to the next clinic.',
    listLabel: '10 public health branch clinics',
    dockOrder: 'West to east',
  },

  missionCard: {
    targetLabel: (v: string) => `Goal ${v}`,
    achieved: (k: number) => `Goal met · top ${k}% of possible allocations`,
    notYet: (k: number) => `Top ${k}% of possible allocations`,
    remainingDays: (v: string) => `${v} days/wk to the goal`,
    remainingPop: (v: string) => `${v} to the goal`,
    judgedAt15: 'Missions are judged at 15 min',
    confirm: 'Confirm this allocation',
    goalTag: 'Mission metric',
    emdStrip: (target: string) => `Average clinic days in the 10 districts · line = goal ${target}`,
    belowTarget: (k: number) => (k > 0 ? `${districts(k)} below the goal` : 'Every district is at or above the goal'),
    gapLine: (v: string) => `District gap ${v} days/wk`,
    thickness: (target: string) => `How deep care reaches, by residents · line = goal ${target}`,
    thickParts: ['3+ days/wk', '1–2 days/wk', 'Not reached'],
    compareLast: (k: number) => `Compare with the last confirmed allocation (Mission ${k})`,
    compareLastOff: 'Back to comparing with today’s real 10 days',
  },

  kpi: {
    meanDays: 'Average clinic days',
    meanDaysSub: (t: number) => `Within ${t} min · averaged over residents · max 5 days`,
    cov1: 'Residents reached 1+ day/wk',
    cov1Sub: (k: string) => `Not reached: ${k}`,
    cov3: 'Residents reached 3+ days/wk',
    worst: 'Worst-off district',
    gap: 'District gap',
    gapValue: (v: string) => `${v} days/wk apart`,
    gapSub: (hi: string, hv: string, lo: string, lv: string) => `Highest ${hi} ${hv} · lowest ${lo} ${lv}`,
    p90: '90% access time',
    p90Sub: '9 in 10 residents can reach an open clinic within this time by road',
    bands: ['Within 10 min', '10–15 min', '15–20 min', 'Over 20 min'],
    none: 'No open clinic',
    info: 'About',
    better: 'Better',
    worse: 'Worse',
    same: 'Same',
    legendBase: (base: string) => `vs. ${base}`,
    legendCurrent: 'today’s real 10 days',
    legendLast: (k: number) => `Mission ${k} allocation`,
    explain: {
      meanDays: (t: number) =>
        `For each village, add up the clinic days of clinics within ${t} min by road (up to 5). Then average over residents, so larger villages count for more. The clinic-day unit and the 5-day cap are game assumptions.`,
      cov1: (t: number) => `Residents in villages reached by at least 1 clinic day a week within ${t} min by road.`,
      cov3: (t: number) => `Residents in villages reached by at least 3 clinic days a week within ${t} min by road.`,
      worst: 'The district with the lowest average clinic days. If two tie, the one with more residents not reached is shown.',
      gap: 'The difference between the highest and lowest district averages. The smaller it is, the more evenly care reaches.',
      p90: 'For each village, take the road access time from its representative point (the village’s mapped location) to the nearest clinic with at least one clinic day. Everyone in a village gets the same time. Line all residents up from shortest to longest: this is the time at the 90% mark. Traffic, lights and waiting are not included.',
    },
  },

  emdList: {
    title: 'Clinic days by district',
    sortLow: 'Lowest first',
    sortName: 'By name',
    zeroVillages: (k: number) => `${villages(k)} at 0 days`,
  },

  controls: {
    deltaOn: 'Showing changes',
    deltaOff: 'Changes hidden',
  },

  region: {
    close: 'Close',
    pop: (v: string) => `Population ${v}`,
    pop65: (p: string) => `Age 65+ ${p}%`,
    pop65Badge: (date: string) => `Real data · ${date}`,
    days: (v: string) => `District average ${v}`,
    zeroTitle: 'Villages not reached',
    zeroNone: 'No village left unreached',
    zeroSummary: (k: number, pop: string, p: string) => `${villages(k)} · ${pop} · ${p}% of the district’s residents`,
    unreachableNote: (k: number, t: number) => `${k} of them ${has(k)} no clinic within ${t} min by road, so no allocation can reach ${them(k)}`,
    zeroList: 'Villages',
    unreachable: (t: number) => `No clinic within ${t} min`,
    facility: (name: string, days: string) => `This district’s clinic: ${name} · ${days}`,
  },

  debrief: {
    achieved: (k: number) => `Goal met · top ${k}% of possible allocations`,
    missed: (k: number) => `Goal not met · top ${k}% of possible allocations`,
    mixedEffect:
      'These results use 15 days: the real 10 plus 5 assumed. So the difference from today’s real 10 days also includes the effect of the 5 extra days.',
    gained: 'What improved',
    gainedNone: 'No metric is better than the baseline',
    lost: 'What got worse',
    lostTitle: (k: number, pop: string) => `${villages(k)} no longer reached · ${pop}`,
    thinnerTitle: (k: number, pop: string) => `${villages(k)} down by a day or more · ${pop}`,
    lostNone: 'No village is worse off than the baseline',
    more: (k: number) => `Show ${k} more`,
    less: 'Show less',
    lostRest: (k: number) => `and ${k} more`,
    lostAll: 'Show every village name',
    table: 'Six metrics',
    colKpi: 'Metric',
    colBase: 'Today’s real 10 days',
    colMine: 'Your allocation (15 days)',
    colDiff: 'Difference',
    landscape: 'Allocation landscape',
    landscapeSentence: 'Further up and to the right, both metrics are higher. But the rightmost point and the topmost point are different allocations.',
    landscapeX: 'Average clinic days (per week)',
    landscapeY: 'Worst-off district (per week)',
    legendMine: 'Your allocation (15 days)',
    legendCurrent: 'Today’s real 10 days',
    legendFront: 'Allocations where raising one metric means lowering another (average, worst-off, 3+ days/wk)',
    legendDensity: (k: string) => `Spread of ${k} possible allocations (15 days; darker = more)`,
    legendOthers: 'Other mission results (15 days)',
    otherPoint: (k: number) => `Mission ${k}`,
    frontCount: (k: number) => `(${k})`,
    tipCov3: (pop: string) => ` · reached 3+ days/wk ${pop}`,
    tableAlloc: 'Allocation',
    tableView: 'View as a table',
    otherGoal: 'With a different goal',
    otherGoalLine: (kpi: string) =>
      `With the same 15 days, putting “${kpi}” first changes the allocation like this. The grey towers on the map show it. You can try it yourself in the next mission.`,
    ghostShow: 'Show reference allocation',
    ghostHide: 'Hide reference allocation',
    compareTitle: (k: number) => `Compared with Mission ${k} · both 15 days`,
    compareLine: (k: number, better: number, worse: number) =>
      `The same 15 days, split differently. Compared with Mission ${k}, ${villages(better)} ${isAre(better)} better off and ${villages(worse)} ${isAre(worse)} worse off.`,
    compareColPrev: (k: number) => `Mission ${k}`,
    compareColMine: 'This allocation',
    compareBetter: 'Districts better off',
    compareWorse: 'Districts worse off',
    compareNone: 'None',
    compareStage: (k: number) => `Compare with Mission ${k} on the map`,
    compareStageOff: 'Turn off map comparison',
    limitTitle: 'Limits of this model',
    next: 'Next mission',
    toFinale: 'See the Three Gongjus',
    again: 'Change the allocation',
    home: 'Back to start',
  },

  finale: {
    title: 'Three Gongjus',
    col: (k: number) => `Mission ${k}`,
    goalLegend: 'Outlined cell = the metric that mission aimed for',
    changeHead: 'vs. today’s real 10 days · includes the 5 added days',
    changeCell: (pop: string, k: number) => `${pop} (${villages(k)})`,
    lead: 'All three allocations split the same 15 days a week. What each one put first changed which places gained and which lost.',
    leadSameAlloc: 'You confirmed the same allocation in all three missions. The goals differed, but the allocation is the same, so every village gets the same clinic days.',
    leadSameOutcome: 'The three allocations differ, but every village gets the same clinic days.',
    basis: 'All three use 10 real + 5 assumed = 15 days · hypothetical policy experiment',
    notCurrent: 'These are hypothetical allocations, not the 10 days a week actually running today. Every comparison uses 15 min by road.',
    reference: 'Reference allocation',
    referenceNote: 'Where you skipped a mission, we put in one of the highest allocations on that mission’s metric alone (a reference allocation).',
    achieved: (k: number) => `Goal met · top ${k}%`,
    missed: (k: number) => `Goal not met · top ${k}%`,
    goalTag: 'This mission’s goal',
    goalShort: 'Goal',
    factMean: 'Average clinic days',
    factWorst: 'Worst-off district',
    factCov3: 'Reached 3+ days/wk',
    factZero: (k: number, pop: string) => `${villages(k)} not reached · ${pop}`,
    factP90: (v: string) => `90% access time ${v}`,
    thinEmds: (list: string) => `Districts averaging under 1 day/wk: ${list}`,
    thickEmds: (list: string) => `Districts averaging 3+ days/wk: ${list}`,
    noneEmds: 'none',
    allocStrip: 'Clinic days by clinic',
    open: (title: string) => `Enlarge the “${title}” allocation on the map`,
    openHint: 'Click to enlarge on the map',
    back: 'Back to all three',
    focusTitle: (title: string) => `${title} · 15 days a week`,
    base: 'Map changes vs.',
    baseCurrent: 'Today’s real 10 days',
    baseMission: (k: number) => `Mission ${k} (15 days)`,
    mapLabel: (title: string, zero: number, worst: string) =>
      `Top-down map of the “${title}” allocation. ${villages(zero)} not reached; worst-off district ${worst}.`,
    tableTitle: 'Six metrics · 15 min by road',
    allocTitle: 'Clinic days by clinic',
    allocTotal: 'Total',
    allocTotalValue: '15 days a week = 10 real + 5 assumed',
    emdTitle: 'Average clinic days by district',
    emdLegend: 'Change = vs. the allocation to its left · dotted cell = worst-off district in that allocation',
    meanLine: (a: string, b: string, c: string, similar: boolean) =>
      similar
        ? `Average clinic days are close (${a} · ${b} · ${c}), but who is left out differs.`
        : `Average clinic days are ${a} · ${b} · ${c}.`,
    zeroLine: (a: number, b: number, c: number) => `Villages not reached: ${a} · ${b} · ${c}.`,
    unreachableLine: (k: number, pop: string, t: number) =>
      `${k} of them (${pop}) ${has(k)} no clinic at all within ${t} min by road, so no allocation can reach ${them(k)}.`,
    overlapLine: (union: number, all: number) =>
      all > 0
        ? `${villages(union)} ${one(union) ? 'goes' : 'go'} unreached because of the allocation in at least one of the three. ${all} of them ${isAre(all)} unreached in all three; the rest depend on the allocation.`
        : `${villages(union)} ${one(union) ? 'goes' : 'go'} unreached because of the allocation in at least one of the three. None is unreached in all three, so each one depends on the allocation.`,
    sameZero: 'The villages left unreached by the allocation are the same in all three.',
    noAllocZero: 'No village is left unreached because of the allocation, in any of the three.',
    sameAllocLine: 'You confirmed the same allocation in all three missions, so all three results are the same.',
    noZero: 'Every village is reached in all three allocations.',
    zeroTitle: 'Villages at 0 days because of the allocation',
    zeroNone: 'None',
    unreachableTitle: (t: number) => `Villages no allocation can reach · no clinic within ${t} min by road`,
    closing:
      'Even with the same 15 days, the allocation changes with the metric you push to the limit. Looking only at the average can hide which villages care doesn’t reach.',
    home: 'Back to start',
  },

  legend: {
    title: 'How to read',
    collapse: 'Close how to read',
    expand: 'How to read',
    villageFull: 'All windows lit = 3–5 days/wk',
    villageHalf: 'One lit window per wall = 1–2 days/wk',
    villageEmpty: 'Dark windows = not reached · people still live here',
    villageNeutral: 'One house ≈ 50 residents',
    house: 'One house ≈ 50 residents · not real houses or locations',
    tower: 'One lit cell in a bubble = one clinic day (tower lights too) · every other week = half a cell',
    route: 'Light on the roads = reach by road (shows on hover) · not real staff or vehicles moving',
    ghost: 'Faint tower beside it = the allocation being compared',
    better: 'Better',
    worse: 'Worse',
    deltaOf: 'vs. baseline',
    worst: 'White dotted line = worst-off district',
    cityCore: 'Grey paper = Gongju city center (outside this model)',
    landscape: 'Rice paddies, fields, forests, trees and roof colors are scenery only, not data.',
  },

  help: {
    open: 'Controls',
    close: 'Close controls',
    title: 'Controls',
    mapTitle: 'Map',
    map: [
      ['Left-drag · W A S D', 'Move the map'],
      ['Right-drag', 'Rotate · tilt'],
      ['Wheel', 'Zoom in · out'],
      ['R', 'Back to the first view'],
    ],
    allocTitle: 'Clinic days',
    alloc: [
      ['Click a bubble', 'Place a day'],
      ['− · right-click', 'Remove a day'],
      ['Tab, then + − or → ←', 'Place · remove by keyboard'],
      ['↑ ↓', 'Next clinic'],
      ['Ctrl Z', 'Undo'],
    ],
    otherTitle: 'Other',
    other: [
      ['Esc', 'Cancel preview · close panel'],
      ['?', 'Open · close controls'],
    ],
  },

  world: {
    markersLabel: '10 public health branch clinics · west to east',
    markerAria: (name: string, emd: string, days: string) => `${name}, ${emd}, ${days}.`,
    handLabel: (left: number, budget: number) => `Clinic days left ${left} / ${budget}`,
    handCount: (k: number) => `×${k}`,
    handCaption: 'Days left',
    handTutorial: 'Day to move',
    handTutorialEmpty: 'Take a day from Uidang',
    handTutorialDone: 'Day moved',
    handEmpty: 'All placed',
    handReal: (k: number) => `Real ${k}`,
    handAssumed: (k: number) => `Assumed ${k}`,
    preview: {
      blockedEmpty: 'Your hand is empty. Click − on another clinic’s bubble to take a day.',
      blockedMax: 'Up to 5 days a week per clinic',
      blockedNone: 'No day to remove',
      blockedTutorial: 'In the tutorial, take a day from Uidang and place it at another clinic',
      newly: (k: number) => `${villages(k)} newly reached`,
      thicker: (k: number) => `${villages(k)} rising to 3+ days/wk`,
      more: (k: number) => `${villages(k)} gaining days`,
      lost: (k: number) => `${villages(k)} no longer reached`,
      thinner: (k: number) => `${villages(k)} dropping below 3 days/wk`,
      less: (k: number) => `${villages(k)} losing days`,
      same: 'No village changes',
      days: (fac: string, a: string, b: string) => `${fac}: ${a} → ${b} a week`,
      headInc: (fac: string) => `If you add 1 day to ${fac}`,
      headDec: (fac: string) => `If you take 1 day from ${fac}`,
      hintInc: 'Click to place · Esc to cancel',
      hintDec: 'Click to remove · Esc to cancel',
      hintUndo: 'Click to undo · Ctrl Z',
      hud: (v: string) => `→ ${v}`,
      hudLabel: 'Preview',
    },
    undo: 'Undo',
    undoHint: 'Reverse the last move',
    topOn: 'View from above',
    topOff: 'Angled view',
    details: 'Metric details · 10 districts',
    detailsTitle: 'Metric details',
    detailsClose: 'Close metric details',
    finishHint: (k: number) => `Place the remaining ${k} ${k === 1 ? 'day' : 'days'} to confirm`,
    judgedAt15Tail: ' · judged at 15 min',
    appreciateSkip: 'Click to see the results',
    lostPin: (name: string, pop: string) => `${name} ${pop} · no longer reached`,
    lostMore: (k: number) => `and ${k} more`,
    debriefDetails: 'Result details · allocation landscape',
    debriefDetailsClose: 'Close result details',
    debriefKpiTitle:
      'The goal is the top-10% cutoff among possible allocations, rounded down. So an allocation can pass the goal and still sit outside the top 10%.',
    debriefKpis: 'Six metrics · vs. today’s real 10 days',
    debriefCols: ['Metric', 'Yours', 'Change'],
    goalTarget: (t: string) => `· goal ${t}`,
    verdict: (achieved: boolean) => (achieved ? 'Goal met' : 'Goal not met'),
    rank: (k: number) => `· top ${k}% of possible allocations`,
    changeTitle: 'Compared with today’s real 10 days',
    betterLabel: 'Residents better off',
    worseLabel: 'Residents worse off',
    sideTotal: (pop: string, k: number) => `${pop} · ${villages(k)}`,
    sideVillages: (k: number) => villages(k),
    sideNone: 'None',
    betterParts: (newly: number, more: number) =>
      [newly > 0 ? `${newly} newly reached` : '', more > 0 ? `${more} up a day or more` : ''].filter(Boolean).join(' · '),
    worseParts: (lost: number, thinner: number) =>
      [lost > 0 ? `${lost} no longer reached` : '', thinner > 0 ? `${thinner} down a day or more` : ''].filter(Boolean).join(' · '),
    sideWhere: (list: string) => `Mostly ${list}`,
    lostLabel: 'Villages no longer reached',
    lostDetail: (list: string, more: number) => (more > 0 ? `${list} and ${more} more` : list),
    lostOnMap: 'Red markers on the map',
    mapKey: (glyphs: boolean, lost: boolean) =>
      [glyphs ? '▲ ▼ on the map = villages up or down a day or more' : '', lost ? 'Red marker = larger village no longer reached (up to 3)' : '']
        .filter(Boolean)
        .join(' · '),
    mapGlyphs: '▲ ▼ on the map = villages up or down a day or more',
    prevLine: (k: number, better: number, worse: number) =>
      `Compared with your Mission ${k} allocation, ${villages(better)} ${isAre(better)} better off by a day or more and ${villages(worse)} ${isAre(worse)} worse off. Both use 15 days, so this difference doesn’t include the 5 added days.`,
    finaleTabs: 'Choose a view · overlay and each mission’s allocation',
    finaleLead: 'Three Gongjus · the same 15 days, three goals',
    finaleBoard: 'Side by side',
    finaleBoardClose: 'View on the island',
    finaleTableTitle: 'Six metrics · 15 min by road',
    overlapTab: 'Overlay',
    overlapTabSub: 'All three on one map',
    overlapBasis: '15 min by road · 1+ day/wk = reached. These are model results, not whether people actually use the clinic.',
    overlapCats: [
      { title: 'Reached in all three', sub: 'Lit houses · window light = the lowest level of the three' },
      { title: 'Depends on the allocation', sub: 'Three cells = Missions 1·2·3; lit cell = reached in that allocation' },
      { title: 'Not reached in any', sub: 'Dark houses · days at a clinic within 15 min could reach them' },
      { title: 'No clinic within 15 min', sub: 'Dark houses · no allocation changes this' },
    ],
    overlapCount: (k: number) => `${k}`,
    overlapCatsAria: 'Village groups · click to highlight those villages on the map',
    overlapHint: 'Click a group to show its villages in teal on the map',
    overlapTotal: (k: number, pop: string) => `Total ${villages(k)} · ${pop}`,
    overlapAria: 'Three allocations overlaid · village groups and clinic days by clinic',
    overlapFacilities: 'Clinic days by clinic',
    overlapKpis: 'Six metrics table',
  },

  hud: {
    kpiTitle: 'Six metrics',
    emdOpen: 'Metric details',
    emdClose: 'Close metric details',
    goalReached: 'Goal met',
  },

  toast: {
    gain: (fac: string, k: number, pop: string) => `${fac} +1 day · ${villages(k)} newly reached · ${pop}`,
    thicker: (fac: string, k: number) => `${fac} +1 day · ${villages(k)} with more days`,
    loss: (fac: string, k: number, pop: string) => `${fac} −1 day · ${villages(k)} no longer reached · ${pop}`,
    thinner: (fac: string, k: number) => `${fac} −1 day · ${villages(k)} with fewer days`,
    none: (fac: string, delta: string) => `${fac} ${delta} · no village changes`,
    tGain: (from: number, to: number, k: number, pop: string) => `${from} → ${to} min · ${villages(k)} newly reached · ${pop}`,
    tLoss: (from: number, to: number, k: number, pop: string) => `${from} → ${to} min · ${villages(k)} no longer reached · ${pop}`,
    tSame: (from: number, to: number) => `${from} → ${to} min · the same villages are reached`,
  },

  share: {
    open: 'Save results as an image',
    title: 'Results image',
    lead: 'Your three missions’ allocations and results, in one image. Hand it in for an assignment, or set it beside a friend’s to compare.',
    nameLabel: 'Name or group (optional)',
    namePlaceholder: 'e.g. Group 4, Section 2',
    nameNote: 'The name only goes into the image. It isn’t sent anywhere.',
    save: 'Save as PNG',
    copy: 'Copy image',
    share: 'Share',
    close: 'Close',
    preparing: 'Making the image',
    saved: 'Image saved.',
    copied: 'Image copied. Paste it where you need it with Ctrl V.',
    failed: 'This browser can’t do that. Please save it as a PNG instead.',
    previewAlt: 'Preview of the results image',
    fileName: 'days-within-reach_results',
    played: (date: string) => `Played ${date}`,
    allocHead: 'Clinic days by clinic · west to east',
    zeroHead: 'Villages not reached',
    legendPlate: 'One lit dot on a clinic plate = one clinic day',
    madeWith: 'An educational game built on real data from Gongju, South Korea',
    basis15: 'All metrics use 15 min by road',
    renderFailed: 'This browser can’t make the results image.',
  },

  sound: {
    label: 'Sound',
    on: 'Sound on',
    off: 'Sound off',
  },

  panelLabel: 'Allocation panel',

  camera: {
    group: 'Camera view',
    overview: 'Overview',
    north: 'North up',
    top: 'View from above',
  },

  dataChip: (pop: string, sched: string, road: string) => `Data as of: population ${pop} · schedule ${sched} · roads ${road}`,

  live: (fac: string, days: string, mean: string, zero: string) => `${fac} ${days}. Average clinic days ${mean}. Residents not reached ${zero}.`,
  liveThreshold: (t: number, mean: string, zero: string) => `Cutoff ${t} min. Average clinic days ${mean}. Residents not reached ${zero}.`,

  village: {
    tooltipPop: (emd: string, pop: string) => `${emd} · population ${pop}`,
    tooltipDays: (v: string) => `Clinic days reaching it: ${v}`,
    tooltipOverlap: (a: string, b: string, c: string) => `Mission 1 ${a} · Mission 2 ${b} · Mission 3 ${c}`,
    tooltipNone: (t: number) => `No clinic within ${t} min by road`,
    worstTag: 'worst-off',
    emdThickShare: (p: number) => `3+ days ${p}%`,
    cityCore: 'Gongju city center · outside the model',
  },

  noWebgl: 'This browser can’t draw the 3D map. You can keep playing with the clinic cards and metrics below.',
  loading: 'Preparing the Gongju terrain model',
  loadError: 'The data didn’t load. Please refresh the page.',
  crashed: 'Something went wrong while drawing the screen. Please refresh the page.',
  mobile: {
    body: 'This game is played on a desktop or laptop screen.',
  },

  dataPage: {
    title: 'Data & limits',
    close: 'Close',
    whatTitle: 'What this game does and doesn’t do',
    what: 'An educational simulation that simplifies real data from Gongju, South Korea. By sharing clinic days yourself, you explore which areas gain and which lose when a public service is divided up.',
    whatNot: 'It is not an evaluation of Gongju’s actual administration, a tool that recommends an optimal policy, or a system for making health policy decisions.',
    sourcesTitle: 'Data sources and reference dates',
    items: {
      population: 'Village population; district residents 65+',
      schedule: 'Branch clinic visiting doctor schedule',
      facilities: 'Locations of the 10 branch clinics',
      roads: 'Road network',
      matrix: 'Road access times, 161 villages × 10 clinics',
      boundaries: 'District boundaries',
      terrain: 'Terrain',
    },
    repro: {
      version: 'Data version',
      engine: 'Routing engine',
      digest: 'Image digest',
      osm: 'OSM',
      code: 'Pipeline code',
      osmLine: (ts: string, bbox: string) => `latest object ${ts} · extract area ${bbox}`,
    },
    scheduleAttribution: (publisher: string, date: string, status: string) =>
      `${publisher}, “Clinic information” visiting schedule (as of ${date}) — ${status}`,
    colItem: 'Item',
    colSource: 'Source',
    colDate: 'Date',
    colClass: 'Type',
    methodTitle: 'How it’s calculated',
    method: [
      'For each village (a legal “ri”), we calculated in advance the shortest car access time over the road network from its representative point (the village’s mapped location) to each of the 10 clinics. Traffic, lights, parking and waiting are not included.',
      'Each route starts from the nearest ordinary road you can drive onto directly from the village’s representative point: never an expressway, ramp, car-only road or tunnel. After that, the route may use expressways.',
      'For each village, we add up the weekly clinic days of the clinics within the cutoff (10, 15 or 20 min). Clinic days reaching one resident are capped at 5 a week.',
      'Average clinic days is the average of village values, weighted by the number of residents. District values use the same method on the villages in that district.',
      '90% access time uses the road access time from each village’s representative point to the nearest clinic with at least one clinic day. Everyone in a village gets the same time. Line residents up from shortest to longest: the time at the 90% mark is the value.',
      'Each mission goal is the top-10% cutoff among all possible allocations (15 days, 15 min), rounded down to 0.1 days or 100 residents. So more than 10% of allocations can pass it. No one chose these numbers by hand.',
    ],
    assumptionsTitle: 'Game assumptions',
    limitsTitle: 'Limits',
    reproTitle: 'Data version',
    creditsTitle: 'Made by',
    credits: 'Kongju National University capstone design project · 2026',
    fonts: 'Fonts: Pretendard (OFL-1.1) · Hahmlet (OFL-1.1) · Inter (OFL-1.1, Vietnamese screens). Sound effects are synthesized in the browser.',
    displayTitle: 'How things are shown',
    display: [
      'One house stands for about 50 residents. It isn’t the real location or number of buildings.',
      'Light flowing along the roads shows changes in road access. It isn’t real medical staff or vehicles moving.',
      'Light reaches villages in order of road access time. The numbers climb with the light, but the calculation is finished the moment you act.',
      'Rice paddies, fields, forests, trees and roof colors are scenery drawn from elevation and slope. They aren’t land-use data.',
      'Sounds are effects that support what you do. Everything can be read on screen without sound.',
    ],
    attributionTitle: 'Data attribution',
    visitNotice: (date: string) =>
      `Clinic schedules come from the Gongju Public Health Center’s clinic information page as of ${date}. Opening days change often, so please check with the health center or branch clinic before visiting.`,
    populationCheck: (date: string) =>
      `Population figures were calculated from Gongju City’s population file (as of ${date}). Every value matches the Ministry of the Interior and Safety’s public data for the same date.`,
  },

  classes: {
    REAL_DATA: 'Real data',
    DERIVED: 'Calculated',
    SIMULATION_ASSUMPTION: 'Game assumption',
  },
}

export const LIMITS_EN: readonly string[] = [
  'This is a simplified educational model. It is not real policy advice.',
  'Times are car access times over the road network. They do not reflect any individual’s real travel time, traffic congestion or waiting time.',
  'A clinic day is a game unit. It does not represent the full range of real medical services, such as specialties, staff or equipment.',
  'Everyone in a village is treated as if they live at one representative point.',
  'Health centers and hospitals in Gongju’s city center (dong areas), private clinics, and facilities in other cities and counties are not in the model.',
  'Village-level counts of residents 65+ are only estimates from district ratios, so they are not shown on screen.',
  'Real operations face staffing, specialty and administrative constraints that this model does not capture.',
  'This model does not say whether clinic days could actually be run wherever you place them.',
  'Of the 15 clinic days in the missions, 5 are a “what if more were available” assumption. It does not mean 5 days should actually be added.',
]
