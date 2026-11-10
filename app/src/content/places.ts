/**
 * 지명의 로마자 표기(국어의 로마자 표기법, 2000 문화관광부 고시 — 행정구역 단위 앞에 붙임표).
 * 영어·베트남어 화면은 같은 로마자 지명을 쓴다. 지명은 번역하지 않는다(「유구읍」은 Yugu-eup이지 다른 이름이 아니다).
 * 데이터 파일(scenario.json 등)은 그대로 두고, 화면에 넘기기 전에 이름 칸만 바꾼 사본을 만든다(localizeData).
 * 한국어 화면은 원본 데이터를 그대로 쓴다.
 */

import type { AppData } from '../data/types'
import type { Lang } from './lang'

/** 읍·면 이름(데이터 id → 로마자). 읍 = -eup, 면 = -myeon */
export const EMD_ROMAN: Record<string, string> = {
  yugu: 'Yugu-eup',
  iin: 'Iin-myeon',
  tancheon: 'Tancheon-myeon',
  gyeryong: 'Gyeryong-myeon',
  banpo: 'Banpo-myeon',
  uidang: 'Uidang-myeon',
  jeongan: 'Jeongan-myeon',
  useong: 'Useong-myeon',
  sagok: 'Sagok-myeon',
  sinpung: 'Sinpung-myeon',
}

/** 보건지소 짧은 이름(데이터 id → 로마자). 화면의 말풍선·표에 쓰는 이름 */
export const FACILITY_ROMAN: Record<string, string> = {
  yugu: 'Yugu',
  iin: 'Iin',
  tancheon: 'Tancheon',
  gyeryong: 'Gyeryong',
  banpo: 'Banpo',
  uidang: 'Uidang',
  jeongan: 'Jeongan',
  useong: 'Useong',
  sagok: 'Sagok',
  sinpung: 'Sinpung',
}

/**
 * 법정리 이름의 앞부분(「리」를 뗀 이름 → 로마자). 소리 나는 대로 적는다(석남 Seongnam, 복룡 Bongnyong, 월암 Woram).
 * 같은 이름이 여러 읍·면에 있으면(신영리·운암리·월곡리) 표기도 같다.
 */
export const VILLAGE_ROMAN: Record<string, string> = {
  // 유구읍
  백교: 'Baekgyo', 노동: 'Nodong', 석남: 'Seongnam', 유구: 'Yugu', 녹천: 'Nokcheon', 신영: 'Sinyeong', 신달: 'Sindal', 입석: 'Ipseok',
  명곡: 'Myeonggok', 구계: 'Gugye', 연종: 'Yeonjong', 세동: 'Sedong', 추계: 'Chugye', 덕곡: 'Deokgok', 문금: 'Mungeum', 탑곡: 'Tapgok',
  동해: 'Donghae', 만천: 'Mancheon',
  // 이인면
  이인: 'Iin', 만수: 'Mansu', 오룡: 'Oryong', 신흥: 'Sinheung', 주봉: 'Jubong', 목동: 'Mokdong', 발양: 'Baryang', 초봉: 'Chobong',
  용성: 'Yongseong', 구암: 'Guam', 달산: 'Dalsan', 산의: 'Sanui', 복룡: 'Bongnyong', 반송: 'Bansong', 이곡: 'Igok', 운암: 'Unam',
  // 탄천면
  삼각: 'Samgak', 광명: 'Gwangmyeong', 장선: 'Jangseon', 안영: 'Anyeong', 덕지: 'Deokji', 화정: 'Hwajeong', 남산: 'Namsan', 가척: 'Gacheok',
  정치: 'Jeongchi', 성: 'Seong', 송학: 'Songhak', 분강: 'Bungang', 유하: 'Yuha', 국동: 'Gukdong', 운곡: 'Ungok', 견동: 'Gyeondong', 대학: 'Daehak',
  // 계룡면
  기산: 'Gisan', 월암: 'Woram', 봉명: 'Bongmyeong', 화은: 'Hwaeun', 내흥: 'Naeheung', 구왕: 'Guwang', 중장: 'Jungjang', 하대: 'Hadae',
  양화: 'Yanghwa', 경천: 'Gyeongcheon', 화헌: 'Hwaheon', 금대: 'Geumdae', 상성: 'Sangseong', 월곡: 'Wolgok', 죽곡: 'Jukgok', 향지: 'Hyangji',
  유평: 'Yupyeong',
  // 반포면
  공암: 'Gongam', 송곡: 'Songgok', 마암: 'Maam', 봉곡: 'Bonggok', 상신: 'Sangsin', 하신: 'Hasin', 온천: 'Oncheon', 학봉: 'Hakbong',
  // 의당면
  두만: 'Duman', 오인: 'Oin', 수촌: 'Suchon', 율정: 'Yuljeong', 청룡: 'Cheongnyong', 유계: 'Yugye', 가산: 'Gasan', 중흥: 'Jungheung',
  도신: 'Dosin', 덕학: 'Deokhak', 요룡: 'Yoryong',
  // 정안면
  광정: 'Gwangjeong', 상룡: 'Sangnyong', 화봉: 'Hwabong', 평정: 'Pyeongjeong', 북계: 'Bukgye', 석송: 'Seoksong', 전평: 'Jeonpyeong',
  쌍달: 'Ssangdal', 고성: 'Goseong', 운궁: 'Ungung', 장원: 'Jangwon', 보물: 'Bomul', 어물: 'Eomul', 내촌: 'Naechon', 사현: 'Sahyeon',
  인풍: 'Inpung', 태성: 'Taeseong', 대산: 'Daesan', 월산: 'Wolsan', 문천: 'Muncheon', 내문: 'Naemun', 산성: 'Sanseong',
  // 우성면
  동대: 'Dongdae', 단지: 'Danji', 방문: 'Bangmun', 상서: 'Sangseo', 평목: 'Pyeongmok', 도천: 'Docheon', 신웅: 'Sinung', 내산: 'Naesan',
  한천: 'Hancheon', 동곡: 'Donggok', 반촌: 'Banchon', 귀산: 'Gwisan', 목천: 'Mokcheon', 방흥: 'Bangheung', 보흥: 'Boheung', 대성: 'Daeseong',
  안양: 'Anyang', 용봉: 'Yongbong', 봉현: 'Bonghyeon', 어천: 'Eocheon', 죽당: 'Jukdang', 오동: 'Odong', 옥성: 'Okseong',
  // 사곡면
  호계: 'Hogye', 화월: 'Hwawol', 계실: 'Gyesil', 해월: 'Haewol', 고당: 'Godang', 대중: 'Daejung', 가교: 'Gagyo', 회학: 'Hoehak',
  월가: 'Wolga', 유룡: 'Yuryong', 부곡: 'Bugok',
  // 신풍면
  산정: 'Sanjeong', 동원: 'Dongwon', 조평: 'Jopyeong', 봉갑: 'Bonggap', 용수: 'Yongsu', 쌍대: 'Ssangdae', 청흥: 'Cheongheung', 대룡: 'Daeryong',
  입동: 'Ipdong', 백룡: 'Baengnyong', 선학: 'Seonhak', 영정: 'Yeongjeong', 평소: 'Pyeongso', 화흥: 'Hwaheung',
}

/** 법정리 이름 `백교리` → `Baekgyo-ri`. 표에 없으면 원래 이름(검사가 빠짐을 잡는다) */
export function villageRoman(name: string): string {
  const stem = name.endsWith('리') ? name.slice(0, -1) : name
  const r = VILLAGE_ROMAN[stem]
  return r ? `${r}-ri` : name
}

/** 보건지소 전체 이름(화면 낭독·툴팁) */
function facilityFull(short: string, lang: Lang): string {
  return lang === 'vi' ? `Trạm y tế ${short}` : `${short} branch clinic`
}

const cache = new Map<string, AppData>()

/**
 * 화면 언어의 지명을 넣은 데이터 사본. 이름 칸만 바꾸고 숫자·좌표·순서는 원본 객체를 그대로 공유한다.
 * 한국어는 원본을 그대로 돌려준다(언어 지원 전과 같은 객체).
 */
export function localizeData(data: AppData, lang: Lang): AppData {
  if (lang === 'ko') return data
  const key = `${lang}|${data.scenario.data_version}`
  const hit = cache.get(key)
  if (hit && hit.terrain === data.terrain) return hit
  const sc = data.scenario
  const scenario = {
    ...sc,
    emds: sc.emds.map((e) => ({ ...e, name: EMD_ROMAN[e.id] ?? e.name })),
    villages: sc.villages.map((v) => ({ ...v, name: villageRoman(v.name) })),
    facilities: sc.facilities.map((f) => {
      const short = FACILITY_ROMAN[f.id] ?? f.short
      return { ...f, short, name: facilityFull(short, lang) }
    }),
  }
  const out: AppData = { ...data, scenario }
  cache.set(key, out)
  return out
}
