/**
 * 화면 문구. 원칙(설계안 5-12): "~해요" 체, 한 문장 한 정보, 느낌표·이모지 없음,
 * 내부 용어는 화면에 쓰지 않는다. 시간은 항상 "도로망 접근시간" 또는 "도로망 {n}분".
 * 날짜·출처는 여기 쓰지 않고 manifest에서 받는다(설계안 8-3).
 * 금지어 검사: src/content/forbidden.test.ts
 */

export const copy = {
  product: 'Shrinking City Lab',
  scenario: '진료일을 나누다 — 공주 보건지소 편',
  dataAndLimits: '자료와 한계',

  stage: {
    start: '시작',
    intro: '소개',
    tutorial: '튜토리얼',
    mission: (n: number) => `미션 ${n}/3`,
    finale: '세 개의 공주',
  },

  threshold: {
    label: '닿는다고 볼 시간',
    help: '도로망 접근시간 · 혼잡·대기 없음',
    option: (t: number) => `${t}분`,
    locked: '확정한 결과는 도로망 15분 기준이에요',
  },

  baseline: {
    label: '기준선',
    current: (date: string) => `현재 실제 (${date.slice(0, 7)}, 10일)`,
    last: (n: number) => `직전 확정 배분 (미션 ${n})`,
  },

  start: {
    headline: '보건지소 10곳, 지금은 주 10일. 5일이 더 생긴다면 어디에 두시겠어요?',
    /** 화면에서는 사실 한 줄 → 질문(두 줄)으로 나눠 쓴다. 숫자와 단위는 한 덩어리(끊지 않는다) */
    fact: ['보건지소 10곳, 지금은 ', '주 10일.'] as const,
    question: ['5일이 더 생긴다면', '어디에 두시겠어요?'] as const,
    sub: '실제 공주시 자료로 만든 교육용 시뮬레이션 · 약 5분',
    begin: '시작',
    stepsLabel: '진행 순서',
    steps: ['지금의 10일이 어느 마을에 닿는지 읽어요', '같은 15일을 세 가지 목표로 다르게 나눠요', '세 배분을 나란히 놓고 누가 얻고 잃는지 봐요'] as const,
    notPolicy: '이 작품은 실제 공주시 행정을 평가하거나 정책을 추천하지 않아요.',
  },

  intro: {
    next: '다음',
    skip: '건너뛰기',
    card1: (pop: string, pct: string) => `공주시 읍·면 10곳에 약 ${pop}이 살아요. 65세 이상이 ${pct}%예요.`,
    card1Small: (date: string) => `주민등록 ${date} · 실제 자료`,
    card1Scope: '공주 시내(동 지역)는 이번 시나리오 범위 밖이에요.',
    card2: (open: number, list: string) =>
      `보건지소는 10곳이지만, 의과 진료가 열리는 곳은 ${open}곳이에요. ${list}.`,
    card2Small: (date: string) => `의과 순회진료 일정 ${date} · 실제 자료`,
    card3: '지금 공주의 진료자원은 이 10일이에요. 진료일 하루는 "한 지소에서 일반진료가 열리는 하루"라는 게임 단위예요.',
    card3SmallReal: (date: string) => `10일 · 실제 자료 · ${date}`,
    card3SmallAssumption: '진료일 단위 · 게임 가정',
  },

  tutorial: {
    title: '튜토리얼 · 지금의 공주',
    step1: '창에 불이 켜진 마을은 진료가 닿는 마을이에요. 창이 모두 켜지면 주 3일 이상이에요. 불이 꺼진 마을에도 사람이 살아요. 진료만 닿지 않아요.',
    step2: '몇 분까지를 "닿는다"고 볼지 바꿔 보세요.',
    step2Changed: (from: string, to: string) =>
      `같은 배분인데 주 1일 이상 닿는 주민이 ${from}에서 ${to}으로 바뀌었어요. 기준도 선택이에요.`,
    step2Return: '15분으로 돌려놓으면 다음으로 넘어가요.',
    step3: '의당 말풍선 끝의 − 를 눌러 진료일 하루를 손으로 가져온 뒤, 다른 지소 말풍선을 눌러 놓아 보세요.',
    step3Pool: (n: number) => `옮길 수 있는 진료일 ${n}일`,
    step3Result: (fac: string, gained: number, thinner: number) =>
      gained > 0
        ? `${fac}에 하루를 놓자 ${gained}개 마을이 처음으로 닿았고, 의당 쪽 ${thinner}개 마을은 두께가 줄었어요.`
        : `${fac}에 하루를 놓았어요. 처음으로 닿은 마을은 없고, 의당 쪽 ${thinner}개 마을은 두께가 줄었어요.`,
    next: '다음',
    skip: '건너뛰기',
    startMission: '미션 시작',
  },

  /** 미션 세 개(설계안 7-2~7-4). 이름은 정책이 아니라 목표다(8-4). */
  missions: {
    m1: {
      title: '미션 1 · 평균을 끌어올려라',
      name: '평균을 끌어올려라',
      goal: (target: string) =>
        `주민 한 사람이 15분 안에 갈 수 있는 진료일의 평균을 ${target} 이상으로 만들어 주세요.`,
      kpiName: '평균 진료일',
      reference: '참고 배분 · 평균형',
      referenceNote: '"평균 진료일" 지표만 보면 가장 높은 배분 하나예요.',
    },
    m2: {
      title: '미션 2 · 어디에도 빈 곳이 없게',
      name: '어디에도 빈 곳이 없게',
      goal: (target: string) => `가장 불리한 읍·면의 평균 진료일을 ${target} 이상으로 만들어 주세요.`,
      kpiName: '가장 불리한 읍·면',
      reference: '참고 배분 · 보장형',
      referenceNote: '"가장 불리한 읍·면" 지표만 보면 가장 높은 배분 하나예요.',
    },
    m3: {
      title: '미션 3 · 두껍게 닿게',
      name: '두껍게 닿게',
      goal: (target: string) => `15분 안에 주 3일 이상 진료가 닿는 주민을 ${target} 이상으로 늘려 주세요.`,
      kpiName: '주 3일 이상 닿는 주민',
      reference: '참고 배분 · 두꺼운 서비스형',
      referenceNote: '"주 3일 이상 닿는 주민" 지표만 보면 가장 높은 배분 하나예요.',
    },
  },

  briefing: {
    resource: '배분할 진료일 주 15일 = 실제 10일 + 가정 5일',
    realBadge: (date: string) => `실제 자료 · 진료일정 ${date}`,
    assumptionBadge: '게임 가정 · 5일이 더 확보됐다면',
    assumption:
      '이 미션은 가상 정책실험이에요. 지금의 10일에 5일이 더 생겼다고 가정해요. 실제로 5일을 늘려야 한다는 뜻은 아니에요.',
    judged: '판정 기준: 도로망 15분 · 지표는 배분할 때마다 바로 갱신돼요',
    kept: '앞 미션의 배분은 그대로 보관돼요. 마지막 「세 개의 공주」에서 세 배분을 나란히 봐요.',
    begin: '배분 시작',
    skip: '건너뛰기',
  },

  pool: {
    title: '진료일 풀',
    remaining: (n: string, b: number) => `남은 진료일 ${n} / ${b}`,
    caption: '실제 10일 + 가정 5일',
    captionTutorial: '현재 실제 10일',
    empty: '모두 놓았어요. 확정하거나 옮겨 보세요.',
    fillFirst: '남은 진료일을 모두 놓으면 확정할 수 있어요.',
  },

  facility: {
    closed: '미운영',
    reach: (t: number, n: number, pop: string) => `${t}분 안 마을 ${n}곳 · ${pop}`,
    dec: (name: string) => `${name} 진료일 하루 빼기`,
    inc: (name: string) => `${name} 진료일 하루 더하기`,
    keysHint: '말풍선을 고른 뒤 + − 또는 → ← 키로 하루를 놓거나 빼요. ↑ ↓ 키로 옆 지소로 옮겨 가요.',
    listLabel: '보건지소 10곳',
    dockOrder: '서쪽에서 동쪽 순서',
  },

  missionCard: {
    targetLabel: (v: string) => `목표 ${v}`,
    achieved: (n: number) => `목표 달성 · 가능한 배분 중 상위 ${n}%`,
    notYet: (n: number) => `가능한 배분 중 상위 ${n}%`,
    remainingDays: (v: string) => `목표까지 주 ${v}일`,
    remainingPop: (v: string) => `목표까지 ${v}`,
    judgedAt15: '미션 판정은 15분 기준이에요',
    confirm: '이 배분으로 확정',
    goalTag: '미션 지표',
    emdStrip: (target: string) => `읍·면 10곳의 평균 진료일 · 가로선 = 목표 ${target}`,
    belowTarget: (n: number) => (n > 0 ? `목표보다 낮은 읍·면 ${n}곳` : '모든 읍·면이 목표 이상이에요'),
    gapLine: (v: string) => `읍·면 격차 주 ${v}일`,
    thickness: (target: string) => `주민 수로 본 진료 두께 · 세로선 = 목표 ${target}`,
    thickParts: ['주 3일 이상', '주 1~2일', '닿지 않음'] as const,
    compareLast: (n: number) => `직전 확정 배분(미션 ${n})과 비교하며 보기`,
    compareLastOff: '현재 실제와 비교로 돌아가기',
  },

  kpi: {
    meanDays: '평균 진료일',
    meanDaysSub: (t: number) => `${t}분 안 · 주민 수로 평균 · 최대 5일`,
    cov1: '주 1일 이상 닿는 주민',
    cov1Sub: (n: string) => `닿지 않는 주민 ${n}`,
    cov3: '주 3일 이상 닿는 주민',
    worst: '가장 불리한 읍·면',
    gap: '읍·면 격차',
    gapValue: (v: string) => `주 ${v}일 차이`,
    gapSub: (hi: string, hv: string, lo: string, lv: string) => `가장 높은 곳 ${hi} ${hv} · 가장 낮은 곳 ${lo} ${lv}`,
    p90: '90% 접근시간',
    p90Sub: '주민 10명 중 9명은 도로망 이 시간 안에 운영 지소에 닿아요',
    bands: ['10분 안', '10~15분', '15~20분', '20분 넘게'] as const,
    none: '운영 지소 없음',
    info: '설명',
    better: '좋아짐',
    worse: '나빠짐',
    same: '같음',
    /** 증감 범례 앞 기준선(부호 = 값의 방향, 색 = 좋아짐/나빠짐) */
    legendBase: (base: string) => `${base} 대비`,
    legendCurrent: '현재 실제(10일)',
    legendLast: (n: number) => `미션 ${n} 배분`,
    explain: {
      meanDays: (t: number) =>
        `각 마을에서 도로망 ${t}분 안에 있는 지소들의 진료일을 더한 값(최대 5일)을, 마을 주민 수로 평균했어요. 진료일과 5일 상한은 게임 가정이에요.`,
      cov1: (t: number) => `도로망 ${t}분 안에 주 1일 이상 진료가 열리는 마을에 사는 주민 수예요.`,
      cov3: (t: number) => `도로망 ${t}분 안에 주 3일 이상 진료가 열리는 마을에 사는 주민 수예요.`,
      worst: '읍·면마다 마을 진료일을 주민 수로 평균한 값이 가장 낮은 곳이에요. 같으면 닿지 않는 주민이 많은 곳을 보여 줘요.',
      gap: '읍·면 평균 진료일이 가장 높은 곳과 가장 낮은 곳의 차이예요. 작을수록 고르게 닿아요.',
      p90: '진료일이 하루 이상 놓인 지소 중 가장 가까운 곳까지의 도로망 접근시간을 주민 수로 줄 세웠을 때 90%째 값이에요. 혼잡·신호·대기 시간은 넣지 않았어요.',
    },
  },

  emdList: {
    title: '읍·면별 진료일',
    sortLow: '낮은 순',
    sortName: '이름순',
    zeroVillages: (n: number) => `0일 마을 ${n}곳`,
  },

  controls: {
    deltaOn: '증감 보기 켬',
    deltaOff: '증감 보기 끔',
  },

  region: {
    close: '닫기',
    pop: (v: string) => `인구 ${v}`,
    pop65: (pct: string) => `65세 이상 ${pct}%`,
    pop65Badge: (date: string) => `실제 자료 · ${date}`,
    days: (v: string) => `읍·면 평균 ${v}`,
    zeroTitle: '진료가 닿지 않는 마을',
    zeroNone: '진료가 닿지 않는 마을은 없어요',
    facility: (name: string, days: string) => `이 읍·면의 지소: ${name} · ${days}`,
  },

  debrief: {
    achieved: (n: number) => `달성 · 가능한 배분 중 상위 ${n}%`,
    missed: (n: number) => `미달 · 가능한 배분 중 상위 ${n}%`,
    mixedEffect:
      '이 결과는 실제 10일에 가정 5일을 더한 15일 기준이에요. 현재 실제(10일)와의 차이에는 5일이 늘어난 효과도 섞여 있어요.',
    gained: '얻은 것',
    gainedNone: '기준선보다 좋아진 지표는 없어요',
    lost: '잃은 것',
    lostTitle: (n: number, pop: string) => `진료가 닿지 않게 된 마을 ${n}곳 · ${pop}`,
    lostNoneButThinner: (n: number, pop: string) =>
      `진료가 닿지 않게 된 마을은 없어요. 두께가 줄어든 마을은 ${n}곳 · ${pop}이에요.`,
    lostNone: '기준선보다 나빠진 마을은 없어요',
    more: (n: number) => `${n}곳 더 보기`,
    less: '접기',
    table: '6개 지표',
    colKpi: '지표',
    colBase: '현재 실제 (10일)',
    colMine: '내 배분 (15일)',
    colDiff: '차이',
    landscape: '배분 지형도',
    landscapeSentence: '오른쪽 위로 갈수록 두 지표가 모두 좋아요. 그런데 오른쪽 끝과 위쪽 끝은 서로 다른 배분이에요.',
    landscapeX: '평균 진료일 (주)',
    landscapeY: '가장 불리한 읍·면 (주)',
    legendMine: '내 배분 (15일)',
    legendCurrent: '현재 실제 (10일)',
    legendFront: '우열 없는 배분',
    legendDensity: (n: string) => `가능한 배분 ${n}개의 분포 (15일, 칸이 진할수록 많음)`,
    legendOthers: '다른 미션 결과 (15일)',
    otherPoint: (n: number) => `미션 ${n}`,
    tableView: '표로 보기',
    otherGoal: '다른 목표였다면',
    otherGoalLine: (kpi: string) =>
      `같은 15일로 "${kpi}"을 높인 배분은 이렇게 달라요. 무대의 회색 탑이 그 배분이에요. 다음 미션에서 직접 해 보세요.`,
    ghostShow: '참고 배분 보기',
    ghostHide: '참고 배분 숨기기',
    compareTitle: (n: number) => `미션 ${n} 배분과 비교 · 둘 다 15일`,
    compareLine: (n: number, better: number, worse: number) =>
      `같은 15일을 다르게 나눴어요. 미션 ${n} 배분보다 좋아진 마을 ${better}곳, 나빠진 마을 ${worse}곳이에요.`,
    compareColPrev: (n: number) => `미션 ${n}`,
    compareColMine: '이번 배분',
    compareBetter: '좋아진 읍·면',
    compareWorse: '나빠진 읍·면',
    compareNone: '없어요',
    compareStage: (n: number) => `무대에서 미션 ${n} 배분과 비교`,
    compareStageOff: '무대 비교 끄기',
    limitTitle: '이 모델의 한계',
    next: '다음 미션',
    toFinale: '세 개의 공주 보기',
    again: '다시 배분',
    home: '처음으로',
  },

  /** S6 「세 개의 공주」(설계안 5-7, 7-5). 순위·점수·정답을 말하지 않는다. */
  finale: {
    title: '세 개의 공주',
    col: (n: number) => `미션 ${n}`,
    goalLegend: '테두리 칸 = 그 미션이 목표로 삼은 지표',
    lead: '세 배분 모두 같은 주 15일을 나눴지만, 무엇을 중요하게 봤느냐에 따라 좋아진 곳과 나빠진 곳이 달라졌어요.',
    basis: '세 배분 모두 실제 10일 + 가정 5일 = 15일 기준 · 가상 정책실험',
    notCurrent: '지금 실제로 운영하는 주 10일과는 다른 가상 배분이에요. 비교는 모두 도로망 15분 기준이에요.',
    reference: '참고 배분',
    referenceNote: '건너뛴 미션은 그 지표만 보면 가장 높은 배분 하나(참고 배분)로 채웠어요.',
    achieved: (n: number) => `달성 · 상위 ${n}%`,
    missed: (n: number) => `미달 · 상위 ${n}%`,
    goalTag: '이 미션의 목표',
    /** 좁은 열의 태그(화면 낭독은 goalTag) */
    goalShort: '목표',
    factMean: '평균 진료일',
    factWorst: '가장 불리한 읍·면',
    factCov3: '주 3일 이상 닿는 주민',
    factZero: (n: number, pop: string) => `닿지 않는 마을 ${n}곳 · ${pop}`,
    factP90: (v: string) => `90% 접근시간 ${v}`,
    thinEmds: (list: string) => `주 1일 미만 읍·면 ${list}`,
    thickEmds: (list: string) => `주 3일 이상 읍·면 ${list}`,
    noneEmds: '없음',
    allocStrip: '보건지소별 진료일',
    open: (title: string) => `${title} 배분을 무대에서 크게 보기`,
    openHint: '눌러서 무대에서 크게 보기',
    back: '세 개로 돌아가기',
    focusTitle: (title: string) => `${title} · 주 15일 배분`,
    base: '지도 증감 기준',
    baseCurrent: '현재 실제 (10일)',
    baseMission: (n: number) => `미션 ${n} (15일)`,
    mapLabel: (title: string, zero: number, worst: string) =>
      `${title} 배분의 위에서 본 지도. 닿지 않는 마을 ${zero}곳, 가장 불리한 읍·면 ${worst}.`,
    tableTitle: '6개 지표 · 도로망 15분',
    allocTitle: '보건지소별 진료일',
    allocTotal: '합계',
    allocTotalValue: '주 15일 = 실제 10일 + 가정 5일',
    emdTitle: '읍·면별 평균 진료일',
    emdLegend: '증감 = 바로 왼쪽 미션 배분 대비 · 점선 칸 = 그 배분에서 가장 불리한 읍·면',
    meanLine: (a: string, b: string, c: string, similar: boolean) =>
      similar ? `평균 진료일은 ${a} · ${b} · ${c}로 비슷하지만,` : `평균 진료일은 ${a} · ${b} · ${c}이에요.`,
    zeroLine: (a: number, b: number, c: number) => `진료가 닿지 않는 마을은 ${a} · ${b} · ${c}곳이에요.`,
    overlapLine: (union: number, all: number) =>
      `세 배분 중 한 번이라도 닿지 않는 마을 ${union}곳 가운데 세 배분 모두에서 닿지 않는 마을은 ${all}곳이에요. 나머지는 배분에 따라 달라져요.`,
    sameZero: '세 배분에서 닿지 않는 마을은 같은 곳이에요.',
    noZero: '세 배분 모두 닿지 않는 마을이 없어요.',
    zeroTitle: '0일이 된 마을',
    zeroNone: '없어요',
    closing: '같은 자원이라도 목표에 따라 좋은 배분이 달라요. 평균 뒤에는 늘 어느 지역의 희생이 있어요.',
    home: '처음으로',
  },

  legend: {
    title: '읽는 법',
    collapse: '읽는 법 닫기',
    expand: '읽는 법',
    villageFull: '창이 모두 켜진 마을 = 주 3~5일 닿아요',
    villageHalf: '벽마다 창 하나에 불 = 주 1~2일',
    villageEmpty: '창이 어두운 마을 = 진료가 닿지 않아요. 사람은 살아요',
    villageNeutral: '집 한 채 ≈ 주민 50명',
    house: '집 한 채 ≈ 주민 50명 · 실제 집의 수나 자리가 아니에요',
    tower: '말풍선의 불 켜진 칸 하나 = 진료일 하루(탑의 등칸도 같아요) · 격주는 반 칸',
    route: '길의 빛 = 도로망으로 닿는 길(가리키면 보여요) · 실제 의료진·차량의 움직임이 아니에요',
    ghost: '옆의 흐린 탑 = 비교하는 배분',
    better: '좋아짐',
    worse: '나빠짐',
    deltaOf: '기준선 대비',
    worst: '흰 점선 = 가장 불리한 읍·면',
    cityCore: '흐린 종이 = 공주 시내(이번 모델 밖)',
    landscape: '논·밭·숲·나무·지붕 색은 풍경 표현이에요. 자료가 아니에요.',
  },

  /** 세계가 먼저(설계안 6-17): 말풍선·손·미리보기·아이콘 */
  world: {
    markersLabel: '보건지소 10곳 · 서쪽에서 동쪽 순서',
    markerAria: (name: string, emd: string, days: string) => `${name} ${emd}, ${days}.`,
    handLabel: (left: number, budget: number) => `남은 진료일 ${left} / ${budget}`,
    handCount: (n: number) => `×${n}`,
    handCaption: '남은 진료일',
    handTutorial: '옮길 진료일',
    handTutorialEmpty: '의당에서 하루를 가져와요',
    handEmpty: '모두 놓았어요',
    handReal: (n: number) => `실제 ${n}`,
    handAssumed: (n: number) => `가정 ${n}`,
    preview: {
      blockedEmpty: '손에 남은 진료일이 없어요. 다른 지소 말풍선의 − 로 하루를 가져오세요.',
      blockedMax: '한 지소는 주 5일까지예요',
      blockedNone: '뺄 진료일이 없어요',
      blockedTutorial: '튜토리얼에서는 의당에서 하루를 가져와 다른 지소에 놓아요',
      newly: (n: number) => `마을 ${n}곳에 새로 닿아요`,
      thicker: (n: number) => `마을 ${n}곳이 주 3일 이상이 돼요`,
      more: (n: number) => `마을 ${n}곳의 진료일이 늘어요`,
      lost: (n: number) => `마을 ${n}곳에 닿지 않게 돼요`,
      thinner: (n: number) => `마을 ${n}곳이 주 3일 아래로 내려가요`,
      less: (n: number) => `마을 ${n}곳의 진료일이 줄어요`,
      same: '달라지는 마을은 없어요',
      days: (fac: string, a: string, b: string) => `${fac} 주 ${a} → ${b}`,
      /** 점선 판 머리(놓기 전이라는 표시) */
      headInc: (fac: string) => `${fac}에 1일 놓으면`,
      headDec: (fac: string) => `${fac}에서 1일 빼면`,
      tag: '미리보기',
      hintInc: '클릭해서 놓기 · Esc 취소',
      hintDec: '클릭해서 빼기 · Esc 취소',
      hintUndo: '누르면 되돌려요 · Ctrl Z',
      hud: (v: string) => `미리보기 → ${v}`,
    },
    undo: '되돌리기',
    undoHint: '마지막 조작을 거꾸로',
    topOn: '위에서 보기',
    topOff: '비스듬히 보기',
    details: '지표 자세히 · 읍·면 10곳',
    detailsTitle: '지표 자세히',
    detailsClose: '지표 자세히 닫기',
    finishHint: (n: number) => `남은 ${n}일을 모두 놓으면 확정할 수 있어요`,
    appreciateSkip: '누르면 결과를 봐요',
    lostPin: (name: string, pop: string) => `${name} ${pop} · 닿지 않게 됨`,
    lostMore: (n: number) => `외 ${n}곳`,
    debriefDetails: '결과 자세히 · 배분 지형도',
    debriefDetailsClose: '결과 자세히 닫기',
    debriefKpiTitle: '목표는 가능한 배분 중 상위 10% 경계 · 6개 지표를 현재 실제(10일)와 내 배분(15일)으로 비교',
    debriefCols: ['지표', '현재 실제', '내 배분', '차이'] as const,
    lostLabel: '잃은 것',
    lostLine: (n: number, pop: string) => `진료가 닿지 않게 된 마을 ${n}곳 · ${pop}`,
    lostOnMap: '지도에 빨간 표지로 표시했어요',
    lostDetail: (list: string, more: number) => (more > 0 ? `${list} 외 ${more}곳` : list),
    lostNone: '진료가 닿지 않게 된 마을은 없어요',
    finaleTabs: '미션 배분 고르기',
    finaleLead: '세 개의 공주 · 같은 15일, 세 가지 목표',
    finaleBoard: '세 배분 나란히 보기',
    finaleBoardClose: '세계로 돌아가기',
    finaleTableTitle: '6개 지표 · 도로망 15분',
  },

  hud: {
    kpiTitle: '6개 지표',
    emdOpen: '지표 자세히',
    emdClose: '지표 자세히 닫기',
    goalReached: '목표 달성',
  },

  toast: {
    gain: (fac: string, n: number, pop: string) => `${fac} +1일 · 새로 닿은 마을 ${n}곳 · 주민 ${pop}`,
    thicker: (fac: string, n: number) => `${fac} +1일 · 마을 ${n}곳의 진료일이 늘었어요`,
    loss: (fac: string, n: number, pop: string) => `${fac} −1일 · 닿지 않게 된 마을 ${n}곳 · 주민 ${pop}`,
    thinner: (fac: string, n: number) => `${fac} −1일 · 마을 ${n}곳의 진료일이 줄었어요`,
    none: (fac: string, delta: string) => `${fac} ${delta} · 달라진 마을은 없어요`,
    tGain: (from: number, to: number, n: number, pop: string) => `기준 ${from}분 → ${to}분 · 새로 닿은 마을 ${n}곳 · 주민 ${pop}`,
    tLoss: (from: number, to: number, n: number, pop: string) => `기준 ${from}분 → ${to}분 · 닿지 않게 된 마을 ${n}곳 · 주민 ${pop}`,
    tSame: (from: number, to: number) => `기준 ${from}분 → ${to}분 · 닿는 마을은 그대로예요`,
  },

  sound: {
    label: '소리',
    on: '소리 켬',
    off: '소리 끔',
  },

  panelLabel: '배분 패널',

  camera: {
    group: '카메라 시점',
    overview: '전체',
    north: '북쪽으로',
    top: '위에서 보기',
  },

  dataChip: (pop: string, sched: string, road: string) => `자료 기준 ${pop} · 일정 ${sched} · 도로망 ${road}`,

  live: (fac: string, days: string, mean: string, zero: string) =>
    `${fac} ${days}. 평균 진료일 ${mean}. 닿지 않는 주민 ${zero}.`,
  liveThreshold: (t: number, mean: string, zero: string) =>
    `기준 ${t}분. 평균 진료일 ${mean}. 닿지 않는 주민 ${zero}.`,

  village: {
    tooltipPop: (emd: string, pop: string) => `${emd} · 인구 ${pop}`,
    tooltipDays: (v: string) => `닿는 진료일 ${v}`,
    tooltipNone: (t: number) => `도로망 ${t}분 안에 지소가 없어요`,
    worstTag: '가장 불리',
    emdThickShare: (pct: number) => `3일 이상 ${pct}%`,
    cityCore: '공주 시내 · 범위 밖',
  },

  noWebgl: '이 브라우저에서는 3D를 표시할 수 없어요. 아래 지소 카드와 지표만으로 플레이할 수 있어요.',
  loading: '공주 지형 모형을 준비하고 있어요',
  loadError: '자료를 불러오지 못했어요. 페이지를 새로고침해 주세요.',
  mobile: {
    body: '이 작품은 데스크톱 화면에서 플레이할 수 있어요.',
  },

  dataPage: {
    title: '자료와 한계',
    close: '닫기',
    whatTitle: '이 작품은 무엇이고 무엇이 아닌가',
    what: '실제 공주시 자료를 단순화해, 공공서비스를 나눌 때 어느 지역이 얻고 어느 지역이 잃는지 직접 체험하는 교육용 시뮬레이션이에요.',
    whatNot: '실제 공주시 행정 평가, 최적 정책 추천 도구, 의료정책 의사결정 시스템이 아니에요.',
    sourcesTitle: '자료 출처와 기준일',
    colItem: '항목',
    colSource: '출처',
    colDate: '기준일',
    colClass: '분류',
    methodTitle: '계산 방식',
    method: [
      '각 마을(법정리)의 대표점에서 각 보건지소까지 자동차 도로망 최단 접근시간을 한 번 계산해 두었어요. 혼잡·신호·주차·대기 시간은 넣지 않았어요.',
      '출발점은 마을 대표점에서 가장 가까운, 직접 들어갈 수 있는 일반 도로예요. 고속도로 본선·램프, 자동차 전용 구간, 터널에서는 출발하지 않아요. 출발한 뒤의 경로에는 고속도로도 써요.',
      '마을에서 기준 시간(10·15·20분) 안에 있는 지소들의 주당 진료일을 더해요. 한 주민이 쓸 수 있는 진료일은 주 5일에서 멈춰요.',
      '평균 진료일은 마을 값을 주민 수로 평균한 값이에요. 읍·면 값도 같은 방법으로 읍·면 안에서 평균해요.',
      '90% 접근시간은 진료일이 하루 이상 놓인 지소 중 가장 가까운 곳까지의 시간을 주민 수로 줄 세웠을 때 90%째 값이에요.',
      '미션 목표치는 가능한 모든 배분(15일, 15분) 중 상위 10% 경계값이에요. 손으로 정하지 않았어요.',
    ],
    assumptionsTitle: '게임 가정',
    limitsTitle: '한계',
    reproTitle: '자료 판본',
    creditsTitle: '만든 곳',
    credits: '공주대학교 캡스톤 디자인 프로젝트 · 2026',
    fonts: '글꼴: Pretendard(OFL-1.1) · Hahmlet(OFL-1.1). 효과음은 브라우저에서 합성한 소리예요.',
    displayTitle: '화면 표현',
    display: [
      '집 한 채는 주민 약 50명을 뜻하는 기호예요. 실제 건물의 위치나 수가 아니에요.',
      '길을 따라 흐르는 빛은 도로망 접근성의 변화를 보여 주는 표현이에요. 실제 의료진이나 차량의 움직임이 아니에요.',
      '빛이 마을에 닿는 순서는 도로망 접근시간 순서예요. 지표 숫자는 빛을 따라 오르지만, 계산은 조작하는 순간 끝나요.',
      '논·밭·숲·나무와 지붕 색은 고도와 경사로 만든 풍경 표현이에요. 토지이용 자료가 아니에요.',
      '소리는 조작을 거드는 효과음이에요. 소리 없이도 모든 정보를 화면에서 볼 수 있어요.',
    ],
    attributionTitle: '데이터 출처 표기',
    visitNotice: (date: string) =>
      `진료 일정은 ${date} 기준 공주시보건소 진료안내 페이지를 옮긴 것이에요. 운영 여부는 수시로 바뀌니, 방문 전에 해당 보건(지)소에 꼭 확인해 주세요.`,
    populationCheck: (date: string) =>
      `인구 값은 공주시 인구현황 파일(${date} 기준)로 계산했고, 같은 기준일의 행정안전부 공개 자료와 값이 모두 같아요.`,
  },

  classes: {
    REAL_DATA: '실제 자료',
    DERIVED: '계산값',
    SIMULATION_ASSUMPTION: '게임 가정',
  },
} as const

/** 4-9절 한계 9문장. 순서가 곧 번호다. */
export const LIMITS = [
  '교육용 단순화 모델이에요. 실제 정책 권고가 아니에요.',
  '시간은 도로망 자동차 접근시간이에요. 실제 개인의 이동시간·교통혼잡·대기시간은 반영하지 않아요.',
  '진료일은 게임용 단위예요. 진료 과목·의료진·장비 같은 실제 의료서비스 전체를 나타내지 않아요.',
  '마을 주민 전체가 마을 대표점 한 곳에 있다고 봤어요.',
  '공주 시내(동 지역)의 보건소·병원, 민간 의원, 다른 시군의 시설은 모델에 없어요.',
  '법정리별 65세 이상 인구는 읍·면 비율로 나눈 추정값이라 화면에 쓰지 않았어요.',
  '실제 운영에는 이 모델이 표현하지 않는 인력·전문과·행정 제약이 있어요.',
  '진료일을 어디에 두어도 실제로 그렇게 운영할 수 있는지는 이 모델이 말하지 않아요.',
  '미션의 진료일 15일 중 5일은 "추가로 확보됐다면"이라는 가정이에요. 실제로 5일을 늘려야 한다는 뜻이 아니에요.',
] as const

/**
 * 금지어가 부정문으로 들어가야 하는, 설계안이 문장을 고정한 문구(5-1, 4-9, 5-4, 2-7).
 * 금지어 검사는 이 문장들만 예외로 본다.
 */
export const APPROVED_NEGATIONS = [
  copy.start.notPolicy,
  copy.briefing.assumption,
  copy.dataPage.whatNot,
  LIMITS[1],
  LIMITS[8],
] as const
