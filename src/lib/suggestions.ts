/**
 * Prompt library for the empty-state suggestion cards.
 *
 * The home screen shows four of these at random each time it is opened, so the
 * app doesn't look like it only supports four fixed things.
 */

export type SuggestionIcon = 'globe' | 'spark' | 'layers' | 'code' | 'pen' | 'book'

export interface Suggestion {
  id: string
  icon: SuggestionIcon
  /** Short headline on the card. */
  title: string
  /** Small capability hint under the title. */
  desc: string
  /** What actually gets sent when tapped. */
  prompt: string
}

export const SUGGESTION_POOL: Suggestion[] = [
  // ---- 联网搜索 ----
  {
    id: 'news-v41',
    icon: 'globe',
    title: 'DeepSeek V4.1 有什么新特性？',
    desc: '联网搜索 + 来源引用',
    prompt: 'DeepSeek V4.1 有什么新特性？',
  },
  {
    id: 'weather',
    icon: 'globe',
    title: '今天北京天气怎么样？',
    desc: '实时信息 + 穿衣建议',
    prompt: '今天北京天气怎么样？需要注意什么？',
  },
  {
    id: 'ai-weekly',
    icon: 'globe',
    title: '最近 AI 有什么大新闻',
    desc: '联网搜索 + 要点汇总',
    prompt: '最近一周 AI 领域有什么值得关注的新闻？给我一份要点汇总。',
  },
  {
    id: 'compare-phone',
    icon: 'globe',
    title: '帮我在网上比比价',
    desc: '联网搜索 + 参数对比表',
    prompt: '帮我查一下今年主流旗舰手机的参数和价格，做一张对比表。',
  },

  // ---- 深度思考 / 数学 ----
  {
    id: 'math-extrema',
    icon: 'spark',
    title: '求函数 x³-3x²+2 的极值',
    desc: '深度思考 + 公式推导',
    prompt: '求函数 f(x) = x³ - 3x² + 2 的单调区间与极值',
  },
  {
    id: 'math-sqrt2',
    icon: 'spark',
    title: '证明根号 2 是无理数',
    desc: '深度思考 + 严谨证明',
    prompt: '证明根号 2 是无理数，尽可能严谨。',
  },
  {
    id: 'decision',
    icon: 'spark',
    title: '帮我把这件事想清楚',
    desc: '深度思考 + 利弊分析',
    prompt: '我在纠结要不要换工作：现在稳定但没成长，新机会涨薪 30% 但风险大。帮我把利弊理清楚，给出判断框架。',
  },

  // ---- 代码 ----
  {
    id: 'code-sse',
    icon: 'code',
    title: 'React 里怎么处理流式响应',
    desc: '可运行代码 + 踩坑提示',
    prompt: 'React 里怎么处理 SSE 流式响应？给我一份 TypeScript 实现，并说明常见坑。',
  },
  {
    id: 'code-fetch',
    icon: 'code',
    title: '写一个带重试的请求封装',
    desc: 'TypeScript 工程实践',
    prompt: '用 TypeScript 写一个 fetch 封装，支持超时、指数退避重试和 AbortController 取消。',
  },
  {
    id: 'code-debug',
    icon: 'code',
    title: '这段报错是什么意思',
    desc: '定位原因 + 修复方案',
    prompt: '解释一下 TypeError: Cannot read properties of undefined (reading "map") 通常是什么原因，怎么系统排查？',
  },
  {
    id: 'code-regex',
    icon: 'code',
    title: '帮我写个正则表达式',
    desc: '逐段解释 + 边界用例',
    prompt: '写一个正则表达式，匹配中国大陆手机号，并解释每一段的作用和边界情况。',
  },

  // ---- 架构 / 图表 ----
  {
    id: 'arch-chat',
    icon: 'layers',
    title: '设计一个流式聊天架构',
    desc: 'Mermaid 架构图',
    prompt: '帮我设计一个流式聊天应用的架构，画出流程图',
  },
  {
    id: 'state-machine',
    icon: 'layers',
    title: '用状态机描述订单流程',
    desc: 'Mermaid 状态图',
    prompt: '用状态机描述一个电商订单的完整生命周期，画出状态图。',
  },
  {
    id: 'timeline',
    icon: 'layers',
    title: '画个项目排期时序图',
    desc: 'Mermaid 时序图',
    prompt: '用时序图描述用户下单到发货的完整交互流程。',
  },

  // ---- 写作 / 表达 ----
  {
    id: 'write-apology',
    icon: 'pen',
    title: '写一封诚恳的道歉邮件',
    desc: '语气把控 + 可直接用',
    prompt: '帮我写一封给客户的道歉邮件：项目延期两周，原因是供应商接口没就绪。语气要诚恳但不卑微。',
  },
  {
    id: 'write-simplify',
    icon: 'pen',
    title: '把这段话改得更口语',
    desc: '润色 + 保留原意',
    prompt: '把下面这段产品介绍改得更口语化、更像人说的话：本产品基于多模态大模型构建，具备卓越的语义理解能力与高效的推理性能。',
  },
  {
    id: 'write-summary',
    icon: 'pen',
    title: '帮我把长文提炼成要点',
    desc: '结构化摘要',
    prompt: '把我接下来发的内容提炼成 5 条要点，每条不超过 20 字。',
  },

  // ---- 学习 / 解释 ----
  {
    id: 'explain-vector-db',
    icon: 'book',
    title: '通俗解释什么是向量数据库',
    desc: '打比方 + 一次讲懂',
    prompt: '用通俗的话解释什么是向量数据库，它解决了什么问题，适合在什么场景用。',
  },
  {
    id: 'explain-closure',
    icon: 'book',
    title: '解释一下什么是闭包',
    desc: '概念 + 例子 + 常见误区',
    prompt: '解释一下编程里的闭包，给一个直观的例子，并说明它常见的用错场景。',
  },
  {
    id: 'explain-http2',
    icon: 'book',
    title: 'HTTP/2 比 1.1 快在哪',
    desc: '对比讲解 + 结论',
    prompt: 'HTTP/2 相比 HTTP/1.1 主要快在哪里？用对比的方式讲清楚。',
  },

  // ---- 生活 ----
  {
    id: 'trip-hangzhou',
    icon: 'globe',
    title: '安排个杭州三日游',
    desc: '行程 + 路线规划',
    prompt: '帮我安排杭州三天两夜的行程，节奏别太赶，多安排本地人常去的地方。',
  },
  {
    id: 'cook-eggs',
    icon: 'book',
    title: '冰箱只有鸡蛋和番茄',
    desc: '可执行菜谱',
    prompt: '冰箱里只有鸡蛋和番茄，能做什么菜？给两个十分钟能做完的做法。',
  },
]

/** Random sample without replacement (Fisher–Yates on a copy). */
export function pickSuggestions(count = 4): Suggestion[] {
  const pool = [...SUGGESTION_POOL]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool.slice(0, Math.min(count, pool.length))
}
