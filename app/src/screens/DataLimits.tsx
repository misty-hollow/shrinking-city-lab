import { useEffect, useRef } from 'react'

import { LIMITS, copy } from '../content/copy'
import { mtext } from '../content/manifestText'
import type { Manifest } from '../data/types'
import { Badge } from '../ui/common'

/**
 * S8 자료와 한계(설계안 5-9). 어디서든 열고 닫아도 플레이 상태는 그대로다.
 * 표의 날짜·출처·분류는 manifest에서 읽는다(하드코딩하지 않는다, 8-3).
 */
export function DataLimits({ manifest, onClose }: { manifest: Manifest; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const opener = useRef<Element | null>(null)
  // onClose는 부르는 쪽에서 매번 새 함수다. 효과를 그것에 묶으면 뒤 화면이 다시 그려질 때마다(빛·소식 타이머)
  // 포커스가 [닫기]로 튀고 읽던 곳이 맨 위로 돌아간다. 열릴 때 한 번만 건다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    opener.current = document.activeElement
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [])
  // 바깥(어두운 곳)을 눌러 닫기: 누르기와 떼기가 모두 바깥일 때만(종이 안에서 글자를 끌어 고르다 바깥에서 떼면 닫지 않는다)
  const downOnBackdrop = useRef(false)
  const s = manifest.sources
  const it = copy.dataPage.items
  const rp = copy.dataPage.repro
  const rows: { item: string; source: string; url?: string; date: string; cls: 'REAL_DATA' | 'DERIVED' }[] = [
    { item: it.population, source: `${mtext(s.population.title)} · ${mtext(s.population.license)}`, url: s.population.page_url, date: s.population.reference_date, cls: 'REAL_DATA' },
    { item: it.schedule, source: `${mtext(s.schedule.publisher)} · ${mtext(s.schedule.title)}`, url: s.schedule.page_url, date: s.schedule.reference_date, cls: 'REAL_DATA' },
    { item: it.facilities, source: mtext(s.facilities.coordinates), date: s.facilities.reference_month, cls: 'REAL_DATA' },
    { item: it.roads, source: `${mtext(s.road_network.publisher)} · ${mtext(s.road_network.license)}`, date: manifest.display_dates.road_network, cls: 'REAL_DATA' },
    { item: it.matrix, source: `${s.routing.engine} ${s.routing.profile} · ${mtext(s.routing.conditions)}`, date: manifest.display_dates.road_network, cls: 'DERIVED' },
    { item: it.boundaries, source: mtext(s.boundaries.publisher), date: s.boundaries.reference_date, cls: 'REAL_DATA' },
    { item: it.terrain, source: mtext(s.terrain.publisher), date: '—', cls: 'REAL_DATA' },
  ]
  const assumptions = manifest.classification.filter((c) => c.class === 'SIMULATION_ASSUMPTION')
  return (
    <div
      className="data-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="s8-title"
      onMouseDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose()
        downOnBackdrop.current = false
      }}
    >
      <div className="data-sheet paper">
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
                <td>
                  {r.source}
                  {r.url && (
                    <>
                      <br />
                      <a href={r.url} target="_blank" rel="noopener noreferrer">
                        {r.url}
                      </a>
                    </>
                  )}
                </td>
                <td className="num">{r.date}</td>
                <td>
                  <Badge cls={r.cls} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small">
          {mtext(s.schedule.conversion_rule)}. {mtext(manifest.semantics.current_total)}
        </p>
        <p className="small notice">{copy.dataPage.visitNotice(s.schedule.reference_date)}</p>
        <p className="small">{copy.dataPage.populationCheck(s.population.computed_from.reference_date)}</p>

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
              <Badge cls="SIMULATION_ASSUMPTION" /> {mtext(a.item)}
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
              <th>{rp.version}</th>
              <td className="mono">
                {manifest.data_version} ({manifest.data_version_date})
              </td>
            </tr>
            <tr>
              <th>{rp.engine}</th>
              <td className="mono">
                {s.routing.image} · {mtext(s.routing.profile_detail)} · {s.routing.algorithm}
              </td>
            </tr>
            <tr>
              <th>{rp.digest}</th>
              <td className="mono">{s.routing.digest}</td>
            </tr>
            <tr>
              <th>{rp.osm}</th>
              <td className="mono">
                {rp.osmLine(s.road_network.osm_latest_object_timestamp, s.road_network.extract_bbox.join(', '))}
              </td>
            </tr>
            <tr>
              <th>{rp.code}</th>
              <td className="mono">
                {manifest.reproducibility.pipeline_version} · {manifest.reproducibility.code_sha256}
              </td>
            </tr>
          </tbody>
        </table>

        <h3>{copy.dataPage.attributionTitle}</h3>
        <ul className="small">
          <li>{mtext(s.facilities.attribution)}</li>
          <li>{mtext(s.road_network.license)} — OpenStreetMap</li>
          <li>{mtext(s.boundaries.license)}</li>
          <li>{mtext(s.terrain.license)}</li>
          <li>{mtext(s.population.attribution)}</li>
          <li>{copy.dataPage.scheduleAttribution(mtext(s.schedule.publisher), s.schedule.reference_date, mtext(s.schedule.usage_status))}</li>
        </ul>

        <h3>{copy.dataPage.creditsTitle}</h3>
        <p>{copy.dataPage.credits}</p>
        <p className="small">{copy.dataPage.fonts}</p>
      </div>
    </div>
  )
}
