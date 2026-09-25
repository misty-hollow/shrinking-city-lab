import { useEffect, useRef } from 'react'

import { LIMITS, copy } from '../content/copy'
import type { Manifest } from '../data/types'
import { Badge } from '../ui/common'

/**
 * S8 자료와 한계(설계안 5-9). 어디서든 열고 닫아도 플레이 상태는 그대로다.
 * 표의 날짜·출처·분류는 manifest에서 읽는다(하드코딩하지 않는다, 8-3).
 */
export function DataLimits({ manifest, onClose }: { manifest: Manifest; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const opener = useRef<Element | null>(null)
  useEffect(() => {
    opener.current = document.activeElement
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [onClose])
  const s = manifest.sources
  const rows: { item: string; source: string; date: string; cls: 'REAL_DATA' | 'DERIVED' }[] = [
    { item: '법정리 인구, 읍·면 65세 이상', source: `${s.population.publisher} · ${s.population.title}`, date: s.population.reference_date, cls: 'REAL_DATA' },
    { item: '보건지소 의과 순회진료 일정', source: `${s.schedule.publisher} · ${s.schedule.title}`, date: s.schedule.reference_date, cls: 'REAL_DATA' },
    { item: '보건지소 10곳 위치', source: s.facilities.coordinates, date: s.facilities.reference_month, cls: 'REAL_DATA' },
    { item: '도로망', source: `${s.road_network.publisher} · ${s.road_network.license}`, date: manifest.display_dates.road_network, cls: 'REAL_DATA' },
    { item: '도로망 접근시간 161×10', source: `${s.routing.engine} ${s.routing.profile} · ${s.routing.conditions}`, date: manifest.display_dates.road_network, cls: 'DERIVED' },
    { item: '읍·면 경계', source: s.boundaries.publisher, date: s.boundaries.reference_date, cls: 'REAL_DATA' },
    { item: '지형', source: s.terrain.publisher, date: '—', cls: 'REAL_DATA' },
  ]
  const assumptions = manifest.classification.filter((c) => c.class === 'SIMULATION_ASSUMPTION')
  return (
    <div className="data-page" role="dialog" aria-modal="true" aria-labelledby="s8-title" onClick={onClose}>
      <div className="data-sheet paper" onClick={(e) => e.stopPropagation()}>
        <div className="data-head">
          <h2 id="s8-title">{copy.dataPage.title}</h2>
          <button type="button" className="btn btn-small" ref={closeRef} onClick={onClose}>
            {copy.dataPage.close}
          </button>
        </div>

        <h3>{copy.dataPage.whatTitle}</h3>
        <p>{copy.dataPage.what}</p>
        <p>{copy.dataPage.whatNot}</p>

        <h3>{copy.dataPage.sourcesTitle}</h3>
        <table>
          <thead>
            <tr>
              <th>{copy.dataPage.colItem}</th>
              <th>{copy.dataPage.colSource}</th>
              <th>{copy.dataPage.colDate}</th>
              <th>{copy.dataPage.colClass}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item}>
                <td>{r.item}</td>
                <td>{r.source}</td>
                <td className="num">{r.date}</td>
                <td>
                  <Badge cls={r.cls} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small">
          {s.schedule.conversion_rule}. {manifest.semantics.current_total}
        </p>

        <h3>{copy.dataPage.methodTitle}</h3>
        <ol>
          {copy.dataPage.method.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>

        <h3>{copy.dataPage.displayTitle}</h3>
        <ul>
          {copy.dataPage.display.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>

        <h3>{copy.dataPage.assumptionsTitle}</h3>
        <ul>
          {assumptions.map((a) => (
            <li key={a.item}>
              <Badge cls="SIMULATION_ASSUMPTION" /> {a.item}
            </li>
          ))}
        </ul>

        <h3>{copy.dataPage.limitsTitle}</h3>
        <ol>
          {LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>

        <h3>{copy.dataPage.reproTitle}</h3>
        <table>
          <tbody>
            <tr>
              <th>판본</th>
              <td className="mono">
                {manifest.data_version} ({manifest.data_version_date})
              </td>
            </tr>
            <tr>
              <th>경로 엔진</th>
              <td className="mono">
                {s.routing.image} · {s.routing.profile_detail} · {s.routing.algorithm}
              </td>
            </tr>
            <tr>
              <th>이미지 digest</th>
              <td className="mono">{s.routing.digest}</td>
            </tr>
            <tr>
              <th>OSM</th>
              <td className="mono">
                최신 객체 {s.road_network.osm_latest_object_timestamp} · 추출 범위 {s.road_network.extract_bbox.join(', ')}
              </td>
            </tr>
            <tr>
              <th>생성 코드</th>
              <td className="mono">
                {manifest.reproducibility.pipeline_version} · {manifest.reproducibility.code_sha256}
              </td>
            </tr>
          </tbody>
        </table>

        <h3>{copy.dataPage.attributionTitle}</h3>
        <ul className="small">
          <li>{s.road_network.license} — OpenStreetMap</li>
          <li>{s.boundaries.license}</li>
          <li>{s.terrain.license}</li>
          <li>{s.population.license}</li>
        </ul>

        <h3>{copy.dataPage.creditsTitle}</h3>
        <p>{copy.dataPage.credits}</p>
        <p className="small">{copy.dataPage.fonts}</p>
      </div>
    </div>
  )
}
