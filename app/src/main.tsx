import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@fontsource-variable/hahmlet'
// 베트남어 화면 전용(Pretendard에는 베트남어 성조 글자가 없다). 글꼴 파일은 베트남어 글자를 그릴 때만 받는다.
import '@fontsource-variable/inter/wght.css'

import { App } from './App'
import { initialLang, setLang } from './content/i18n'
import './styles/app.css'
import './styles/world.css'

// 첫 화면을 그리기 전에 언어를 정한다(주소의 ?lang= → 이 브라우저에서 고른 언어 → 한국어)
setLang(initialLang())

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
