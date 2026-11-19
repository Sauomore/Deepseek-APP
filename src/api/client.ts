/**
 * DeepSeek Open Platform client.
 *
 * Protocol: **Messages (Anthropic-compatible)** — `POST {base}/anthropic/v1/messages`.
 * Chosen over Chat Completions / Responses because it streams the chatbot UI as
 * discrete content blocks (thinking / server tool use / tool results / text with
 * citations) and supports `title`, which is exactly what the official app shows.
 *
 * Everything here is browser/WebView-native (fetch + ReadableStream + XHR) —
 * the DeepSeek API sends permissive CORS headers (verified for
 * `/anthropic/v1/messages`, `/files`, `/v1/tools/asr`, `/models`), so the app
 * can talk to it directly with the user's own key, with no proxy.
 */

import {
  DeepSeekApiError,
  type DeepSeekModel,
  type MessagesRequest,
  type StreamEvent,
  type UploadedFile,
  type FilePurpose,
  type ApiErrorBody,
} from '@/types/api'

export { DeepSeekApiError }
export type { DeepSeekModel }

export const DEFAULT_BASE_URL = 'https://api.deepseek.com'

/** Status-code → friendly Chinese copy. */
const HTTP_MESSAGES: Record<number, { text: string; code: string }> = {
  400: { text: '请求格式有误（400）', code: 'invalid_format' },
  401: { text: 'API Key 无效或已失效（401）', code: 'auth_failed' },
  402: { text: '账户余额不足（402）', code: 'insufficient_balance' },
  408: { text: '请求超时（408），请检查网络后重试', code: 'timeout' },
  413: { text: '上传的文件太大（413）', code: 'too_large' },
  422: { text: '请求参数无效（422）', code: 'invalid_params' },
  429: { text: '请求过于频繁，请稍后再试（429）', code: 'rate_limit' },
  500: { text: '服务器开小差了（500），请稍后重试', code: 'server_error' },
  502: { text: '网关错误（502），请稍后重试', code: 'bad_gateway' },
  503: { text: '服务器繁忙（503），请稍后重试', code: 'overloaded' },
  504: { text: '网关超时（504），请稍后重试', code: 'gateway_timeout' },
}

/** Normalise whatever the user pasted into a bare origin such as `https://api.deepseek.com`. */
export function normalizeBaseUrl(input: string): string {
  let u = (input || '').trim()
  if (!u) u = DEFAULT_BASE_URL
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`
  u = u.replace(/\/+$/, '')
  // Accept a pasted full endpoint and strip the protocol-specific parts.
  u = u
    .replace(/\/anthropic\/v1\/messages$/i, '')
    .replace(/\/anthropic\/v1$/i, '')
    .replace(/\/anthropic$/i, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/v1\/tools\/asr$/i, '')
    .replace(/\/files$/i, '')
    .replace(/\/v1$/i, '')
  return u.replace(/\/+$/, '') || DEFAULT_BASE_URL
}

export function messagesEndpoint(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/anthropic/v1/messages`
}

export function filesEndpoint(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/files`
}

export function asrEndpoint(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/v1/tools/asr`
}

export function modelsEndpoint(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/models`
}

function authHeaders(apiKey: string): Record<string, string> {
  const key = (apiKey || '').trim()
  // The Messages API accepts either header; sending both is harmless and helps
  // users who paste keys from either console.
  return { 'x-api-key': key, Authorization: `Bearer ${key}` }
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException
      ? err.name === 'AbortError'
      : !!err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError'
  )
}

export { isAbortError }

async function readErrorBody(res: Response): Promise<ApiErrorBody | null> {
  try {
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text) as ApiErrorBody
    } catch {
      return { message: text.slice(0, 500) }
    }
  } catch {
    return null
  }
}

/** Build a friendly error from a non-2xx response. */
export async function errorFromResponse(res: Response): Promise<DeepSeekApiError> {
  const body = await readErrorBody(res)
  const serverMsg = body?.error?.message || body?.message || ''
  const serverCode = body?.error?.code || body?.code

  // Content-safety rejections come back as 400 with a distinctive message.
  if (res.status === 400 && /content exists risk/i.test(serverMsg)) {
    return new DeepSeekApiError(
      '内容未通过安全审核，请修改后重试',
      res.status,
      'content_risk',
      serverMsg,
    )
  }

  const mapped = HTTP_MESSAGES[res.status]
  const text = mapped?.text || `请求失败（${res.status}）`
  const withDetail = serverMsg && !text.includes(serverMsg) ? `${text}：${serverMsg}` : text
  return new DeepSeekApiError(withDetail, res.status, serverCode || mapped?.code, serverMsg)
}

/* ------------------------------------------------------------------ */
/*  SSE parsing                                                       */
/* ------------------------------------------------------------------ */

export interface StreamOptions {
  baseUrl: string
  apiKey: string
  body: MessagesRequest
  signal?: AbortSignal
  onEvent: (event: StreamEvent) => void
  /** Fired once headers are received, useful to switch UI to "streaming". */
  onOpen?: () => void
}

/**
 * POST the request and dispatch parsed SSE events until the stream ends.
 * Resolves on a clean end; throws `DeepSeekApiError` on HTTP errors and
 * `AbortError` when the caller cancels.
 */
export async function streamMessages(opts: StreamOptions): Promise<void> {
  const { baseUrl, apiKey, body, signal, onEvent, onOpen } = opts

  let res: Response
  try {
    res = await fetch(messagesEndpoint(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...authHeaders(apiKey),
        'anthropic-version': '2023-06-01',
        // Required as soon as the conversation references a Files API object
        // (document blocks, or images uploaded by file_id). Harness validates
        // this against the live API: omitting it returns 400
        // "Missing or invalid anthropic-beta header".
        'anthropic-beta': 'files-api-2025-04-14',
      },
      body: JSON.stringify(body),
      signal,
      // The WebView must not try to cache a POST.
      cache: 'no-store',
    })
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new DeepSeekApiError(
      '网络连接失败，请检查网络或代理设置',
      0,
      'network_error',
      err instanceof Error ? err.message : String(err),
    )
  }

  if (!res.ok) throw await errorFromResponse(res)
  onOpen?.()

  if (!res.body) {
    throw new DeepSeekApiError('响应为空，请重试', 0, 'empty_body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let closed = false

  const dispatch = (rawBlock: string) => {
    const lines = rawBlock.split('\n')
    const dataLines: string[] = []
    for (const line of lines) {
      if (!line || line.startsWith(':')) continue // keep-alive comment
      if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
      // `event:` is redundant — the payload carries `type`.
    }
    if (!dataLines.length) return
    const data = dataLines.join('\n').trim()
    if (!data || data === '[DONE]') return
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return // partial / non-JSON frame: ignore rather than crash the chat
    }
    const ev = parsed as StreamEvent
    if (ev && typeof ev === 'object' && 'type' in ev) onEvent(ev)
  }

  try {
    while (!closed) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // Normalise CRLF without losing a boundary split between chunks.
      buffer = buffer.replace(/\r\n/g, '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        dispatch(raw)
        boundary = buffer.indexOf('\n\n')
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) dispatch(buffer.replace(/\r\n/g, '\n'))
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new DeepSeekApiError(
      '连接中断，回答可能不完整',
      0,
      'stream_interrupted',
      err instanceof Error ? err.message : String(err),
    )
  } finally {
    closed = true
    try {
      reader.releaseLock()
    } catch {
      /* already released */
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Health / models                                                   */
/* ------------------------------------------------------------------ */

export interface RemoteModel {
  id: string
  display_name?: string
  context_window?: number
  output_limit?: number
}

/** Validates the key and endpoint; throws `DeepSeekApiError` when unusable. */
export async function listModels(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<RemoteModel[]> {
  if (!apiKey.trim()) throw new DeepSeekApiError('请先填写 API Key', 0, 'missing_key')
  let res: Response
  try {
    res = await fetch(modelsEndpoint(baseUrl), {
      headers: { ...authHeaders(apiKey), Accept: 'application/json' },
      signal,
      cache: 'no-store',
    })
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new DeepSeekApiError('无法连接服务器，请检查 Base URL 与网络', 0, 'network_error')
  }
  if (!res.ok) throw await errorFromResponse(res)
  const json = (await res.json()) as { data?: RemoteModel[] }
  return json.data ?? []
}

/* ------------------------------------------------------------------ */
/*  Files API — document parsing                                      */
/* ------------------------------------------------------------------ */

export interface UploadOptions {
  baseUrl: string
  apiKey: string
  file: Blob
  filename: string
  purpose: FilePurpose
  signal?: AbortSignal
  onProgress?: (ratio: number) => void
}

/**
 * Upload + parse a document. The response only arrives after parsing finishes,
 * which can be slow for big PDFs — so we use XHR to get upload progress and set
 * a generous timeout.
 */
export function uploadFile(opts: UploadOptions): Promise<UploadedFile> {
  const { baseUrl, apiKey, file, filename, purpose, signal, onProgress } = opts
  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false
    const fail = (err: DeepSeekApiError) => {
      if (settled) return
      settled = true
      reject(err)
    }

    xhr.open('POST', filesEndpoint(baseUrl), true)
    xhr.timeout = 5 * 60 * 1000
    const key = (apiKey || '').trim()
    xhr.setRequestHeader('x-api-key', key)
    xhr.setRequestHeader('Authorization', `Bearer ${key}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(1, e.loaded / e.total))
    }
    xhr.onerror = () =>
      fail(new DeepSeekApiError('文件上传失败，请检查网络', 0, 'network_error'))
    xhr.ontimeout = () =>
      fail(new DeepSeekApiError('解析超时，请换小一点的文件重试', 0, 'timeout'))
    xhr.onabort = () => fail(new DeepSeekApiError('已取消上传', 0, 'aborted'))

    xhr.onload = () => {
      if (settled) return
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) {
        settled = true
        onProgress?.(1)
        resolve(body as UploadedFile)
        return
      }
      const errBody = body as ApiErrorBody | null
      const msg = errBody?.error?.message || errBody?.message || ''
      if (xhr.status === 400 && /content exists risk/i.test(msg)) {
        fail(new DeepSeekApiError('文件内容未通过安全审核', 400, 'content_risk', msg))
        return
      }
      const mapped = HTTP_MESSAGES[xhr.status]
      fail(
        new DeepSeekApiError(
          `${mapped?.text || `文件解析失败（${xhr.status}）`}${msg ? `：${msg}` : ''}`,
          xhr.status,
          errBody?.error?.code || mapped?.code,
          msg,
        ),
      )
    }

    const form = new FormData()
    // NOTE: the server requires `purpose` to be sent *before* `file`.
    form.append('purpose', purpose)
    form.append('file', file, filename)

    if (signal) {
      if (signal.aborted) {
        fail(new DeepSeekApiError('已取消上传', 0, 'aborted'))
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    try {
      xhr.send(form)
    } catch {
      fail(new DeepSeekApiError('文件上传失败', 0, 'network_error'))
    }
  })
}

/* ------------------------------------------------------------------ */
/*  Speech to text                                                    */
/* ------------------------------------------------------------------ */

export interface TranscribeOptions {
  baseUrl: string
  apiKey: string
  /** Must be 16-bit PCM WAV or Ogg Opus (see `lib/audio.ts` for the encoder). */
  audio: Blob
  signal?: AbortSignal
}

/** Transcribe a short recording (≤120 s, ≤8 MiB). Returns the transcript. */
export async function transcribe(opts: TranscribeOptions): Promise<{ text: string; durationMs?: number }> {
  const { baseUrl, apiKey, audio, signal } = opts
  if (audio.size > 8 * 1024 * 1024) {
    throw new DeepSeekApiError('录音太大（超过 8MB），请说短一点', 413, 'too_large')
  }
  const form = new FormData()
  form.append('file', audio, 'speech.wav')

  let res: Response
  try {
    res = await fetch(asrEndpoint(baseUrl), {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: form,
      signal,
    })
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new DeepSeekApiError('语音识别连接失败，请检查网络', 0, 'network_error')
  }
  if (!res.ok) throw await errorFromResponse(res)
  const json = (await res.json()) as { text?: string; duration_ms?: number }
  return { text: json.text ?? '', durationMs: json.duration_ms }
}

/** Convenience: a hard-coded model list for the picker (the platform has 2). */
export const KNOWN_MODELS: DeepSeekModel[] = ['deepseek-flash', 'deepseek-v4-pro']
