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
  // SPA 물러섬이 없는 파일 대신 index.html(200)을 돌려주면 JSON은 파싱에서 걸리지만 이진 지형은 그대로 읽힌다.
  // 머리표가 말하는 크기보다 짧으면 자료가 아니다 — 무대를 만들다 깨지기 전에 여기서 멈춘다.
  const h = geometry.terrain
  const need = Math.max(h.heights_offset + h.cols * h.rows * 2, h.mask_offset + (h.cols - 1) * (h.rows - 1))
  if (terrain.byteLength < need) throw new Error(`terrain: ${terrain.byteLength} < ${need} bytes`)
  return { scenario, geometry, landscape, manifest, terrain }
}
