/**
 * Message list with chat-style auto-scroll: stays pinned to the bottom while
 * tokens stream in, but yields immediately if the user scrolls up to read.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AssistantMessage, UserMessage } from '@/components/messages'
import {
  BookOpenIcon,
  ChevronDownIcon,
  CodeIcon,
  GlobeIcon,
  LayersIcon,
  PencilIcon,
  SparkIcon,
} from '@/components/icons'
import { pickSuggestions, type SuggestionIcon } from '@/lib/suggestions'
import type { ChatMessage } from '@/types/chat'

/* ------------------------------------------------------------------ */
/*  Empty state                                                       */
/* ------------------------------------------------------------------ */

const SUGGESTION_ICONS: Record<SuggestionIcon, typeof GlobeIcon> = {
  globe: GlobeIcon,
  spark: SparkIcon,
  layers: LayersIcon,
  code: CodeIcon,
  pen: PencilIcon,
  book: BookOpenIcon,
}

interface EmptyStateProps {
  onPick: (prompt: string) => void
  suggestionsEnabled?: boolean
  /** Changes when the conversation changes, so the cards re-roll. */
  seed?: string
}

export function EmptyState({ onPick, suggestionsEnabled = true, seed }: EmptyStateProps) {
  // Four random prompts from the library, re-rolled for every new conversation.
  const suggestions = useMemo(() => pickSuggestions(4), [seed])

  return (
    <div className="empty-state">
      <h1 className="empty-title">今天想做点什么？</h1>

      {suggestionsEnabled ? (
        <div className="suggestions">
          {suggestions.map((item) => {
            const Icon = SUGGESTION_ICONS[item.icon]
            return (
              <button
                type="button"
                className="suggestion"
                key={item.id}
                onClick={() => onPick(item.prompt)}
              >
                <span className="suggestion-icon">
                  <Icon />
                </span>
                <span className="suggestion-title">{item.title}</span>
                <span className="suggestion-desc">{item.desc}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Message list                                                      */
/* ------------------------------------------------------------------ */

interface MessageListProps {
  messages: ChatMessage[]
  onRegenerate: (messageId: string) => void
  onPickSuggestion: (prompt: string) => void
  /** Conversation id; lets the empty state re-roll its suggestions. */
  seed?: string
  /** Settings → 交互 → 首页推荐问题. */
  suggestionsEnabled?: boolean
}

export function MessageList({
  messages,
  onRegenerate,
  onPickSuggestion,
  seed,
  suggestionsEnabled = true,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(true)
  const pinnedRef = useRef(true)
  const lastCountRef = useRef(0)

  const setPinnedBoth = (value: boolean) => {
    pinnedRef.current = value
    setPinned(value)
  }

  const scrollToBottom = useCallback((smooth = false) => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const handleScroll = useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    const nextPinned = distance < 96
    if (nextPinned !== pinnedRef.current) setPinnedBoth(nextPinned)
  }, [])

  // Follow new content only while the user is at the bottom.
  useLayoutEffect(() => {
    if (pinnedRef.current) scrollToBottom(false)
  }, [messages, scrollToBottom])

  // Jump to the newest message when switching conversations.
  const messageCount = messages.length
  useEffect(() => {
    if (messageCount !== lastCountRef.current) {
      const grew = messageCount > lastCountRef.current
      lastCountRef.current = messageCount
      if (!grew && pinnedRef.current) scrollToBottom(false)
    }
  }, [messageCount, scrollToBottom])

  const isEmpty = messages.length === 0

  return (
    <div className="messages-scroll" ref={scrollRef} onScroll={handleScroll}>
      <div className={`messages-inner${isEmpty ? ' messages-inner--empty' : ''}`}>
        {isEmpty ? (
          <EmptyState onPick={onPickSuggestion} seed={seed} suggestionsEnabled={suggestionsEnabled} />
        ) : (
          messages.map((message) =>
            message.role === 'user' ? (
              <UserMessage key={message.id} message={message} />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                onRegenerate={() => onRegenerate(message.id)}
              />
            ),
          )
        )}
      </div>

      {!pinned && !isEmpty ? (
        <button
          type="button"
          className="scroll-bottom"
          onClick={() => {
            setPinnedBoth(true)
            scrollToBottom(true)
          }}
          aria-label="回到最新消息"
        >
          <ChevronDownIcon />
        </button>
      ) : null}
    </div>
  )
}
