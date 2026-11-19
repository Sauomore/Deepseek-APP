/**
 * Wire types for the DeepSeek Open Platform, **Messages (Anthropic-compatible)
 * protocol** — `POST {baseUrl}/anthropic/v1/messages`.
 *
 * This is the protocol the official "Build a Chatbot" guide and the official
 * open-source demo use, because it returns the chatbot UI as discrete content
 * blocks (thinking / server tool use / tool results / text with citations),
 * which is exactly what the official DeepSeek app renders.
 *
 * Docs: https://api-docs.deepseek.com/guides/web_tools
 */

export const DEEPSEEK_MODELS = ['deepseek-flash', 'deepseek-v4-pro'] as const
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number]

export const MODEL_META: Record<
  DeepSeekModel,
  { label: string; alias: string; thinking: boolean; vision: boolean; desc: string }
> = {
  'deepseek-flash': {
    label: 'DeepSeek V4.1 Flash',
    alias: 'deepseek-flash',
    thinking: true,
    vision: true,
    desc: '速度快、支持识图，日常问答首选',
  },
  'deepseek-v4-pro': {
    label: 'DeepSeek V4 Pro',
    alias: 'deepseek-v4-pro',
    thinking: true,
    vision: false,
    desc: '更强的推理与写作能力，暂不支持图片',
  },
}

export type ThinkingType = 'enabled' | 'disabled'
export type ReasoningEffort = 'low' | 'high' | 'max'

/* ------------------------------------------------------------------ */
/*  Assistant content blocks (returned by the API, rendered by the UI) */
/* ------------------------------------------------------------------ */

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
  signature?: string
}

export type ServerToolName = 'deepseek_web_search' | 'deepseek_read_url'

export type ToolKind = 'search' | 'deep_search' | 'read_link' | 'image_search' | 'deep_image_search'

export type ToolAction =
  | { action: 'search'; queries?: string[] }
  | { action: 'open_page'; url?: string }
  | { action: 'find_in_page'; url?: string; pattern?: string }
  | { action: 'read_link'; url?: string }

export interface ServerToolUseBlock {
  type: 'server_tool_use'
  id: string
  name: ServerToolName
  input: ToolAction
  caller?: { type?: string }
  kind?: ToolKind
}

export interface WebSearchResult {
  type: 'web_search_result'
  title: string
  url: string
  encrypted_content?: string
  page_age?: string | null
  snippet?: string
  site_name?: string | null
  site_icon?: string | null
  image_url?: string
}

export interface WebSearchToolResultError {
  type: 'web_search_tool_result_error'
  error_code: string
}

export interface WebSearchToolResultBlock {
  type: 'web_search_tool_result'
  tool_use_id: string
  content: Array<WebSearchResult | WebSearchToolResultError>
  kind?: ToolKind
}

export interface WebFetchResult {
  type: 'web_fetch_result'
  url: string
  content?: {
    type: 'document'
    source?: { type: 'text'; media_type?: string; data?: string }
    title?: string
  }
  published_at?: string | null
}

export interface WebFetchToolResultError {
  type: 'web_fetch_tool_result_error'
  error_code: string
}

export interface WebFetchToolResultBlock {
  type: 'web_fetch_tool_result'
  tool_use_id: string
  content: WebFetchResult | WebFetchToolResultError
  kind?: ToolKind
  signature?: string
}

export interface Citation {
  type: 'web_search_result_location'
  url: string
  title?: string | null
  encrypted_index?: string
  cited_text?: string
}

export interface TextBlock {
  type: 'text'
  text: string
  citations?: Citation[]
}

export type AssistantBlock =
  | ThinkingBlock
  | ServerToolUseBlock
  | WebSearchToolResultBlock
  | WebFetchToolResultBlock
  | TextBlock

/* ------------------------------------------------------------------ */
/*  User content parts (sent in the request)                          */
/* ------------------------------------------------------------------ */

export interface UserTextPart {
  type: 'text'
  text: string
}

export interface UserImagePart {
  type: 'image'
  source:
    | { type: 'base64'; media_type: string; data: string }
    | { type: 'url'; url: string }
    | { type: 'file'; file_id: string }
}

export interface UserDocumentPart {
  type: 'document'
  source: { type: 'file'; file_id: string }
  title?: string
}

export type UserContentPart = UserTextPart | UserImagePart | UserDocumentPart
export type UserContent = string | UserContentPart[]

export interface ChatMessageParam {
  /** `system` is only used for mid-conversation prompt hot-updates (`in-history` models). */
  role: 'user' | 'assistant' | 'system'
  content: UserContent | AssistantBlock[]
}

/* ------------------------------------------------------------------ */
/*  Usage                                                             */
/* ------------------------------------------------------------------ */

export interface ServerToolUsage {
  web_search_requests?: number
  web_fetch_requests?: number
  tool_search?: number
  tool_fetch?: number
  tool_image_search?: number
}

export interface Usage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  service_tier?: string
  server_tool_use?: ServerToolUsage
  output_tokens_details?: { safety_tokens?: number; thinking_tokens?: number }
}

/* ------------------------------------------------------------------ */
/*  Files API purposes                                                */
/* ------------------------------------------------------------------ */

/**
 * `text_recognition` / `rich_layout_recognition` are **parsed** documents
 * (PDF, DOC/DOCX, PPT/PPTX, images) and are billed per page.
 * `user_data` is for files that need no parsing (txt/md/csv/json/code,
 * XLSX/XLS, EPUB/MOBI) and is not billed — verified against the live API:
 * these uploads return 400 if sent with a parsing purpose.
 */
export type FilePurpose = 'text_recognition' | 'rich_layout_recognition' | 'user_data'

/* ------------------------------------------------------------------ */
/*  Streaming events                                                  */
/* ------------------------------------------------------------------ */

export type StopReason = 'end_turn' | 'max_tokens' | 'refusal' | 'tool_use' | null

export interface MessageStartEvent {
  type: 'message_start'
  message: {
    id?: string
    type?: string
    role?: string
    model?: string
    content?: AssistantBlock[]
    stop_reason?: StopReason
    usage?: Usage
  }
}

export interface ContentBlockStartEvent {
  type: 'content_block_start'
  index: number
  content_block: AssistantBlock
}

export type ContentBlockDelta =
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'text_delta'; text: string }
  | { type: 'signature_delta'; signature: string }
  | { type: 'citations_delta'; citation: Citation }

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta'
  index: number
  delta: ContentBlockDelta
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop'
  index: number
}

export interface MessageDeltaEvent {
  type: 'message_delta'
  delta: {
    stop_reason?: StopReason
    stop_sequence?: string | null
    title?: string
  }
  usage?: Usage
}

export interface MessageStopEvent {
  type: 'message_stop'
}

export interface ErrorEvent {
  type: 'error'
  error: { type?: string; message?: string; code?: string }
}

export interface PingEvent {
  type: 'ping'
}

export type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | ErrorEvent
  | PingEvent

/* ------------------------------------------------------------------ */
/*  Request body                                                      */
/* ------------------------------------------------------------------ */

export interface MessagesRequest {
  model: DeepSeekModel
  messages: ChatMessageParam[]
  max_tokens: number
  stream: boolean
  thinking?: { type: ThinkingType }
  output_config?: { effort?: ReasoningEffort }
  tools?: Array<{ type: ServerToolName; name: ServerToolName }>
  tool_choice?: { type: 'auto' | 'none' | 'any' }
  safety_check?: { level: 'low' | 'high' }
  title?: { enabled: boolean }
  system?: string | Array<{ type: 'text'; text: string }>
  temperature?: number
}

/* ------------------------------------------------------------------ */
/*  Files API                                                         */
/* ------------------------------------------------------------------ */


export interface UploadedFile {
  id: string
  object?: string
  bytes?: number
  created_at?: number
  filename?: string
  purpose?: FilePurpose
}

/** Files API endpoint errors carry `{ error: { message, type, code } }`. */
export interface ApiErrorBody {
  error?: { message?: string; type?: string; code?: string }
  message?: string
  type?: string
  code?: string
}

/** Normalised, user-facing error thrown by the client layer. */
export class DeepSeekApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly detail?: string

  constructor(message: string, status = 0, code?: string, detail?: string) {
    super(message)
    this.name = 'DeepSeekApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}
