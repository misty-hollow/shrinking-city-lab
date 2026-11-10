/**
 * 「자료와 한계」가 manifest.json에서 그대로 읽어 보이는 한국어 문장의 영어·베트남어.
 * manifest는 파이프라인 산출물이라 손대지 않는다(CLAUDE.md 2절). 그래서 원문 문장 자체를 열쇠로 번역을 찾는다.
 * 원문이 바뀌면 번역이 없어 한국어가 그대로 보이고, manifestText.test.ts가 그 빠짐을 잡는다.
 *
 * 공식 자료·기관 이름은 번역 뒤에 원래 이름을 남긴다(출처를 찾을 수 있게, 다른 자료와 헷갈리지 않게).
 */

import { getLang } from './lang'

interface Entry {
  ko: string
  en: string
  vi: string
}

export const MANIFEST_TEXT: readonly Entry[] = [
  {
    ko: '행정안전부_지역별(법정동) 성별 연령별 주민등록 인구수_20260831',
    en: 'Ministry of the Interior and Safety (Korea): resident registration population by legal dong, sex and age, 2026-08-31 — original title 「행정안전부_지역별(법정동) 성별 연령별 주민등록 인구수_20260831」',
    vi: 'Bộ Nội vụ và An toàn Hàn Quốc: dân số đăng ký cư trú theo dong pháp định, giới tính và độ tuổi, ngày 2026-08-31 — tên gốc 「행정안전부_지역별(법정동) 성별 연령별 주민등록 인구수_20260831」',
  },
  {
    ko: '이용허락범위 제한 없음(공공데이터포털 표시)',
    en: 'no restriction on permitted use (as marked on Korea’s Public Data Portal)',
    vi: 'không giới hạn phạm vi sử dụng (theo ghi chú trên Cổng dữ liệu công Hàn Quốc)',
  },
  {
    ko: '행정안전부, 「지역별(법정동)·(행정동) 성별 연령별 주민등록 인구수」(2026-08-31 기준), 공공데이터포털 — 이용허락범위 제한 없음(공공데이터포털 표시)',
    en: 'Ministry of the Interior and Safety (Korea), “Resident registration population by region (legal dong · administrative dong), sex and age” (「지역별(법정동)·(행정동) 성별 연령별 주민등록 인구수」, as of 2026-08-31), Public Data Portal — no restriction on permitted use (as marked on the portal)',
    vi: 'Bộ Nội vụ và An toàn Hàn Quốc, “Dân số đăng ký cư trú theo khu vực (dong pháp định · dong hành chính), giới tính và độ tuổi” (「지역별(법정동)·(행정동) 성별 연령별 주민등록 인구수」, ngày 2026-08-31), Cổng dữ liệu công — không giới hạn phạm vi sử dụng (theo ghi chú trên cổng)',
  },
  {
    ko: '공주시보건소',
    en: 'Gongju Public Health Center (공주시보건소)',
    vi: 'Trung tâm Y tế công cộng Gongju (공주시보건소)',
  },
  {
    ko: '진료안내 — 공주시보건소 순회근무 현황 (2026. 4. 13. 기준), 의과 진료 표',
    en: 'Clinic information — Gongju Public Health Center visiting schedule (as of 2026-04-13), medical care table (original: 「진료안내 — 공주시보건소 순회근무 현황」)',
    vi: 'Hướng dẫn khám bệnh — lịch làm việc lưu động của Trung tâm Y tế công cộng Gongju (ngày 2026-04-13), bảng khám y khoa (bản gốc: 「진료안내 — 공주시보건소 순회근무 현황」)',
  },
  {
    ko: '요일 칸 ○ = 주 1일, 격주 = 주 0.5일(격주 평균), 빈 칸 = 0일',
    en: 'In the weekday table, ○ = 1 day a week, every other week = 0.5 days a week (averaged), blank = 0 days',
    vi: 'Trong bảng lịch theo thứ, ○ = 1 ngày mỗi tuần, cách tuần = 0,5 ngày mỗi tuần (lấy trung bình), ô trống = 0 ngày',
  },
  {
    ko: '이용조건 별도 확인 필요. 게시물에서 공공누리 유형 표시를 찾지 못했고, 공주시 저작권정책은 공공누리가 없는 자료를 사전 협의 대상으로 둔다. 개별 이용조건·재배포 허용 여부는 별도로 확인하지 못했다. 확정된 이용허락이 아니다',
    en: 'Terms of use still to be confirmed. We found no KOGL (Korea Open Government License) mark on the page, and Gongju City’s copyright policy asks for prior consultation on material without one. We have not separately confirmed the specific terms or whether redistribution is allowed. This is not a confirmed permission',
    vi: 'Điều kiện sử dụng cần được xác nhận riêng. Chúng tôi không thấy ký hiệu giấy phép KOGL (Giấy phép mở của Chính phủ Hàn Quốc) trên trang, và chính sách bản quyền của thành phố Gongju yêu cầu trao đổi trước đối với tài liệu không có ký hiệu này. Chúng tôi chưa xác nhận riêng điều kiện cụ thể hay việc có được phân phối lại hay không. Đây không phải là sự cho phép đã được xác nhận',
  },
  {
    ko: 'HIRA 병원정보서비스 2026.6 좌표. 공식 주소와 HIRA 주소가 다른 유구·정안은 OSM 객체 중심점',
    en: 'Coordinates from HIRA (Health Insurance Review & Assessment Service) hospital information, 2026-06. For Yugu and Jeongan, where the official address and the HIRA address differ, the center of the OSM object',
    vi: 'Tọa độ từ dịch vụ thông tin bệnh viện của HIRA (Cơ quan Thẩm định và Đánh giá Bảo hiểm Y tế Hàn Quốc), tháng 6/2026. Riêng Yugu và Jeongan, nơi địa chỉ chính thức và địa chỉ của HIRA khác nhau, dùng tâm của đối tượng OSM',
  },
  {
    ko: '건강보험심사평가원 「전국 병의원 및 약국 현황 2026.6」 병원정보서비스 — 공공누리 제1유형(출처표시) — 공공데이터포털 데이터셋 페이지 표시, 2026-09-25 확인',
    en: 'Health Insurance Review & Assessment Service (건강보험심사평가원), “Hospitals, clinics and pharmacies nationwide, 2026-06” (「전국 병의원 및 약국 현황 2026.6」), hospital information service — KOGL Type 1 (attribution) — as marked on the Public Data Portal dataset page, checked 2026-09-25',
    vi: 'Cơ quan Thẩm định và Đánh giá Bảo hiểm Y tế (건강보험심사평가원), “Bệnh viện, phòng khám và nhà thuốc toàn quốc, 2026-06” (「전국 병의원 및 약국 현황 2026.6」), dịch vụ thông tin bệnh viện — KOGL loại 1 (ghi nguồn) — theo ghi chú trên trang dữ liệu của Cổng dữ liệu công, kiểm tra ngày 2026-09-25',
  },
  {
    ko: 'OpenStreetMap contributors (Geofabrik 배포)',
    en: 'OpenStreetMap contributors (distributed by Geofabrik)',
    vi: 'OpenStreetMap contributors (do Geofabrik phân phối)',
  },
  {
    ko: '자유류(free-flow) 도로망 시간. 혼잡·신호 대기·주차·진료 대기 없음',
    en: 'Free-flow road network times. No congestion, waiting at lights, parking or waiting at the clinic',
    vi: 'Thời gian đường bộ khi đường thông thoáng (free-flow). Không tính kẹt xe, chờ đèn, đỗ xe hay chờ khám',
  },
  {
    ko: 'stock /opt/car.lua (osrm-backend v5.27.1 이미지 내장)',
    en: 'stock /opt/car.lua (built into the osrm-backend v5.27.1 image)',
    vi: 'stock /opt/car.lua (có sẵn trong image osrm-backend v5.27.1)',
  },
  {
    ko: '통계청 SGIS 행정동 경계(공공누리 제1유형), 가공 vuski/admdongkor (CC BY 4.0)',
    en: 'Statistics Korea SGIS administrative dong boundaries (KOGL Type 1), processed by vuski/admdongkor (CC BY 4.0)',
    vi: 'Ranh giới dong hành chính của SGIS, Cục Thống kê Hàn Quốc (KOGL loại 1), xử lý bởi vuski/admdongkor (CC BY 4.0)',
  },
  {
    ko: '본 데이터는 통계청 통계지리정보서비스(SGIS)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor), CC BY 4.0(https://creativecommons.org/licenses/by/4.0/)으로 배포된다. Shrinking City Lab이 이를 투영·단순화하고 시내 동 6곳을 하나로 합쳤다.',
    en: 'This data processes the administrative dong boundaries that Statistics Korea’s Statistical Geographic Information Service (SGIS) released under KOGL Type 1 (processing: vuski/admdongkor), distributed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Shrinking City Lab projected and simplified it, and merged the six dong of the city center into one.',
    vi: 'Dữ liệu này xử lý ranh giới dong hành chính mà Dịch vụ Thông tin Địa lý Thống kê (SGIS) của Cục Thống kê Hàn Quốc công bố theo KOGL loại 1 (xử lý: vuski/admdongkor), phân phối theo CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Shrinking City Lab đã chuyển hệ chiếu, đơn giản hóa và gộp 6 dong của khu trung tâm thành một.',
  },
  {
    ko: 'NASA/USGS SRTM 1 arc-second, Mapzen/Tilezen Terrain Tiles(AWS Open Data elevation-tiles-prod, skadi 형식)',
    en: 'NASA/USGS SRTM 1 arc-second, Mapzen/Tilezen Terrain Tiles (AWS Open Data elevation-tiles-prod, skadi format)',
    vi: 'NASA/USGS SRTM 1 arc-second, Mapzen/Tilezen Terrain Tiles (AWS Open Data elevation-tiles-prod, định dạng skadi)',
  },
  {
    ko: 'SRTM은 미국 정부 저작물(퍼블릭 도메인). Terrain Tiles 출처 표기: Mapzen/Tilezen, SRTM(NASA).',
    en: 'SRTM is a work of the US government (public domain). Terrain Tiles attribution: Mapzen/Tilezen, SRTM (NASA).',
    vi: 'SRTM là tác phẩm của chính phủ Hoa Kỳ (phạm vi công cộng). Ghi nguồn Terrain Tiles: Mapzen/Tilezen, SRTM (NASA).',
  },
  {
    ko: '주 10일 = 2026-04-13 의과 순회진료 일정의 합(격주는 주 0.5일로 평균)',
    en: '10 days a week = the sum of the 2026-04-13 visiting doctor schedule (every other week averaged as 0.5 days a week)',
    vi: '10 ngày mỗi tuần = tổng lịch bác sĩ đến khám ngày 2026-04-13 (cách tuần tính trung bình là 0,5 ngày mỗi tuần)',
  },
  {
    ko: '진료일 단위(지소 하나의 주당 일반진료 1일, 모두 같은 가치)',
    en: 'The clinic-day unit (one day of general care a week at one clinic; every clinic day is worth the same)',
    vi: 'Đơn vị ngày khám (một ngày khám thông thường mỗi tuần tại một trạm; mọi ngày khám có giá trị như nhau)',
  },
  {
    ko: '주민 1인 주당 상한 5일',
    en: 'A cap of 5 clinic days a week per resident',
    vi: 'Mỗi người dân tính tối đa 5 ngày khám mỗi tuần',
  },
  {
    ko: "'닿는다' 기준 10·15·20분과 기준 안 지소의 균등 이용",
    en: 'The 10 · 15 · 20 min cutoffs for “within reach,” and equal use of every clinic inside the cutoff',
    vi: 'Các mốc “trong tầm” 10 · 15 · 20 phút, và việc mọi trạm trong mốc được dùng như nhau',
  },
  {
    ko: '추가 진료자원 +5일(미션 총량 15일 = 실제 10일 + 가정 5일)',
    en: '5 extra clinic days (mission total 15 days = 10 real + 5 assumed)',
    vi: 'Thêm 5 ngày khám (tổng của nhiệm vụ 15 ngày = 10 ngày thật + 5 ngày giả định)',
  },
  {
    ko: '정수 배분(격주 배분은 만들 수 없다)',
    en: 'Whole-day allocation (you can’t set every-other-week days)',
    vi: 'Chỉ chia theo ngày tròn (không tạo được lịch cách tuần)',
  },
]

const byKo = new Map(MANIFEST_TEXT.map((e) => [e.ko, e]))

/** manifest의 한국어 문장을 화면 언어로. 한국어이거나 번역이 없으면 원문 그대로 */
export function mtext(ko: string): string {
  const l = getLang()
  if (l === 'ko') return ko
  return byKo.get(ko)?.[l] ?? ko
}
