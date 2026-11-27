/**
 * 长文档库：把大 txt 切块建 SQLite FTS5 索引，提问时只检索相关片段注入上下文。
 *
 * 为什么不直接上传：App 走 Anthropic Messages 端点，服务端会校验输入长度
 * （实测 32K token 上限），几 MB 的原文必然被拒。本地建库后每次只发几千字。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ingest, resetDb, stats, hasLongdoc } from '@/lib/longdoc/db'
import { toast } from '@/store/ui'
import { TrashIcon } from '@/components/icons'

export function LongdocPanel() {
  const [info, setInfo] = useState<{ chunks: number; bytes: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      if (await hasLongdoc()) setInfo(await stats())
      else setInfo(null)
    } catch {
      setInfo(null)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onPick = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    try {
      const list: { name: string; text: string }[] = []
      for (const f of Array.from(files)) {
        list.push({ name: f.name, text: await f.text() })
      }
      const r = await ingest(list)
      toast('已建库：' + r.chunks + ' 块，耗时 ' + Math.round(r.ms) + 'ms', 'success')
      await refresh()
    } catch (e) {
      toast('建库失败：' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [refresh])

  const onClear = useCallback(async () => {
    setBusy(true)
    try {
      await resetDb()
      setInfo(null)
      toast('长文档库已清空', 'success')
    } catch (e) {
      toast('清空失败：' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally {
      setBusy(false)
    }
  }, [])

  if (!loaded) return null

  return (
    <div className="settings-group">
      <div className="settings-group-title">长文档库</div>
      <button
        type="button"
        className="settings-row"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        <span>
          <span className="settings-row-title">{busy ? "处理中…" : "导入 .txt 建库"}</span>
          <span className="settings-row-desc">
            {info
              ? '已索引 ' + info.chunks + ' 块 · ' + (info.bytes / 1048576).toFixed(1) + ' MB · 提问时自动检索最相关的 3 段'
              : '把几 MB 的长文本切块建索引，提问时只发送命中的片段，避免超出上下文上限'}
          </span>
        </span>
        <span className="settings-row-value">{info ? "已建库" : "未建库"}</span>
      </button>
      {info ? (
        <button type="button" className="settings-row" onClick={() => void onClear()} disabled={busy}>
          <span>
            <span className="settings-row-title">清空长文档库</span>
            <span className="settings-row-desc">删除本机保存的索引（不影响对话记录）</span>
          </span>
          <span className="settings-row-value"><TrashIcon size={16} /></span>
        </button>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept=".txt,text/plain"
        multiple
        hidden
        onChange={(e) => void onPick(e.target.files)}
      />
    </div>
  )
}
