import type { AppData, Geometry, Landscape, Manifest, Scenario } from './types'

/** 앱과 같은 폴더의 data/에서 정적 파일만 읽는다. 외부 서버를 부르지 않는다. */
export async function loadAppData(base = './data/'): Promise<AppData> {
  const get = async <T>(name: string): Promise<T> => {
    const r = await fetch(base + name)
    if (!r.ok) throw new Error(`${name}: ${r.status}`)
    return (await r.json()) as T
  }
  const [scenario, geometry, landscape, manifest] = await Promise.all([
    get<Scenario>('scenario.json'),
    get<Geometry>('geometry.json'),
    get<Landscape>('landscape.json'),
    get<Manifest>('manifest.json'),
  ])
  const t = await fetch(base + geometry.terrain.file)
  if (!t.ok) throw new Error(`terrain: ${t.status}`)
  const terrain = await t.arrayBuffer()
  return { scenario, geometry, landscape, manifest, terrain }
}
