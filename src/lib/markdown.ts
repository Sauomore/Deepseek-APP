/**
 * Markdown → HTML pipeline for assistant answers.
 *
 * Order of operations matters:
 *   1. pull math out into opaque placeholders (so Markdown can't mangle it)
 *   2. render Markdown (raw HTML disabled — model output is untrusted)
 *   3. sanitise the HTML
 *   4. splice the KaTeX-rendered math back in (trusted, generated with trust:false)
 *
 * Mermaid fences become `<div class="mermaid-block" data-src="...">` placeholders
 * that a React component hydrates lazily, so the ~1 MB Mermaid bundle is only
 * loaded when a reply actually contains a diagram.
 */

import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'
import katex from 'katex'
import DOMPurify from 'dompurify'

const MATH_OPEN = '\uE000'
const MATH_CLOSE = '\uE001'
const mathPattern = new RegExp(`${MATH_OPEN}(\\d+)${MATH_CLOSE}`, 'g')

/**
 * Citation placeholder token. The Messages protocol splits an answer into one
 * `text` block per citation, so the renderer merges consecutive blocks back into
 * a single Markdown string and drops these tokens where a badge belongs.
 */
const CITE_TOKEN = /\uE100(\d+)\uE101/g
export const citationToken = (index: number): string => `\uE100${index}\uE101`

let mathStore: string[] = []

function renderKatex(expression: string, displayMode: boolean): string | null {
  try {
    const html = katex.renderToString(expression.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      output: 'htmlAndMathml',
    })
    mathStore.push(html)
    return `${MATH_OPEN}${mathStore.length - 1}${MATH_CLOSE}`
  } catch {
    return null
  }
}

const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/
/** Plain money: `5`, `1,000`, `20 million`, `12.5bn`. */
const CURRENCY = /^[\d.,\s]*(million|billion|trillion|bn|b|k|m)?$/i

/**
 * Distinguish `$x^2$` from `$5` / `$20 million` in Chinese prose.
 * Deliberately conservative: a false negative just shows the raw text, while a
 * false positive turns a price into italic math.
 */
function looksLikeMath(expr: string): boolean {
  const trimmed = expr.trim()
  if (!trimmed) return false
  if (CJK.test(trimmed)) return false
  if (CURRENCY.test(trimmed)) return false
  return /[A-Za-z\\^_=<>+\-*/()[\]{}|]/.test(trimmed)
}

/** Extract math expressions into placeholders. */
function extractMath(input: string): string {
  let out = input

  // Display math: $$...$$ and \[...\]
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (whole, expr: string) => {
    // A short "$$" pair inside a word is almost never math.
    if (!expr.trim()) return whole
    return renderKatex(expr, true) ?? whole
  })
  out = out.replace(/\\\[([\s\S]+?)\\\]/g, (whole, expr: string) => renderKatex(expr, true) ?? whole)

  // Inline math: \(...\)
  out = out.replace(/\\\(([\s\S]+?)\\\)/g, (whole, expr: string) => renderKatex(expr, false) ?? whole)

  // Inline math: $...$ — skip currency and prose.
  out = out.replace(/(?<!\\)\$(?!\$)([^$\n]{1,400}?)(?<!\\)\$/g, (whole, expr: string) => {
    if (!looksLikeMath(expr)) return whole
    return renderKatex(expr, false) ?? whole
  })

  return out
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const md = new MarkdownIt({
  html: false, // model output must not inject HTML
  linkify: true,
  breaks: true, // chat-style: a single newline is a line break
  typographer: false,
})

/* ---------------- custom fence: code blocks + mermaid ---------------- */

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
  const language = info.split(/\s+/g)[0] || ''
  const code = token.content

  if (language === 'mermaid') {
    // The save button lives *outside* `.mermaid-block` because hydration swaps
    // that node's innerHTML with the rendered SVG.
    return (
      `<div class="mermaid-wrap">` +
      `<div class="mermaid-block" data-src="${encodeURIComponent(code)}">` +
      `<div class="mermaid-loading"><span class="spinner"></span>正在绘制图表…</div>` +
      `</div>` +
      `<button type="button" class="mermaid-save" data-mermaid-save aria-label="保存图片">` +
      `<svg class="svg-icon svg-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11.5"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 16.5V19a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5"/></svg>` +
      `<span>保存</span>` +
      `</button>` +
      `</div>\n`
    )
  }

  let highlighted: string
  let displayLanguage = language
  if (lightMode) {
    // 流式期间不跑 hljs：未闭合的代码块语法树不完整，高亮结果也会被下一帧推翻
    highlighted = escapeHtml(code)
    if (!displayLanguage) displayLanguage = 'text'
  } else if (language && hljs.getLanguage(language)) {
    try {
      highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value
    } catch {
      highlighted = escapeHtml(code)
    }
  } else {
    highlighted = escapeHtml(code)
    if (!displayLanguage) displayLanguage = 'text'
  }

  return (
    `<div class="code-block">` +
    `<div class="code-head">` +
    `<span class="code-lang">${escapeHtml(displayLanguage)}</span>` +
    `<button type="button" class="code-copy" aria-label="复制代码">` +
    `<svg class="svg-icon svg-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
    `<span>复制</span></button>` +
    `</div>` +
    `<pre class="code-pre"><code class="hljs language-${escapeHtml(displayLanguage)}">${highlighted}</code></pre>` +
    `</div>\n`
  )
}

/* ---------------- tables scroll horizontally ---------------- */

md.renderer.rules.table_open = () => '<div class="table-wrap"><table>'
md.renderer.rules.table_close = () => '</table></div>'

/* ---------------- links: open outside the WebView ---------------- */

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet('rel', 'noopener noreferrer nofollow')
  token.attrSet('target', '_blank')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

/* ---------------- render + memoise ---------------- */

const cache = new Map<string, string>()
const CACHE_LIMIT = 80

export interface RenderOptions {
  /** Turn `citationToken(n)` into custom HTML (a citation badge). */
  citationHtml?: (index: number) => string
  /**
   * 流式期间的轻量模式：跳过公式提取与语法高亮。
   * 这两步都要对整段文本做二次正则扫描，是流式卡顿的主要来源；
   * 流结束后（caret=false）会用完整模式再渲染一次。
   */
  light?: boolean
}

/** 供 fence 规则读取当前是否处于轻量模式（同步渲染，无并发问题） */
let lightMode = false

export function renderMarkdown(source: string, options?: RenderOptions): string {
  if (!source) return ''
  const hasCitations = !!options?.citationHtml
  const cacheKey = hasCitations ? null : source
  if (cacheKey !== null) {
    const cached = cache.get(cacheKey)
    if (cached !== undefined) return cached
  }

  const light = !!options?.light
  const prevLight = lightMode
  lightMode = light
  try {
    mathStore = []
    // 轻量模式跳过公式抽取：未闭合的 $$...$$ 在这一帧抽出来，下一帧就被推翻
    const withMath = light ? source : extractMath(source)

    let html = md.render(withMath)

    // Defence in depth: strip anything script-ish that survived.
    html = DOMPurify.sanitize(html, {
      ADD_ATTR: ['data-src', 'data-cite-url', 'data-mermaid-save', 'target', 'rel'],
      FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'object', 'embed'],
      FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
    })

    // Restore trusted KaTeX output after sanitisation.
    if (!light) {
      html = html.replace(mathPattern, (_whole, index: string) => mathStore[Number(index)] ?? '')
    }

    if (options?.citationHtml) {
      const citationHtml = options.citationHtml
      html = html.replace(CITE_TOKEN, (_whole, index: string) => citationHtml(Number(index)))
    }

    if (cacheKey !== null) {
      if (cache.size >= CACHE_LIMIT) {
        const firstKey = cache.keys().next().value
        if (firstKey !== undefined) cache.delete(firstKey)
      }
      cache.set(cacheKey, html)
    }
    return html
  } finally {
    lightMode = prevLight
  }
}

/** Plain-text preview used by the conversation drawer. */
export function toPlainPreview(source: string, maxLength = 80): string {
  const text = source
    .replace(/```[\s\S]*?```/g, ' [代码] ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' [公式] ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^[#>\-*+\s]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

/** Count fenced code blocks / mermaid diagrams (used for render hints). */
export function containsMermaid(source: string): boolean {
  return /```mermaid\b/.test(source)
}
