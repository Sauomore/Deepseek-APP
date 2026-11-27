/**
 * 长文档检索：SQLite FTS5 (WASM) + 2-gram 索引。
 *
 * 为什么不用 sql.js：它未编译 FTS5（no such module: fts5）。
 * 官方 @sqlite.org/sqlite-wasm 支持 FTS5 与 bm25()。
 *
 * 为什么入库前切 2-gram：FTS5 的 trigram 分词器要求 >=3 字符，
 * 中文核心词多为 2 字（如"数据""模型"），直接用 trigram 会 0 命中。
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { get, set } from 'idb-keyval'

const DB_KEY = 'longdoc-db-v2'
const VERSION_KEY = 'longdoc-schema-version'
const WASM_URL = '/sqlite3.wasm'

/**
 * 建库规则版本。停用词表或切块参数变化时必须 +1，
 * 否则旧索引与新查询词表不一致，检索结果会错乱。
 */
const SCHEMA_VERSION = 2

/**
 * 无区分度的 2-gram 黑名单。
 *
 * 实测教训：用户追问「原文为什么没有……」时，切出的
 * 原文 / 文为 / 为什 / 什么 / 么没 / 没有 全是全库高频词，
 * 一个都不指向具体内容。BM25 被它们主导，最终命中了
 * 完全无关的段落，而不是上一轮正在讨论的那一段。
 *
 * 索引与查询两侧必须使用同一张表。
 */
const STOP_BIGRAMS = new Set([
  // 疑问 / 元指代
  '原文', '文为', '为什', '什么', '么没', '没有', '应该', '该多', '多少',
  '怎么', '么办', '如何', '何时', '哪些', '哪个', '是不', '不是', '可以',
  '以吗', '吗', '是什', '么样', '怎样', '为啥', '么会', '会不',
  // 人称 / 指示
  '我们', '你们', '他们', '自己', '这样', '那样', '这个', '那个', '一个',
  '这里', '那里', '现在', '目前', '已经', '就是', '只是', '还是',
  // 连接 / 虚词
  '但是', '而且', '如果', '因为', '所以', '然后', '或者', '并且', '虽然',
  '不过', '因此', '于是', '总之', '其实', '确实', '真的', '一下', '一些',
  // 客套
  '请问', '帮我', '告诉', '说说', '看看', '麻烦', '谢谢',
])

/** 单个汉字级的噪音字 —— 2-gram 里两个都是噪音字才丢弃 */
const STOP_CHARS = new Set('的了是在我你他就也都而及与或不有这那个上下中说要会能对很还被把从到为以之其但若则且等什吗呢吧啊呀么怎么'.split(''))

let sqlite3: any = null
let db: any = null
let ready: Promise<any> | null = null

/** 中文字符级 2-gram，空格分隔，供 FTS5 unicode61 分词使用 */
export function toBigrams(text: string): string {
  const out: string[] = []
  let buf: string[] = []
  const flush = () => {
    if (buf.length >= 2) {
      const s = buf.join('')
      for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
    }
    buf = []
  }
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    const isCjk = cp >= 0x4e00 && cp <= 0x9fff
    const isAsciiWord = cp < 128 && /[0-9A-Za-z]/.test(ch)
    if (isCjk || isAsciiWord) buf.push(ch)
    else flush()
  }
  flush()
  // 丢弃无区分度的 2-gram：命中黑名单，或两个字都是噪音字
  const kept = out.filter((bg) => {
    if (STOP_BIGRAMS.has(bg)) return false
    if (STOP_CHARS.has(bg[0]) && STOP_CHARS.has(bg[1])) return false
    return true
  })
  return kept.join(' ')
}

/** 按行累积切块，块间保留 overlap 字符 */
export function chunkText(text: string, tag: string, chunk = 400, overlap = 100) {
  // 去掉导出文件的元信息头（会话 id / 时间戳），否则整块会污染检索
  const m = text.search(/【(我|DeepSeek)】\s*#\d+/)
  const body = m > 0 ? text.slice(m) : text

  const lines = body.split('\n')
  const out: { tag: string; body: string; bigr: string }[] = []
  let buf: string[] = []
  let len = 0
  for (const line of lines) {
    buf.push(line)
    len += line.length + 1
    if (len >= chunk) {
      const b = buf.join('\n').trim()
      if (b) out.push({ tag, body: b, bigr: toBigrams(b) })
      const tail = buf.join('\n').slice(-overlap)
      buf = [tail]
      len = tail.length
    }
  }
  const rest = buf.join('\n').trim()
  if (rest.length > 20) out.push({ tag, body: rest, bigr: toBigrams(rest) })
  return out
}

async function initDb(): Promise<any> {
  if (db) return db
  sqlite3 = await (sqlite3InitModule as any)({ locateFile: () => WASM_URL })
  // 建库规则变了（停用词 / 切块参数）→ 旧索引作废，丢弃重建
  const cachedVersion = await get(VERSION_KEY)
  const cachedRaw = await get(DB_KEY)
  const cached = cachedVersion === SCHEMA_VERSION ? cachedRaw : undefined
  if (cachedVersion !== SCHEMA_VERSION && cachedRaw) {
    await set(DB_KEY, undefined)
  }
  if (cached instanceof Uint8Array && cached.byteLength > 0) {
    db = new sqlite3.oo1.DB()
    sqlite3.capi.sqlite3_deserialize(
      db.pointer,
      'main',
      sqlite3.wasm.allocFromTypedArray(cached),
      cached.byteLength,
      cached.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    )
  } else {
    db = new sqlite3.oo1.DB(':memory:', 'ct')
    db.exec("CREATE VIRTUAL TABLE chunks USING fts5(tag UNINDEXED, body, bigr, tokenize='unicode61')")
  }
  return db
}

/**
 * 快速判断库里是否有内容，不初始化 wasm。
 * chat 流程每次都要判断，若直接 openDb() 会在首次提问时拉 879KB wasm。
 */
export async function hasLongdoc(): Promise<boolean> {
  if (db) {
    const n = db.exec({ sql: 'SELECT count(*) FROM chunks', returnValue: 'resultRows' })[0][0] as number
    return n > 0
  }
  try {
    const cached = await get(DB_KEY)
    return cached instanceof Uint8Array && cached.byteLength > 1024
  } catch {
    return false
  }
}

export function openDb(): Promise<any> {
  if (!ready) ready = initDb()
  return ready
}

/** 把文件入库 */
export async function ingest(files: { name: string; text: string }[]): Promise<{ chunks: number; ms: number }> {
  const d = await openDb()
  const t0 = performance.now()
  d.exec('BEGIN')
  try {
    const stmt = d.prepare('INSERT INTO chunks(tag, body, bigr) VALUES (?,?,?)')
    try {
      for (const f of files) {
        for (const c of chunkText(f.text, f.name)) {
          stmt.bind([c.tag, c.body, c.bigr])
          stmt.step()
          stmt.reset()
        }
      }
    } finally {
      stmt.finalize()
    }
    d.exec('COMMIT')
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
  await persist()
  const n = d.exec({ sql: 'SELECT count(*) FROM chunks', returnValue: 'resultRows' })[0][0] as number
  return { chunks: n, ms: performance.now() - t0 }
}

async function persist(): Promise<void> {
  if (!db) return
  try {
    const bytes: Uint8Array = sqlite3.capi.sqlite3_js_db_export(db.pointer)
    await set(DB_KEY, bytes)
    await set(VERSION_KEY, SCHEMA_VERSION)
  } catch {
    /* 持久化失败不影响本次会话查询 */
  }
}

export interface Hit { tag: string; body: string; score: number }

/**
 * BM25 检索；query 切成 2-gram 后以 OR 组合。
 *
 * context 是上一轮用户问句。为什么需要它：
 * 用户追问「原文为什么没有」时，这句话本身过滤停用词后几乎不剩有效词，
 * 检索完全丢失了上一轮的具体意图，只能撞上任何含泛词的段落。
 * 策略：当前问句有效词少于 4 个时，才把上一轮拼进来补意图 ——
 * 有效词足够时，拼上下文反而会稀释当前问题的权重。
 */
export async function search(query: string, topK = 3, context?: string): Promise<Hit[]> {
  const d = await openDb()

  const own = Array.from(new Set(toBigrams(query).split(' ').filter(Boolean)))
  let terms = own
  if (own.length < 4 && context) {
    const merged = new Set(own)
    for (const t of toBigrams(context).split(' ')) if (t) merged.add(t)
    terms = Array.from(merged)
  }
  if (!terms.length) return []
  const match = terms.map((t) => 'bigr:"' + t.split('"').join('""') + '"').join(' OR ')
  try {
    const rows = d.exec({
      sql: 'SELECT tag, body, bm25(chunks) AS r FROM chunks WHERE chunks MATCH ? ORDER BY r LIMIT ?',
      bind: [match, topK],
      rowMode: 'object',
      returnValue: 'resultRows',
    })
    return (rows as any[]).map((r) => ({ tag: r.tag, body: r.body, score: -r.r }))
  } catch {
    return []
  }
}

/** 清空并重建 */
export async function resetDb(): Promise<void> {
  if (db) {
    db.close()
    db = null
  }
  ready = null
  await set(DB_KEY, undefined)
}

/** 当前库统计 */
export async function stats(): Promise<{ chunks: number; bytes: number }> {
  const d = await openDb()
  const n = d.exec({ sql: 'SELECT count(*) FROM chunks', returnValue: 'resultRows' })[0][0] as number
  let bytes = 0
  try {
    bytes = (sqlite3.capi.sqlite3_js_db_export(d.pointer) as Uint8Array).byteLength
  } catch {
    /* ignore */
  }
  return { chunks: n, bytes }
}
