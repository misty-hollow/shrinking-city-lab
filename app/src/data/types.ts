/**
 * 전처리(pipeline/)가 만든 정적 데이터의 모양.
 * 값의 의미는 public/data/manifest.json의 semantics가 정의한다.
 */

export type XY = [number, number]
/** [외곽 링, 구멍...] */
export type PolygonRings = XY[][]

export interface Emd {
  id: string
  name: string
  pop: number
  pop65: number
  pop65_pct: number
  label: XY
}

export interface Village {
  id: string
  name: string
  emd: string
  pop: number
  /** 인구 삼분위 0·1·2 */
  size: 0 | 1 | 2
  lon: number
  lat: number
  x: number
  y: number
}

export interface Facility {
  id: string
  name: string
  short: string
  emd: string
  lon: number
  lat: number
  x: number
  y: number
  current_days: number
  schedule_cells: string[]
  schedule_note: string
  coordinate_method: string
}

export interface Scenario {
  data_version: string
  totals: { pop: number; pop65: number; pop65_pct: number; villages: number; facilities: number }
  rules: {
    max_days_per_facility: number
    resident_cap_days: number
    thresholds_min: number[]
    mission_threshold_min: number
    current_total_days: number
    mission_budget: number
    added_assumption_days: number
  }
  size_tiers: { thresholds: [number, number]; radius_ratio: number[] }
  emds: Emd[]
  villages: Village[]
  facilities: Facility[]
  current_allocation: number[]
  matrix: { unit: 'tenths_of_minute'; rounding: string; tenths: number[][] }
}

export interface TerrainHeader {
  file: string
  sha256: string
  cols: number
  rows: number
  cell_km: number
  x0: number
  y0: number
  heights_offset: number
  mask_offset: number
  elevation_m: { min_inside: number; max_inside: number }
  cells_inside: number
}

export interface Geometry {
  emds: { id: string; label: XY; polygons: PolygonRings[] }[]
  city_core: { name: string; members: string[]; label: XY; polygons: PolygonRings[] }
  outer: { polygons: PolygonRings[]; area_km2: number }
  roads: { class: string; coords: XY[] }[]
  rivers: { name: string; coords: XY[] }[]
  water_polygons: PolygonRings[]
  terrain: TerrainHeader
  /** 관계 읽기용 실제 도로망 경로(20분 안 쌍). [마을 i, 지소 j, 좌표(km)]. 계산에는 쓰지 않는다 */
  routes: { threshold_min: number; note: string; pairs: [number, number, XY[]][] }
}

export interface KpiRow {
  x: number[]
  mean_days: number
  worst_emd_days: number
  worst_emd: string
  cov1_pop: number
  cov3_pop: number
  gap_days: number
  p90_tenths: number
}

export type MissionKpi = 'mean_days' | 'worst_emd_days' | 'cov3_pop'

export interface LandscapeCombo {
  budget: number
  threshold_min: number
  n_alloc: number
  density: { x: 'mean_days'; y: 'worst_emd_days'; step: number; cells: [number, number, number][] }
  front: KpiRow[]
  rank_thresholds: Record<MissionKpi, number[]>
}

export interface MissionData {
  kpi: MissionKpi
  label: string
  budget: number
  threshold_min: number
  target: number
  target_rule: string
  top_share_exact_value: number
  share_at_or_above_target: number
  reference: KpiRow
  reference_rule: string
}

export interface Landscape {
  definition: Record<string, string>
  combos: LandscapeCombo[]
  missions: Record<'m1' | 'm2' | 'm3', MissionData>
}

export type DataClass = 'REAL_DATA' | 'DERIVED' | 'SIMULATION_ASSUMPTION'

export interface Manifest {
  product: string
  scenario: string
  data_version: string
  data_version_date: string
  reproducibility: { pipeline_version: string; code_sha256: string; outputs: Record<string, string> }
  display_dates: { population: string; schedule: string; road_network: string }
  sources: {
    population: { publisher: string; title: string; page_url: string; reference_date: string; license: string; method: string }
    schedule: {
      publisher: string
      title: string
      page_url: string
      reference_date: string
      conversion_rule: string
      rows: { facility: string; cells: string[]; note: string; weekly_days: number }[]
    }
    facilities: { title: string; reference_month: string; official_address: string; coordinates: string; excluded: string }
    road_network: {
      publisher: string
      license: string
      osm_latest_object_timestamp: string
      extract_bbox: number[]
      pbf_sha256: string
    }
    routing: {
      engine: string
      image: string
      digest: string
      profile: string
      profile_detail: string
      algorithm: string
      conditions: string
      runtime: string
    }
    boundaries: { publisher: string; title: string; download_url: string; reference_date: string; license: string }
    terrain: { publisher: string; title: string; license: string }
  }
  semantics: Record<string, string>
  classification: { item: string; class: DataClass; note?: string }[]
}

export interface GoldenCase {
  name: string
  x: number[]
  threshold_min: number
  kpis: {
    mean_days: number
    cov1_pop: number
    cov3_pop: number
    zero_pop: number
    worst_emd: number
    worst_emd_days: number
    best_emd: number
    gap_days: number
    p90_tenths: number | null
    time_band_pop: number[] | null
    emd_days: number[]
    emd_zero_pop: number[]
  }
}

export interface Golden {
  tolerance: { days: number; pop: number; minutes: number }
  cases: GoldenCase[]
}

export interface AppData {
  scenario: Scenario
  geometry: Geometry
  landscape: Landscape
  manifest: Manifest
  terrain: ArrayBuffer
}
