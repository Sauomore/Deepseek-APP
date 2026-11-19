/**
 * Assistant content blocks: the collapsible thinking panel, web-search cards,
 * page-read cards, citation badges and inline notices.
 *
 * Both tool cards behave like the thinking panel: a single summary row that the
 * user can tap to expand, so a deep-search turn doesn't flood the transcript with
 * dozens of source previews. Shapes were verified against the live API: one
 * search turn can contain several `thinking` blocks, one `search` call with 10–15
 * sources, and multiple parallel `open_page` calls whose results arrive after all
 * the calls.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  GlobeIcon,
  InfoIcon,
  SparkIcon,
} from '@/components/icons'
import { formatDurationMs } from '@/lib/format'
import { hostnameOf, openExternal } from '@/lib/platform'
import type {
  ServerToolUseBlock,
  WebFetchToolResultBlock,
  WebSearchResult,
  WebSearchToolResultBlock,
} from '@/types/api'

/* ------------------------------------------------------------------ */
/*  Thinking panel                                                    */
/* ------------------------------------------------------------------ */

interface ThinkingPanelProps {
  text: string
  streaming: boolean
  /** True once the answer text has started (auto-collapse trigger). */
  hasAnswer: boolean
}

export function ThinkingPanel({ text, streaming, hasAnswer }: ThinkingPanelProps) {
  const live = streaming && !hasAnswer
  const [open, setOpen] = useState(live)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const startedAt = useRef<number | null>(streaming ? Date.now() : null)
  const userToggled = useRef(false)

  // Auto-expand while reasoning, auto-collapse once the answer starts.
  useEffect(() => {
    if (userToggled.current) return
    setOpen(live)
  }, [live])

  // Track how long the reasoning took (only when observed live).
  useEffect(() => {
    if (live && startedAt.current === null) startedAt.current = Date.now()
    if (!live && startedAt.current !== null && durationMs === null) {
      setDurationMs(Date.now() - startedAt.current)
      startedAt.current = null
    }
  }, [live, durationMs])

  // Keep the newest reasoning line visible while it streams.
  useEffect(() => {
    if (!live || !open) return
    const node = bodyRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [text, live, open])

  const toggle = () => {
    userToggled.current = true
    setOpen((value) => !value)
  }

  const showSkeleton = !text && streaming
  const durationLabel = durationMs ? formatDurationMs(durationMs) : ''

  return (
    <div className="thinking" data-open={open}>
      <button
        type="button"
        className="thinking-head"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? '收起思考过程' : '展开思考过程'}
      >
        <span className="thinking-icon">
          <SparkIcon />
        </span>
        <span className="thinking-label">
          {live ? '正在深度思考' : text ? '已深度思考' : '深度思考'}
        </span>
        {live ? (
          <span className="gen-status" aria-hidden="true">
            <span className="shake-dot" />
            <span className="shake-dot" />
            <span className="shake-dot" />
          </span>
        ) : durationLabel ? (
          <span className="thinking-meta">用时 {durationLabel}</span>
        ) : null}
        <span className="chevron">
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        showSkeleton ? (
          <div className="thinking-skeleton" aria-hidden="true">
            <div className="shimmer-line" />
            <div className="shimmer-line" />
            <div className="shimmer-line" />
          </div>
        ) : (
          <div ref={bodyRef} className={`thinking-body${live ? ' is-live' : ''}`}>
            {text}
          </div>
        )
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Web search card                                                   */
/* ------------------------------------------------------------------ */

const VISIBLE_SOURCES = 4

interface SearchCardProps {
  tool: ServerToolUseBlock
  result?: WebSearchToolResultBlock
  indexOf: (url: string) => number
  streaming: boolean
  /** URLs the answer actually cites — surfaced first so they're not buried. */
  citedUrls?: string[]
}

function queriesOf(tool: ServerToolUseBlock): string[] {
  const input = tool.input
  if (input.action === 'search' && input.queries?.length) return input.queries
  if (input.action === 'open_page' && input.url) return [input.url]
  if (input.action === 'find_in_page' && input.url) return [input.url]
  if (input.action === 'read_link' && input.url) return [input.url]
  return []
}

function isSearchResult(item: WebSearchResult | { type: string }): item is WebSearchResult {
  return (item as WebSearchResult).url !== undefined
}

function isSearchError(item: WebSearchResult | { type: string }): boolean {
  return (item as { type: string }).type === 'web_search_tool_result_error'
}

export function SearchCard({ tool, result, indexOf, streaming, citedUrls }: SearchCardProps) {
  /** Collapsed by default — tapping the summary row reveals the source list. */
  const [open, setOpen] = useState(false)
  /** Inside the expanded body, limit how many sources are listed. */
  const [showAll, setShowAll] = useState(false)

  const queries = queriesOf(tool)
  const deep = tool.kind === 'deep_search' || tool.kind === 'deep_image_search'

  const { sources, failed } = useMemo(() => {
    const items = result?.content ?? []
    const list = items.filter(isSearchResult)
    // Cited sources first (stable), so the badge numbers map to visible rows.
    const cited = new Set(citedUrls ?? [])
    const ordered =
      cited.size > 0
        ? [...list].sort((a, b) => Number(cited.has(b.url)) - Number(cited.has(a.url)))
        : list
    return {
      sources: ordered,
      failed: items.some(isSearchError),
    }
  }, [result, citedUrls])

  const visible = showAll ? sources : sources.slice(0, VISIBLE_SOURCES)
  const pending = !result && streaming

  return (
    <div className="tool-card" data-open={open}>
      <button
        type="button"
        className="tool-head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? '收起搜索结果' : '展开搜索结果'}
      >
        <span className="tool-head-icon">
          <GlobeIcon />
        </span>
        <div className="tool-head-text">
          <span className="tool-title">{deep ? '深度思考搜索' : '联网搜索'}</span>
          <span className="tool-subtitle">
            {failed
              ? '搜索失败，已根据已有信息作答'
              : result
                ? `找到 ${sources.length} 条相关资料`
                : pending
                  ? '正在搜索…'
                  : '未返回搜索结果'}
          </span>
        </div>
        {pending ? (
          <span className="tool-badge">
            <span className="spinner" />
          </span>
        ) : (
          <span className="tool-badge">{deep ? '深度' : `${sources.length} 条`}</span>
        )}
        <span className="tool-chevron">
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <div className="tool-body">
          {queries.length > 0 ? (
            <div className="query-row">
              {queries.map((query) => (
                <span className="query-chip" key={query} title={query}>
                  {query}
                </span>
              ))}
            </div>
          ) : null}

          {sources.length > 0 ? (
            <>
              <div className="source-list">
                {visible.map((source) => (
                  <button
                    type="button"
                    key={source.url}
                    className="source-item"
                    onClick={() => openExternal(source.url)}
                  >
                    <span className="source-index">{indexOf(source.url)}</span>
                    <span className="source-body">
                      <span className="source-title">{source.title || hostnameOf(source.url)}</span>
                      <span className="source-meta">
                        {source.site_icon ? (
                          <img
                            className="source-favicon"
                            src={source.site_icon}
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              ;(event.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : null}
                        <span className="source-site">
                          {source.site_name || hostnameOf(source.url)}
                        </span>
                        {source.page_age ? (
                          <span className="source-age">{source.page_age.slice(0, 10)}</span>
                        ) : null}
                      </span>
                      {source.snippet ? (
                        <span className="source-snippet">{source.snippet}</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
              {sources.length > VISIBLE_SOURCES ? (
                <button
                  type="button"
                  className="source-more"
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll ? '收起' : `展开全部 ${sources.length} 条`}
                  <ChevronDownIcon
                    size={14}
                    style={{ transform: showAll ? 'rotate(180deg)' : undefined }}
                  />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page-reading card (open_page / find_in_page / read_link)          */
/* ------------------------------------------------------------------ */

export interface PageRead {
  tool: ServerToolUseBlock
  result?: WebFetchToolResultBlock
}

function pageInfo({ tool, result }: PageRead): { title: string; url: string; failed: boolean } {
  const input = tool.input
  const url = 'url' in input ? (input.url ?? '') : ''
  const content = result?.content
  const ok = content && (content as { type: string }).type === 'web_fetch_result'
  const failed = Boolean(
    content && (content as { type: string }).type === 'web_fetch_tool_result_error',
  )
  const fetchResult = ok ? (content as { url?: string; content?: { title?: string } }) : undefined
  return {
    title: fetchResult?.content?.title || (url ? hostnameOf(url) : '网页'),
    url: fetchResult?.url || url,
    failed,
  }
}

interface PagesCardProps {
  pages: PageRead[]
  streaming: boolean
}

export function PagesCard({ pages, streaming }: PagesCardProps) {
  /** Collapsed by default, exactly like the thinking panel. */
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? pages : pages.slice(0, 3)
  const pending = pages.some((page) => !page.result) && streaming
  const failedCount = pages.filter((page) => pageInfo(page).failed).length

  return (
    <div className="tool-card" data-open={open}>
      <button
        type="button"
        className="tool-head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? '收起网页列表' : '展开网页列表'}
      >
        <span className="tool-head-icon">
          <BookOpenIcon />
        </span>
        <div className="tool-head-text">
          <span className="tool-title">阅读网页</span>
          <span className="tool-subtitle">
            {pending
              ? `正在打开 ${pages.length} 个网页…`
              : failedCount > 0
                ? `${pages.length} 个网页，其中 ${failedCount} 个打开失败`
                : `已打开 ${pages.length} 个网页`}
          </span>
        </div>
        {pending ? (
          <span className="tool-badge">
            <span className="spinner" />
          </span>
        ) : (
          <span className="tool-badge">{pages.length}</span>
        )}
        <span className="tool-chevron">
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <div className="tool-body">
          <div className="source-list">
            {visible.map((page) => {
              const info = pageInfo(page)
              return (
                <div className="page-row" key={page.tool.id}>
                  <span className={`source-index${info.failed ? ' is-failed' : ''}`}>
                    <BookOpenIcon size={11} />
                  </span>
                  <span className="source-body">
                    <span className={`source-title${info.failed ? ' is-failed' : ''}`}>
                      {info.failed ? '网页打开失败' : info.title}
                    </span>
                    {info.url ? <span className="source-meta">{info.url}</span> : null}
                  </span>
                  {info.url && !info.failed ? (
                    <button
                      type="button"
                      className="page-open"
                      aria-label="在浏览器中打开"
                      onClick={() => openExternal(info.url)}
                    >
                      <ExternalLinkIcon size={14} />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {pages.length > 3 ? (
            <button
              type="button"
              className="source-more"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? '收起' : `展开全部 ${pages.length} 个`}
              <ChevronDownIcon
                size={14}
                style={{ transform: showAll ? 'rotate(180deg)' : undefined }}
              />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Citation badge                                                    */
/* ------------------------------------------------------------------ */

interface CitationBadgeProps {
  index: number
  url: string
  title?: string | null
}

export function CitationBadge({ index, url, title }: CitationBadgeProps) {
  return (
    <button
      type="button"
      className="cite-badge"
      onClick={(event) => {
        event.stopPropagation()
        openExternal(url)
      }}
      title={title ?? url}
      aria-label={`来源 ${index}：${title ?? url}`}
    >
      {index}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Notices                                                           */
/* ------------------------------------------------------------------ */

interface NoticeProps {
  tone?: 'error' | 'warn' | 'info'
  title?: string
  detail?: string
  action?: { label: string; onClick: () => void }
}

export function Notice({ tone = 'info', title, detail, action }: NoticeProps) {
  const Icon = tone === 'error' ? AlertIcon : tone === 'warn' ? AlertIcon : InfoIcon
  return (
    <div className={`notice notice--${tone}`}>
      <Icon />
      <div className="notice-body">
        {title ? <div className="notice-title">{title}</div> : null}
        {detail ? <div className="notice-detail">{detail}</div> : null}
        {action ? (
          <button
            type="button"
            className="notice-retry"
            onClick={action.onClick}
            style={tone !== 'error' ? { color: 'inherit' } : undefined}
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  )
}
