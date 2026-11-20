/**
 * Composer: the message input.
 *
 * Layout: a rounded field with a `+` on the left, a growing textarea, and a
 * **permanently visible** send button on the right (it dims when there is
 * nothing to send instead of swapping to a mic icon — the swap depended on React
 * state, which could lag behind the native field on some keyboards and made the
 * send button appear to vanish in later turns).
 *
 * Voice input is a gesture now: **long-press the input area** to start
 * recording, release to stop and transcribe.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpenIcon,
  CameraIcon,
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  FileIcon,
  GlobeIcon,
  ImageIcon,
  KeyboardIcon,
  MicIcon,
  PaperclipIcon,
  PlusIcon,
  SendIcon,
  SparkIcon,
  StopIcon,
} from '@/components/icons'
import { VoiceOverlay } from '@/components/VoiceOverlay'
import { createDocumentAttachment, createImageAttachment, DOCUMENT_ACCEPT } from '@/services/attachments'
import { prefixedId } from '@/lib/id'
import { formatBytes } from '@/lib/image'
import { tapFeedback } from '@/lib/haptics'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { toast, useUiStore } from '@/store/ui'
import { MODEL_META } from '@/types/api'
import type { Attachment } from '@/types/chat'
import type { Conversation } from '@/types/chat'

/** How long the finger must rest on the input before voice recording starts.
 * Kept above the platform long-press threshold so the OS paste/select menu wins. */
const LONG_PRESS_MS = 700
/** The composer grows to at most this many lines, then offers full screen. */
const MAX_LINES = 3
const VOICE_HINT_KEY = 'deepseek.voiceHintShown.v1'

type SheetMode = null | 'attach'

interface ComposerProps {
  conversation: Conversation | null
  generating: boolean
  onStop: () => void
}

export function Composer({ conversation, generating, onStop }: ComposerProps) {
  const settings = useSettingsStore((state) => state.settings)
  const updateOptions = useChatStore((state) => state.updateOptions)
  const openSettings = useUiStore((state) => state.openSettings)
  const setKeyboardOpen = useUiStore((state) => state.setKeyboardOpen)

  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [focused, setFocused] = useState(false)
  const [sheet, setSheet] = useState<SheetMode>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  /** Bumped on finger release so the voice overlay finishes the recording. */
  const [finishSignal, setFinishSignal] = useState(0)
  /** Full-screen editor: shown once the input passes its three-line cap. */
  const [fullscreen, setFullscreen] = useState(false)
  /** True while the content is taller than the three-line box. */
  const [canExpand, setCanExpand] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fullscreenRef = useRef<HTMLTextAreaElement>(null)
  /** Latest `send` callback, so the full-screen editor can submit without stale closures. */
  const sendRef = useRef<() => void>(() => {})
  /** True while the IME is composing; resizing then would break the composition. */
  const composingRef = useRef(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const uploadControllers = useRef(new Map<string, AbortController>())
  const holdTimerRef = useRef<number | null>(null)
  const holdingRef = useRef(false)
  const detachHoldListenersRef = useRef<(() => void) | null>(null)

  const model = conversation?.model ?? settings.model
  const modelMeta = MODEL_META[model]
  const supportsVision = modelMeta.vision

  /* ------------------------------ long-press voice ------------------------------ */
  const endHold = useCallback(() => {
    detachHoldListenersRef.current?.()
    detachHoldListenersRef.current = null
    if (!holdingRef.current) return
    holdingRef.current = false
    setFinishSignal((value) => value + 1)
  }, [])

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  /** Leave the full-screen editor, copying its text back into the composer. */
  const closeFullscreen = useCallback(
    (andSend: boolean) => {
      const value = fullscreenRef.current?.value ?? ''
      const target = textareaRef.current
      if (target) target.value = value
      setText(value)
      setFullscreen(false)
      if (andSend) {
        window.setTimeout(() => sendRef.current(), 0)
        return
      }
      window.setTimeout(() => {
        const element = textareaRef.current
        if (!element) return
        element.focus()
        const length = element.value.length
        try {
          element.setSelectionRange(length, length)
        } catch {
          /* ignore */
        }
      }, 30)
    },
    [],
  )

  const startHold = useCallback(() => {
    if (generating || holdTimerRef.current !== null) return
    // Long-press on a field that already has text must stay a native
    // select/paste gesture — hijacking it was what broke pasting long text.
    if ((textareaRef.current?.value ?? '').trim().length > 0) return
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null
      holdingRef.current = true
      // Drop any native caret / selection / paste popup before the recorder covers the page.
      textareaRef.current?.blur()
      try {
        window.getSelection()?.removeAllRanges()
      } catch {
        /* ignore */
      }
      setVoiceOpen(true)
      window.addEventListener('pointerup', endHold, { once: true })
      window.addEventListener('pointercancel', endHold, { once: true })
      detachHoldListenersRef.current = () => {
        window.removeEventListener('pointerup', endHold)
        window.removeEventListener('pointercancel', endHold)
      }
    }, LONG_PRESS_MS)
  }, [endHold, generating])

  /**
   * The OS long-press menu (paste / select) always wins: if the browser opens it
   * while we are still waiting, drop the pending recording. Without this the
   * paste menu got swallowed and long pasted text silently never arrived.
   */
  useEffect(() => {
    const cancel = () => cancelHold()
    document.addEventListener('contextmenu', cancel, true)
    document.addEventListener('selectstart', cancel, true)
    return () => {
      document.removeEventListener('contextmenu', cancel, true)
      document.removeEventListener('selectstart', cancel, true)
    }
  }, [cancelHold])

  useEffect(
    () => () => {
      cancelHold()
      detachHoldListenersRef.current?.()
      detachHoldListenersRef.current = null
    },
    [cancelHold],
  )

  /* --------------------------- textarea autosize --------------------------- */
  // One line at rest, +1 line per newline up to MAX_LINES, then internal
  // scrolling (with the "full screen" escape hatch rendered above the box).
  //
  // The height is measured on a hidden **mirror** textarea, never on the live
  // one: re-laying out the focused textarea (which `height:auto` measuring did
  // on every keystroke) makes Android WebView commit the IME composition and
  // move the caret to the end, so typing in the middle of a sentence was
  // impossible. The mirror is off-screen, so measuring it is free of side
  // effects; the real element only changes height when a line is added/removed.
  const mirrorRef = useRef<HTMLDivElement | null>(null)

  useEffect(
    () => () => {
      mirrorRef.current?.remove()
      mirrorRef.current = null
    },
    [],
  )

  const resizeTextarea = useCallback(() => {
    const element = textareaRef.current
    if (!element) return
    // Never touch layout while the IME is composing (see above).
    if (composingRef.current) return

    const style = getComputedStyle(element)
    const lineHeight = Number.parseFloat(style.lineHeight) || 24
    const padTop = Number.parseFloat(style.paddingTop) || 0
    const padBottom = Number.parseFloat(style.paddingBottom) || 0
    const maxHeight = Math.round(lineHeight * MAX_LINES + padTop + padBottom)
    const minHeight = Math.round(lineHeight + padTop + padBottom)

    let mirror = mirrorRef.current
    if (!mirror) {
      // A plain <div>, not another <textarea>: keeping a second *editable*
      // element around (even off-screen) is pointless noise for the IME.
      mirror = document.createElement('div')
      mirror.setAttribute('aria-hidden', 'true')
      mirror.style.cssText =
        'position:absolute;top:-10000px;left:-10000px;visibility:hidden;pointer-events:none;box-sizing:border-box;overflow:hidden;margin:0;border:0;'
      document.body.appendChild(mirror)
      mirrorRef.current = mirror
    }
    mirror.style.width = `${element.clientWidth}px`
    mirror.style.fontFamily = style.fontFamily
    mirror.style.fontSize = style.fontSize
    mirror.style.fontWeight = style.fontWeight
    mirror.style.letterSpacing = style.letterSpacing
    mirror.style.lineHeight = style.lineHeight
    mirror.style.paddingTop = style.paddingTop
    mirror.style.paddingBottom = style.paddingBottom
    mirror.style.paddingLeft = style.paddingLeft
    mirror.style.paddingRight = style.paddingRight
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.overflowWrap = style.overflowWrap || 'anywhere'
    mirror.style.wordBreak = style.wordBreak
    // Trailing zero-width space keeps a final newline measurable.
    mirror.textContent = `${element.value}\u200b`
    const contentHeight = Math.ceil(mirror.getBoundingClientRect().height)

    const target = Math.min(Math.max(contentHeight, minHeight), maxHeight)
    const current = Number.parseFloat(element.style.height || '0')
    if (Math.abs(current - target) >= 1) {
      const start = element.selectionStart
      const end = element.selectionEnd
      element.style.height = `${target}px`
      if (document.activeElement === element) {
        try {
          element.setSelectionRange(start, end)
        } catch {
          /* ignore */
        }
      }
    }

    // Keep the line being typed visible: with a capped height the field
    // scrolls, and the newest text must stay at the bottom.
    const overflowing = contentHeight > maxHeight + 1
    setCanExpand(overflowing)
    const caret = element.selectionStart
    const valueLength = (element.value ?? '').length
    if (overflowing) {
      if (caret >= valueLength) {
        element.scrollTop = element.scrollHeight
      } else {
        // Otherwise just make sure the caret line is on screen.
        const caretLine = (element.value ?? '').slice(0, caret).split('\n').length
        const firstVisible = Math.max(0, caretLine - MAX_LINES)
        element.scrollTop = Math.max(0, firstVisible * lineHeight)
      }
    } else {
      element.scrollTop = 0
    }
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [text, resizeTextarea])

  /**
   * Some Android keyboards only fire `compositionend` (or nothing at all) for
   * IME commits, leaving the React mirror stale: the send button stays grey.
   * Poll the live DOM value while the composer is mounted so the UI catches up
   * within a frame or two regardless of which events the keyboard emits.
   *
   * The same tick also re-runs the autosize: if a keyboard never sends
   * `compositionend`, the resize would otherwise stay blocked forever.
   */
  const textRef = useRef(text)
  textRef.current = text
  useEffect(() => {
    const sync = () => {
      const value = textareaRef.current?.value ?? ''
      if (value !== textRef.current) setText(value)
      resizeTextarea()
    }
    const timer = window.setInterval(sync, 220)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [resizeTextarea])

  useEffect(() => {
    return () => {
      uploadControllers.current.forEach((controller) => controller.abort())
      uploadControllers.current.clear()
    }
  }, [])

  /* ------------------------------ attachments ------------------------------ */
  const patchAttachment = useCallback((id: string, patch: Partial<Attachment>) => {
    setAttachments((current) =>
      current.map((attachment) => (attachment.id === id ? { ...attachment, ...patch } : attachment)),
    )
  }, [])

  const removeAttachment = useCallback((id: string) => {
    uploadControllers.current.get(id)?.abort()
    uploadControllers.current.delete(id)
    setAttachments((current) => current.filter((attachment) => attachment.id !== id))
  }, [])

  const addImages = useCallback(
    async (files: File[]) => {
      const images = files.filter((file) => file.type.startsWith('image/'))
      if (images.length === 0) return
      if (!supportsVision) {
        toast(`${modelMeta.label} 不支持图片，请切换到 ${MODEL_META['deepseek-flash'].label}`, 'error')
        return
      }
      for (const file of images.slice(0, 4)) {
        try {
          const attachment = await createImageAttachment(file)
          setAttachments((current) => [...current, attachment])
        } catch (error) {
          toast(error instanceof Error ? error.message : '图片处理失败', 'error')
        }
      }
    },
    [modelMeta.label, supportsVision],
  )

  const addDocuments = useCallback(
    async (files: File[]) => {
      for (const file of files.slice(0, 4)) {
        const id = prefixedId('doc')
        const controller = new AbortController()
        uploadControllers.current.set(id, controller)

        // Optimistic placeholder so progress is visible during parsing.
        setAttachments((current) => [
          ...current,
          {
            id,
            kind: 'document',
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            uploadState: 'uploading',
            progress: 0,
            purpose: 'text_recognition',
            blob: file,
          },
        ])

        try {
          const attachment = await createDocumentAttachment(file, {
            settings,
            signal: controller.signal,
            onProgress: (ratio) => patchAttachment(id, { progress: ratio }),
          })
          setAttachments((current) =>
            current.map((item) => (item.id === id ? { ...attachment, id } : item)),
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : '文件解析失败'
          patchAttachment(id, { uploadState: 'error', error: message })
          toast(message, 'error')
        } finally {
          uploadControllers.current.delete(id)
        }
      }
    },
    [patchAttachment, settings],
  )

  const handleFiles = useCallback(
    (fileList: FileList | null, kind: 'image' | 'document' | 'any') => {
      if (!fileList || fileList.length === 0) return
      const files = Array.from(fileList)
      const images = files.filter((file) => file.type.startsWith('image/'))
      const documents = files.filter((file) => !file.type.startsWith('image/'))
      if (kind === 'image' || (kind === 'any' && images.length)) {
        void addImages(kind === 'image' ? files : images)
      }
      if (kind === 'document' || (kind === 'any' && documents.length)) {
        void addDocuments(kind === 'document' ? files : documents)
      }
    },
    [addDocuments, addImages],
  )

  /* -------------------------------- actions -------------------------------- */
  const uploading = attachments.some(
    (attachment) => attachment.uploadState === 'uploading' || attachment.uploadState === 'pending',
  )
  const hasFailed = attachments.some((attachment) => attachment.uploadState === 'error')
  const canSend = (text.trim().length > 0 || attachments.length > 0) && !uploading && !hasFailed

  const send = useCallback(() => {
    if (generating) return

    // Read the live DOM value, not just React state: an IME commit or a paste can
    // update the field without React observing an `input` event. When an image is
    // attached the send button stays enabled regardless of state, so trusting the
    // stale state here would send "image with no text".
    const domText = textareaRef.current?.value ?? ''
    const payload = (domText || text).trim()

    if (uploading) {
      toast('文件还在解析，请稍候')
      return
    }
    if (hasFailed) {
      toast('有文件解析失败，请移除后重试', 'error')
      return
    }
    if (!payload && attachments.length === 0) return

    const ready = attachments.filter((attachment) => attachment.uploadState === 'ready')
    // Clear the uncontrolled field explicitly, then reset the mirror state.
    if (textareaRef.current) textareaRef.current.value = ''
    setText('')
    setAttachments([])
    tapFeedback()
    void useChatStore.getState().send(payload, ready)
  }, [attachments, generating, hasFailed, text, uploading])
  sendRef.current = send

  /* Focus the full-screen editor with the caret at the end when it opens. */
  useEffect(() => {
    if (!fullscreen) return
    const element = fullscreenRef.current
    if (!element) return
    const length = element.value.length
    const timer = window.setTimeout(() => {
      element.focus()
      try {
        element.setSelectionRange(length, length)
      } catch {
        /* ignore */
      }
    }, 40)
    return () => window.clearTimeout(timer)
  }, [fullscreen])

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send is button-only (like the official app): Enter inserts a newline.
    // Keep IME composition safe — never treat a composing Enter as a send.
    if (event.key === 'Enter' && event.nativeEvent.isComposing) {
      event.stopPropagation()
    }
  }

  const toggleThinking = () => {
    tapFeedback()
    const level = conversation?.thinkingLevel ?? settings.thinkingLevel
    // The pill is a quick on/off switch; turning it back on restores the
    // configured default level rather than guessing a depth.
    updateOptions({ thinkingLevel: level === 'off' ? settings.thinkingLevel : 'off' })
  }

  const toggleSearch = () => {
    tapFeedback()
    updateOptions({ searchEnabled: !(conversation?.searchEnabled ?? settings.searchEnabled) })
  }

  const thinkingOn = (conversation?.thinkingLevel ?? settings.thinkingLevel) !== 'off'
  const searchOn = conversation?.searchEnabled ?? settings.searchEnabled
  const needsKey = !settings.apiKey.trim() && !settings.demoMode

  const attachSheet = sheet === 'attach'

  return (
    <div className="composer-dock">
      <div
        className={`composer${dragging ? ' is-dragover' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFiles(event.dataTransfer.files, 'any')
        }}
      >
        {/* ------------------------------ toggles ------------------------------ */}
        <div className="composer-toggles">
          <button
            type="button"
            className="toggle-pill"
            aria-pressed={thinkingOn}
            onClick={toggleThinking}
            disabled={generating}
          >
            <SparkIcon />
            深度思考
          </button>
          <button
            type="button"
            className="toggle-pill"
            aria-pressed={searchOn}
            onClick={toggleSearch}
            disabled={generating}
          >
            <GlobeIcon />
            联网搜索
          </button>
          <span className="composer-hint">
            {settings.demoMode ? '演示模式' : modelMeta.label.replace('DeepSeek ', '')}
          </span>
        </div>

        {/* --------------------------- missing key --------------------------- */}
        {needsKey ? (
          <div className="composer-notice">
            还没有配置 API Key，
            <button type="button" onClick={openSettings}>
              去设置
            </button>
            或打开演示模式
          </div>
        ) : null}

        {/* ------------------------------- box ------------------------------- */}
        {/*
          The expand affordance lives in its own reserved strip *above* the box:
          floating it over the box covered the right end of the first text line.
        */}
        <div className={`composer-input-area${canExpand ? ' has-expand' : ''}`}>
          {canExpand ? (
            <button
              type="button"
              className="composer-expand"
              onClick={() => {
                tapFeedback()
                setFullscreen(true)
              }}
              aria-label="全屏编辑"
              title="全屏编辑"
            >
              <ExpandIcon size={13} />
            </button>
          ) : null}
          <div
            className={`composer-box${focused ? ' is-focused' : ''}`}
            onPointerDown={(event) => {
              const target = event.target as Element | null
              // Buttons handle their own taps; never start recording from them.
              if (target?.closest('button')) return
              startHold()
            }}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
          >
            <button
              type="button"
              className="composer-btn"
              onClick={() => setSheet('attach')}
              aria-label="添加图片或文件"
              disabled={generating}
            >
              <PlusIcon />
            </button>

          <div className="composer-input-wrap">
            {attachments.length > 0 ? (
              <div className="attach-strip">
                {attachments.map((attachment) => (
                  <div className="attach-chip" key={attachment.id}>
                    {attachment.kind === 'image' && attachment.previewUrl ? (
                      <img className="attach-thumb" src={attachment.previewUrl} alt={attachment.name} />
                    ) : (
                      <span className="attach-fileicon">
                        <FileIcon />
                      </span>
                    )}
                    <span className="attach-info">
                      <span className="attach-name">{attachment.name}</span>
                      <span className="attach-meta">
                        {attachment.uploadState === 'uploading' ? (
                          <span className="uploading">解析中 {Math.round((attachment.progress ?? 0) * 100)}%</span>
                        ) : attachment.uploadState === 'error' ? (
                          <span className="failed">失败</span>
                        ) : (
                          formatBytes(attachment.size)
                        )}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="attach-remove"
                      onClick={() => removeAttachment(attachment.id)}
                      aria-label={`移除 ${attachment.name}`}
                    >
                      <CloseIcon />
                    </button>
                    {attachment.uploadState === 'uploading' ? (
                      <span className="attach-progress">
                        <i style={{ width: `${Math.round((attachment.progress ?? 0) * 100)}%` }} />
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {/*
              Uncontrolled on purpose: the DOM value is the source of truth.
              A controlled textarea gets its value rewritten on every React
              render, which silently drops text that reached the field without a
              matching `input` event (IME commit, paste menu, autofill). With an
              attachment the send button is enabled regardless of state, so that
              used to send "image with no text". `text` is kept only as a mirror
              for button/placeholder state.
            */}
            <textarea
              ref={textareaRef}
              className="composer-textarea"
              defaultValue=""
              rows={1}
              placeholder="与 Deepseek 聊天"
              onChange={(event) => setText(event.target.value)}
              onInput={(event) => setText((event.target as HTMLTextAreaElement).value)}
              onCompositionStart={() => {
                composingRef.current = true
              }}
              onCompositionEnd={(event) => {
                composingRef.current = false
                setText((event.target as HTMLTextAreaElement).value)
              }}
              onKeyDown={onKeyDown}
              onFocus={() => {
                setFocused(true)
                setKeyboardOpen(true)
                const value = textareaRef.current?.value ?? ''
                if (value !== text) setText(value)
                // One-time discoverability hint for the long-press gesture.
                try {
                  if (!localStorage.getItem(VOICE_HINT_KEY)) {
                    localStorage.setItem(VOICE_HINT_KEY, '1')
                    toast('长按空白输入框可以说话，松手自动转文字')
                  }
                } catch {
                  /* storage may be unavailable */
                }
              }}
              onBlur={() => {
                const value = textareaRef.current?.value ?? ''
                if (value !== text) setText(value)
                setFocused(false)
                setKeyboardOpen(false)
              }}
              enterKeyHint="enter"
            />
          </div>

          <div className="composer-actions">
            {generating ? (
              <button type="button" className="composer-btn composer-stop" onClick={onStop} aria-label="停止生成">
                <StopIcon />
              </button>
            ) : (
              /* Always present: it dims when there is nothing to send rather
                 than swapping to another icon. */
              <button
                type="button"
                className={`composer-btn composer-send${canSend ? ' is-active' : ''}`}
                onClick={send}
                aria-label="发送"
                aria-disabled={!canSend}
              >
                <SendIcon />
              </button>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* --------------------------- hidden inputs --------------------------- */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.target.files, 'image')
          event.target.value = ''
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          handleFiles(event.target.files, 'image')
          event.target.value = ''
        }}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.target.files, 'document')
          event.target.value = ''
        }}
      />

      {/* --------------------------- attachment sheet --------------------------- */}
      {attachSheet ? (
        <>
          <div className="scrim scrim--sheet" onClick={() => setSheet(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="添加附件">
            <div className="sheet-grabber" />
            <div className="sheet-head">
              <div>
                <div className="sheet-title">添加内容</div>
                <div className="sheet-sub">图片由模型识别，文档会上传解析</div>
              </div>
              <button type="button" className="icon-btn sheet-close" onClick={() => setSheet(null)}>
                <CloseIcon />
              </button>
            </div>
            <div className="sheet-body">
              <div className="attach-grid">
                <button
                  type="button"
                  className="attach-action"
                  onClick={() => {
                    setSheet(null)
                    imageInputRef.current?.click()
                  }}
                >
                  <span className="attach-action-icon">
                    <ImageIcon />
                  </span>
                  相册
                  <small>JPG / PNG / WebP</small>
                </button>
                <button
                  type="button"
                  className="attach-action"
                  onClick={() => {
                    setSheet(null)
                    cameraInputRef.current?.click()
                  }}
                >
                  <span className="attach-action-icon">
                    <CameraIcon />
                  </span>
                  拍照
                  <small>调用系统相机</small>
                </button>
                <button
                  type="button"
                  className="attach-action"
                  onClick={() => {
                    setSheet(null)
                    documentInputRef.current?.click()
                  }}
                >
                  <span className="attach-action-icon">
                    <PaperclipIcon />
                  </span>
                  文件
                  <small>PDF / Word / PPT / Excel</small>
                </button>
                <button
                  type="button"
                  className="attach-action"
                  onClick={() => {
                    setSheet(null)
                    setVoiceOpen(true)
                  }}
                >
                  <span className="attach-action-icon">
                    <MicIcon />
                  </span>
                  语音
                  <small>说完自动转文字</small>
                </button>
              </div>

              <div className="settings-group" style={{ marginTop: 18 }}>
                <div className="settings-card">
                  <button
                    type="button"
                    className="settings-row"
                    onClick={() => {
                      setSheet(null)
                      openSettings()
                    }}
                  >
                    <span className="settings-row-main">
                      <span className="settings-row-title">
                        <KeyboardIcon size={17} />
                        输入与模型设置
                      </span>
                      <span className="settings-row-desc">
                        切换模型、思考强度、发送方式
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="settings-row"
                    onClick={() => {
                      setSheet(null)
                      toast(supportsVision ? '当前模型支持识图' : '当前模型不支持识图')
                    }}
                  >
                    <span className="settings-row-main">
                      <span className="settings-row-title">
                        <BookOpenIcon size={17} />
                        {modelMeta.label}
                      </span>
                      <span className="settings-row-desc">{modelMeta.desc}</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* ---------------------------- full-screen editor ---------------------------- */}
      {fullscreen ? (
        <div className="composer-fullscreen" role="dialog" aria-modal="true" aria-label="全屏编辑">
          <div className="composer-fs-head">
            <button
              type="button"
              className="icon-btn"
              onClick={() => closeFullscreen(false)}
              aria-label="收起全屏编辑"
            >
              <CollapseIcon />
            </button>
            <span className="composer-fs-title">编辑消息</span>
            <span className="composer-fs-count">{text.length} 字</span>
            <button
              type="button"
              className={`composer-btn composer-send${canSend ? ' is-active' : ''}`}
              onClick={() => closeFullscreen(true)}
              aria-label="发送"
              aria-disabled={!canSend}
            >
              <SendIcon />
            </button>
          </div>
          <textarea
            ref={fullscreenRef}
            className="composer-fs-textarea"
            defaultValue={textareaRef.current?.value ?? text}
            placeholder="与 Deepseek 聊天"
            onInput={(event) => setText((event.target as HTMLTextAreaElement).value)}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="composer-fs-foot">收起后内容会回到输入框</div>
        </div>
      ) : null}

      <VoiceOverlay
        open={voiceOpen}
        autoFinishSignal={finishSignal}
        onClose={() => setVoiceOpen(false)}
        onTranscript={(transcript) => {
          const element = textareaRef.current
          const current = element?.value ?? text
          const next = current.trim() ? `${current} ${transcript}` : transcript
          if (element) element.value = next
          setText(next)
          window.setTimeout(() => element?.focus(), 60)
        }}
      />
    </div>
  )
}
