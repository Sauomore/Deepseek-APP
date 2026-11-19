下面是一个在 React 里处理 SSE 流式响应的自定义 Hook。核心难点有两个：**分块到达的数据不等于完整事件**，以及**组件卸载时要把读取器关掉**。

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'

type Chunk = { type: 'text'; text: string } | { type: 'done' }

export function useSSE(onChunk: (c: Chunk) => void) {
  const [streaming, setStreaming] = useState(false)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  const stop = useCallback(() => {
    readerRef.current?.cancel().catch(() => {})
    readerRef.current = null
    setStreaming(false)
  }, [])

  const start = useCallback(
    async (url: string, payload: unknown) => {
      setStreaming(true)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok || !res.body) {
        setStreaming(false)
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      // SSE 帧以空行分隔，一块网络数据可能只拿到半帧
      let buffer = ''

      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let boundary = buffer.indexOf('\n\n')
          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const data = frame
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim())
              .join('\n')
            if (data && data !== '[DONE]') onChunk(JSON.parse(data))
            boundary = buffer.indexOf('\n\n')
          }
        }
      } finally {
        reader.releaseLock()
        setStreaming(false)
        onChunk({ type: 'done' })
      }
    },
    [onChunk],
  )

  // 卸载时中断，避免向已卸载的组件 setState
  useEffect(() => () => stop(), [stop])

  return { start, stop, streaming }
}
```

几个容易踩的点：

1. **别用 `reader.read()` 的结果直接 JSON.parse**。TCP 分块和 SSE 帧没有任何对齐关系，一定要先按 `\n\n` 切帧再解析。
2. **`TextDecoder` 要传 `{ stream: true }`**。一个中文字符可能被切在两个 Uint8Array 之间，不带这个参数会解出乱码。
3. **保持 `buffer` 是闭包变量而不是 state**，否则每个 chunk 都触发一次渲染，长回答时手机会明显发烫。
4. **卸载时要 `cancel()`**，只把 `aborted` 标记置位是不能真正断开连接的，服务端会继续吐 token 并计费。

如果你想让它更稳，可以再加一个"空闲超时"：超过 60 秒没有收到任何数据就主动中断并重试。需要我把完整版（带重连和退避）写出来吗？
