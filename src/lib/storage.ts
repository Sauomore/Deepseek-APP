/**
 * Persistence.
 *
 * - Settings: localStorage (small, synchronous, needed before first paint).
 * - Conversations: IndexedDB via idb-keyval, written on a debounce so that the
 *   hot streaming path never touches disk.
 *
 * Everything stays on the device; nothing is uploaded anywhere except to the
 * DeepSeek API itself when the user sends a message.
 */

import { get, set } from 'idb-keyval'
import { DEFAULT_SETTINGS, type Settings } from '@/types/settings'
import type { Conversation } from '@/types/chat'

const SETTINGS_KEY = 'deepseek.settings.v1'
const CONVERSATIONS_KEY = 'deepseek.conversations.v1'

/* ------------------------------------------------------------------ */
/*  Settings                                                          */
/* ------------------------------------------------------------------ */

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings> & {
      /** Legacy fields from ≤1.0.6 (boolean thinking + 3-level effort). */
      thinkingEnabled?: boolean
      effort?: string
    }
    const merged: Settings = { ...DEFAULT_SETTINGS, ...parsed }
    if (typeof parsed.thinkingLevel !== 'string') {
      merged.thinkingLevel =
        parsed.thinkingEnabled === false
          ? 'off'
          : parsed.effort === 'low'
            ? 'low'
            : parsed.effort === 'max'
              ? 'max'
              : 'high'
    }
    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let settingsTimer: number | undefined

export function saveSettings(settings: Settings): void {
  if (settingsTimer) window.clearTimeout(settingsTimer)
  settingsTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* quota exceeded — non-fatal */
    }
  }, 120)
}

export function saveSettingsNow(settings: Settings): void {
  if (settingsTimer) window.clearTimeout(settingsTimer)
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* non-fatal */
  }
}

/* ------------------------------------------------------------------ */
/*  Conversations                                                     */
/* ------------------------------------------------------------------ */

/** Strip non-persistable handles (Blob / File) before writing to IndexedDB. */
function serialisable(conversations: Conversation[]): Conversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      attachments: message.attachments?.map((attachment) => {
        const { blob: _blob, ...rest } = attachment
        return rest
      }),
    })),
  }))
}

export async function loadConversations(): Promise<Conversation[]> {
  try {
    const stored = await get<Conversation[]>(CONVERSATIONS_KEY)
    if (!Array.isArray(stored)) return []
    return stored
  } catch {
    return []
  }
}

let conversationsTimer: number | undefined
let pendingConversations: Conversation[] | null = null

/** Debounced write — safe to call on every state change. */
export function saveConversations(conversations: Conversation[]): void {
  pendingConversations = conversations
  if (conversationsTimer) return
  conversationsTimer = window.setTimeout(() => {
    conversationsTimer = undefined
    const payload = pendingConversations
    pendingConversations = null
    if (payload) void flushConversations(payload)
  }, 700)
}

export async function flushConversations(conversations: Conversation[]): Promise<void> {
  try {
    await set(CONVERSATIONS_KEY, serialisable(conversations))
  } catch (err) {
    // Quota is the realistic failure here (large base64 images). Retry without
    // image payloads rather than losing the whole history.
    console.warn('[storage] conversation write failed, retrying without media', err)
    try {
      const stripped = serialisable(conversations).map((conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) => ({
          ...message,
          attachments: message.attachments?.map((attachment) => ({
            ...attachment,
            base64: undefined,
          })),
        })),
      }))
      await set(CONVERSATIONS_KEY, stripped)
    } catch {
      /* give up silently — the in-memory session continues to work */
    }
  }
}

/** Flush immediately; call when the app goes to the background. */
export function flushNow(conversations: Conversation[]): void {
  if (conversationsTimer) {
    window.clearTimeout(conversationsTimer)
    conversationsTimer = undefined
  }
  pendingConversations = null
  void flushConversations(conversations)
}
