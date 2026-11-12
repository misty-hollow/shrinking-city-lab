/**
 * 결과 이미지 대화상자(S6). 세 미션의 배분·결과를 그린 PNG 한 장을 미리 보여 주고 저장 · 복사 · 공유한다.
 * 모두 이 브라우저 안에서 한다: 계정·서버·업로드 없음. 이름·모둠 칸은 비워도 되고, 적으면 이미지에만 들어간다.
 * - 저장: PNG 내려받기(어느 브라우저나)
 * - 복사: 클립보드에 이미지(지원하는 브라우저만, 안 되면 안내 한 줄)
 * - 공유: 기기의 공유 창(파일 공유를 지원할 때만 단추가 보인다 — 휴대폰·Windows·macOS의 공유 창)
 */

import { useEffect, useRef, useState } from 'react'

import { copy } from '../content/copy'
import { imageFileName, renderResultImage, type ResultImageInput, todayLocal } from '../share/resultImage'

type Input = Omit<ResultImageInput, 'name' | 'date'>

export function ShareDialog({ input, onClose }: { input: Input; onClose(): void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [status, setStatus] = useState('')
  const [canShareFiles, setCanShareFiles] = useState(false)
  const blob = useRef<Blob | null>(null)
  const sayTimer = useRef(0)
  const say = (text: string) => {
    setStatus('')
    window.clearTimeout(sayTimer.current)
    sayTimer.current = window.setTimeout(() => setStatus(text), 60)
  }
  const nameRef = useRef<HTMLInputElement>(null)
  const opener = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const date = useRef(todayLocal()).current
  const inputRef = useRef(input)
  inputRef.current = input

  // 열 때: 연 자리를 기억하고 이름 칸에 포커스, Esc로 닫기. 닫으면 연 자리로 포커스를 돌려준다
  useEffect(() => {
    opener.current = document.activeElement
    nameRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(sayTimer.current)
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [])

  // 이름을 고치면 잠시 뒤 다시 그린다(글자마다 그리지 않는다)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    setBusy(true)
    const id = window.setTimeout(
      async () => {
        try {
          const canvas = await renderResultImage({ ...inputRef.current, name, date })
          if (!alive) return
          if (!canvas) throw new Error('no 2d canvas')
          const b = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
          if (!alive) return
          if (!b) throw new Error('no png')
          blob.current = b
          made = URL.createObjectURL(b)
          setUrl(made)
          setBusy(false)
          if (typeof navigator.canShare === 'function') {
            try {
              setCanShareFiles(navigator.canShare({ files: [new File([b], imageFileName(date, name), { type: 'image/png' })] }))
            } catch {
              setCanShareFiles(false)
            }
          }
        } catch {
          // 그리기·PNG 만들기가 실패하면 「만들고 있어요」에 멈추지 않고 안내한다.
          // 앞서 만든 이미지(이름을 고치기 전)는 이미 놓아 주었으니 저장·복사도 막는다
          if (alive) {
            blob.current = null
            setUrl(null)
            setBusy(false)
            say(copy.share.renderFailed)
          }
        }
      },
      name ? 350 : 0,
    )
    return () => {
      alive = false
      window.clearTimeout(id)
      if (made) URL.revokeObjectURL(made)
    }
  }, [name, date])

  const save = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = imageFileName(date, name)
    document.body.appendChild(a)
    a.click()
    a.remove()
    say(copy.share.saved)
  }

  const copyImage = async () => {
    const b = blob.current
    try {
      if (!b || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('no clipboard')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])
      say(copy.share.copied)
    } catch {
      say(copy.share.failed)
    }
  }

  const share = async () => {
    const b = blob.current
    if (!b) return
    try {
      await navigator.share({ files: [new File([b], imageFileName(date, name), { type: 'image/png' })], title: copy.scenario })
    } catch (e) {
      // 사용자가 공유 창을 닫은 것은 실패가 아니다
      if ((e as DOMException)?.name !== 'AbortError') say(copy.share.failed)
    }
  }

  // 바깥(어두운 곳)을 눌러 닫기: 누르기와 떼기가 모두 바깥일 때만
  const downOnBackdrop = useRef(false)
  return (
    <div
      className="share-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onMouseDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose()
        downOnBackdrop.current = false
      }}
    >
      <div className="share-sheet">
        <div className="share-head">
          <h2 id="share-title">{copy.share.title}</h2>
          <button type="button" className="btn btn-small" onClick={onClose}>
            {copy.share.close}
          </button>
        </div>
        <p className="share-lead">{copy.share.lead}</p>
        <div className="share-body">
          <div className={`share-preview${busy ? ' is-busy' : ''}`} aria-busy={busy}>
            {url ? <img src={url} alt={copy.share.previewAlt} /> : <span className="share-wait">{copy.share.preparing}</span>}
          </div>
          <div className="share-side">
            <label className="share-name">
              <span>{copy.share.nameLabel}</span>
              <input
                ref={nameRef}
                type="text"
                value={name}
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
                placeholder={copy.share.namePlaceholder}
                onChange={(e) => setName(e.target.value)}
              />
              <small>{copy.share.nameNote}</small>
            </label>
            <div className="share-actions">
              <button type="button" className="btn btn-primary" onClick={save} disabled={!url || busy}>
                {copy.share.save}
              </button>
              <button type="button" className="btn" onClick={copyImage} disabled={!url || busy}>
                {copy.share.copy}
              </button>
              {canShareFiles && (
                <button type="button" className="btn" onClick={share} disabled={!url || busy}>
                  {copy.share.share}
                </button>
              )}
            </div>
            <p className="share-status" role="status" aria-live="polite">
              {status}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
