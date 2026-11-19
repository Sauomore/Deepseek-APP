/**
 * Live API probe — verifies the app's wire assumptions against the real service.
 *
 * Reads the key from `secrets/deepseek-api-key.txt` (git-ignored). Never prints
 * the key. Each mode issues ONE minimal request so the billing cost is trivial.
 *
 *   node scripts/probe-api.mjs chat
 *   node scripts/probe-api.mjs search
 *   node scripts/probe-api.mjs vision
 *   node scripts/probe-api.mjs title
 *   node scripts/probe-api.mjs files <path>
 *   node scripts/probe-api.mjs asr <path.wav>
 */

import fs from 'node:fs'
import path from 'node:path'

const KEY_FILE = 'secrets/deepseek-api-key.txt'
const BASE = 'https://api.deepseek.com'
const MESSAGES = `${BASE}/anthropic/v1/messages`

const key = fs.readFileSync(KEY_FILE, 'utf8').trim()
if (!key.startsWith('sk-')) throw new Error('API key missing or malformed')

const authHeaders = (extra = {}) => ({
  'x-api-key': key,
  Authorization: `Bearer ${key}`,
  ...extra,
})

/* ------------------------------------------------------------------ */
/*  SSE reader                                                        */
/* ------------------------------------------------------------------ */

async function streamMessages(body, onEvent) {
  const res = await fetch(MESSAGES, {
    method: 'POST',
    headers: authHeaders({
      'content-type': 'application/json',
      accept: 'text/event-stream',
      'anthropic-version': '2023-06-01',
      // Required as soon as the request references a Files API document/image.
      'anthropic-beta': 'files-api-2025-04-14',
    }),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 600)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const events = []

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    buffer = buffer.replace(/\r\n/g, '\n')
    let idx = buffer.indexOf('\n\n')
    while (idx !== -1) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('')
      if (data && data !== '[DONE]') {
        try {
          const event = JSON.parse(data)
          events.push(event)
          onEvent(event)
        } catch {
          /* ignore malformed frame */
        }
      }
      idx = buffer.indexOf('\n\n')
    }
  }
  return events
}

const blocks = new Map()
function applyEvent(event) {
  if (event.type === 'content_block_start') blocks.set(event.index, event.content_block)
  if (event.type === 'content_block_delta') {
    const block = blocks.get(event.index)
    if (!block) return
    if (event.delta.type === 'text_delta') block.text = (block.text ?? '') + event.delta.text
    if (event.delta.type === 'thinking_delta') block.thinking = (block.thinking ?? '') + event.delta.thinking
    if (event.delta.type === 'signature_delta') block.signature = event.delta.signature
    if (event.delta.type === 'citations_delta') {
      block.citations = block.citations ?? []
      block.citations.push(event.delta.citation)
    }
  }
}

function summarise(title, events) {
  const seenCounts = {}
  for (const event of events) seenCounts[event.type] = (seenCounts[event.type] ?? 0) + 1
  const final = [...blocks.values()]
  const usage = [...events].reverse().find((e) => e.type === 'message_delta')?.usage
  const messageDelta = [...events].reverse().find((e) => e.type === 'message_delta')

  console.log(`\n=== ${title} ===`)
  console.log('event types:', JSON.stringify(seenCounts))
  console.log('stop_reason:', messageDelta?.delta?.stop_reason)
  console.log('title:', messageDelta?.delta?.title ?? '(none)')
  console.log('usage:', JSON.stringify(usage))
  console.log('blocks:')
  for (const [index, block] of [...blocks.entries()].sort((a, b) => a[0] - b[0])) {
    if (block.type === 'thinking') {
      console.log(`  [${index}] thinking (${(block.thinking ?? '').length} chars, sig=${Boolean(block.signature)})`)
    } else if (block.type === 'text') {
      console.log(
        `  [${index}] text (${(block.text ?? '').length} chars, citations=${(block.citations ?? []).length})`,
      )
    } else if (block.type === 'server_tool_use') {
      console.log(`  [${index}] server_tool_use name=${block.name} kind=${block.kind} input=${JSON.stringify(block.input)}`)
    } else if (block.type === 'web_search_tool_result') {
      const items = Array.isArray(block.content) ? block.content : []
      console.log(
        `  [${index}] web_search_tool_result items=${items.length} first=${JSON.stringify(items[0]?.url ?? items[0]?.type ?? null).slice(0, 90)}`,
      )
    } else {
      console.log(`  [${index}] ${block.type}`)
    }
  }
  const text = final
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  console.log('answer head:', JSON.stringify(text.slice(0, 220)))
  const cites = final.flatMap((b) => b.citations ?? [])
  if (cites.length) {
    console.log('citations:', cites.map((c) => `${c.type} ${c.url?.slice(0, 60)}`).join(' | '))
  }
  return { events, blocks: final, text }
}

/* ------------------------------------------------------------------ */
/*  Test image (vision) — geometric shapes, no font dependency        */
/* ------------------------------------------------------------------ */

async function makeTestImage() {
  const sharp = (await import('sharp')).default
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320">
    <rect width="480" height="320" fill="#ffffff"/>
    <circle cx="120" cy="160" r="78" fill="#e0245e"/>
    <rect x="270" y="82" width="150" height="150" fill="#1d6fe0" rx="12"/>
    <path d="M150 300 L240 300 L195 262 Z" fill="#1f9d55"/>
  </svg>`
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return png.toString('base64')
}

/* ------------------------------------------------------------------ */
/*  Modes                                                             */
/* ------------------------------------------------------------------ */

const mode = process.argv[2] ?? 'chat'

if (mode === 'chat') {
  const events = await streamMessages(
    {
      model: 'deepseek-flash',
      max_tokens: 512,
      stream: true,
      thinking: { type: 'enabled' },
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: '用一句话解释什么是 SSE，不要用列表。' }],
    },
    applyEvent,
  )
  summarise('chat (thinking enabled, no tools)', events)
}

if (mode === 'search') {
  const events = await streamMessages(
    {
      model: 'deepseek-flash',
      max_tokens: 768,
      stream: true,
      thinking: { type: 'enabled' },
      output_config: { effort: 'low' },
      tools: [
        { type: 'deepseek_web_search', name: 'deepseek_web_search' },
        { type: 'deepseek_read_url', name: 'deepseek_read_url' },
      ],
      tool_choice: { type: 'auto' },
      title: { enabled: true },
      messages: [{ role: 'user', content: 'DeepSeek V4.1 的上下文长度是多少？一句话回答并给出出处。' }],
    },
    applyEvent,
  )
  summarise('search + tools + title', events)
}

if (mode === 'vision') {
  const base64 = await makeTestImage()
  fs.mkdirSync('artifacts', { recursive: true })
  fs.writeFileSync(
    'artifacts/probe-vision-input.png',
    Buffer.from(base64, 'base64'),
  )
  const events = await streamMessages(
    {
      model: 'deepseek-flash',
      max_tokens: 300,
      stream: true,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: base64 },
            },
            { type: 'text', text: '这张图里有哪些几何形状？分别是什么颜色？请简短回答。' },
          ],
        },
      ],
    },
    applyEvent,
  )
  summarise('vision (base64 png)', events)
}

if (mode === 'title') {
  const events = await streamMessages(
    {
      model: 'deepseek-flash',
      max_tokens: 120,
      stream: true,
      thinking: { type: 'disabled' },
      title: { enabled: true },
      messages: [{ role: 'user', content: '帮我把这句话翻译成英文：今天的会议推迟到下午三点。' }],
    },
    applyEvent,
  )
  summarise('title only', events)
}

if (mode === 'files') {
  const filePath = process.argv[3]
  const purpose = process.argv[4] ?? 'text_recognition'
  if (!filePath) throw new Error('usage: files <path> [purpose]')
  const data = fs.readFileSync(filePath)
  const form = new FormData()
  form.append('purpose', purpose)
  form.append('file', new Blob([data]), path.basename(filePath))

  console.log('uploading', filePath, `${data.length} bytes purpose=${purpose} ...`)
  const res = await fetch(`${BASE}/files`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`upload HTTP ${res.status}: ${text.slice(0, 400)}`)
  const uploaded = JSON.parse(text)
  console.log('uploaded file_id:', uploaded.id, 'bytes:', uploaded.bytes, 'purpose:', uploaded.purpose)

  const events = await streamMessages(
    {
      model: 'deepseek-flash',
      max_tokens: 400,
      stream: true,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'file', file_id: uploaded.id } },
            { type: 'text', text: '这份文档里的项目代号、负责人和预算分别是什么？简短列出。' },
          ],
        },
      ],
    },
    applyEvent,
  )
  summarise('files api + document reference', events)
}

if (mode === 'multi') {
  // Turn 1: a search turn, exactly like the app sends on the first message.
  blocks.clear()
  const turnOne = await streamMessages(
    {
      model: 'deepseek-flash',
      max_tokens: 600,
      stream: true,
      thinking: { type: 'enabled' },
      output_config: { effort: 'low' },
      tools: [
        { type: 'deepseek_web_search', name: 'deepseek_web_search' },
        { type: 'deepseek_read_url', name: 'deepseek_read_url' },
      ],
      tool_choice: { type: 'auto' },
      title: { enabled: true },
      messages: [{ role: 'user', content: 'DeepSeek V4.1 的上下文长度和最大输出分别是多少？' }],
    },
    applyEvent,
  )
  summarise('multi — turn 1', turnOne)

  // Replay the assistant content exactly as `sanitizeBlocksForHistory` would.
  const assistantContent = [...blocks.values()]
  const turnTwoMessages = [
    { role: 'user', content: 'DeepSeek V4.1 的上下文长度和最大输出分别是多少？' },
    { role: 'assistant', content: assistantContent },
    { role: 'user', content: '基于上面的回答，只回答一个问题：我一次最多能输出多少 token？' },
  ]

  blocks.clear()
  const turnTwo = await streamMessages(
    {
      model: 'deepseek-flash',
      max_tokens: 300,
      stream: true,
      thinking: { type: 'enabled' },
      output_config: { effort: 'low' },
      tools: [
        { type: 'deepseek_web_search', name: 'deepseek_web_search' },
        { type: 'deepseek_read_url', name: 'deepseek_read_url' },
      ],
      tool_choice: { type: 'auto' },
      messages: turnTwoMessages,
    },
    applyEvent,
  )
  summarise('multi — turn 2 (history replayed)', turnTwo)
  console.log('\n>>> HISTORY REPLAY OK (no 400) — multi-turn with thinking + tool blocks is valid')
}

if (mode === 'asr') {
  const wavPath = process.argv[3]
  if (!wavPath) throw new Error('usage: asr <path.wav>')
  const data = fs.readFileSync(wavPath)
  const form = new FormData()
  form.append('file', new Blob([data], { type: 'audio/wav' }), path.basename(wavPath))

  console.log('uploading audio', wavPath, `${data.length} bytes ...`)
  const res = await fetch(`${BASE}/v1/tools/asr`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  const text = await res.text()
  console.log('HTTP', res.status)
  console.log('body:', text.slice(0, 600))
}

console.log('\n(probe done)')
