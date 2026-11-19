/**
 * Chat store — conversations, message history and streaming orchestration.
 *
 * Design notes:
 * - One in-flight generation at a time (matches the app's single-composer UX and
 *   keeps abort handling unambiguous).
 * - Streaming never writes to disk: IndexedDB is only touched when a turn starts
 *   and when it settles. Tokens are flushed into React at ~25 fps.
 * - Demo mode and the real API share the entire downstream pipeline; only the
 *   event source differs.
 */

import { create } from 'zustand'
import { BlockAccumulator } from '@/api/accumulator'
import { isAbortError, streamMessages, DeepSeekApiError } from '@/api/client'
import { mockTitleFor, runMockStream } from '@/api/mock/engine'
import { buildMessagesRequest, effectiveSystemPrompt, lastUserText, promptHash } from '@/api/request'
import { prefixedId } from '@/lib/id'
import { flushNow, loadConversations, saveConversations } from '@/lib/storage'
import { useSettingsStore } from '@/store/settings'
import { toast } from '@/store/ui'
import type { AssistantBlock, DeepSeekModel } from '@/types/api'
import type { Attachment, ChatMessage, Conversation, MessageStatus } from '@/types/chat'
import type { Settings, ThinkingLevel } from '@/types/settings'
import type { ScenarioInput } from '@/api/mock/scenarios'

/* ------------------------------------------------------------------ */
/*  Factory helpers                                                   */
/* ------------------------------------------------------------------ */

export function newConversation(settings: Settings): Conversation {
  const now = Date.now()
  return {
    id: prefixedId('conv'),
    title: '新的对话',
    createdAt: now,
    updatedAt: now,
    messages: [],
    model: settings.model,
    thinkingLevel: settings.thinkingLevel,
    searchEnabled: settings.searchEnabled,
    readUrlEnabled: settings.readUrlEnabled,
  }
}

function newUserMessage(text: string, attachments: Attachment[]): ChatMessage {
  return {
    id: prefixedId('msg'),
    role: 'user',
    createdAt: Date.now(),
    text,
    attachments: attachments.length ? attachments : undefined,
    status: 'done',
  }
}

function newAssistantMessage(): ChatMessage {
  return {
    id: prefixedId('msg'),
    role: 'assistant',
    createdAt: Date.now(),
    blocks: [],
    status: 'pending',
  }
}

function patchConversation(
  conversations: Conversation[],
  id: string,
  updater: (conversation: Conversation) => Conversation,
): Conversation[] {
  return conversations.map((conversation) => (conversation.id === id ? updater(conversation) : conversation))
}

function patchMessage(
  conversations: Conversation[],
  conversationId: string,
  messageId: string,
  patch: Partial<ChatMessage>,
): Conversation[] {
  return patchConversation(conversations, conversationId, (conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.id === messageId ? { ...message, ...patch } : message,
    ),
  }))
}

/** Refusals: the docs ask the client to drop the streamed answer, keep tool blocks. */
function stripAnswerBlocks(blocks: AssistantBlock[]): AssistantBlock[] {
  return blocks.filter(
    (block) =>
      block.type === 'server_tool_use' ||
      block.type === 'web_search_tool_result' ||
      block.type === 'web_fetch_tool_result',
  )
}

function lastUserAttachments(conversation: Conversation): Attachment[] {
  for (let i = conversation.messages.length - 1; i >= 0; i -= 1) {
    const message = conversation.messages[i]
    if (message.role === 'user') return message.attachments ?? []
  }
  return []
}

/* ------------------------------------------------------------------ */
/*  Streaming orchestration                                           */
/* ------------------------------------------------------------------ */

let activeController: AbortController | null = null
let publishTimer: number | undefined

interface TurnPatch {
  (patch: Partial<ChatMessage>): void
}

async function executeTurn(
  get: () => ChatStore,
  set: (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void,
  conversationId: string,
  assistantId: string,
): Promise<void> {
  const settings = useSettingsStore.getState().settings
  const conversation = get().conversations.find((item) => item.id === conversationId)
  if (!conversation) return

  const hasRealKey = settings.apiKey.trim().length > 0
  if (!settings.demoMode && !hasRealKey) {
    set((state) => ({
      conversations: patchMessage(state.conversations, conversationId, assistantId, {
        status: 'error',
        error: '还没有配置 API Key。请到「设置 → 模型与接口」填入 Key，或打开演示模式。',
        errorCode: 'missing_key',
      }),
    }))
    toast('请先配置 API Key，或开启演示模式', 'error')
    return
  }

  const isFirstTurn =
    conversation.messages.filter(
      (message) => message.role === 'assistant' && message.id !== assistantId && (message.blocks?.length ?? 0) > 0,
    ).length === 0

  const body = buildMessagesRequest({
    conversation,
    settings,
    messages: conversation.messages,
    isFirstTurn,
  })

  const attachments = lastUserAttachments(conversation)
  const mockInput: ScenarioInput = {
    text: lastUserText(body.messages),
    hasImage: attachments.some((a) => a.kind === 'image'),
    hasDocument: attachments.some((a) => a.kind === 'document'),
  }

  const accumulator = new BlockAccumulator()
  const controller = new AbortController()
  activeController = controller

  const patch: TurnPatch = (partial) => {
    set((state) => ({
      conversations: patchMessage(state.conversations, conversationId, assistantId, partial),
    }))
  }

  let scheduled = false
  const flushBlocks = () => {
    scheduled = false
    publishTimer = undefined
    const snapshot = accumulator.snapshot()
    patch({
      blocks: snapshot.blocks,
      status: 'streaming',
      ...(snapshot.usage ? { usage: snapshot.usage } : {}),
    })
  }
  const schedulePublish = () => {
    if (scheduled) return
    scheduled = true
    publishTimer = window.setTimeout(flushBlocks, 40)
  }

  set({ generating: true })
  // Record what this turn actually used, and remember the prompt hash so a later
  // edit can be detected and re-injected (hot update).
  const usedLevel = conversation.thinkingLevel ?? settings.thinkingLevel
  set((state) => ({
    conversations: patchConversation(state.conversations, conversationId, (current) => ({
      ...current,
      model: body.model,
      thinkingLevel: usedLevel,
      searchEnabled: Boolean(body.tools?.some((tool) => tool.type === 'deepseek_web_search')),
      readUrlEnabled: Boolean(body.tools?.some((tool) => tool.type === 'deepseek_read_url')),
      lastPromptHash: promptHash(effectiveSystemPrompt(settings)),
    })),
  }))
  saveConversations(get().conversations)

  const startedAt = Date.now()

  try {
    const onEvent = (event: Parameters<BlockAccumulator['apply']>[0]) => {
      if (accumulator.apply(event)) schedulePublish()
    }

    if (settings.demoMode) {
      await runMockStream({
        request: body,
        input: mockInput,
        signal: controller.signal,
        onEvent,
      })
    } else {
      await streamMessages({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        body,
        signal: controller.signal,
        onEvent,
      })
    }

    if (publishTimer) {
      window.clearTimeout(publishTimer)
      publishTimer = undefined
    }
    const snapshot = accumulator.snapshot()
    const status: MessageStatus =
      snapshot.stopReason === 'refusal'
        ? 'refused'
        : snapshot.stopReason === 'max_tokens'
          ? 'truncated'
          : 'done'

    patch({
      blocks: status === 'refused' ? stripAnswerBlocks(snapshot.blocks) : snapshot.blocks,
      status,
      usage: snapshot.usage,
      durationMs: Date.now() - startedAt,
      error: undefined,
      errorCode: undefined,
    })

    if (snapshot.title) applyServerTitle(set, get, conversationId, snapshot.title)
  } catch (error) {
    if (publishTimer) {
      window.clearTimeout(publishTimer)
      publishTimer = undefined
    }
    const snapshot = accumulator.snapshot()

    if (isAbortError(error)) {
      patch({
        blocks: snapshot.blocks,
        status: 'aborted',
        usage: snapshot.usage,
        durationMs: Date.now() - startedAt,
      })
    } else {
      const message =
        error instanceof DeepSeekApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : '生成失败，请重试'
      const code = error instanceof DeepSeekApiError ? (error.code ?? 'unknown') : 'unknown'
      patch({
        blocks: snapshot.blocks,
        status: 'error',
        error: message,
        errorCode: code,
        usage: snapshot.usage,
        durationMs: Date.now() - startedAt,
      })
      // A missing key already produced its own toast.
      if (code !== 'missing_key') toast(message, 'error')
    }
  } finally {
    activeController = null
    set({ generating: false })
    saveConversations(get().conversations)
  }
}

function applyServerTitle(
  set: (partial: Partial<ChatStore> | ((state: ChatStore) => Partial<ChatStore>)) => void,
  _get: () => ChatStore,
  conversationId: string,
  title: string,
): void {
  const clean = title.trim()
  if (!clean) return
  set((state) => ({
    conversations: patchConversation(state.conversations, conversationId, (conversation) =>
      conversation.titleFromServer ? conversation : { ...conversation, title: clean, titleFromServer: true },
    ),
  }))
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

export interface ChatStore {
  conversations: Conversation[]
  activeId: string | null
  hydrated: boolean
  generating: boolean

  hydrate: () => Promise<void>
  createConversation: (activate?: boolean) => string
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  togglePin: (id: string) => void
  clearAllConversations: () => void
  updateOptions: (
    patch: Partial<
      Pick<Conversation, 'model' | 'thinkingLevel' | 'searchEnabled' | 'readUrlEnabled'>
    >,
  ) => void
  setModel: (model: DeepSeekModel) => void
  setThinkingLevel: (level: ThinkingLevel) => void
  send: (text: string, attachments?: Attachment[]) => Promise<void>
  regenerate: (messageId: string) => Promise<void>
  stop: () => void
  persistNow: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeId: null,
  hydrated: false,
  generating: false,

  hydrate: async () => {
    const stored = await loadConversations()
    const settings = useSettingsStore.getState().settings

    // Any message left mid-stream by a previous session can never resume.
    const recovered = stored.map((conversation) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const legacy = conversation as any
      const level: ThinkingLevel =
        conversation.thinkingLevel ??
        (legacy.thinkingEnabled === false
          ? 'off'
          : legacy.effort === 'low'
            ? 'low'
            : legacy.effort === 'max'
              ? 'max'
              : 'high')
      return {
        ...conversation,
        thinkingLevel: level,
        messages: conversation.messages.map((message) =>
          message.status === 'streaming' || message.status === 'pending'
            ? { ...message, status: 'aborted' as MessageStatus }
            : message,
        ),
      }
    })

    const sorted = [...recovered].sort((a, b) => b.updatedAt - a.updatedAt)
    const activeId = sorted.length > 0 ? sorted[0].id : null
    set({ conversations: sorted, activeId, hydrated: true })

    if (!sorted.length && settings.demoMode) {
      // First launch: show the welcome conversation so the app is never empty.
      get().createConversation(true)
    }
  },

  createConversation: (activate = true) => {
    const settings = useSettingsStore.getState().settings
    const conversation = newConversation(settings)
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      ...(activate ? { activeId: conversation.id } : {}),
    }))
    saveConversations(get().conversations)
    return conversation.id
  },

  selectConversation: (id) => {
    if (get().generating && activeController) {
      // Switching away mid-answer: stop cleanly so nothing keeps billing.
      get().stop()
    }
    set({ activeId: id })
  },

  deleteConversation: (id) => {
    set((state) => {
      const remaining = state.conversations.filter((conversation) => conversation.id !== id)
      const activeId =
        state.activeId === id ? (remaining.length > 0 ? remaining[0].id : null) : state.activeId
      return { conversations: remaining, activeId }
    })
    saveConversations(get().conversations)
  },

  renameConversation: (id, title) => {
    const clean = title.trim() || '新的对话'
    set((state) => ({
      conversations: patchConversation(state.conversations, id, (conversation) => ({
        ...conversation,
        title: clean,
        titleFromServer: true,
      })),
    }))
    saveConversations(get().conversations)
  },

  togglePin: (id) => {
    set((state) => ({
      conversations: patchConversation(state.conversations, id, (conversation) => ({
        ...conversation,
        pinned: !conversation.pinned,
      })),
    }))
    saveConversations(get().conversations)
  },

  clearAllConversations: () => {
    set({ conversations: [], activeId: null })
    saveConversations([])
    const settings = useSettingsStore.getState().settings
    const conversation = newConversation(settings)
    set({ conversations: [conversation], activeId: conversation.id })
    saveConversations(get().conversations)
  },

  updateOptions: (patch) => {
    const id = get().activeId
    if (!id) return
    set((state) => ({
      conversations: patchConversation(state.conversations, id, (conversation) => ({
        ...conversation,
        ...patch,
        updatedAt: Date.now(),
      })),
    }))
    saveConversations(get().conversations)
  },

  setModel: (model) => get().updateOptions({ model }),
  setThinkingLevel: (level) => get().updateOptions({ thinkingLevel: level }),

  send: async (text, attachments = []) => {
    if (get().generating) {
      toast('正在生成中，请稍候或先停止', 'error')
      return
    }
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return

    const id = get().activeId ?? get().createConversation()
    const userMessage = newUserMessage(trimmed, attachments)
    const assistantMessage = newAssistantMessage()

    set((state) => ({
      conversations: patchConversation(state.conversations, id, (conversation) => {
        const isFirstUserTurn = conversation.messages.every((message) => message.role !== 'user')
        return {
          ...conversation,
          title: isFirstUserTurn ? mockTitleFor(trimmed || attachments[0]?.name || '新的对话') : conversation.title,
          updatedAt: Date.now(),
          messages: [...conversation.messages, userMessage, assistantMessage],
        }
      }),
    }))
    saveConversations(get().conversations)

    await executeTurn(get, set, id, assistantMessage.id)
  },

  regenerate: async (messageId) => {
    if (get().generating) {
      toast('正在生成中，请稍候', 'error')
      return
    }
    const id = get().activeId
    if (!id) return
    const conversation = get().conversations.find((item) => item.id === id)
    if (!conversation) return
    const index = conversation.messages.findIndex((message) => message.id === messageId)
    if (index < 0) return

    const trimmed = conversation.messages.slice(0, index)
    const assistantMessage = newAssistantMessage()

    set((state) => ({
      conversations: patchConversation(state.conversations, id, (item) => ({
        ...item,
        messages: [...trimmed, assistantMessage],
        updatedAt: Date.now(),
      })),
    }))
    saveConversations(get().conversations)

    await executeTurn(get, set, id, assistantMessage.id)
  },

  stop: () => {
    if (activeController) {
      activeController.abort()
      activeController = null
    }
  },

  persistNow: () => {
    flushNow(get().conversations)
  },
}))

/* ------------------------------------------------------------------ */
/*  Selectors                                                         */
/* ------------------------------------------------------------------ */

export const selectActiveConversation = (state: ChatStore): Conversation | null =>
  state.conversations.find((conversation) => conversation.id === state.activeId) ?? null

export const selectActiveMessages = (state: ChatStore): ChatMessage[] => {
  const conversation = selectActiveConversation(state)
  return conversation?.messages ?? []
}

/** Pinned first, then most recently updated. */
export const selectSortedConversations = (state: ChatStore): Conversation[] =>
  [...state.conversations].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
