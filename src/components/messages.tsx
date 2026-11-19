/**
 * Message renderers.
 *
 * `UserMessage`  — right-aligned bubble with attachment previews.
 * `AssistantMessage` — avatar + content "runs":
 *    thinking panel → web-search card(s) → grouped page-read card → Markdown answer
 *
 * Why runs: the Messages protocol splits an answer into one `text` block per
 * citation, so rendering blocks independently would break paragraphs (a lone
 * "。" on its own line). Consecutive text blocks are therefore merged back into a
 * single Markdown string with opaque citation tokens, which the renderer swaps
 * for real badges at the exact spot they belong. Page-opening calls are grouped
 * for the same reason: one deep-search turn can open four pages in parallel.
 */

import { useMemo } from 'react'
import { MarkdownView } from '@/components/MarkdownView'
import {
  Notice,
  PagesCard,
  SearchCard,
  ThinkingPanel,
  type PageRead,
} from '@/components/content-blocks'
import { CopyIcon, FileIcon, RefreshIcon, SparkIcon } from '@/components/icons'
import { estimateCost, formatDurationMs, formatTokens } from '@/lib/format'
import { citationToken } from '@/lib/markdown'
import { copyText, hostnameOf } from '@/lib/platform'
import { toast, useUiStore } from '@/store/ui'
import { useSettingsStore } from '@/store/settings'
import type {
  AssistantBlock,
  ServerToolUseBlock,
  WebSearchResult,
  WebSearchToolResultBlock,
} from '@/types/api'
import type { ChatMessage } from '@/types/chat'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isSearchResult(item: WebSearchResult | { type: string }): item is WebSearchResult {
  return (item as WebSearchResult).url !== undefined
}

type SourceRef = { url: string; title?: string | null }

type Run =
  | { kind: 'thinking'; text: string }
  | { kind: 'search'; tool: ServerToolUseBlock; result?: WebSearchToolResultBlock }
  | { kind: 'pages'; pages: PageRead[] }
  | { kind: 'text'; markdown: string }

/** `open_page` / `find_in_page` / `read_link` all mean "a page is being read". */
function isPageAction(block: ServerToolUseBlock): boolean {
  const action = block.input.action
  return action === 'open_page' || action === 'find_in_page' || action === 'read_link'
}

/* ------------------------------------------------------------------ */
/*  User message                                                      */
/* ------------------------------------------------------------------ */

export function UserMessage({ message }: { message: ChatMessage }) {
  const openImageViewer = useUiStore((state) => state.openImageViewer)
  const attachments = message.attachments ?? []

  return (
    <div className="msg-user">
      {attachments.length > 0 ? (
        <div className="user-attachments">
          {attachments.map((attachment) =>
            attachment.kind === 'image' ? (
              <button
                type="button"
                key={attachment.id}
                className="user-attachment-image"
                onClick={() =>
                  attachment.previewUrl && openImageViewer(attachment.previewUrl, attachment.name)
                }
                aria-label={attachment.name}
              >
                {attachment.previewUrl ? (
                  <img src={attachment.previewUrl} alt={attachment.name} loading="lazy" />
                ) : (
                  <span className="user-attachment-fallback">
                    <FileIcon />
                  </span>
                )}
              </button>
            ) : (
              <div className="user-attachment-file" key={attachment.id}>
                <span className="user-attachment-fileicon">
                  <FileIcon />
                </span>
                <span className="user-attachment-meta">
                  <span className="user-attachment-name">{attachment.name}</span>
                  <span className="user-attachment-sub">
                    {attachment.uploadState === 'ready'
                      ? '已解析'
                      : attachment.uploadState === 'error'
                        ? '解析失败'
                        : '解析中…'}
                  </span>
                </span>
              </div>
            ),
          )}
        </div>
      ) : null}

      {message.text ? <div className="bubble-user">{message.text}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Assistant message                                                 */
/* ------------------------------------------------------------------ */

interface AssistantMessageProps {
  message: ChatMessage
  onRegenerate: () => void
}

export function AssistantMessage({ message, onRegenerate }: AssistantMessageProps) {
  const showUsage = useSettingsStore((state) => state.settings.showUsage)
  const blocks = message.blocks ?? []
  const streaming = message.status === 'streaming' || message.status === 'pending'

  /* ------------- fold the block list into ordered runs ------------- */
  const { runs, citationHtml, indexOf, citedUrls, answerText, allowThinking } = useMemo(() => {
    const out: Run[] = []
    const sources: SourceRef[] = []
    const citedUrls: string[] = []
    const sourceIndex = new Map<string, number>()
    /** Register a source and return its stable 1-based number. */
    const register = (url: string, title?: string | null): number => {
      const existing = sourceIndex.get(url)
      if (existing !== undefined) return existing
      sources.push({ url, title })
      sourceIndex.set(url, sources.length)
      return sources.length
    }

    let thinkingText = ''
    let answer = ''
    let i = 0

    while (i < blocks.length) {
      const block = blocks[i]

      if (block.type === 'thinking') {
        thinkingText += (thinkingText ? '\n\n' : '') + block.thinking
        i += 1
        continue
      }

      if (block.type === 'server_tool_use') {
        // --- group consecutive page reads into one card ---
        if (isPageAction(block)) {
          const pages: PageRead[] = []
          while (i < blocks.length) {
            const candidate = blocks[i]
            if (candidate.type !== 'server_tool_use' || !isPageAction(candidate)) break
            const result = blocks.find(
              (item) =>
                item.type === 'web_fetch_tool_result' && item.tool_use_id === candidate.id,
            )
            pages.push({
              tool: candidate,
              result: result?.type === 'web_fetch_tool_result' ? result : undefined,
            })
            i += 1
          }
          out.push({ kind: 'pages', pages })
          continue
        }

        // --- a search call ---
        const result = blocks.find(
          (item) => item.type === 'web_search_tool_result' && item.tool_use_id === block.id,
        )
        if (result?.type === 'web_search_tool_result') {
          for (const item of result.content) {
            if (isSearchResult(item)) register(item.url, item.title)
          }
        }
        out.push({
          kind: 'search',
          tool: block,
          result: result?.type === 'web_search_tool_result' ? result : undefined,
        })
        i += 1
        continue
      }

      if (block.type === 'web_search_tool_result' || block.type === 'web_fetch_tool_result') {
        i += 1
        continue
      }

      if (block.type === 'text') {
        // Merge consecutive text blocks, turning citation splits into tokens.
        let markdown = ''
        // Track the last badge so a source cited across several adjacent splits
        // (the API emits one block per citation) renders as ONE badge.
        let lastCitationIndex = -1
        let textSinceLastCitation = ''
        while (i < blocks.length && blocks[i].type === 'text') {
          const textBlock = blocks[i] as Extract<AssistantBlock, { type: 'text' }>
          markdown += textBlock.text
          answer += textBlock.text
          textSinceLastCitation += textBlock.text
          for (const citation of textBlock.citations ?? []) {
            const number = register(citation.url, citation.title)
            if (!citedUrls.includes(citation.url)) citedUrls.push(citation.url)
            const sourceIdx = number - 1
            const adjacent = textSinceLastCitation.trim().length === 0
            if (adjacent && sourceIdx === lastCitationIndex) continue
            markdown += citationToken(sourceIdx)
            lastCitationIndex = sourceIdx
            textSinceLastCitation = ''
          }
          i += 1
        }
        out.push({ kind: 'text', markdown })
        continue
      }

      i += 1
    }

    if (thinkingText.trim()) out.unshift({ kind: 'thinking', text: thinkingText })

    const html = (index: number): string => {
      const source = sources[index]
      if (!source) return ''
      const label = sourceIndex.get(source.url) ?? index + 1
      const title = source.title || hostnameOf(source.url)
      return `<button type="button" class="cite-badge" data-cite-url="${escapeAttr(
        source.url,
      )}" title="${escapeAttr(title)}" aria-label="来源 ${label}：${escapeAttr(title)}">${label}</button>`
    }

    return {
      runs: out,
      citationHtml: html,
      indexOf: (url: string) => sourceIndex.get(url) ?? 0,
      citedUrls,
      answerText: answer,
      allowThinking: thinkingText.trim().length > 0,
    }
  }, [blocks])

  const lastTextRun = runs.reduce<number>((last, run, index) => (run.kind === 'text' ? index : last), -1)

  const usage = message.usage
  const cost = estimateCost(
    message.model ?? '',
    usage?.input_tokens,
    usage?.output_tokens,
    usage?.cache_read_input_tokens,
  )

  const handleCopy = () => {
    void copyText(answerText).then((ok) => toast(ok ? '已复制回答' : '复制失败', ok ? 'success' : 'error'))
  }

  const showPlaceholder = streaming && !answerText && !allowThinking

  return (
    <div className="msg-assistant">
      <div className="msg-assistant-body">
        {runs.map((run, index) => {
          if (run.kind === 'thinking') {
            return (
              <ThinkingPanel
                key="thinking"
                text={run.text}
                streaming={streaming}
                hasAnswer={answerText.length > 0}
              />
            )
          }

          if (run.kind === 'search') {
            return (
              <SearchCard
                key={`search-${run.tool.id}`}
                tool={run.tool}
                result={run.result}
                indexOf={indexOf}
                streaming={streaming}
                citedUrls={citedUrls}
              />
            )
          }

          if (run.kind === 'pages') {
            return <PagesCard key={`pages-${run.pages[0]?.tool.id ?? index}`} pages={run.pages} streaming={streaming} />
          }

          return (
            <MarkdownView
              key={`text-${index}`}
              text={run.markdown}
              caret={streaming && index === lastTextRun}
              citationHtml={citationHtml}
            />
          )
        })}

        {showPlaceholder ? (
          <div className="assistant-placeholder">
            <SparkIcon size={16} />
            <span>正在思考…</span>
          </div>
        ) : null}

        {/* ------------------------------ status ------------------------------ */}
        {message.status === 'error' ? (
          <Notice
            tone="error"
            title="生成失败"
            detail={message.error}
            action={{ label: '重试', onClick: onRegenerate }}
          />
        ) : null}

        {message.status === 'refused' ? (
          <Notice
            tone="warn"
            title="内容未通过安全审核"
            detail="这条回复已被安全策略拦截，已为你移除生成的内容。可以换个问法再试一次。"
          />
        ) : null}

        {message.status === 'truncated' ? (
          <Notice
            tone="info"
            title="回答被截断"
            detail="已达到单次输出上限。可以发送「继续」让我接着写。"
          />
        ) : null}

        {message.status === 'aborted' ? (
          <Notice tone="info" title="已停止生成" detail="你可以点击重新生成，或继续提问。" />
        ) : null}

        {/* ------------------------------ actions ------------------------------ */}
        {!streaming && (answerText.length > 0 || message.status === 'done' || message.status === 'aborted') ? (
          <div className="msg-actions">
            <button type="button" className="action-btn" onClick={handleCopy}>
              <CopyIcon />
              复制
            </button>
            <button type="button" className="action-btn" onClick={onRegenerate}>
              <RefreshIcon />
              重新生成
            </button>
            <span className="action-spacer" />
          </div>
        ) : null}

        {/* ------------------------------- usage ------------------------------- */}
        {showUsage && !streaming && usage && (usage.output_tokens ?? 0) > 0 ? (
          <div className="usage-line">
            <span>输入 {formatTokens(usage.input_tokens)}</span>
            <span className="dot" />
            <span>输出 {formatTokens(usage.output_tokens)}</span>
            {cost ? (
              <>
                <span className="dot" />
                <span>{cost}</span>
              </>
            ) : null}
            {message.durationMs ? (
              <>
                <span className="dot" />
                <span>{formatDurationMs(message.durationMs)}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
