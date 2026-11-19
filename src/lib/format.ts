/** Formatting helpers for timestamps, counters and durations. */

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

export function formatRelative(timestamp: number, now = Date.now()): string {
  const diff = now - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`

  const date = new Date(timestamp)
  const today = new Date(now)
  const isSameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  if (isSameDay) return formatClock(timestamp)

  const yesterday = new Date(now - 86_400_000)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  if (isYesterday) return '昨天'

  if (date.getFullYear() === today.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/** Bucket label used to group the conversation list. */
export function dateGroupLabel(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp)
  const today = new Date(now)
  if (date.toDateString() === today.toDateString()) return '今天'
  const yesterday = new Date(now - 86_400_000)
  if (date.toDateString() === yesterday.toDateString()) return '昨天'
  if (now - timestamp < 7 * 86_400_000) return '过去 7 天'
  if (now - timestamp < 30 * 86_400_000) return '过去 30 天'
  return '更早'
}

export function formatTokens(count: number | undefined): string {
  if (!count || count <= 0) return '0'
  if (count < 1000) return `${count}`
  if (count < 1_000_000) {
    const value = count / 1000
    return `${value >= 10 ? Math.round(value) : value.toFixed(1)}k`
  }
  return `${(count / 1_000_000).toFixed(2)}M`
}

export function formatDurationMs(ms: number | undefined): string {
  if (!ms || ms <= 0) return ''
  if (ms < 1000) return `${Math.round(ms)} 毫秒`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} 秒`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} 分 ${Math.round(seconds % 60)} 秒`
}

/** Rough cost estimate in USD using the published DeepSeek prices. */
export function estimateCost(
  model: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  cacheHitTokens = 0,
): string {
  const isPro = model.includes('pro')
  // Peak prices (USD per 1M tokens); off-peak is half.
  const price = isPro
    ? { inputMiss: 1.32, inputHit: 0.044, output: 3.96 }
    : { inputMiss: 0.3, inputHit: 0.006, output: 1.2 }
  const input = Math.max(0, (inputTokens ?? 0) - cacheHitTokens)
  const cost =
    (input / 1_000_000) * price.inputMiss +
    (cacheHitTokens / 1_000_000) * price.inputHit +
    ((outputTokens ?? 0) / 1_000_000) * price.output
  if (cost <= 0) return ''
  if (cost < 0.0001) return '<$0.0001'
  return `$${cost.toFixed(4)}`
}
