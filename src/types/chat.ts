/**
 * Local (persisted) application model. Deliberately independent from the wire
 * protocol so the UI never depends on API-specific shapes: the store keeps the
 * raw assistant blocks it needs to replay a conversation, plus display state.
 */

import type {
  AssistantBlock,
  DeepSeekModel,
  FilePurpose,
  Usage,
} from './api'
import type { ThinkingLevel } from './settings'

export type MessageStatus =
  | 'pending' // queued / request not yet sent
  | 'streaming' // receiving tokens
  | 'done' // finished normally
  | 'aborted' // stopped by the user
  | 'refused' // stop_reason === 'refusal'
  | 'truncated' // stop_reason === 'max_tokens'
  | 'error' // transport / API error

export type AttachmentKind = 'image' | 'document'

export type UploadState = 'pending' | 'uploading' | 'ready' | 'error'

export interface Attachment {
  id: string
  kind: AttachmentKind
  name: string
  mimeType: string
  size: number
  /** Data URL used for the local thumbnail / preview (images). */
  previewUrl?: string
  /** Raw base64 payload (no data: prefix) for inline vision requests. */
  base64?: string
  /** Files API id for parsed documents or uploaded images. */
  fileId?: string
  /** Locally kept File/Blob so a retry can re-upload without user action. */
  blob?: Blob
  uploadState: UploadState
  progress?: number
  error?: string
  /** Parsing purpose used for documents. */
  purpose?: FilePurpose
  /** Server-reported page count etc. (display only). */
  meta?: Record<string, string | number>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  createdAt: number

  /** --- user turn --- */
  text?: string
  attachments?: Attachment[]

  /** --- assistant turn --- */
  blocks?: AssistantBlock[]
  status: MessageStatus
  error?: string
  /** Human-readable error code from the API (e.g. `rate_limit`). */
  errorCode?: string
  usage?: Usage
  /** Wall-clock duration of the generation, ms. */
  durationMs?: number
  /** Model used for this turn (frozen at request time). */
  model?: DeepSeekModel
  thinkingEnabled?: boolean
  searchEnabled?: boolean
  readUrlEnabled?: boolean
  /** Set while a retry reuses the original request payload. */
  regeneratedFrom?: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  model: DeepSeekModel
  thinkingLevel: ThinkingLevel
  searchEnabled: boolean
  readUrlEnabled: boolean
  /** True once the server has supplied a title (so we stop asking for one). */
  titleFromServer?: boolean
  /**
   * Hash of the system prompt used for the last turn. When the user edits the
   * custom prompt mid-conversation, the next turn detects the mismatch and
   * re-injects the new prompt (see buildMessagesRequest).
   */
  lastPromptHash?: string
  pinned?: boolean
}

/** Payload shown in the conversation drawer list (avoids loading messages). */
export interface ConversationSummary {
  id: string
  title: string
  updatedAt: number
  pinned?: boolean
  preview?: string
  messageCount: number
}
