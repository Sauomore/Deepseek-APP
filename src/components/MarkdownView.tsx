/**
 * MarkdownView — sanitised Markdown with KaTeX, code copying, external links and
 * lazily hydrated Mermaid diagrams.
 *
 * The HTML comes from `renderMarkdown` (already sanitised); this component only
 * wires behaviour on top: copy buttons, link interception and Mermaid rendering.
 */

import { memo, useEffect, useMemo, useRef } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { copyText, openExternal, safeDecode } from '@/lib/platform'
import { toast, useUiStore } from '@/store/ui'
import { tapFeedback } from '@/lib/haptics'

interface MarkdownViewProps {
  text: string
  /** Appends the blinking caret to the last block while tokens stream in. */
  caret?: boolean
  className?: string
  /** Renders `citationToken(n)` placeholders as citation badges. */
  citationHtml?: (index: number) => string
}

/* ------------------------------------------------------------------ */
/*  Mermaid hydration (serialised; Mermaid is not re-entrant)          */
/* ------------------------------------------------------------------ */

let mermaidSeq = 0
let mermaidQueue: Promise<void> = Promise.resolve()

type MermaidModule = typeof import('mermaid')

async function loadMermaid(theme: 'default' | 'dark'): Promise<MermaidModule['default']> {
  const mod = await import('mermaid')
  const mermaid = mod.default
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    flowchart: { htmlLabels: true, curve: 'basis', padding: 12 },
    themeVariables:
      theme === 'dark'
        ? {
            background: '#1d1f24',
            primaryColor: '#26314f',
            primaryTextColor: '#eceef2',
            primaryBorderColor: '#3b4a72',
            lineColor: '#878d99',
            secondaryColor: '#232a45',
            tertiaryColor: '#1d1f24',
          }
        : {
            background: '#f5f6f8',
            primaryColor: '#edf1ff',
            primaryTextColor: '#17181b',
            primaryBorderColor: '#c3cdff',
            lineColor: '#8b909c',
            secondaryColor: '#f0f3ff',
            tertiaryColor: '#ffffff',
          },
  })
  return mermaid
}

function hydrateMermaid(root: HTMLElement | null, theme: 'default' | 'dark'): void {
  if (!root) return
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block[data-src]'))
  const pending = nodes.filter(
    (node) => node.dataset.state !== 'done' || node.dataset.renderTheme !== theme,
  )
  if (pending.length === 0) return

  mermaidQueue = mermaidQueue
    .then(async () => {
      const mermaid = await loadMermaid(theme)
      for (const node of pending) {
        if (!node.isConnected) continue
        const source = safeDecode(node.dataset.src)
        if (!source.trim()) continue
        node.dataset.state = 'rendering'
        mermaidSeq += 1
        const id = `mmd-${mermaidSeq}`
        try {
          const { svg } = await mermaid.render(id, source)
          if (!node.isConnected) continue
          node.innerHTML = svg
          node.dataset.state = 'done'
          node.dataset.renderTheme = theme
        } catch (error) {
          node.dataset.state = 'error'
          node.innerHTML = `<div class="mermaid-error">图表语法有误，无法绘制：${
            error instanceof Error ? error.message : '未知错误'
          }</div>`
        }
      }
    })
    .catch(() => {
      /* never let a diagram failure break the message */
    })
}

/* ------------------------------------------------------------------ */

/**
 * memo 包裹是流式流畅的关键：
 * AgentMessage 每 100ms 重建一次 runs，若不 memo，一条 20 段的回复
 * 会每帧把 20 段全部重新解析 Markdown。memo 后只有 text 真正变化的那段重算。
 */
export const MarkdownView = memo(function MarkdownView({
  text,
  caret = false,
  className,
  citationHtml,
}: MarkdownViewProps) {
  const theme = useUiStore((state) => state.resolvedTheme)
  const mermaidTheme = theme === 'dark' ? 'dark' : 'default'
  const containerRef = useRef<HTMLDivElement>(null)

  const html = useMemo(() => {
    // 流式期间跳过 KaTeX 与语法高亮：两者都要对整段文本做二次解析，
    // 每 100ms 重跑一次是主要卡顿来源。流结束后（caret=false）再做完整渲染。
    let output = renderMarkdown(
      text,
      citationHtml || caret ? { ...(citationHtml ? { citationHtml } : {}), light: caret } : undefined,
    )
    if (caret) {
      // Place the caret inside the final block so it hugs the last character.
      const withCaret = output.replace(
        /(<\/(?:p|li|h[1-6]|td|th|pre|div|blockquote|strong|em)>)\s*$/,
        '<span class="stream-caret"></span>$1',
      )
      output = withCaret === output ? `${output}<span class="stream-caret"></span>` : withCaret
    }
    return output
  }, [text, caret, citationHtml])

  // 流式期间（caret=true）跳过图表水合。
  // 否则每 100ms 一次的 html 变更都会触发一次 DOM 扫描 + mermaid 渲染，
  // 而未闭合的代码块本就画不出图，白烧一次布局。
  useEffect(() => {
    if (caret) return
    hydrateMermaid(containerRef.current, mermaidTheme)
  }, [html, mermaidTheme, caret])

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement

    const mermaidSave = target.closest<HTMLElement>('[data-mermaid-save]')
    if (mermaidSave) {
      event.preventDefault()
      const wrap = mermaidSave.closest('.mermaid-wrap')
      const block = wrap?.querySelector<HTMLElement>('.mermaid-block')
      const svg = block?.querySelector<SVGSVGElement>('svg')
      if (!svg) {
        toast('图表还在绘制，请稍候再保存', 'error')
        return
      }
      mermaidSave.dataset.busy = '1'
      void (async () => {
        try {
          const { exportMermaidImage } = await import('@/lib/save-image')
          const background = (block && getComputedStyle(block).backgroundColor) || '#ffffff'
          const format = await exportMermaidImage(svg, { background })
          toast(format === 'svg' ? '已保存为 SVG 矢量图' : '图表已保存', 'success')
        } catch (error) {
          toast(error instanceof Error ? error.message : '保存失败', 'error')
        } finally {
          delete mermaidSave.dataset.busy
        }
      })()
      return
    }

    const citeButton = target.closest<HTMLElement>('.cite-badge')
    if (citeButton) {
      event.preventDefault()
      const url = citeButton.dataset.citeUrl
      if (url) openExternal(url)
      return
    }

    const copyButton = target.closest<HTMLButtonElement>('.code-copy')
    if (copyButton) {
      event.preventDefault()
      const code = copyButton.closest('.code-block')?.querySelector('code')?.textContent ?? ''
      void copyText(code).then((ok) => {
        if (!ok) {
          toast('复制失败', 'error')
          return
        }
        tapFeedback()
        copyButton.classList.add('is-copied')
        const label = copyButton.querySelector('span')
        if (label) label.textContent = '已复制'
        window.setTimeout(() => {
          copyButton.classList.remove('is-copied')
          if (label) label.textContent = '复制'
        }, 1600)
      })
      return
    }

    const anchor = target.closest<HTMLAnchorElement>('a[href]')
    if (anchor) {
      event.preventDefault()
      const href = anchor.getAttribute('href') ?? ''
      if (href.startsWith('#')) {
        containerRef.current?.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
        return
      }
      openExternal(anchor.href || href)
    }
  }

  if (!text) return null

  return (
    <div
      ref={containerRef}
      className={className ? `md ${className}` : 'md'}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
},
// 只比 text / caret / className / 主题。
// citationHtml 每次渲染都是新函数（闭包捕获了新的 sources），若参与比较
// 则 memo 永远失效；但引用角标的变化本身会通过 text 之外的渠道体现，
// 且流式期间不产生新引用，忽略它在观感上没有可感知差异。
(prev, next) =>
  prev.text === next.text &&
  prev.caret === next.caret &&
  prev.className === next.className,
)
