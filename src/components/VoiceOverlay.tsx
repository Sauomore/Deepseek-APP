/**
 * Voice input overlay.
 *
 * Records raw PCM through the Web Audio graph (see `lib/audio.ts`), uploads a
 * 16 kHz mono WAV to the ASR endpoint, and hands the transcript back to the
 * composer. In demo mode the transcript comes from the mock engine.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CloseIcon, SendIcon } from '@/components/icons'
import { formatDuration, MAX_RECORDING_MS, VoiceRecorder } from '@/lib/audio'
import { transcribe } from '@/api/client'
import { mockTranscribe } from '@/api/mock/engine'
import { tapFeedback, successFeedback } from '@/lib/haptics'
import { useSettingsStore } from '@/store/settings'
import { toast } from '@/store/ui'

const BAR_COUNT = 28

interface VoiceOverlayProps {
  open: boolean
  /**
   * Incremented by the composer when the user lifts their finger after a
   * long-press. Any change while recording finishes the take and transcribes it.
   */
  autoFinishSignal?: number
  onClose: () => void
  onTranscript: (text: string) => void
}

type Phase = 'starting' | 'recording' | 'transcribing' | 'error'

export function VoiceOverlay({
  open,
  autoFinishSignal = 0,
  onClose,
  onTranscript,
}: VoiceOverlayProps) {
  const settings = useSettingsStore((state) => state.settings)
  const [phase, setPhase] = useState<Phase>('starting')
  const [elapsed, setElapsed] = useState(0)
  const [bars, setBars] = useState<number[]>(() => new Array(BAR_COUNT).fill(3))
  const [errorText, setErrorText] = useState('')

  const recorderRef = useRef<VoiceRecorder | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const stoppedRef = useRef(false)
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(3))
  const phaseRef = useRef<Phase>('starting')
  /** Set when the finger is lifted before the recorder finished spinning up. */
  const pendingFinishRef = useRef(false)

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
    recorderRef.current?.cancel()
    recorderRef.current = null
  }, [])

  /** Stop recording and run ASR. */
  const finish = useCallback(
    async (auto: boolean) => {
      if (stoppedRef.current) return
      stoppedRef.current = true
      const recorder = recorderRef.current
      if (!recorder) return
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      rafRef.current = null
      timerRef.current = null

      let result
      try {
        result = await recorder.stop()
      } catch (error) {
        setPhase('error')
        setErrorText(error instanceof Error ? error.message : '录音失败')
        return
      }
      recorderRef.current = null

      // Very short taps are almost always accidental.
      if (result.durationMs < 500 && !auto) {
        onClose()
        return
      }

      setPhase('transcribing')
      try {
        let text: string
        if (settings.demoMode) {
          const mock = await mockTranscribe(result.durationMs)
          // Give the spinner a beat so the state change is perceptible.
          await new Promise((resolve) => setTimeout(resolve, 650))
          text = mock.text
        } else {
          if (!settings.apiKey.trim()) throw new Error('请先在设置中填写 API Key')
          const response = await transcribe({
            baseUrl: settings.baseUrl,
            apiKey: settings.apiKey,
            audio: result.blob,
          })
          text = response.text
        }
        if (!text.trim()) {
          setPhase('error')
          setErrorText('没有听清，请再说一遍')
          return
        }
        successFeedback()
        onTranscript(text.trim())
        onClose()
      } catch (error) {
        setPhase('error')
        setErrorText(error instanceof Error ? error.message : '识别失败')
      }
    },
    [onClose, onTranscript, settings.apiKey, settings.baseUrl, settings.demoMode],
  )

  // Begin recording whenever the overlay opens.
  useEffect(() => {
    if (!open) return
    stoppedRef.current = false
    setPhase('starting')
    setElapsed(0)
    setErrorText('')
    barsRef.current = new Array(BAR_COUNT).fill(3)
    setBars(barsRef.current)

    const recorder = new VoiceRecorder()
    recorderRef.current = recorder
    let cancelled = false

    void recorder
      .start()
      .then(() => {
        if (cancelled) {
          recorder.cancel()
          return
        }
        setPhase('recording')
        tapFeedback()

        const tick = () => {
          const level = recorder.getLevel()
          const next = [...barsRef.current.slice(1), Math.max(3, Math.round(level * 46))]
          barsRef.current = next
          setBars(next)
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)

        timerRef.current = window.setInterval(() => {
          setElapsed(recorder.durationMs)
          if (recorder.durationMs >= MAX_RECORDING_MS) {
            void finish(true)
          }
        }, 120)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setPhase('error')
        setErrorText(error instanceof Error ? error.message : '无法开始录音')
        toast(error instanceof Error ? error.message : '无法开始录音', 'error')
      })

    return () => {
      cancelled = true
      cleanup()
    }
    // `finish` is intentionally excluded: the overlay owns one recording session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  /* Keep a ref mirror so the long-press release doesn't read stale state. */
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  /* Finger released after a long press → finish the take and transcribe. */
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    if (!open || autoFinishSignal === 0) return
    if (phaseRef.current === 'recording') {
      void finishRef.current(true)
    } else if (phaseRef.current === 'starting') {
      pendingFinishRef.current = true
    }
  }, [autoFinishSignal, open])

  /* If the release landed while the mic was still spinning up, finish as soon as
     recording actually begins. */
  useEffect(() => {
    if (phase === 'recording' && pendingFinishRef.current) {
      pendingFinishRef.current = false
      void finishRef.current(true)
    }
  }, [phase])

  const cancel = () => {
    stoppedRef.current = true
    cleanup()
    onClose()
  }

  if (!open) return null

  return (
    <div className="voice-overlay" role="dialog" aria-modal="true" aria-label="语音输入">
      <div className="voice-card">
        <div className={`voice-waves${phase === 'recording' ? '' : ' is-idle'}`} aria-hidden="true">
          {bars.map((height, index) => (
            <span
              key={index}
              style={{
                height: `${phase === 'recording' ? height : 12 + (index % 5) * 5}px`,
                opacity: phase === 'recording' ? 0.9 : 0.45,
              }}
            />
          ))}
        </div>

        {phase === 'error' ? (
          <>
            <div className="voice-hint" style={{ color: 'var(--danger)' }}>
              {errorText}
            </div>
            <div className="voice-actions">
              <button type="button" className="voice-btn" onClick={cancel} aria-label="关闭">
                <CloseIcon />
              </button>
            </div>
          </>
        ) : phase === 'transcribing' ? (
          <>
            <div className="voice-transcribing">
              <span className="spinner" />
              正在识别语音…
            </div>
            <div className="voice-hint">上传录音到 DeepSeek 语音识别服务</div>
          </>
        ) : (
          <>
            <div className="voice-timer">{formatDuration(elapsed)}</div>
            <div className="voice-hint">
              {phase === 'starting' ? '正在启动麦克风…' : '正在聆听，说完点击右侧发送'}
            </div>
            <div className="voice-actions">
              <button type="button" className="voice-btn" onClick={cancel} aria-label="取消录音">
                <CloseIcon />
              </button>
              <button
                type="button"
                className="voice-btn voice-btn--send"
                onClick={() => void finish(false)}
                aria-label="完成并识别"
              >
                <SendIcon />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
