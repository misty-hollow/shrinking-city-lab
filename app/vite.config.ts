import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * 번들에 실제로 들어간 npm 패키지의 라이선스 원문을 dist/licenses/THIRD_PARTY_NOTICES.txt로 낸다.
 * 줄인 번들에는 라이선스 주석이 남지 않으므로(MIT 고지 의무), 배포본에 고지 파일을 함께 둔다.
 * 원문을 못 찾으면 빌드를 멈춘다. 글꼴(OFL) 원문은 public/licenses/에 따로 있다.
 */
function thirdPartyNotices(): Plugin {
  const SEPARATE: Record<string, string> = { pretendard: 'licenses/Pretendard-OFL.txt' }
  return {
    name: 'third-party-notices',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const pkgs = new Set<string>()
      for (const out of Object.values(bundle)) {
        if (out.type !== 'chunk') continue
        for (const id of Object.keys(out.modules)) {
          const m = id.replace(/\\/g, '/').match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)\//)
          if (m) pkgs.add(m[1])
        }
      }
      if (pkgs.size === 0) this.error('번들에서 npm 패키지를 찾지 못했다')
      const parts = [
        'Shrinking City Lab — 이 배포본에 포함된 오픈소스 소프트웨어의 라이선스 고지',
        'Third-party software notices for the packages bundled into this build.',
        '',
      ]
      for (const name of [...pkgs].sort()) {
        const dir = join(import.meta.dirname, 'node_modules', name)
        const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')) as { version: string; license?: string }
        const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f))
        parts.push('='.repeat(78), `${name}@${meta.version} — ${meta.license ?? 'UNKNOWN'}`, '='.repeat(78))
        if (file) parts.push(readFileSync(join(dir, file), 'utf-8').trim())
        else if (SEPARATE[name] && existsSync(join(import.meta.dirname, 'public', SEPARATE[name]))) parts.push(`라이선스 원문: ${SEPARATE[name]}`)
        else this.error(`${name}: 라이선스 원문 파일이 없다`)
        parts.push('')
      }
      this.emitFile({ type: 'asset', fileName: 'licenses/THIRD_PARTY_NOTICES.txt', source: parts.join('\n') })
    },
  }
}

// 정적 파일만 만든다(설계안 10-1 10번: 런타임 외부 호출 없음). base를 상대 경로로 두어
// 어느 하위 경로·정적 호스팅에 올려도 data/ 를 같은 폴더에서 읽는다(배포 위치는 미정, 11절 3).
export default defineConfig({
  base: './',
  plugins: [react(), thirdPartyNotices()],
  build: {
    chunkSizeWarningLimit: 900,
    // three.js는 따로 묶는다(앱 코드가 바뀌어도 브라우저 캐시에 남게). 첫 화면에 모두 필요하므로 지연 로딩은 하지 않는다.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: (id: string) => (/node_modules[\\/]three[\\/]/.test(id) ? 'three' : null) }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
