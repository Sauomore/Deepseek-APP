/**
 * Mock stream engine — replays the exact SSE event sequence of the real
 * Messages API so the UI can be developed and demoed without an API key.
 *
 * Event order mirrored from the official docs:
 *   message_start
 *   content_block_start(thinking) → thinking_delta… → signature_delta → stop
 *   content_block_start(server_tool_use) → stop
 *   content_block_start(web_search_tool_result) → stop
 *   content_block_start(text) → text_delta… → citations_delta… → stop
 *   message_delta (stop_reason, title, usage)
 *   message_stop
 */

import type {
  Citation,
  FilePurpose,
  MessagesRequest,
  StreamEvent,
  UploadedFile,
  Usage,
  WebSearchResult,
} from '@/types/api'
import { pickScenario, type MockScenario, type ScenarioInput } from './scenarios'

export interface MockRunOptions {
  request: MessagesRequest
  input: ScenarioInput
  signal: AbortSignal
  onEvent: (event: StreamEvent) => void
  /** 1 = normal speed, 2 = twice as fast. */
  speed?: number
}

class AbortedError extends Error {
  name = 'AbortError'
  constructor() {
    super('Aborted')
  }
}

function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new AbortedError()
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError())
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new AbortedError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

/** Split `text` on `[[n]]` markers into text/citation segments. */
function splitCitations(text: string): Array<{ text: string; cites: number[] }> {
  const out: Array<{ text: string; cites: number[] }> = []
  const re = /\[\[(\d+)\]\]/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    out.push({ text: text.slice(last, match.index), cites: [Number(match[1])] })
    last = match.index + match[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), cites: [] })
  return out.filter((s) => s.text.length > 0 || s.cites.length > 0)
}

function toSearchResults(scenario: MockScenario): WebSearchResult[] {
  if (!scenario.search) return []
  return scenario.search.sources.map((s) => ({
    type: 'web_search_result' as const,
    title: s.title,
    url: s.url,
    encrypted_content: 'mock-encrypted-content',
    page_age: s.pageAge ?? null,
    snippet: s.snippet,
    site_name: s.siteName,
    site_icon: s.siteIcon ?? null,
  }))
}

/** Roughly imitate the token accounting the server reports. */
function estimateUsage(scenario: MockScenario, request: MessagesRequest): Usage {
  const answerLen = scenario.answer.length
  const thinkLen = (scenario.thinking?.length ?? 0) + (scenario.postSearchThinking?.length ?? 0)
  const inputLen = (request.messages.at(-1)?.content ?? '').toString().length
  const searches = scenario.search ? 1 : 0
  return {
    input_tokens: Math.round(320 + inputLen / 1.6 + searches * 1450),
    output_tokens: Math.round((answerLen + thinkLen) / 1.5),
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: request.messages.length > 2 ? 1024 : 0,
    service_tier: 'standard',
    server_tool_use: scenario.search
      ? { web_search_requests: 1, web_fetch_requests: scenario.readUrl ? 1 : 0, tool_search: scenario.search.queries.length, tool_fetch: scenario.readUrl ? 1 : 0, tool_image_search: 0 }
      : undefined,
  }
}

export async function runMockStream(opts: MockRunOptions): Promise<void> {
  const { request, input, signal, onEvent } = opts
  const speed = opts.speed ?? 1
  const scenario = pickScenario(input)

  const emit = (event: StreamEvent) => {
    checkAbort(signal)
    onEvent(event)
  }

  /** Stream a plain string as many small deltas of one content block. */
  const streamChars = async (text: string, onPiece: (piece: string) => void) => {
    const chars = Array.from(text)
    let i = 0
    while (i < chars.length) {
      checkAbort(signal)
      const size = Math.round(rand(3, 9))
      onPiece(chars.slice(i, i + size).join(''))
      i += size
      await sleep(rand(5, 12) / speed, signal)
    }
  }

  // A brief "thinking about it" pause feels far more natural than instant output.
  await sleep(rand(260, 520) / speed, signal)

  emit({
    type: 'message_start',
    message: {
      id: `msg_mock_${Date.now().toString(36)}`,
      type: 'message',
      role: 'assistant',
      model: request.model,
      content: [],
      stop_reason: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  })

  let index = 0

  /* ---------------- thinking (pre-tool) ---------------- */
  if (scenario.thinking) {
    emit({
      type: 'content_block_start',
      index,
      content_block: { type: 'thinking', thinking: '' },
    })
    await streamChars(scenario.thinking, (piece) =>
      emit({
        type: 'content_block_delta',
        index,
        delta: { type: 'thinking_delta', thinking: piece },
      }),
    )
    emit({
      type: 'content_block_delta',
      index,
      delta: {
        type: 'signature_delta',
        signature: `mock-sig-${index}-${Math.random().toString(36).slice(2, 10)}`,
      },
    })
    emit({ type: 'content_block_stop', index })
    index += 1
  }

  /* ---------------- web search tool call ---------------- */
  if (scenario.search) {
    const callId = `srvtoolu_s_00_mock${index}`
    emit({
      type: 'content_block_start',
      index,
      content_block: {
        type: 'server_tool_use',
        id: callId,
        name: 'deepseek_web_search',
        input: { action: 'search', queries: scenario.search.queries },
        caller: { type: 'direct' },
        kind: scenario.search.kind,
      },
    })
    emit({ type: 'content_block_stop', index })
    index += 1

    // The service takes a moment to actually search.
    await sleep(rand(420, 780) / speed, signal)

    emit({
      type: 'content_block_start',
      index,
      content_block: {
        type: 'web_search_tool_result',
        tool_use_id: callId,
        content: toSearchResults(scenario),
        kind: scenario.search.kind,
      },
    })
    emit({ type: 'content_block_stop', index })
    index += 1
  }

  /* ---------------- url reading tool call ---------------- */
  if (scenario.readUrl) {
    const callId = `srvtoolu_rl_01_mock${index}`
    emit({
      type: 'content_block_start',
      index,
      content_block: {
        type: 'server_tool_use',
        id: callId,
        name: 'deepseek_read_url',
        input: { action: 'read_link', url: scenario.readUrl.url },
        caller: { type: 'direct' },
        kind: 'read_link',
      },
    })
    emit({ type: 'content_block_stop', index })
    index += 1
    await sleep(rand(300, 560) / speed, signal)
    emit({
      type: 'content_block_start',
      index,
      content_block: {
        type: 'web_fetch_tool_result',
        tool_use_id: callId,
        content: {
          type: 'web_fetch_result',
          url: scenario.readUrl.url,
          content: {
            type: 'document',
            source: { type: 'text', media_type: 'text/plain', data: '' },
            title: scenario.readUrl.title,
          },
          published_at: null,
        },
        kind: 'read_link',
        signature: `mock-page-signature-${index}`,
      },
    })
    emit({ type: 'content_block_stop', index })
    index += 1
  }

  /* ---------------- thinking (post-tool) ---------------- */
  if (scenario.postSearchThinking) {
    emit({
      type: 'content_block_start',
      index,
      content_block: { type: 'thinking', thinking: '' },
    })
    await streamChars(scenario.postSearchThinking, (piece) =>
      emit({
        type: 'content_block_delta',
        index,
        delta: { type: 'thinking_delta', thinking: piece },
      }),
    )
    emit({
      type: 'content_block_delta',
      index,
      delta: {
        type: 'signature_delta',
        signature: `mock-sig-${index}-${Math.random().toString(36).slice(2, 10)}`,
      },
    })
    emit({ type: 'content_block_stop', index })
    index += 1
  }

  /* ---------------- answer text (with citations) ---------------- */
  const sources = scenario.search?.sources ?? []
  const segments = splitCitations(scenario.answer)

  for (const segment of segments) {
    emit({
      type: 'content_block_start',
      index,
      content_block: { type: 'text', text: '' },
    })
    await streamChars(segment.text, (piece) =>
      emit({
        type: 'content_block_delta',
        index,
        delta: { type: 'text_delta', text: piece },
      }),
    )
    for (const n of segment.cites) {
      const src = sources[n - 1]
      if (!src) continue
      const citation: Citation = {
        type: 'web_search_result_location',
        url: src.url,
        title: src.title,
        encrypted_index: '',
        cited_text: segment.text.trim().slice(-120),
      }
      emit({
        type: 'content_block_delta',
        index,
        delta: { type: 'citations_delta', citation },
      })
      await sleep(rand(60, 130) / speed, signal)
    }
    emit({ type: 'content_block_stop', index })
    index += 1
  }

  /* ---------------- finish ---------------- */
  const usage = estimateUsage(scenario, request)
  emit({
    type: 'message_delta',
    delta: {
      stop_reason: 'end_turn',
      stop_sequence: null,
      ...(request.title?.enabled ? { title: scenario.title } : {}),
    },
    usage,
  })
  emit({ type: 'message_stop' })
}

/* ------------------------------------------------------------------ */
/*  Mock auxiliary endpoints (Files API / ASR / title)                */
/* ------------------------------------------------------------------ */

export interface MockUploadOptions {
  file: Blob
  filename: string
  purpose: FilePurpose
  signal?: AbortSignal
  onProgress?: (ratio: number) => void
}

/** Simulates upload + server-side parsing (which is slow for real documents). */
export async function mockUploadFile(opts: MockUploadOptions): Promise<UploadedFile> {
  const { file, filename, purpose, onProgress } = opts
  const controller = new AbortController()
  const signal = opts.signal ?? controller.signal

  const totalMs = Math.min(2600, 900 + file.size / 60_000)
  const steps = 18
  for (let i = 1; i <= steps; i += 1) {
    await sleep(totalMs / steps, signal)
    // Upload finishes at ~55% of the bar, then "parsing" continues.
    onProgress?.(Math.min(1, (i / steps) * (i / steps < 0.55 ? 1 : 1)))
  }
  onProgress?.(1)
  return {
    id: `file-api-mock-${Math.random().toString(36).slice(2, 14)}`,
    object: 'file',
    bytes: file.size,
    created_at: Math.floor(Date.now() / 1000),
    filename,
    purpose,
  }
}

const MOCK_TRANSCRIPTS = [
  '帮我看看这段代码为什么会有内存泄漏',
  '用通俗的话解释一下什么是向量数据库',
  '把刚才那段内容整理成一张表格',
  '今天北京天气怎么样，需要带伞吗',
  '帮我写一封给客户的道歉邮件，语气要真诚一点',
  '这个方案的风险点主要有哪些',
]

/** Simulates a speech-to-text round trip. */
export async function mockTranscribe(durationMs = 2400): Promise<{ text: string; duration_ms: number }> {
  const text = MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)]
  return { text, duration_ms: durationMs }
}

/** Simulates the built-in conversation-title feature. */
export function mockTitleFor(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (!clean) return '新的对话'
  return clean.length > 18 ? `${clean.slice(0, 18)}…` : clean
}
