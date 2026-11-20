/**
 * Settings — credentials, model behaviour, appearance, interaction and data.
 *
 * The API key lives only in this device's storage and is sent exclusively to the
 * configured DeepSeek endpoint.
 */

import { useEffect, useRef, useState } from 'react'
import {
  AlertIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  ExternalLinkIcon,
  GlobeIcon,
  InfoIcon,
  KeyIcon,
  MoonIcon,
  SparkIcon,
  SunIcon,
  TrashIcon,
  BookOpenIcon,
} from '@/components/icons'
import { listModels } from '@/api/client'
import { openExternal } from '@/lib/platform'
import { tapFeedback } from '@/lib/haptics'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { toast, useUiStore } from '@/store/ui'
import { APP_VERSION, RELEASE_NOTES } from '@/lib/version'
import { MODEL_META } from '@/types/api'
import {
  MAX_OUTPUT_OPTIONS,
  THINKING_LEVELS,
  type FontScale,
  type ThemeMode,
} from '@/types/settings'

const THEMES: Array<{ value: ThemeMode; label: string; icon: typeof SunIcon }> = [
  { value: 'auto', label: '跟随系统', icon: InfoIcon },
  { value: 'light', label: '浅色', icon: SunIcon },
  { value: 'dark', label: '深色', icon: MoonIcon },
]

const FONT_SCALES: Array<{ value: FontScale; label: string }> = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '标准' },
  { value: 'lg', label: '大' },
]

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        tapFeedback()
        onChange(!checked)
      }}
    />
  )
}

export function SettingsPage() {
  const open = useUiStore((state) => state.settingsOpen)
  const close = useUiStore((state) => state.closeSettings)
  const setModelSheet = useUiStore((state) => state.setModelSheet)
  const settings = useSettingsStore((state) => state.settings)
  const update = useSettingsStore((state) => state.update)
  const clearAll = useChatStore((state) => state.clearAllConversations)
  const setThinkingLevel = useChatStore((state) => state.setThinkingLevel)
  const activeConversation = useChatStore((state) => state.conversations.find((item) => item.id === state.activeId))

  const [keyDraft, setKeyDraft] = useState(settings.apiKey)
  const [showKey, setShowKey] = useState(false)
  const [baseUrlDraft, setBaseUrlDraft] = useState(settings.baseUrl)
  const [testing, setTesting] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [panel, setPanel] = useState<null | 'prompt' | 'tokens' | 'changelog'>(null)
  const [promptDraft, setPromptDraft] = useState(settings.systemPrompt)
  const keyInputRef = useRef<HTMLInputElement>(null)
  const baseUrlInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  /**
   * The settings page stays mounted for the whole app lifetime, so `useState`
   * initialisers would freeze the drafts at their first-launch values. Without
   * this re-sync a key entered on the onboarding screen shows up as an empty
   * field — and blurring that field would overwrite the real key with ''.
   */
  useEffect(() => {
    if (!open) return
    const latest = useSettingsStore.getState().settings
    setKeyDraft(latest.apiKey)
    setBaseUrlDraft(latest.baseUrl)
    // The fields are uncontrolled, so seed their DOM values explicitly.
    if (keyInputRef.current) keyInputRef.current.value = latest.apiKey
    if (baseUrlInputRef.current) baseUrlInputRef.current.value = latest.baseUrl
  }, [open])

  /** Re-sync the prompt draft whenever the editor panel opens. */
  useEffect(() => {
    if (panel !== 'prompt') return
    const latest = useSettingsStore.getState().settings.systemPrompt
    setPromptDraft(latest)
    // The textarea is uncontrolled, so seed its DOM value too (defaultValue only
    // applies at mount, and the sheet is reused between opens).
    if (promptInputRef.current) promptInputRef.current.value = latest
  }, [panel])

  if (!open) return null

  const currentModel = activeConversation?.model ?? settings.model
  const modelMeta = MODEL_META[currentModel]

  /**
   * Paste robustness: some Android WebViews update the DOM value without firing
   * an `input` event, so always prefer the live DOM value over React state.
   */
  const readKeyDraft = (): string => {
    const domValue = keyInputRef.current?.value ?? ''
    const value = (domValue || keyDraft).trim()
    if (domValue && domValue !== keyDraft) setKeyDraft(domValue)
    return value
  }

  const commitKey = () => {
    const next = readKeyDraft()
    if (next !== settings.apiKey.trim()) {
      update({ apiKey: next })
      toast(next ? 'API Key 已保存' : 'API Key 已清空', next ? 'success' : 'default')
    }
  }

  const commitBaseUrl = () => {
    const domValue = baseUrlInputRef.current?.value ?? ''
    const next = (domValue || baseUrlDraft).trim() || 'https://api.deepseek.com'
    setBaseUrlDraft(next)
    if (next !== settings.baseUrl) {
      update({ baseUrl: next })
      toast('接口地址已保存', 'success')
    }
  }

  const testConnection = async () => {
    const key = readKeyDraft()
    if (!key) {
      toast('请先填写 API Key', 'error')
      return
    }
    setTesting(true)
    try {
      const models = await listModels(settings.baseUrl, key)
      const ids = models.map((model) => model.id).filter(Boolean)
      toast(ids.length ? `连接成功：${ids.join('、')}` : '连接成功', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : '连接失败', 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="settings-page" role="dialog" aria-modal="true" aria-label="设置">
      <div className="settings-head">
        <button type="button" className="icon-btn" onClick={close} aria-label="返回">
          <ChevronRightIcon style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span className="settings-title">设置</span>
      </div>

      <div className="settings-body">
        {/* ------------------------------- 接口 ------------------------------- */}
        <div className="settings-group">
          <div className="settings-group-title">接口与账号</div>
          <div className="settings-card">
            <div className="settings-field">
              <label htmlFor="api-key">
                <KeyIcon size={13} /> DeepSeek API Key
              </label>
              <div className="input-with-action">
                <input
                  id="api-key"
                  ref={keyInputRef}
                  className="text-input"
                  type={showKey ? 'text' : 'password'}
                  /* Uncontrolled: a bound value is rewritten on every render and
                     on Android WebView that moves the caret to the end, which
                     made it impossible to edit a key in the middle. */
                  defaultValue=""
                  onInput={(event) => setKeyDraft((event.target as HTMLInputElement).value)}
                  onBlur={commitKey}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      commitKey()
                      keyInputRef.current?.blur()
                    }
                  }}
                  placeholder="sk-..."
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button type="button" className="mini-btn" onClick={() => setShowKey((value) => !value)}>
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
              <div className="field-hint">
                Key 仅保存在本机，直接发往 DeepSeek 官方接口。
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => openExternal('https://platform.deepseek.com/api_keys')}
                >
                  获取 Key
                  <ExternalLinkIcon size={11} />
                </button>
              </div>
            </div>

            <button
              type="button"
              className="settings-row"
              onClick={() => void testConnection()}
              disabled={testing}
            >
              <span className="settings-row-main">
                <span className="settings-row-title">测试连接</span>
                <span className="settings-row-desc">
                  {settings.demoMode ? '演示模式下不会真正请求接口' : '验证 Key 与地址是否可用'}
                </span>
              </span>
              <span className="settings-row-value">
                {testing ? <span className="spinner" /> : '检查'}
              </span>
            </button>

            <div className="settings-field">
              <label htmlFor="base-url">接口地址（Base URL）</label>
              <input
                id="base-url"
                ref={baseUrlInputRef}
                className="text-input"
                defaultValue=""
                onInput={(event) => setBaseUrlDraft((event.target as HTMLInputElement).value)}
                onBlur={commitBaseUrl}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitBaseUrl()
                    baseUrlInputRef.current?.blur()
                  }
                }}
                placeholder="https://api.deepseek.com"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <div className="field-hint">
                默认 <code>https://api.deepseek.com</code>，对话走
                <code>/anthropic/v1/messages</code>。填入官方地址即可，不要填完整路径。
              </div>
            </div>

            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">演示模式</span>
                <span className="settings-row-desc">不请求接口、不消耗额度，回答来自本地内容库</span>
              </span>
              <Switch
                label="演示模式"
                checked={settings.demoMode}
                onChange={(value) => update({ demoMode: value })}
              />
            </div>

            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">内容安全审核</span>
                <span className="settings-row-desc">
                  开启后，你的问题和模型的回答都会先经过 DeepSeek 官方安全审核；
                  命中风险时回答会被拦截并显示拒答提示（safety_check: high）
                </span>
              </span>
              <Switch
                label="内容安全审核"
                checked={settings.safetyCheck}
                onChange={(value) => update({ safetyCheck: value })}
              />
            </div>
          </div>
        </div>

        {/* ------------------------------- 模型 ------------------------------- */}
        <div className="settings-group">
          <div className="settings-group-title">模型与能力</div>
          <div className="settings-card">
            <button type="button" className="settings-row" onClick={() => setModelSheet(true)}>
              <span className="settings-row-main">
                <span className="settings-row-title">当前模型</span>
                <span className="settings-row-desc">{modelMeta.desc}</span>
              </span>
              <span className="settings-row-value">{modelMeta.label.replace('DeepSeek ', '')}</span>
              <span className="chev">
                <ChevronRightIcon />
              </span>
            </button>

            <div className="settings-field">
              <label>思考强度</label>
              <div className="segmented">
                {THINKING_LEVELS.map((level) => (
                  <button
                    type="button"
                    key={level.value}
                    aria-pressed={(activeConversation?.thinkingLevel ?? settings.thinkingLevel) === level.value}
                    onClick={() => {
                      tapFeedback()
                      update({ thinkingLevel: level.value })
                      if (activeConversation) setThinkingLevel(level.value)
                    }}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
              <div className="field-hint">
                {THINKING_LEVELS.find(
                  (level) => level.value === (activeConversation?.thinkingLevel ?? settings.thinkingLevel),
                )?.desc}
              </div>
            </div>

            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">
                  <GlobeIcon size={15} /> 允许联网搜索
                </span>
                <span className="settings-row-desc">总开关；关闭后即使输入框开关打开也不会联网</span>
              </span>
              <Switch
                label="允许联网搜索"
                checked={settings.searchEnabled}
                onChange={(value) => update({ searchEnabled: value })}
              />
            </div>

            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">
                  <BookOpenIcon size={15} /> 允许读取链接
                </span>
                <span className="settings-row-desc">让模型打开消息中的网址并基于网页内容回答</span>
              </span>
              <Switch
                label="允许读取链接"
                checked={settings.readUrlEnabled}
                onChange={(value) => update({ readUrlEnabled: value })}
              />
            </div>

            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">
                  <ClockIcon size={15} /> 注入当前日期
                </span>
                <span className="settings-row-desc">把今天的日期与语言作为系统上下文，时效性问题更准</span>
              </span>
              <Switch
                label="注入当前日期"
                checked={settings.userContextEnabled}
                onChange={(value) => update({ userContextEnabled: value })}
              />
            </div>

            <button type="button" className="settings-row" onClick={() => setPanel('prompt')}>
              <span className="settings-row-main">
                <span className="settings-row-title">
                  <SparkIcon size={15} /> 自定义系统提示词
                </span>
                <span className="settings-row-desc">
                  {settings.systemPrompt.trim()
                    ? `已启用 · ${settings.systemPrompt.trim().length} 字，改动对已有对话下一轮生效`
                    : '留空使用内置默认；修改后已有对话下一轮自动重新注入'}
                </span>
              </span>
              <span className="settings-row-value">{settings.systemPrompt.trim() ? '已设置' : '默认'}</span>
              <span className="chev">
                <ChevronRightIcon />
              </span>
            </button>

            <button type="button" className="settings-row" onClick={() => setPanel('tokens')}>
              <span className="settings-row-main">
                <span className="settings-row-title">
                  <BookOpenIcon size={15} /> 最大输出 token
                </span>
                <span className="settings-row-desc">限制单次回复长度；默认交由服务端决定</span>
              </span>
              <span className="settings-row-value">
                {MAX_OUTPUT_OPTIONS.find((option) => option.value === settings.maxOutputTokens)?.label ?? settings.maxOutputTokens}
              </span>
              <span className="chev">
                <ChevronRightIcon />
              </span>
            </button>
          </div>
        </div>

        {/* ------------------------------- 外观 ------------------------------- */}
        <div className="settings-group">
          <div className="settings-group-title">外观</div>
          <div className="settings-card">
            <div className="settings-field">
              <label>主题</label>
              <div className="segmented">
                {THEMES.map((theme) => (
                  <button
                    type="button"
                    key={theme.value}
                    aria-pressed={settings.theme === theme.value}
                    onClick={() => {
                      tapFeedback()
                      update({ theme: theme.value })
                    }}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-field">
              <label>正文字号</label>
              <div className="segmented">
                {FONT_SCALES.map((scale) => (
                  <button
                    type="button"
                    key={scale.value}
                    aria-pressed={settings.fontScale === scale.value}
                    onClick={() => {
                      tapFeedback()
                      update({ fontScale: scale.value })
                    }}
                  >
                    {scale.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">显示 token 用量</span>
                <span className="settings-row-desc">在回答下方显示输入/输出 token 与费用估算</span>
              </span>
              <Switch
                label="显示 token 用量"
                checked={settings.showUsage}
                onChange={(value) => update({ showUsage: value })}
              />
            </div>
          </div>
        </div>

        {/* ------------------------------- 交互 ------------------------------- */}
        <div className="settings-group">
          <div className="settings-group-title">交互</div>
          <div className="settings-card">
            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">发送方式</span>
                <span className="settings-row-desc">仅点击右侧发送按钮发送，回车键用于换行</span>
              </span>
              <span className="settings-row-value">按钮发送</span>
            </div>
            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">震动反馈</span>
                <span className="settings-row-desc">发送、切换开关时给出轻微触感</span>
              </span>
              <Switch
                label="震动反馈"
                checked={settings.hapticsEnabled}
                onChange={(value) => update({ hapticsEnabled: value })}
              />
            </div>
            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">首页推荐问题</span>
                <span className="settings-row-desc">在空对话页面显示 4 个随机推荐卡片</span>
              </span>
              <Switch
                label="首页推荐问题"
                checked={settings.showSuggestions}
                onChange={(value) => update({ showSuggestions: value })}
              />
            </div>
          </div>
        </div>

        {/* ------------------------------- 数据 ------------------------------- */}
        <div className="settings-group">
          <div className="settings-group-title">数据</div>
          <div className="settings-card">
            <button type="button" className="settings-row" onClick={() => setConfirmClear(true)}>
              <span className="settings-row-main">
                <span className="settings-row-title" style={{ color: 'var(--danger)' }}>
                  清空所有对话
                </span>
                <span className="settings-row-desc">删除本机保存的全部对话记录，不可恢复</span>
              </span>
              <span className="chev" style={{ color: 'var(--danger)' }}>
                <TrashIcon />
              </span>
            </button>
          </div>
        </div>

        {/* ------------------------------- 关于 ------------------------------- */}
        <div className="settings-group">
          <div className="settings-group-title">关于</div>
          <div className="settings-card">
            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">版本</span>
                <span className="settings-row-desc">Deepseek APP {APP_VERSION} · 非官方客户端</span>
              </span>
            </div>
            <button type="button" className="settings-row" onClick={() => setPanel('changelog')}>
              <span className="settings-row-main">
                <span className="settings-row-title">更新日志</span>
                <span className="settings-row-desc">当前版本 {APP_VERSION} · 查看历史更新说明</span>
              </span>
              <span className="chev">
                <ChevronRightIcon />
              </span>
            </button>
            <button
              type="button"
              className="settings-row"
              onClick={() => openExternal('https://api-docs.deepseek.com/guides/build_a_chatbot')}
            >
              <span className="settings-row-main">
                <span className="settings-row-title">官方 API 文档</span>
                <span className="settings-row-desc">Build a Chatbot 指南</span>
              </span>
              <span className="chev">
                <ExternalLinkIcon />
              </span>
            </button>
            <div className="settings-row settings-row--static">
              <span className="settings-row-main">
                <span className="settings-row-title">隐私说明</span>
                <span className="settings-row-desc">
                  对话、图片与文件只会发送到你配置的 DeepSeek 接口；本应用不含任何统计或追踪。
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------- 系统提示词编辑 ------------------------- */}
      {panel === 'prompt' ? (
        <>
          <div className="scrim scrim--sheet" onClick={() => setPanel(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="自定义系统提示词">
            <div className="sheet-grabber" />
            <div className="sheet-head">
              <div>
                <div className="sheet-title">自定义系统提示词</div>
                <div className="sheet-sub">
                  每次请求都会重新读取这里的文本；保存后，已有对话的下一轮会自动用上新提示词。
                </div>
              </div>
              <button type="button" className="icon-btn sheet-close" onClick={() => setPanel(null)} aria-label="关闭">
                <CloseIcon />
              </button>
            </div>
            <div className="sheet-body">
              <textarea
                ref={promptInputRef}
                className="settings-textarea"
                defaultValue={promptDraft}
                placeholder="例如：你是一位严谨的技术顾问，回答先给结论，再给依据；不确定时明确说明。"
                rows={7}
                onChange={(event) => setPromptDraft(event.target.value)}
                onInput={(event) => setPromptDraft((event.target as HTMLTextAreaElement).value)}
              />
              <div className="field-hint">
                留空表示使用内置默认提示词。系统提示词不会显示在对话记录里。
              </div>
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    if (promptInputRef.current) promptInputRef.current.value = ''
                    setPromptDraft('')
                    update({ systemPrompt: '' })
                    toast('已恢复默认提示词', 'success')
                    setPanel(null)
                  }}
                >
                  恢复默认
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    const value = (promptInputRef.current?.value ?? promptDraft).trim()
                    update({ systemPrompt: value })
                    toast(value ? '系统提示词已保存，下一轮生效' : '已恢复默认提示词', 'success')
                    setPanel(null)
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* ------------------------- 最大输出 token ------------------------- */}
      {panel === 'tokens' ? (
        <>
          <div className="scrim scrim--sheet" onClick={() => setPanel(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="最大输出 token">
            <div className="sheet-grabber" />
            <div className="sheet-head">
              <div>
                <div className="sheet-title">最大输出 token</div>
                <div className="sheet-sub">限制单次回复的最大长度；默认交由服务端按模型/思考模式决定。</div>
              </div>
            </div>
            <div className="sheet-body">
              {MAX_OUTPUT_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`confirm-item${settings.maxOutputTokens === option.value ? ' is-active' : ''}`}
                  onClick={() => {
                    tapFeedback()
                    update({ maxOutputTokens: option.value })
                    setPanel(null)
                  }}
                >
                  <span>{option.label}</span>
                  {option.value > 0 ? <span className="confirm-item-meta">{option.value.toLocaleString()} tokens</span> : null}
                  {settings.maxOutputTokens === option.value ? <CheckIcon /> : null}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* ----------------------------- 更新日志 ----------------------------- */}
      {panel === 'changelog' ? (
        <>
          <div className="scrim scrim--sheet" onClick={() => setPanel(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="更新日志">
            <div className="sheet-grabber" />
            <div className="sheet-head">
              <div>
                <div className="sheet-title">更新日志</div>
                <div className="sheet-sub">当前版本 Deepseek APP v{APP_VERSION}</div>
              </div>
              <button type="button" className="icon-btn sheet-close" onClick={() => setPanel(null)} aria-label="关闭">
                <CloseIcon />
              </button>
            </div>
            <div className="sheet-body">
              {RELEASE_NOTES.map((note) => (
                <div className="changelog-block" key={note.version}>
                  <div className="changelog-head">
                    <span className="changelog-version">v{note.version}</span>
                    <span className="changelog-date">{note.date}</span>
                    {note.version === APP_VERSION ? <span className="changelog-current">当前</span> : null}
                  </div>
                  <ul className="update-list">
                    {note.items.map((item) => (
                      <li key={item} className="update-item">
                        <span className="update-dot" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {confirmClear ? (
        <>
          <div className="scrim scrim--sheet" onClick={() => setConfirmClear(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="确认清空">
            <div className="sheet-grabber" />
            <div className="sheet-head">
              <div>
                <div className="sheet-title">清空所有对话？</div>
                <div className="sheet-sub">本机保存的全部对话与消息都会被删除，且无法恢复</div>
              </div>
            </div>
            <div className="sheet-body">
              <div className="confirm-sheet-actions">
                <button
                  type="button"
                  className="confirm-item confirm-item--danger"
                  onClick={() => {
                    clearAll()
                    setConfirmClear(false)
                    toast('已清空所有对话', 'success')
                    close()
                  }}
                >
                  <TrashIcon />
                  确认清空
                </button>
                <button type="button" className="confirm-item" onClick={() => setConfirmClear(false)}>
                  <CheckIcon />
                  取消
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

/** Small inline banner used by the chat screen when demo mode is on. */
export function DemoBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div
      className="composer-notice"
      style={{ color: 'var(--warning)', gap: 5, cursor: 'pointer' }}
      onClick={onOpenSettings}
      role="button"
      tabIndex={0}
    >
      <AlertIcon size={12} />
      演示模式：回答来自本地内容库，
      <span style={{ textDecoration: 'underline' }}>接入真实模型</span>
    </div>
  )
}

export { CloseIcon }
