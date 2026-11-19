/**
 * Builds Messages-protocol requests from local state.
 *
 * Key rules taken from the official docs:
 * - Pass previous assistant replies back **unchanged**, including `kind` and
 *   `signature`, so that read pages survive into later turns.
 * - `thinking: {type}` switches CoT; `output_config.effort` sets depth
 *   (`low` / `high` / `max`); `off` is expressed as `type: "disabled"`.
 * - `tools` are declared only when the corresponding toggle is on; with
 *   `tool_choice: none` all web tools are disabled.
 * - `title: {enabled:true}` only on the first turn of a conversation.
 * - Images go in `image` blocks (base64), documents in `document` blocks (Files API id).
 * - The system prompt is rebuilt on **every** turn, so edits apply to ongoing
 *   conversations (hot update). Models declaring
 *   `api_capabilities.anthropic_messages.system_prompt_update = "in-history"`
 *   additionally get a `system` message appended after the history, which
 *   replaces all earlier prompts; `leading-only` models just get the leading one.
 */

import type {
  ChatMessageParam,
  DeepSeekModel,
  MessagesRequest,
  UserContentPart,
} from '@/types/api'
import type { Conversation, ChatMessage } from '@/types/chat'
import type { Settings, ThinkingLevel } from '@/types/settings'
import { MAX_OUTPUT_TOKEN_LIMIT } from '@/types/settings'
import { sanitizeBlocksForHistory } from './accumulator'

/** ~1M context, so this only bounds pathological payloads. */
const MAX_TOKENS = 32768

/** Older than this many user turns, image payloads are dropped from history. */
const IMAGE_HISTORY_TURNS = 6

/**
 * From `GET /models` → `api_capabilities.anthropic_messages.system_prompt_update`.
 * `in-history` accepts a mid-conversation `system` message that replaces earlier
 * prompts; `leading-only` ignores later ones, so only the leading prompt counts.
 */
export const SYSTEM_PROMPT_UPDATE: Record<DeepSeekModel, 'in-history' | 'leading-only'> = {
  'deepseek-flash': 'in-history',
  'deepseek-v4-pro': 'leading-only',
}

function textOf(content: ChatMessageParam['content']): string {
  if (typeof content === 'string') return content
  return content
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('')
}

function buildUserContent(message: ChatMessage, keepImages: boolean): UserContentPart[] {
  const parts: UserContentPart[] = []

  for (const attachment of message.attachments ?? []) {
    if (attachment.kind === 'image' && attachment.base64 && attachment.uploadState === 'ready') {
      if (!keepImages) continue
      parts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: attachment.mimeType || 'image/jpeg',
          data: attachment.base64,
        },
      })
    } else if (attachment.kind === 'document' && attachment.fileId) {
      parts.push({
        type: 'document',
        source: { type: 'file', file_id: attachment.fileId },
      })
    }
  }

  const text = (message.text ?? '').trim()
  if (text) parts.push({ type: 'text', text })
  else if (parts.length > 0) parts.push({ type: 'text', text: '请描述我发送的内容。' })

  return parts
}

export interface BuildRequestOptions {
  conversation: Conversation
  settings: Settings
  /** The conversation messages *including* the new user turn and the empty assistant placeholder. */
  messages: ChatMessage[]
  /** True when this is the first assistant turn (enables server-side title generation). */
  isFirstTurn: boolean
}

export function buildMessagesRequest(options: BuildRequestOptions): MessagesRequest {
  const { conversation, settings, messages, isFirstTurn } = options

  const userTurns = messages.filter((m) => m.role === 'user')
  const keepImagesFrom = Math.max(0, userTurns.length - IMAGE_HISTORY_TURNS)

  const params: ChatMessageParam[] = []
  let seenUserTurns = 0

  for (const message of messages) {
    if (message.role === 'user') {
      const keepImages = seenUserTurns >= keepImagesFrom
      seenUserTurns += 1
      params.push({
        role: 'user',
        content: buildUserContent(message, keepImages),
      })
    } else {
      // Skip the not-yet-filled assistant placeholder.
      const blocks = sanitizeBlocksForHistory(message.blocks)
      if (!blocks.length) continue
      params.push({ role: 'assistant', content: blocks })
    }
  }

  const model: DeepSeekModel = conversation.model ?? settings.model

  const thinkingLevel: ThinkingLevel = conversation.thinkingLevel ?? settings.thinkingLevel
  const maxTokens =
    settings.maxOutputTokens > 0
      ? Math.min(settings.maxOutputTokens, MAX_OUTPUT_TOKEN_LIMIT)
      : MAX_TOKENS

  const systemPrompt = effectiveSystemPrompt(settings)
  const hash = promptHash(systemPrompt)
  // Prompt edited mid-conversation? For `in-history` models the new prompt is
  // appended as the latest system message, which replaces all earlier ones.
  const promptChanged =
    Boolean(conversation.lastPromptHash) &&
    conversation.lastPromptHash !== hash &&
    params.length > 0
  if (promptChanged && SYSTEM_PROMPT_UPDATE[model] === 'in-history' && systemPrompt) {
    params.push({ role: 'system', content: systemPrompt })
  }

  const body: MessagesRequest = {
    model,
    messages: params,
    max_tokens: maxTokens,
    stream: true,
    thinking: { type: thinkingLevel === 'off' ? 'disabled' : 'enabled' },
  }
  if (thinkingLevel !== 'off') {
    body.output_config = { effort: thinkingLevel }
  }

  const wantSearch = conversation.searchEnabled && settings.searchEnabled
  const wantReadUrl = conversation.readUrlEnabled && settings.readUrlEnabled

  const tools: NonNullable<MessagesRequest['tools']> = []
  if (wantSearch) tools.push({ type: 'deepseek_web_search', name: 'deepseek_web_search' })
  if (wantReadUrl) tools.push({ type: 'deepseek_read_url', name: 'deepseek_read_url' })
  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = { type: 'auto' }
  }

  if (settings.safetyCheck) body.safety_check = { level: 'high' }
  if (isFirstTurn) body.title = { enabled: true }

  // The leading system prompt is rebuilt from the *current* settings on every
  // turn, so prompt edits reach ongoing conversations without a restart.
  if (systemPrompt) body.system = systemPrompt

  return body
}

/** Light user-metadata marker, mirroring the official `latest_reminder` behaviour. */
export function buildSystemContext(date = new Date()): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `当前日期：${y}-${m}-${d}（${weekday}）。用户语言：中文（简体）。回答时请使用 Markdown 排版。`
}

/**
 * The system prompt actually sent: the user's custom prompt (when set) plus the
 * optional date/locale reminder. Empty string means "send no system prompt".
 */
export function effectiveSystemPrompt(settings: Settings, date = new Date()): string {
  const custom = settings.systemPrompt.trim()
  const context = settings.userContextEnabled ? buildSystemContext(date) : ''
  if (!custom) return context
  return context ? `${custom}\n\n${context}` : custom
}

/** Stable, cheap hash used to detect prompt edits between turns. */
export function promptHash(prompt: string): string {
  let hash = 5381
  for (let i = 0; i < prompt.length; i += 1) {
    hash = ((hash * 33) ^ prompt.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

/* ------------------------------------------------------------------ */
/*  Demo-mode helpers                                                 */
/* ------------------------------------------------------------------ */

/** Extract the last user message text from a request (used by the mock engine). */
export function lastUserText(messages: ChatMessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return textOf(messages[i].content)
  }
  return ''
}
