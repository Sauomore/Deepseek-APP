/**
 * First-run screen.
 *
 * The app works with the user's own DeepSeek API key (stored only on this
 * device) or fully offline in demo mode. This is where that choice is made.
 *
 * Paste robustness: some Android WebViews / IMEs (notably the text-selection
 * "paste" menu and keyboard smart-insert) update the input's DOM value without
 * dispatching an `input` event, which leaves React state empty and a
 * state-gated button stuck disabled. So the confirm button is never disabled and
 * always reads the *DOM* value first.
 */

import { useRef, useState } from 'react'
import { CheckIcon, ExternalLinkIcon, KeyIcon, SparkIcon } from '@/components/icons'
import { BrandMark } from '@/components/BrandMark'
import { useSettingsStore } from '@/store/settings'
import { useChatStore } from '@/store/chat'
import { openExternal } from '@/lib/platform'
import { toast } from '@/store/ui'
import { tapFeedback } from '@/lib/haptics'

const MIN_KEY_LENGTH = 20

export function Onboarding() {
  const settings = useSettingsStore((state) => state.settings)
  const update = useSettingsStore((state) => state.update)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  if (settings.onboardingDone) return null

  /** Source of truth = the DOM input; React state is only a mirror. */
  const readKey = (): string => {
    const domValue = inputRef.current?.value ?? ''
    const value = (domValue || apiKey).trim()
    if (domValue && domValue !== apiKey) setApiKey(domValue)
    return value
  }

  const finish = (patch: { apiKey?: string; demoMode: boolean }) => {
    tapFeedback()
    update({ ...patch, onboardingDone: true })
    // Guarantee there is something to look at right away.
    if (useChatStore.getState().conversations.length === 0) {
      useChatStore.getState().createConversation(true)
    }
  }

  const startWithKey = () => {
    const key = readKey()
    if (key.length < MIN_KEY_LENGTH) {
      toast(key ? 'API Key 看起来不完整，请检查是否粘贴完整' : '请先粘贴 API Key', 'error')
      inputRef.current?.focus()
      return
    }
    finish({ apiKey: key, demoMode: false })
  }

  /** Keyboard opening shrinks the viewport; keep the card reachable. */
  const ensureVisible = () => {
    window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 260)
  }

  const keyLength = apiKey.trim().length

  return (
    <div className="onboarding">
      <div className="onboarding-inner">
        <BrandMark size={76} className="onboarding-brand" />

        <h1 className="onboarding-title">欢迎使用 Deepseek APP</h1>
        <p className="onboarding-desc">
          基于 DeepSeek 官方开放平台的 App 端 API 构建：深度思考、联网搜索、识图、文件解析与语音输入。
          API Key 只保存在这台设备上，不会经过任何第三方服务器。
        </p>

        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="onboarding-step-num">1</span>
            <span>在 platform.deepseek.com 创建 API Key（形如 sk-...）</span>
          </div>
          <div className="onboarding-step">
            <span className="onboarding-step-num">2</span>
            <span>粘贴到下方输入框，点「填入 Key 并开始」</span>
          </div>
          <div className="onboarding-step">
            <span className="onboarding-step-num">3</span>
            <span>回到对话页开始提问，可随时在设置里更换 Key 或切到演示模式</span>
          </div>
        </div>

        <div className="onboarding-card" ref={cardRef}>
          <label htmlFor="onboarding-key">
            <KeyIcon />
            DeepSeek API Key
          </label>
          <div className="input-with-action">
            <input
              id="onboarding-key"
              ref={inputRef}
              className="text-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              onInput={(event) => setApiKey((event.target as HTMLInputElement).value)}
              onBlur={() => {
                // Re-sync from the DOM in case an event was swallowed.
                const value = inputRef.current?.value ?? ''
                if (value !== apiKey) setApiKey(value)
              }}
              onFocus={ensureVisible}
              onKeyDown={(event) => {
                // The IME's "confirm/done" key usually arrives as Enter.
                if (event.key === 'Enter') {
                  event.preventDefault()
                  startWithKey()
                }
              }}
              placeholder="sk-..."
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
            <button type="button" className="mini-btn" onClick={() => setShowKey((value) => !value)}>
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          <div className="field-hint">
            {keyLength >= MIN_KEY_LENGTH ? (
              <span style={{ color: 'var(--success)' }}>已识别 {keyLength} 个字符</span>
            ) : keyLength > 0 ? (
              <span style={{ color: 'var(--warning)' }}>太短了，Key 通常有 35 个字符</span>
            ) : (
              <>
                还没有 Key？
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => openExternal('https://platform.deepseek.com/api_keys')}
                >
                  去创建
                  <ExternalLinkIcon size={11} />
                </button>
              </>
            )}
          </div>

          <div className="onboarding-actions">
            <button type="button" className="btn btn--primary" onClick={startWithKey}>
              <CheckIcon size={17} />
              填入 Key 并开始
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => finish({ demoMode: true })}>
              <SparkIcon size={17} />
              先体验演示模式
            </button>
          </div>
        </div>

        <p className="onboarding-foot">
          这是一个非官方的第三方客户端，仅用于个人学习与自用。所有对话内容会发送给 DeepSeek
          官方接口，请遵守其服务条款。
        </p>
      </div>
    </div>
  )
}
