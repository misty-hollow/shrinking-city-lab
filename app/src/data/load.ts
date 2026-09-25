import type { AppData, Geometry, Landscape, Manifest, Scenario } from './types'

/**
 * 앱과 같은 폴더의 data/에서 정적 파일만 읽는다. 외부 서버를 부르지 않는다.
 * 경로는 빌드의 base를 따른다. 기본 빌드(base './')는 어느 하위 경로에 올려도 되고, 사이트 뿌리에 올려
 * SPA 물러섬(없는 경로 → index.html)을 쓰는 배포(geoleobom.kr)는 `--base=/`로 빌드해 `/p/...` 같은 깊은
 * 주소에서도 자산·자료를 뿌리에서 찾는다.
 */
export async function loadAppData(base = `${import.meta.env.BASE_URL}data/`): Promise<AppData> {
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
