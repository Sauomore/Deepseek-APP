/**
 * Input diagnostics.
 *
 * The middle-of-text caret bug only reproduces inside the Android WebView, so
 * this page records the *real* IME / selection event sequence on the device:
 * open it, tap in the middle of the sample text, type a couple of characters,
 * then screenshot the log. It tells us which event moves the caret and whether
 * the IME is composing at that moment.
 */

import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from '@/components/icons'
import { tapFeedback } from '@/lib/haptics'

interface LogEntry {
  at: string
  kind: string
  detail: string
}

const MAX_ENTRIES = 24

const time = () => {
  const now = new Date()
  const pad = (n: number, w = 2) => `${n}`.padStart(w, '0')
  return `${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`
}

export function InputDiagnostics({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [composing, setComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setEntries([])
      setComposing(false)
      return
    }
    const timer = window.setTimeout(() => {
      const element = inputRef.current
      if (!element) return
      element.focus()
    }, 120)
    return () => window.clearTimeout(timer)
  }, [open])

  /** Record one event with the current value + caret. */
  const record = (kind: string, extra = '') => {
    const element = inputRef.current
    if (!element) return
    const caret = element.selectionStart ?? -1
    const end = element.selectionEnd ?? -1
    const entry: LogEntry = {
      at: time(),
      kind,
      detail: `len=${element.value.length} caret=${caret}${end !== caret ? `-${end}` : ''}${extra ? ` ${extra}` : ''}`,
    }
    setEntries((current) => [entry, ...current].slice(0, MAX_ENTRIES))
  }

  if (!open) return null

  return (
    <div className="diag-overlay" role="dialog" aria-modal="true" aria-label="输入诊断">
      <div className="diag-head">
        <span className="diag-title">输入诊断</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
          <CloseIcon />
        </button>
      </div>

      <div className="diag-body">
        <ol className="diag-steps">
          <li>点一下下面的输入框，把光标点到「中间」（比如第 3 个字符后）</li>
          <li>用你平时的输入法打 2 个字</li>
          <li>把这块截图发给开发者</li>
        </ol>

        <label className="diag-label" htmlFor="diag-input">
          在这里试（默认内容 abcdefghij）
        </label>
        <input
          id="diag-input"
          ref={inputRef}
          className="text-input diag-input"
          defaultValue="abcdefghij"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onCompositionStart={() => {
            setComposing(true)
            record('compositionstart')
          }}
          onCompositionUpdate={() => record('compositionupdate')}
          onCompositionEnd={() => {
            setComposing(false)
            record('compositionend')
          }}
          onBeforeInput={(event) => record('beforeinput', `type=${(event.nativeEvent as InputEvent).inputType ?? '?'}`)}
          onInput={() => record('input')}
          onKeyDown={(event) => record('keydown', `key=${event.key}`)}
          onSelect={() => record('select')}
          onClick={() => record('click')}
        />

        <div className="diag-status">
          组词中：<b>{composing ? '是' : '否'}</b>
          <span className="diag-sep">·</span>
          {`WebView: ${navigator.userAgent.includes('wv') ? 'Android WebView' : '浏览器'}`}
        </div>

        <div className="diag-log">
          {entries.length === 0 ? (
            <div className="diag-empty">还没有记录，在上面的输入框里打字试试</div>
          ) : (
            entries.map((entry, index) => (
              <div className="diag-row" key={`${entry.at}-${index}`}>
                <span className="diag-at">{entry.at}</span>
                <span className="diag-kind">{entry.kind}</span>
                <span className="diag-detail">{entry.detail}</span>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          className="btn btn--ghost diag-clear"
          onClick={() => {
            tapFeedback()
            setEntries([])
          }}
        >
          清空日志
        </button>
      </div>
    </div>
  )
}
