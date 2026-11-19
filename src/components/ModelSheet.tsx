/** Model picker + thinking-effort control, presented as a bottom sheet. */

import { CheckIcon, CloseIcon, SparkIcon } from '@/components/icons'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import { tapFeedback } from '@/lib/haptics'
import { DEEPSEEK_MODELS, MODEL_META, type DeepSeekModel } from '@/types/api'
import { THINKING_LEVELS, type ThinkingLevel } from '@/types/settings'

export function ModelSheet() {
  const open = useUiStore((state) => state.modelSheetOpen)
  const setOpen = useUiStore((state) => state.setModelSheet)
  const conversations = useChatStore((state) => state.conversations)
  const activeId = useChatStore((state) => state.activeId)
  const updateOptions = useChatStore((state) => state.updateOptions)
  const settings = useSettingsStore((state) => state.settings)
  const updateSettings = useSettingsStore((state) => state.update)

  const conversation = conversations.find((item) => item.id === activeId)
  if (!open) return null

  const currentModel = conversation?.model ?? settings.model
  const currentLevel: ThinkingLevel = conversation?.thinkingLevel ?? settings.thinkingLevel

  // A model sheet with no conversation would silently discard the choice.
  const commitModel = (model: DeepSeekModel) => {
    tapFeedback()
    if (conversation) {
      updateOptions({ model })
    } else {
      updateSettings({ model })
    }
    setOpen(false)
  }

  return (
    <>
      <div className="scrim scrim--sheet" onClick={() => setOpen(false)} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="选择模型">
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <div>
            <div className="sheet-title">选择模型</div>
            <div className="sheet-sub">不同模型在速度、推理与识图能力上各有侧重</div>
          </div>
          <button type="button" className="icon-btn sheet-close" onClick={() => setOpen(false)} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>

        <div className="sheet-body">
          {DEEPSEEK_MODELS.map((model) => {
            const meta = MODEL_META[model]
            const active = model === currentModel
            return (
              <button
                type="button"
                key={model}
                className={`model-option${active ? ' is-active' : ''}`}
                onClick={() => commitModel(model)}
              >
                <span className="model-option-body">
                  <span className="model-name">
                    {meta.label}
                    {active ? null : null}
                  </span>
                  <span className="model-desc">{meta.desc}</span>
                  <span className="model-tags">
                    <span className="model-tag model-tag--brand">1M 上下文</span>
                    <span className="model-tag">384K 输出</span>
                    <span className={`model-tag${meta.vision ? ' model-tag--brand' : ' model-tag--muted'}`}>
                      {meta.vision ? '支持识图' : '不支持识图'}
                    </span>
                    <span className="model-tag model-tag--muted">
                      {model === 'deepseek-flash' ? '2500 并发' : '500 并发'}
                    </span>
                  </span>
                </span>
                {active ? (
                  <span className="model-check">
                    <CheckIcon />
                  </span>
                ) : (
                  <span className="model-radio" />
                )}
              </button>
            )
          })}

          <div className="settings-group" style={{ marginTop: 18 }}>
            <div className="settings-group-title">思考强度</div>
            <div className="settings-card">
              <div className="settings-field">
                <div className="segmented">
                  {THINKING_LEVELS.map((level) => (
                    <button
                      type="button"
                      key={level.value}
                      aria-pressed={currentLevel === level.value}
                      onClick={() => {
                        tapFeedback()
                        if (conversation) updateOptions({ thinkingLevel: level.value })
                        else updateSettings({ thinkingLevel: level.value })
                      }}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
                <div className="field-hint">
                  <SparkIcon size={12} /> {THINKING_LEVELS.find((l) => l.value === currentLevel)?.desc}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
