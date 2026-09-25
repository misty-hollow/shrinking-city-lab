import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 정적 파일만 만든다(설계안 10-1 10번: 런타임 외부 호출 없음). base를 상대 경로로 두어
// 어느 하위 경로·정적 호스팅에 올려도 data/ 를 같은 폴더에서 읽는다(배포 위치는 미정, 11절 3).
export default defineConfig({
  base: './',
  plugins: [react()],
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
