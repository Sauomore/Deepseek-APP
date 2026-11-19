/**
 * Block accumulator: folds a stream of Messages-protocol SSE events into the
 * `AssistantBlock[]` array the renderer consumes.
 *
 * The official docs are explicit that one reply can contain **several** blocks
 * and that thinking can appear more than once (think → search → think → answer),
 * so blocks are kept in an array addressed by `index` rather than as a single
 * "current block".
 */

import type {
  AssistantBlock,
  Citation,
  StopReason,
  StreamEvent,
  TextBlock,
  ThinkingBlock,
  Usage,
} from '@/types/api'

export interface AccumulatedMessage {
  blocks: AssistantBlock[]
  stopReason: StopReason
  title?: string
  usage?: Usage
  model?: string
  messageId?: string
  /** True once `message_stop` (or an error) arrived. */
  finished: boolean
}

function cloneBlock(block: AssistantBlock): AssistantBlock {
  if (block.type === 'text') {
    return {
      type: 'text',
      text: block.text ?? '',
      ...(block.citations ? { citations: [...block.citations] } : {}),
    }
  }
  if (block.type === 'thinking') {
    return { type: 'thinking', thinking: block.thinking ?? '', signature: block.signature }
  }
  // Tool blocks arrive complete in `content_block_start`; keep them by reference
  // because they are never mutated afterwards.
  return block
}

export class BlockAccumulator {
  private blocks: AssistantBlock[] = []
  private stopReason: StopReason = null
  private title: string | undefined
  private usage: Usage | undefined
  private model: string | undefined
  private messageId: string | undefined
  private finished = false

  /** Apply one stream event. Returns `true` when visible content changed. */
  apply(event: StreamEvent): boolean {
    switch (event.type) {
      case 'message_start': {
        this.model = event.message?.model ?? this.model
        this.messageId = event.message?.id ?? this.messageId
        return false
      }
      case 'content_block_start': {
        const incoming = cloneBlock(event.content_block)
        // A repeated index replaces the placeholder (defensive; servers don't reuse indices).
        this.blocks[event.index] = incoming
        return true
      }
      case 'content_block_delta': {
        const block = this.blocks[event.index]
        if (!block) return false
        const delta = event.delta
        if (delta.type === 'text_delta' && block.type === 'text') {
          block.text += delta.text
          return true
        }
        if (delta.type === 'thinking_delta' && block.type === 'thinking') {
          block.thinking += delta.thinking
          return true
        }
        if (delta.type === 'signature_delta' && block.type === 'thinking') {
          block.signature = delta.signature
          return false
        }
        if (delta.type === 'citations_delta' && block.type === 'text') {
          const target = block as TextBlock
          const citations: Citation[] = target.citations ? [...target.citations] : []
          citations.push(delta.citation)
          target.citations = citations
          return true
        }
        return false
      }
      case 'message_delta': {
        if (event.delta?.stop_reason !== undefined) this.stopReason = event.delta.stop_reason
        if (event.delta?.title) this.title = event.delta.title
        if (event.usage) this.usage = event.usage
        return false
      }
      case 'message_stop': {
        this.finished = true
        return false
      }
      case 'error': {
        this.finished = true
        return false
      }
      default:
        return false
    }
  }

  /** Deep-ish snapshot safe to hand to React (new refs for changed content). */
  snapshot(): AccumulatedMessage {
    return {
      blocks: this.blocks.filter(Boolean).map(cloneBlock),
      stopReason: this.stopReason,
      title: this.title,
      usage: this.usage,
      model: this.model,
      messageId: this.messageId,
      finished: this.finished,
    }
  }

  get isFinished(): boolean {
    return this.finished
  }

  /** Convenience: assembled visible answer text (used for copy / usage previews). */
  text(): string {
    return this.blocks
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
  }

  thinkingText(): string {
    return this.blocks
      .filter((b): b is ThinkingBlock => b.type === 'thinking')
      .map((b) => b.thinking)
      .join('\n\n')
  }
}

/* ------------------------------------------------------------------ */
/*  History sanitising                                                */
/* ------------------------------------------------------------------ */

/**
 * Make an assistant turn safe to replay in `messages`:
 * - drop empty text / thinking blocks (an aborted stream can leave one)
 * - keep thinking blocks but normalise a missing signature to '' — the service
 *   can recover the signature from the tool-call ids, and omitting the block
 *   entirely can make a tool-calling follow-up return 400
 * - drop a tool call with no matching result, and a result with no call
 */
export function sanitizeBlocksForHistory(blocks: AssistantBlock[] | undefined): AssistantBlock[] {
  if (!blocks?.length) return []
  const kept = blocks
    .filter((block) => {
      if (block.type === 'text') return block.text.trim().length > 0
      if (block.type === 'thinking') return block.thinking.trim().length > 0
      return true
    })
    .map((block) =>
      block.type === 'thinking' && !block.signature
        ? { ...block, signature: '' }
        : block,
    )

  const callIds = new Set(
    kept.filter((b) => b.type === 'server_tool_use').map((b) => (b as { id: string }).id),
  )
  const resultIds = new Set(
    kept
      .filter((b) => b.type === 'web_search_tool_result' || b.type === 'web_fetch_tool_result')
      .map((b) => (b as { tool_use_id: string }).tool_use_id),
  )

  return kept.filter((block) => {
    if (block.type === 'server_tool_use') return resultIds.has(block.id)
    if (block.type === 'web_search_tool_result' || block.type === 'web_fetch_tool_result') {
      return callIds.has(block.tool_use_id)
    }
    return true
  })
}
