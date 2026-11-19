/**
 * Mock content library — powers **演示模式** (demo mode).
 *
 * No API key is required: the simulator reproduces the exact event sequence the
 * real Messages API emits, so every UI path (streaming, thinking, search cards,
 * citations, usage) can be exercised offline. Answers live in `content/*.md` and
 * may contain `[[n]]` citation markers.
 */

import searchV41 from './content/search-v41.md?raw'
import weather from './content/weather.md?raw'
import code from './content/code.md?raw'
import math from './content/math.md?raw'
import mermaid from './content/mermaid.md?raw'
import vision from './content/vision.md?raw'
import documentContent from './content/document.md?raw'
import welcome from './content/welcome.md?raw'
import general from './content/general.md?raw'

export interface MockSource {
  title: string
  url: string
  snippet: string
  siteName: string
  siteIcon?: string
  pageAge?: string
}

export interface MockSearchCall {
  kind: 'search' | 'deep_search'
  queries: string[]
  sources: MockSource[]
}

export interface MockScenario {
  id: string
  /** Short conversation title, mimicking the server-side `title` feature. */
  title: string
  /** First thinking block (before any tool call). */
  thinking?: string
  /** A search step the server "ran" on our behalf. */
  search?: MockSearchCall
  /** Thinking emitted after the search, which is how deep search behaves. */
  postSearchThinking?: string
  /** URL-reading step (deepseek_read_url). */
  readUrl?: { url: string; title: string }
  /** Markdown answer; `[[n]]` maps to `search.sources[n-1]`. */
  answer: string
}

const icon = (host: string) => `https://cdn.deepseek.com/site-icons/${host}`

/* ------------------------------------------------------------------ */
/*  Scenario definitions                                              */
/* ------------------------------------------------------------------ */

const V41: MockScenario = {
  id: 'v41',
  title: 'DeepSeek V4.1 有什么新特性',
  thinking: `用户问的是 V4.1 的新特性，这是个信息型问题，而且答案会随时间变化，应该联网查一下再回答，避免只凭训练数据说错发布时间。
我的记忆里 V4.1 是 2026 年 10 月前后发布的，但具体参数细节需要以官方发布说明为准。
需要查：发布说明、模型能力对照、上下文长度、价格变化。`,
  search: {
    kind: 'deep_search',
    queries: ['DeepSeek V4.1 发布 新特性', 'DeepSeek V4.1 context window pricing'],
    sources: [
      {
        title: 'DeepSeek V4.1 正式发布：1M 上下文与思考模式默认开启',
        url: 'https://api-docs.deepseek.com/news/news261017/',
        snippet:
          'DeepSeek 今日发布 V4.1 系列模型，上下文长度提升至 1M tokens，最大输出 384K tokens，思考模式改为默认开启…',
        siteName: 'DeepSeek',
        siteIcon: icon('deepseek.com'),
        pageAge: '2026-10-17T08:00:00+00:00',
      },
      {
        title: 'Models & Pricing | DeepSeek API Docs',
        url: 'https://api-docs.deepseek.com/quick_start/pricing',
        snippet:
          'deepseek-flash 与 deepseek-v4-pro 均支持 1M 上下文，缓存命中输入价格低至 $0.003/1M tokens…',
        siteName: 'DeepSeek API Docs',
        siteIcon: icon('api-docs.deepseek.com'),
        pageAge: '2026-11-01T00:00:00+00:00',
      },
      {
        title: 'Build a Chatbot with DeepSeek: web search, files, speech',
        url: 'https://api-docs.deepseek.com/guides/build_a_chatbot',
        snippet:
          'The DeepSeek API offers the same conversation features as DeepSeek Chat on the web and in the app: web search, deep thinking search, file input and URL reading…',
        siteName: 'DeepSeek API Docs',
        siteIcon: icon('api-docs.deepseek.com'),
        pageAge: '2026-11-02T00:00:00+00:00',
      },
    ],
  },
  postSearchThinking: `搜索结果确认了几点：V4.1 是 2026 年 10 月发布；Flash 支持识图，Pro 不支持；上下文 1M、输出 384K；思考模式默认开启，并且新增了 effort 三档。
另外发现官方把"应用端能力"（搜索、读链接、文件解析、语音）直接做进了 API，这对 App 开发是最有价值的变化。
组织答案时应该先给结论，再用表格对比两个模型，最后讲应用层能力，因为用户问"新特性"大概率是想判断要不要迁移。`,
  answer: searchV41,
}

const WEATHER: MockScenario = {
  id: 'weather',
  title: '北京今天天气怎么样',
  thinking: `用户问天气，属于强时效性问题，必须联网。今天的日期按系统时间是 11 月 18 日。
需要查北京今日与未来三天预报，重点关注气温、降水和风力，因为用户通常还想知道"穿什么、要不要带伞"。`,
  search: {
    kind: 'search',
    queries: ['北京今天天气 11月18日', '北京未来三天天气预报'],
    sources: [
      {
        title: '北京天气预报：今日晴，最高气温 12℃',
        url: 'https://www.weather.com.cn/weather/101010100.shtml',
        snippet: '北京今天白天晴，最高气温 12℃，最低气温 3℃，西北风 3 级，空气质量良…',
        siteName: '中国天气网',
        siteIcon: icon('weather.com.cn'),
        pageAge: '2026-11-18T00:20:00+00:00',
      },
      {
        title: '北京市气象台：未来三天以晴到多云为主，无降水',
        url: 'https://www.bjmb.gov.cn/news/20261118.html',
        snippet: '预计未来三天北京市以晴到多云天气为主，气温缓慢回升，昼夜温差较大，请注意保暖…',
        siteName: '北京市气象局',
        siteIcon: icon('bjmb.gov.cn'),
        pageAge: '2026-11-18T01:10:00+00:00',
      },
    ],
  },
  postSearchThinking: `拿到了今天的实况和未来三天预报。信息足够直接回答，不需要再读链接。
给出建议时要具体：温差接近 10℃，湿度低，无降水——可以对应到"穿搭、加湿、洗车"三个可执行的动作。`,
  answer: weather,
}

const CODE: MockScenario = {
  id: 'code',
  title: 'React 里怎么处理流式响应',
  thinking: `用户想要流式响应的实现。关键词是 SSE、ReadableStream、React。
这类问题的价值不在"能跑"，而在"能不能上生产"，所以除了主实现，应该点出几个真实会踩的坑：
1. 网络分块和 SSE 帧不对齐，必须先攒够空行再解析；
2. TextDecoder 必须带 stream: true，否则中文跨块会乱码；
3. buffer 放闭包变量而不是 state，避免每 chunk 一次渲染；
4. 卸载时必须 cancel reader，否则连接不断、服务端继续计费。
按"实现 → 坑点 → 可选增强"的结构组织，代码用 TS 写，方便直接抄。`,
  answer: code,
}

const MATH: MockScenario = {
  id: 'math',
  title: '求函数的单调区间与极值',
  thinking: `这是一个标准的一元三次函数单调性题目。步骤很清楚：
1. 求一阶导找驻点；
2. 用二阶导判断极值类型；
3. 列表给出各区间单调性；
4. 算出极值。
需要注意区间端点不能用等号，极值点要明确是极大还是极小。最后把结论框起来方便阅读。
另外顺手验证两端趋势，作为自检。`,
  answer: math,
}

const MERMAID: MockScenario = {
  id: 'mermaid',
  title: '流式聊天架构怎么设计',
  thinking: `用户想看架构设计。用图比用文字更清楚，所以应该给 Mermaid 流程图。
重点是要讲清"服务端工具"这个边界——搜索和读链接都在服务端执行，客户端只负责渲染结构化块。
再补一个块累加器的状态机，因为这是实现时最容易写错的地方（思考会出现多次，必须按 index 维护块数组）。`,
  answer: mermaid,
}

const VISION_SCENARIO: MockScenario = {
  id: 'vision',
  title: '图片内容分析',
  thinking: `用户上传了图片。按照多模态的流程，应该先描述画面主体，再给出可落地的后续动作。
考虑到演示模式的限制，描述会偏通用，但结构和真实识图回答保持一致：主体 → 构图/色调 → 可提取信息 → 后续建议。
要提醒用户当前是演示模式，避免误导。`,
  answer: vision,
}

const DOCUMENT_SCENARIO: MockScenario = {
  id: 'document',
  title: '文档摘要与要点提取',
  thinking: `用户上传了文档，需要读文档回答。文档问答的正确结构是：先说文档在讲什么（整体），再列关键要点（分点），然后指出值得注意的细节，最后给出可继续的动作。
如果文档很长，要点控制在 5 条以内，避免信息过载。
需要说明演示模式不会真的解析文件。`,
  answer: documentContent,
}

const WELCOME_SCENARIO: MockScenario = {
  id: 'welcome',
  title: '你好',
  thinking: `用户打了个招呼，先要做自我介绍，然后主动展示能力边界，降低用户的探索成本。
这个 App 是演示模式，必须说清楚，否则用户会以为模型真的在回答。
最好给出可直接尝试的示例问题。`,
  answer: welcome,
}

const GENERAL_SCENARIO: MockScenario = {
  id: 'general',
  title: '新的对话',
  thinking: `这个问题比较开放，没有明确的时效性，也不涉及计算或代码，不需要联网。
回答策略：先给结论，再拆解成几个可操作的角度，最后用一个表格总结常见误区，避免空泛。
结尾给出继续深入的方向，把选择权交回用户。`,
  answer: general,
}

export const SCENARIOS: MockScenario[] = [
  V41,
  WEATHER,
  CODE,
  MATH,
  MERMAID,
  VISION_SCENARIO,
  DOCUMENT_SCENARIO,
  WELCOME_SCENARIO,
  GENERAL_SCENARIO,
]

/* ------------------------------------------------------------------ */
/*  Selection                                                         */
/* ------------------------------------------------------------------ */

export interface ScenarioInput {
  text: string
  hasImage?: boolean
  hasDocument?: boolean
}

const has = (text: string, re: RegExp) => re.test(text)

/** Pick the most fitting canned scenario for a user turn. */
export function pickScenario(input: ScenarioInput): MockScenario {
  const t = (input.text || '').trim()

  // Attachments win: they change the shape of the answer entirely.
  if (input.hasImage) return VISION_SCENARIO
  if (input.hasDocument) return DOCUMENT_SCENARIO

  if (has(t, /v4\.?1|新特性|新功能|更新了什么|发布说明|升级公告|changelog/i)) return V41
  if (has(t, /天气|气温|下雨|降温|温度|weather|穿衣/i)) return WEATHER
  if (has(t, /数学|求导|导数|极值|单调|方程|证明|积分|不等式|函数|latex|公式/i)) return MATH
  if (has(t, /架构|流程图|mermaid|状态机|时序图|系统设计|怎么设计|技术方案/i)) return MERMAID
  if (
    has(t, /代码|写一个|实现|hook|react|sse|stream|函数式|报错|bug|编程|typescript|javascript/i)
  ) {
    return CODE
  }
  if (has(t, /你好|您好|hi\b|hello|嗨|在吗|你是谁|能做什么|介绍一下你/i)) return WELCOME_SCENARIO
  if (!t) return WELCOME_SCENARIO
  return GENERAL_SCENARIO
}
