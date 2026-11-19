# DeepSeek 开放平台 · APP 端全套能力 API 技术参考

> **用途**：本文档是开发「类官方 DeepSeek App」的**逐字段可实现**参考。所有字段名、枚举值、事件名、错误文案均**逐字照抄官方文档**（英文原文，不做意译）。
> **抓取来源**：`https://api-docs.deepseek.com`（英文版，`.md` 纯文本接口），抓取时间 2026-11-18。
> **标注约定**：
> - 「文档未覆盖」= 官方页面没有给出该信息，本文不做推测。
> - 「示意」= JSON 结构由本文根据文档字段表拼装，字段名严格照抄，用于说明形状。
> - 所有 `→` 表示响应中的取值/去向。

---

## 目录

1. [总览：端点、协议、鉴权、模型](#1-总览端点协议鉴权模型)
2. [三协议差异速查（选型用）](#2-三协议差异速查选型用)
3. [Chat Completions API（主协议）](#3-chat-completions-api主协议)
4. [思考模式 thinking_mode（三协议切换）](#4-思考模式-thinking_mode三协议切换)
5. [Web 工具：deepseek_web_search / deepseek_read_url](#5-web-工具deepseek_web_search--deepseek_read_url)
6. [Vision 图片输入](#6-vision-图片输入)
7. [Files API 文件上传](#7-files-api-文件上传)
8. [File Parsing 文档解析（PDF/Word/PPT）](#8-file-parsing-文档解析pdfwordppt)
9. [OCR](#9-ocr)
10. [TTS 语音合成](#10-tts-语音合成)
11. [ASR 语音识别](#11-asr-语音识别)
12. [safety_check 内容安全](#12-safety_check-内容安全)
13. [Conversation Title 标题生成](#13-conversation-title-标题生成)
14. [latest_reminder 用户元数据标记](#14-latest_reminder-用户元数据标记)
15. [Context Caching（kv_cache）计费字段](#15-context-cachingkv_cache计费字段)
16. [JSON Output（json_mode）](#16-json-outputjson_mode)
17. [Tool Calls（函数调用 / strict 模式）](#17-tool-calls函数调用--strict-模式)
18. [错误码](#18-错误码)
19. [限流与隔离](#19-限流与隔离)
20. [Responses API 摘要](#20-responses-api-摘要)
21. [Messages API（Anthropic 格式）摘要](#21-messages-apianthropic-格式摘要)
22. [技术选型建议](#22-技术选型建议)
23. [附录：抓取来源清单 / 未覆盖项](#23-附录抓取来源清单--未覆盖项)

---

## 1. 总览：端点、协议、鉴权、模型

### 1.1 Base URL 与端点

| 协议 | Base URL | 端点（完整 URL） | 鉴权头 |
|---|---|---|---|
| Chat Completions（OpenAI 兼容） | `https://api.deepseek.com` | `POST https://api.deepseek.com/chat/completions` | `Authorization: Bearer <API_KEY>` |
| Chat Completions（Beta，续写/strict 用） | `https://api.deepseek.com/beta` | `POST https://api.deepseek.com/beta/chat/completions` | 同上 |
| Responses（OpenAI 兼容） | `https://api.deepseek.com` | `POST https://api.deepseek.com/responses` | 同上 |
| Messages（Anthropic 兼容） | `https://api.deepseek.com/anthropic` | `POST https://api.deepseek.com/anthropic/v1/messages`（直接 HTTP 亦可用 `/anthropic/messages`） | `x-api-key: <API_KEY>` 或 `Authorization: Bearer <API_KEY>`（两者都给时 **`Authorization` 优先**） |
| Files API（OpenAI 兼容） | `https://api.deepseek.com` | `POST /files`、`GET /files`、`GET /files/{file_id}`、`DELETE /files/{file_id}` | `Authorization: Bearer` |
| Files API（Anthropic 兼容） | `https://api.deepseek.com/anthropic` | `POST /anthropic/v1/files` 等 | `x-api-key` + **必须** `anthropic-beta: files-api-2025-04-14` |
| OCR | — | `POST https://api.deepseek.com/v1/tools/ocr` | `Authorization: Bearer` |
| TTS（全文） | — | `POST https://api.deepseek.com/v1/tools/tts` | `Authorization: Bearer` |
| TTS（流式） | — | `wss://api.deepseek.com/v1/tools/tts` | 头 `Authorization: Bearer` 或子协议 `Sec-WebSocket-Protocol: tts, bearer.<API key>` |
| ASR | — | `POST https://api.deepseek.com/v1/tools/asr` | `Authorization: Bearer` |

> **坑**：OCR/TTS/ASR 的路径里带 `/v1`，而 chat 系列**不带** `/v1`（`/chat/completions` 不是 `/v1/chat/completions`；但 `/anthropic/v1/messages` 带）。混用会 404。

### 1.2 模型

| | `deepseek-flash` | `deepseek-v4-pro` |
|---|---|---|
| 模型版本 | DeepSeek-V4.1-Flash-1017 | DeepSeek-V4-Pro-0813 |
| 思考模式 | 支持非思考 / 思考（**默认思考**） | 同左 |
| 上下文长度 | 1M | 1M |
| 最大输出 | 384K | 384K |
| Vision | ✓ | **不支持** |
| JSON Output / Tool Calls / Responses API / Anthropic API / Chat Prefix Completion(Beta) | ✓ | ✓ |
| FIM Completion(Beta) | 仅非思考模式 | 仅非思考模式 |
| 并发上限（账号级） | 2500 | 500 |

- `model` 在 Chat Completions 中是枚举：`["deepseek-flash","deepseek-v4-pro"]`。
- 旧模型名 `deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` **仍被接受**，但对应模型已下线，请求由最新 Flash 模型（V4.1-Flash-1017）服务并按 Flash 价格计费。
- Anthropic 协议下 `claude-opus*` 名字映射到 `deepseek-v4-pro`，其他 `claude*` 映射到 `deepseek-flash`；**不以 `claude` 开头的未知模型名返回 400**。

### 1.3 `max_tokens` / `max_output_tokens` 默认值

| 模式 | 默认上限 |
|---|---|
| 非思考模式 | 8K |
| 思考模式 | 64K |
| 思考模式 + `reasoning_effort=max` | 128K |
| 允许填写范围 | 1 – 384K（393216） |

> **坑（严重）**：声明了 web 工具 / `safety_check=high` / `title` 时，`max_tokens` **限制的是「每一轮推理步（inference step）」的输出**，不是整轮响应总输出。一次带搜索的响应有多个 step，实际输出可能远超 `max_tokens`。

### 1.4 通用请求约定

- `Content-Type: application/json`（Files/OCR/ASR 用 `multipart/form-data`）。
- `stop` / `stop_sequences`：最多 **16** 条，每条非空、≤ **512 字节**（UTF-8）。
- 全部为**无状态 API**：每轮必须发送完整历史。
- **Keep-Alive 机制**：请求等待期间，非流式请求会持续返回**空行**，流式请求会持续返回 SSE 注释 `: keep-alive`。解析时必须容忍。**若 10 分钟内未开始推理，服务端会关闭连接**。

---

## 2. 三协议差异速查（选型用）

| 能力 | Chat Completions | Responses | Messages (Anthropic) |
|---|---|---|---|
| 端点 | `/chat/completions` | `/responses` | `/anthropic/v1/messages` |
| 流式终止 | `data: [DONE]` | **无** `[DONE]`，终于 `response.completed`/`incomplete`/`failed` | **无** `[DONE]`，终于 `message_stop` |
| SSE 形态 | data-only，单一 `object: chat.completion.chunk` | 30+ 具名事件（`response.*`）+ `sequence_number` | 具名事件 `message_start`/`content_block_*`/`message_delta`/`message_stop` + `ping` |
| 思考内容位置 | `delta.reasoning_content` / `message.reasoning_content` | `reasoning` output item（`response.reasoning_text.delta`） | `thinking` content block（`thinking_delta` + `signature_delta`） |
| 思考开关 | `thinking:{type}` / `reasoning_effort` | `reasoning:{effort}` | `thinking:{type}` / `output_config:{effort}` |
| Web 工具声明 | `{"type":"deepseek_web_search"}` / `{"type":"deepseek_read_url"}` | 同 Chat Completions（无 `name`） | `{"type":"deepseek_web_search","name":"deepseek_web_search"}`（需同时给 `type` 与 `name`） |
| 搜索进度流式事件 | `server_tool_event`（`step_reasoning_done`/`call_started`/`call_completed`） | `response.web_search_call.in_progress/searching/completed` | **无独立进度事件**；块整体在 `content_block_start` 一次性到达 |
| 引用数据 | `message.annotations`（`url_citation` + `start_index/end_index`） | `url_citation` annotations（`start_index/end_index`，按 Unicode code point） | `text` 块上的 `citations`；流式用 `citations_delta`（**可实时渲染**） |
| 引用是否可流式实时拿 | **否**，只在最后一个 chunk 一次性给 | 是（`response.output_text.annotation.added`） | **是**（`citations_delta`） |
| `title` 返回位置 | `message.title` / 最后一个 chunk 的 `delta.title` | 顶层 `title` / 终态事件的 `response.title` | 顶层 `title` / `message_delta` 的 `delta.title` |
| `latest_reminder` | ✓ | **✗（不接受）** | ✓ |
| `safety_check` | ✓ | ✓ | ✓ |
| 文件（PDF 等）引用块 | `{"type":"file","file_id":...}` | `{"type":"input_file","file_id":...}` | `{"type":"document","source":{"type":"file","file_id":...}}` + 头 `anthropic-beta: files-api-2025-04-14` |
| 图片引用块 | `{"type":"image_url","image_url":{url,detail}}` | `{"type":"input_image",image_url/detail}` | `{"type":"image","source":{"type":"base64\|url\|file",...}}` |
| 断线续写（continue） | 仅 Beta 端点 + 最后一条 assistant 设 `prefix:true` | **不支持** | 支持（末条 assistant 直接给部分内容） |
| 会话中插入 tool call | **不支持**（只支持插 `system`） | 支持 | 支持 |
| thoughting 模式下强制 tool_choice | `required` / 具名 → **400** | `required` 视为 `auto` | `any` 在声明 server tool 时视为 `auto`、仅客户端工具时 400；具名 tool 在思考模式 400 |
| 未知/不支持参数 | 通常 400（如声明 web tools 时 `web_search_options`→400、`logprobs`→400） | **静默忽略** | 大量字段"忽略"（见 §21） |
| 生成中失败 | 最后一个 chunk 带 `error`、`choices` 为空、**无** `[DONE]`；非流式 body 为 `{"error":...,"usage":...}` | 流式 `response.failed`；非流式 `status: failed`、`error.code: server_error` | 流式以 `error` 事件结尾、之后无 `message_delta`/`message_stop`；非流式 body `{"type":"error",...}` |
| 主要定位 | OpenAI 生态主协议、App 首选之一 | Codex 生态 | Claude Code / Anthropic 生态；块模型最完整 |

---

## 3. Chat Completions API（主协议）

### 3.1 创建对话补全

```http
POST https://api.deepseek.com/chat/completions
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

**最小请求体**

```json
{
  "model": "deepseek-flash",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello"}
  ],
  "stream": false
}
```

### 3.2 请求参数（完整表）

| 字段 | 必填 | 类型 | 取值 / 说明 |
|---|---|---|---|
| `model` | 是 | string | enum `["deepseek-flash","deepseek-v4-pro"]` |
| `messages` | 是 | array | minItems 1；元素见 §3.3 |
| `thinking` | 否 | object \| null | `{"type":"enabled"\|"disabled"}`，`type` 必填。省略或 `null` 时由 `reasoning_effort` 决定；两者都省略 → **思考开启**。给了 `thinking` 对象时 `type` **优先于** `reasoning_effort` |
| `reasoning_effort` | 否 | string | enum `["none","low","high","max"]`；`none` 关思考，`low/high/max` 开思考，默认 `high`。兼容别名：`minimal`→`low`，`medium`/`xhigh`→`high` |
| `max_tokens` | 否 | integer \| null | 1–393216（384K）；默认见 §1.3 |
| `response_format` | 否 | object \| null | `{"type":"text"\|"json_object"}`，`type` 必填；JSON 模式见 §16 |
| `stop` | 否 | string \| array \| null | 最多 16 条，每条 ≤512 字节 |
| `stream` | 否 | boolean \| null | 默认 `false`；`true` 时返回 data-only SSE，以 `data: [DONE]` 结束 |
| `stream_options` | 否 | object | 文档引用 `ChatCompletionStreamOptions`，**未给出字段表（文档未覆盖）**。注意：**即使不传，`usage` 也会出现在最后一个 chunk** |
| `temperature` | 否 | number \| null | 0–2，默认 1；**思考模式下无效** |
| `top_p` | 否 | number \| null | >0 且 ≤1；行为依赖模型：<br>`deepseek-flash`：思考模式默认 1.0，**低于 0.95 一律按 0.95**；非思考模式固定 1.0，忽略传值。<br>`deepseek-v4-pro`：思考模式忽略传值（启用工具调用时固定 0.95，否则 1.0）；非思考模式生效，默认 1.0 |
| `tools` | 否 | array \| null | 元素为 `ChatCompletionTool`（function）或 `{"type":"deepseek_web_search"}` 或 `{"type":"deepseek_read_url"}`；**工具名必须唯一** |
| `tool_choice` | 否 | string \| object \| null | `none` / `auto` / `required` / `{"type":"function","function":{"name":...}}`。无 tools 时默认 `none`，有 tools 时默认 `auto`。**`required` 与具名在思考模式下返回 400**；声明 web 工具时 `required` 视为 `auto` |
| `safety_check` | 否 | object \| null | `{"level":"low"\|"high"}`，`level` 必填；`low` 等同省略（DeepSeek 扩展） |
| `title` | 否 | object \| null | `{"enabled": true}`，`enabled` 必填（DeepSeek 扩展） |
| `logprobs` | 否 | boolean | 默认 `false`；返回 `content` 的 token log 概率 |
| `top_logprobs` | 否 | integer | 0–20；`logprobs` 必须为 `true` |
| `user_id` | 否 | string \| null | 建议仅 ASCII 字母/数字/`_`/`-`，UTF-8 ≤512 字节；用于内容安全、KVCache 隔离、调度隔离 |
| `frequency_penalty` | 否 | — | **已废弃**（`deprecated: true`），传了也不生效 |
| `presence_penalty` | 否 | — | **已废弃**，传了也不生效 |

> **OpenAI SDK 写法**：`thinking`、`user_id` 是 DeepSeek 扩展字段，SDK 中必须放进 `extra_body`：
> ```python
> client.chat.completions.create(
>     model="deepseek-flash",
>     messages=[...],
>     reasoning_effort="high",
>     extra_body={"thinking": {"type": "enabled"}, "user_id": "u_123"},
> )
> ```

### 3.3 `messages` 元素类型

| role | 关键字段 | 说明 |
|---|---|---|
| `system` | `content`(string, 必填)、`name`(可选) | |
| `user` | `content`(string 或 content part 数组, 必填)、`name` | content part 见下 |
| `assistant` | `content`(string \| null, 必填)、`name`、`prefix`(Beta，需 `/beta` base_url，强制以该前缀开头)、`reasoning_content`(Beta，Chat Prefix Completion 用，需 `prefix:true`)、`server_tool_calls`(原样回传) | `content` 可为 `null`（例如仅有 tool_calls 的一轮） |
| `tool` | `content`(string 或 content part 数组, 必填)、`tool_call_id`(必填) | 图片可放在 tool 消息里 |
| `latest_reminder` | `content`(string, 必填) | DeepSeek 扩展，见 §14。**必须紧跟在它所属的 `user` 消息之前，放在别处返回 400** |

**content part（`ChatCompletionRequestContentPart`）三种：**

```json
{"type": "text", "text": "What is in this image?"}
{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,<B64>", "detail": "low"}}
{"type": "file", "file_id": "file-api-xxxxxxxxxxxxxxxx"}
```

- `image_url.url`：`http(s)` 链接（≤8192 字符）或 base64 data URL（`data:image/jpeg;base64,...`）。格式：**JPEG/PNG/GIF/WebP**。
- `image_url.detail`：enum `["low","high","original","auto"]`。
- `file` 块：`file_id` 与 `file_data` **二者必须恰好给一个**（都不给 400 `"file must have a file_id or file_data"`，都给 400 `"file cannot have both file_id and file_data"`）；`filename` 只能与 `file_data` 同用。

### 3.4 非流式响应结构

```json
{
  "id": "88beaa90-17fd-45fc-939c-2ef75e2d913c",
  "object": "chat.completion",
  "created": 1793084842,
  "model": "deepseek-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! 👋 How can I help you today?"
      },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 7,
    "completion_tokens": 11,
    "total_tokens": 18,
    "prompt_tokens_details": {"cached_tokens": 0},
    "prompt_cache_hit_tokens": 0,
    "prompt_cache_miss_tokens": 7
  },
  "system_fingerprint": "e72d3c7f663d3e1383b00b3884cb4501"
}
```

**`choices[].message` 字段（`ChatCompletionResponseMessage`）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `content` | string \| null | 必填。思考模式下只含**最终答案** |
| `reasoning_content` | string \| null | **仅思考模式**。最终答案之前的思维链（CoT） |
| `tool_calls` | array | 模型生成的函数调用 |
| `role` | string | 恒为 `"assistant"` |
| `annotations` | array | **声明 web 工具时**：`content` 中的引用。元素 `{"type":"url_citation","url_citation":{"url","title","start_index","end_index"}}` |
| `server_tool_calls` | array | **声明 web 工具时**：服务端工具调用，**每个 step 一条**，下一次请求必须原样回传 |
| `title` | string | `title.enabled=true` 时的会话标题 |
| `refusal` | string | 请求中的图片未通过内容安全审核时，**点名被拦的图片** |

**`finish_reason` 枚举（逐字）**：`stop` / `length` / `content_filter` / `tool_calls` / `insufficient_system_resource` / `aborted`
（含义：`insufficient_system_resource` = 推理系统资源不足导致中断；`aborted` = 生成被中断。）

**`usage` 字段**（`CompletionUsage`，除标注外均必填）

| 字段 | 说明 |
|---|---|
| `prompt_tokens` | = `prompt_cache_hit_tokens` + `prompt_cache_miss_tokens` |
| `completion_tokens` | 生成的总 token |
| `total_tokens` | prompt + completion |
| `prompt_tokens_details.cached_tokens` | 命中上下文缓存的 prompt token，等同 `prompt_cache_hit_tokens` |
| `prompt_cache_hit_tokens` | 命中上下文缓存的输入 token |
| `prompt_cache_miss_tokens` | 未命中缓存（全价）的输入 token |
| `completion_tokens_details.reasoning_tokens` | 思考产生的 token |
| `completion_tokens_details.safety_tokens` | **DeepSeek 扩展**，安全审核消耗的 token，**已包含在 `completion_tokens` 内**，仅 `safety_check=high` 时出现 |
| `usage.server_tool_use` | **声明 web 工具且计数非零时出现**：`tool_search`（搜索数，不含图片搜索）、`tool_fetch`（页面抓取数）、`tool_image_search`（图片搜索数） |

### 3.5 流式响应（SSE）

- 每帧格式：`data: <json>\n\n`，`object` 恒为 `"chat.completion.chunk"`；**最后一个数据帧后是 `data: [DONE]`**。
- 所有 chunk 的 `id` / `created` 相同。
- `usage` 在**最后一个 chunk** 才有值（在此之前为 `null`）。

```
data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}],"usage":null}

data: {"id":"071f229d-daa0-4557-a580-106a22e8df73","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"e72d3c7f663d3e1383b00b3884cb4501","choices":[{"index":0,"delta":{"content":"Hello"},"logprobs":null,"finish_reason":null}],"usage":null}

...（略）...

data: {"id":"071f229d-...","object":"chat.completion.chunk","created":1793084907,"model":"deepseek-flash","system_fingerprint":"...","choices":[{"index":0,"delta":{"content":""},"logprobs":null,"finish_reason":"stop"}],"usage":{"prompt_tokens":7,"completion_tokens":11,"total_tokens":18,"prompt_tokens_details":{"cached_tokens":0},"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":7}}

data: [DONE]
```

**`choices[]` 的流式字段**

| 字段 | 说明 |
|---|---|
| `delta` | 见下表 |
| `server_tool_event` | **DeepSeek 扩展**（声明 web 工具时）。服务端工具调用进度，**一个 chunk 最多一个事件**。是 choice 上与 `delta` 平级的字段 |
| `logprobs` | 可选，结构同非流式 |
| `finish_reason` | 可为 `null`；枚举同 §3.4 |
| `index` | 恒 0（单候选） |

**`delta` 字段（`ChatCompletionStreamResponseDelta`）**

| 字段 | 说明 |
|---|---|
| `content` | string \| null，答案增量 |
| `reasoning_content` | string \| null，**思考增量**（与 `content` 互斥地推进） |
| `role` | 首个 chunk 出现 `"assistant"` |
| `tool_calls` | 函数调用增量：**每个 call 的首个 chunk 带 `id`、`type`、`function`，后续 chunk 只带 `function.arguments`**；元素含 `index` |
| `annotations` | **流式时只在最后一个 chunk 一次性发送** |
| `server_tool_calls` | **流式时只在最后一个 chunk 一次性发送**（含 `signature`） |
| `title` | **最后一个 chunk** 的 `delta.title` |
| `refusal` | **最后一个 chunk** 的 `delta.refusal` |

**`server_tool_event` 事件类型（逐字，DeepSeek 扩展）**

| `type` | 携带字段 | 含义 |
|---|---|---|
| `step_reasoning_done` | `step` | 第 `step` 步的思考已完成：在此事件之前流出的思考、尚未归属的，都属于该 step。每步发一次，在该步首个 call 之前 |
| `call_started` | `step`、`call` | 该步某个 call 开始，`call` 带完整 `action` |
| `call_completed` | `step`、`call` | 该 call 结束，`call` 带 `status` 与 `sources` / `page` / `error`，**但不带 `signature`** |

> **示意（字段名照抄文档，原始 chunk 全文官方未给出）**：
> ```json
> {"id":"...","object":"chat.completion.chunk","choices":[{"index":0,
>   "delta":{"role":"assistant","content":""},
>   "server_tool_event":{"type":"call_started","step":0,
>     "call":{"index":0,"id":"srvtoolu_s_00_...","type":"deepseek_web_search","kind":"search",
>             "action":{"type":"search","queries":["DeepSeek V4.1"]},
>             "status":"completed"}},
>   "finish_reason":null}],"usage":null}
> ```

### 3.6 生成中途失败（HTTP 已是 200）

- **流式**：最后一个 chunk 携带 `error`，`choices` 为空，且**之后没有 `[DONE]`**。
- **非流式**：body 为 `{"error": {...}, "usage": {...}}`。
- 因为 HTTP 状态是 `200`，**SDK 不会抛异常**，必须自己检查 body 里有没有 `error`。

### 3.7 续写（Continue Generation）

```
POST https://api.deepseek.com/beta/chat/completions
{"model":"deepseek-flash","messages":[{"role":"user","content":"..."},{"role":"assistant","content":"The autumn wind rises,","prefix":true}]}
```
- 只有 Beta 端点 + 最后一条 assistant 的 `prefix: true` 才支持；返回**只有新增部分**。
- **用过 `deepseek_web_search` / `deepseek_read_url` 的回复无法续写，返回 400**，只能重发上一个请求。

---

## 4. 思考模式 thinking_mode（三协议切换）

### 4.1 开关与档位对照（官方原表）

| | OpenAI 格式控制参数 | Anthropic 格式控制参数 | Responses API 格式控制参数 |
|---|---|---|---|
| 思考开关(1) | `{"thinking": {"type": "enabled/disabled"}}` | `{"thinking": {"type": "enabled/disabled"}}` | `{"reasoning": {"effort": "none/low/high/max"}}` / `none` 关闭思考 |
| 思考强度 | `{"reasoning_effort": "low/high/max"}` | `{"output_config": {"effort": "low/high/max"}}` | `{"reasoning": {"effort": "none/low/high/max"}}` |

(1) **思考模式默认开启**，默认 effort 为 `high`。

**effort 映射表（逐字）**

| 请求值 | 实际映射 |
|---|---|
| `minimal` | `low` |
| `low` | `low` |
| `medium` | `high` |
| `high` | `high` |
| `xhigh` | `high` |
| `max` | `max` |
| `ultra` | `max` |

补充精度：
- Chat Completions 的 `reasoning_effort` **枚举是** `["none","low","high","max"]`（`minimal`/`medium`/`xhigh` 仅为"接受并映射"的兼容值）。
- Messages 的 `output_config.effort` 枚举为 `["none","minimal","low","medium","high","xhigh","ultra","max",null]`；`thinking.type` 显式给出时决定开关。
- Messages 的 `thinking.type` 枚举为 `["enabled","disabled","adaptive"]`，**`adaptive` 视为 `enabled`**；`budget_tokens` **被忽略**（不设思考预算）。
- OpenAI SDK 设 `thinking` 必须走 `extra_body={"thinking": {"type": "enabled"}}`。

### 4.2 思考模式下的采样参数（必读）

- `temperature`、`presence_penalty`、`frequency_penalty` **不支持**。为了兼容老代码，**传了不报错，但完全无效**。
- `top_p` 按模型分流（见 §3.2）。简记：
  - `deepseek-flash`：**只有思考模式生效**，有效区间 `0.95–1.0`，低于 0.95 按 0.95；非思考模式固定 1.0，传值被忽略。
  - `deepseek-v4-pro`：**思考模式忽略传值**（启用工具调用时固定 0.95，否则 1.0）；**非思考模式生效**。把 `tool_choice` 设为 `none` 可在传了 `tools` 的情况下也关闭工具调用。
- Messages 侧补充：`temperature` 有效区间 `[0.0, 2.0]`，非思考模式生效、思考模式**固定 1.0**。

### 4.3 `reasoning_content` 是否需要回传（决定 App 的会话存储模型）

| 场景 | 是否回传 | 后果 |
|---|---|---|
| 请求**带** `tools` | **必须回传**（所有历史轮次的 `reasoning_content`） | 不回传 → **400** |
| 请求**不带** `tools` | **不需要**；即使传了也会被**忽略**，不会拼进上下文 | 多轮时历史 CoT 不进入上下文 |

- 官方示例里 `messages.append(response.choices[0].message)` 等价于 append `{role, content, reasoning_content, tool_calls}` 四件套。**推荐直接 append 整个 message 对象**，避免漏字段。
- **声明了 web 工具时的情况**：`message.reasoning_content` **只保留最后一个 step 的思考**；更早 step 的思考在各 `server_tool_calls[].reasoning_content` 里。所以「带 web 工具」时必须整条 message（含 `server_tool_calls`）原样回传。

### 4.4 流式取 CoT（官方示例逻辑）

```python
reasoning_content = ""
content = ""
for chunk in response:
    if chunk.choices[0].delta.reasoning_content:
        reasoning_content += chunk.choices[0].delta.reasoning_content
    else:
        content += chunk.choices[0].delta.content
```

- Messages：`thinking` 块的 `content_block_start` 形如
  `{"type":"thinking","thinking":"","signature":""}` → `thinking_delta`（`delta.thinking`）→ **`signature_delta`（`delta.signature`）** → `content_block_stop`。`signature` 是思考块的签名，回传时必须保留（输入侧不校验）。
- Responses：思考是 `reasoning` output item，`reasoning_text` 内容、`summary` 为空、**没有 `encrypted_content`**。

### 4.5 思考 + 工具调用的官方循环（Chat Completions）

1. 请求带 `tools` 与思考开启。
2. 循环：取 `response.choices[0].message` → **原样 append 到 messages** → 若 `tool_calls` 为 `None` 则结束 → 否则逐个执行，append `{"role":"tool","tool_call_id":<tool.id>,"content":<result>}`。
3. 下一轮用户提问时，**仍然把之前所有轮次的 `reasoning_content` 一起发**。

---

## 5. Web 工具：deepseek_web_search / deepseek_read_url

> 这两个能力**全部在服务端执行**，客户端不执行任何工具。用 `deepseek-flash`。设计目标是"做聊天机器人"；若要在自己的 agent/代码里搜索，官方另提供 Search & Fetch API（本文不展开）。

### 5.1 能力矩阵

| 能力 | 开启方式 | 行为 |
|---|---|---|
| Web search | 声明 `deepseek_web_search`，**思考关闭** | 模型按需搜索，带引用作答 |
| Deep thinking search | 声明 `deepseek_web_search`，**思考开启** | 多步推理中自行搜索、打开页面、页内查找、核对事实 |
| URL reading | 声明 `deepseek_read_url` | 从最后一条用户消息中找链接，抓取后作答 |

### 5.2 三协议声明方式（完整可跑 curl）

**Messages**
```bash
curl https://api.deepseek.com/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${DEEPSEEK_API_KEY}" \
  -d '{
    "model": "deepseek-flash",
    "thinking": {"type": "enabled"},
    "tools": [
      {"type": "deepseek_web_search", "name": "deepseek_web_search"},
      {"type": "deepseek_read_url", "name": "deepseek_read_url"}
    ],
    "messages": [{"role": "user", "content": "What is new in DeepSeek V4.1?"}],
    "stream": true
  }'
```

**Responses**
```bash
curl https://api.deepseek.com/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
    "model": "deepseek-flash",
    "reasoning": {"effort": "high"},
    "tools": [
      {"type": "deepseek_web_search"},
      {"type": "deepseek_read_url"}
    ],
    "input": "What is new in DeepSeek V4.1?",
    "stream": true
  }'
```

**Chat Completions**
```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
    "model": "deepseek-flash",
    "thinking": {"type": "enabled"},
    "tools": [
      {"type": "deepseek_web_search"},
      {"type": "deepseek_read_url"}
    ],
    "messages": [{"role": "user", "content": "What is new in DeepSeek V4.1?"}],
    "stream": true
  }'
```

**硬约束**
- 只想读链接、不要搜索：**只**声明 `deepseek_read_url`。
- `tool_choice` **不能**点名 `deepseek_web_search` / `deepseek_read_url`，否则 **400**。搜不搜、读不读由模型决定。
- `tool_choice: "none"` 会**连带关闭 URL reading**（所有工具都关）。
- 工具重复声明 → 400：``tools: `deepseek_web_search` can only be declared once``
- 与其他 server tool 混用 → 400：``tools: other tools cannot be used together with `deepseek_web_search`, `deepseek_read_url`, `safety_check` or `title` yet``
- 不支持 `allowed_domains` / `blocked_domains` / `user_location` → 400（不支持的只是这些字段，不是整个工具）

### 5.3 搜索行为细节

- **一次搜索**可包含多个 query，全部列在 `input.queries`。
- 每次搜索产出一个 `server_tool_use` 块（`input.action` + `kind` 均为 `search`），随后跟一个 `web_search_tool_result` 块；答案用 `citations` 标注来源。
- **深度思考搜索（thinking 开启）**：模型在作答前最多发起约 **20** 次工具调用。`content[].input.action` 三种：

| `input.action` | 步骤 |
|---|---|
| `search` | 搜索网页 |
| `open_page` | 打开网页 |
| `find_in_page` | 在已打开的页内查找文本 |

- 深度搜索中每个 step 都是 `kind: deep_search` 的 `server_tool_use`，后跟其结果；同时发起多个时，**调用先到、结果后到**。
- 深度搜索打开的页面**只返回 url、title、publication time**：`data` 为空字符串、**没有 `signature`**。
- **图片来源**：用户消息里带图时，模型可"以图搜图"，也发生在深度思考搜索中。与普通搜索相比三点不同：`kind` 为 `image_search`（深度搜索中为 `deep_image_search`）；**没有 queries**（`queries` 为空数组）；每个结果多一个 `image_url`（原站图片地址，仅供展示，可能缺失、不保证可访问）。

### 5.4 URL 读取（read_link）规则

- **只检查最后一条 user 消息**里的 URL。重复 URL 只算一次。**最多考虑消息中前 10 个不同 URL**，读哪些由模型决定。
- **思考开启 且 声明了 `deepseek_web_search`** 时：该轮走深度思考搜索，**不会单独读链接**。只有其他情况才读链接（思考关闭，或只声明了 `deepseek_read_url`）。
- 每次读页产出 `server_tool_use`（`input.action = "read_link"`，带 `url`）+ `web_fetch_tool_result`（`kind = "read_link"`）。一次读多个时**调用先到、结果后到**。
- 结果里有 URL、title、publication date；**页面正文不返回在块里**，而是**加密存放在 `signature`**。`url`/`title`/`data`/`published_at` **仅供展示**，回传前改动**无效**。
- 一轮读多个链接时每页分到的空间更少，长页会被截断。
- 开启内容安全时，读链接结果要**通过审核后才发送**；未通过的页面返回 `url_not_allowed` 错误。

### 5.5 返回块结构（Messages 格式，最完整）

**`server_tool_use`**
```json
{
  "type": "server_tool_use",
  "id": "srvtoolu_s_00_3f2a9c...",
  "name": "deepseek_web_search",
  "input": {"action": "search", "queries": ["DeepSeek V4.1"]},
  "caller": {"type": "direct"},
  "kind": "search"
}
```

| `input.action` | `name` | 其他 `input` 字段 |
|---|---|---|
| `search` | `deepseek_web_search` | `queries`：本次调用的搜索词 |
| `open_page` | `deepseek_web_search` | `url` |
| `find_in_page` | `deepseek_web_search` | `url` 与 `pattern` |
| `read_link` | `deepseek_read_url` | `url` |

- `name` 是"启用了该能力的那个已声明工具名"，**不是** Anthropic SDK 类型里的名字，但 SDK 运行时不校验。
- `input.action` 与 `kind` 是 DeepSeek 扩展。`kind` 取值：`search`（Web 搜索）、`deep_search`（深度思考搜索）、`read_link`（URL 读取）、`image_search` / `deep_image_search`（图片搜索）。

**`web_search_tool_result`**
```json
{
  "type": "web_search_tool_result",
  "tool_use_id": "srvtoolu_s_00_3f2a9c...",
  "content": [
    {
      "type": "web_search_result",
      "title": "...",
      "url": "https://example.com/news",
      "encrypted_content": "...",
      "page_age": "2026-01-02T03:04:05+00:00",
      "snippet": "...",
      "site_name": "Example News",
      "site_icon": "https://cdn.deepseek.com/site-icons/example.com"
    }
  ],
  "kind": "search"
}
```
- `content` **可以是空数组**。搜索失败时返回 `[{"type": "web_search_tool_result_error", "error_code": "unavailable"}]`。
- `snippet` / `site_name` / `site_icon` 是 DeepSeek 扩展，用于展示；`site_name`、`site_icon` 可为 `null`；**回传时会被忽略**。
- `page_age` 是 RFC 3339 UTC 时间戳，或 `null`。
- `web_search_tool_result_error.error_code` 枚举：`invalid_tool_input` / `unavailable` / `max_uses_exceeded` / `too_many_requests` / `query_too_long` / `request_too_large`。

**`web_fetch_tool_result`**
```json
{
  "type": "web_fetch_tool_result",
  "tool_use_id": "srvtoolu_rl_01_9c1d...",
  "content": {
    "type": "web_fetch_result",
    "url": "https://example.com/a",
    "content": {
      "type": "document",
      "source": {"type": "text", "media_type": "text/plain", "data": ""},
      "title": "Page title"
    },
    "published_at": "2026-01-01"
  },
  "kind": "read_link",
  "signature": "q3J0b1RmZ1c4cE1x..."
}
```
- 正文不返回：`data` 恒为空字符串；`read_link` 的页面**加密在 `signature`** 里，**必须原样回传**才能把页面恢复到上下文。
- `published_at`：`read_link` 时是页面上找到的日期（**无固定格式**）；深度搜索打开的页面是 RFC 3339 时间戳。两者都可能为 `null`。
- 失败时 `content` 为 `{"type":"web_fetch_tool_result_error","error_code":"..."}` 且**没有 `signature`**：

| `error_code` | 含义 |
|---|---|
| `url_not_accessible` | 链接读不到 |
| `url_not_allowed` | 不允许读该链接，或页面未通过内容安全审核 |
| `unavailable` | 服务不可用、深度思考搜索中页面打不开、或调用未完成 |

**通用规则**
- 每个 call 都产出 `server_tool_use` + 结果块。**流式时两类块的内容都整体在 `content_block_start` 一次性到达，不分片**。
- 用 `tool_use_id` 把 call 与 result 配对。多个页面同时读、或开启内容安全时，**result 不一定紧跟在它的 call 后面**。**每个 call 都会有 result**：没完成的 call 结果是 `unavailable` 错误。

### 5.6 Citations

```json
{
  "type": "text",
  "text": "It is cloudy in Shanghai today.",
  "citations": [
    {
      "type": "web_search_result_location",
      "url": "https://example.com/weather",
      "title": "...",
      "encrypted_index": "",
      "cited_text": "It is cloudy in Shanghai today."
    }
  ]
}
```
- 流式中每条引用是当前 `text` 块上的一个 **`citations_delta`** 事件：`{"type":"citations_delta","citation":{...}}`。
- **一个 `text` 块一旦有了引用，后续文本会另起新的 `text` 块**，所以块的引用只属于该块自己的文本。**同一块内一个 URL 最多出现一次**。
- `type` 恒为 `web_search_result_location`（深度思考搜索打开的页面也一样）。
- **`cited_text` 是"该块到引用位置为止的答案文本"，不是从来源摘抄的原文**（与 Anthropic 官方语义不同，务必注意）。
- `encrypted_index` 恒为空字符串；`title` 可为 `null`。
- **回传时 citations 被忽略**。

### 5.7 流式事件顺序（Messages，思考开启、搜索一次）

```text
message_start
content_block_start (thinking) → thinking_delta … → signature_delta → content_block_stop
content_block_start (server_tool_use) → content_block_stop
content_block_start (web_search_tool_result) → content_block_stop
content_block_start (thinking) → thinking_delta … → signature_delta → content_block_stop
content_block_start (text) → text_delta … → citations_delta … → content_block_stop
content_block_start (text) → text_delta … → content_block_stop
message_delta
message_stop
```
- 思考开启时，`message_start` 之后立刻开一个 `thinking` 块，**模型先搜索时它可以是空的**。
- **`message_start` 里的 `usage` 只覆盖第一个推理步**；最终 usage 从 `message_delta` 读。
- 开启 `title` 时，`message_delta` 还会带会话标题。
- 没有新内容时推 `: keep-alive` 注释；非流式请求在 JSON body 之前会收到换行符。

**Stop reasons（Messages）**

| `stop_reason` | 含义 |
|---|---|
| `end_turn` | 答案完整 |
| `max_tokens` | 达到输出上限被截断；或搜索/读链接后上下文耗尽 |
| `refusal` | 内容审核拒绝，见 §12 |

### 5.8 Chat Completions 侧的返回结构（App 主协议重点）

工具调用放在扩展字段 **`message.server_tool_calls`**。每个元素是**一个 step**：该步的思考 + 该步发起的调用。

```json
{
  "role": "assistant",
  "reasoning_content": "I have enough to answer ...",
  "content": "The post is about ... The author previously worked at ...",
  "annotations": [
    {"type": "url_citation", "url_citation": {"url": "https://example.com/post", "title": "...", "start_index": 0, "end_index": 21}}
  ],
  "server_tool_calls": [
    {
      "index": 0,
      "reasoning_content": "",
      "calls": [
        {
          "index": 0,
          "id": "srvtoolu_rl_00_3f2a...",
          "type": "deepseek_read_url",
          "kind": "read_link",
          "action": {"type": "read_link", "url": "https://example.com/post"},
          "status": "completed",
          "page": {"url": "https://example.com/post", "title": "...", "published_at": "2026-01-02"},
          "signature": "q3J0b1RmZ1c4cE1x..."
        }
      ]
    },
    {
      "index": 1,
      "reasoning_content": "I have read the post. Next, the author's background ...",
      "calls": [
        {
          "index": 0,
          "id": "srvtoolu_s_01_9c41...",
          "type": "deepseek_web_search",
          "kind": "search",
          "action": {"type": "search", "queries": ["..."]},
          "status": "completed",
          "sources": [
            {"type": "url", "url": "https://example.com/news", "title": "...", "snippet": "...", "site_name": "Example News", "site_icon": "...", "published_at": "2026-01-02T03:04:05+00:00"}
          ]
        }
      ]
    }
  ]
}
```

**字段语义（逐字）**

| 层级 | 字段 | 含义 |
|---|---|---|
| Step | `index` | step 序号，从 0 开始 |
| Step | `reasoning_content` | 该步的思考。**思考开启时恒为字符串**（该步无思考时为空串）；**思考关闭时该字段被省略** |
| Step | `calls` | 该步发起的调用，按顺序 |
| Call | `index`、`id` | 步内调用序号；`id` 与其它协议同形 |
| Call | `type` | 启用该能力的已声明工具：`deepseek_web_search` 或 `deepseek_read_url` |
| Call | `kind` | `search` / `deep_search` / `read_link` / `image_search` / `deep_image_search` |
| Call | `action` | `{type:"search",queries}` / `{type:"open_page",url}` / `{type:"find_in_page",url,pattern}` / `{type:"read_link",url}` |
| Call | `status` | `completed` 或 `failed`。响应结束时仍无结果的 call 为 `failed` |
| Call | `sources` | 搜索结果，展示字段与 Responses 相同 |
| Call | `page` | 打开/读取页面的 `{url,title,published_at}`，仅供展示 |
| Call | `signature` | 加密后的页面，**仅出现在成功读取的链接上** |
| Call | `error` | 失败调用的 `{code}`，错误码同 §5.5 `web_fetch_tool_result` |

**要点**
- `message.reasoning_content` **只有最后一步的思考**；更早步骤的思考在各条 `server_tool_calls` 里。
- `content` **不含引用标记**；引用在 `message.annotations` 的 `url_citation` 项里：`start_index` / `end_index` 是 **`content` 中的 Unicode code point 下标**；`title` 未知时**等于 URL**。没有引用时该字段被省略。用 URL 去 `sources` / `page` 里匹配展示字段（标题、站点名、图标）。
- **`finish_reason`（web 工具场景）**：
  - `stop`：答案完整
  - `length`：达到输出上限被截断
  - `content_filter`：内容审核拒绝。`content` 为空串、`annotations` 省略；`server_tool_calls` 保留但**每步的思考被清空**

**Chat Completions 流式（web 工具）**
- 思考和文本照常走 `delta.reasoning_content` / `delta.content`。**所有 step 的思考按顺序流出，无分隔符**。
- 工具调用进度走 `server_tool_event`（§3.5）。用 `step` 字段归属思考：某个 `step_reasoning_done` 之后、下一个之前的思考属于当前 step。
- **完整的 `server_tool_calls` 与 `annotations` 只在最后一个 chunk（带 `finish_reason` 的那个）的 `delta` 里发送一次**；`call_completed` 里**没有 `signature`**。
- 开启 `title` 时标题在最后一个 chunk 的 `delta.title`，非流式在 `message.title`。
- **`usage.server_tool_use`** 中 `tool_search` / `tool_fetch` / `tool_image_search` 语义同 Responses。

**Chat Completions 的额外限制（声明 web 工具时）**
- `web_search_options` → **400**（要改用 `tools` 声明）。请求 schema 里也不再列出该字段。
- `response_format` 只允许 `text`（其他值 400）；`logprobs` / `top_logprobs` → 400。
- 接受 `latest_reminder` 消息。
- 续写只能用 Beta 端点 + 末条 assistant 的 `prefix: true`。
- **被忽略的请求参数**（服务端自行决定）：`temperature`、`top_p`、`frequency_penalty`、`presence_penalty`、`stop`、`seed`、`n`、`preserve_thinking`、`parallel_tool_calls`。

### 5.9 Responses API 侧的工具输出（摘要）

- 每次工具调用是一个 `web_search_call` output item，带 DeepSeek 扩展 `kind`：
```json
{"type":"web_search_call","id":"srvtoolu_s_00_3f2a9c...","status":"completed","kind":"search",
 "action":{"type":"search","queries":["DeepSeek V4.1"],
   "sources":[{"type":"url","url":"https://example.com/news","title":"...","snippet":"...","site_name":"Example News","site_icon":"...","published_at":"2026-01-02T03:04:05+00:00"}]}}
```
- `output[].kind` 与 `action.type` 对应关系：`search`/`deep_search`/`image_search`/`deep_image_search` → `action.type: "search"`（带 `action.queries` 与 `action.sources`）；`deep_search` → `open_page` 或 `find_in_page`（带 `pattern`），并带 `page: {url,title,published_at}`；`read_link` → `open_page`，带 `page` 与（成功读取时的）`signature`。
- 失败的调用：`status: "failed"` + `error: {"code": "..."}`（码表同 §5.5）。
- 思考是 `reasoning` item，内容在 `reasoning_text`，`summary` 为空、**无 `encrypted_content`**。
- 答案是 `message` item，其 `output_text` 用 `url_citation` annotations 带引用；`start_index`/`end_index` 按 **Unicode code point** 计，**`title` 未知时是空字符串**。
- `status`：`completed`；`incomplete` + `incomplete_details.reason: "max_output_tokens"`；`incomplete` + `"content_filter"`（此时 `output` 只保留已执行的 `web_search_call` items）。
- 流式：一次调用产生 `response.output_item.added`（带完整 `action`）→ `response.web_search_call.in_progress` → `...searching` → `...completed` → `response.output_item.done`（带 `sources`/`page`/`signature`/`error`）。并发多个调用时**先全部 added，再逐个完成**，用 `output_index` 配对。每条引用是一个 `response.output_text.annotation.added` 事件。
- OpenAI Python SDK 的 `get_final_response()` 在响应以 `content_filter` 结束时**会抛异常**；应从 `response.incomplete` 事件读最终响应。

### 5.10 多轮回传规则（最容易踩的坑）

**通用**
- 每轮发送完整历史，**把上一条回复原样回传，包含 `kind` 与 `signature`**。
- 搜索结果、打开的页面、往轮的思考**不会**被加入后续轮次上下文；**只有答案文本会**。
- 含 web 工具块的历史，**也可以发给没有声明这些工具的请求**。

**Messages**
- 回传 assistant 的 `content` 数组原样（含 `server_tool_use` / `web_search_tool_result` / `web_fetch_tool_result` / `thinking`）。
- **读链接的页面由 `signature` 恢复，并追加到该轮 user 消息末尾**，之后轮次可引用。**`signature` 无效时页面不加，但请求仍然成功**。
- **思考内容省略的风险**：继续思考模式的工具调用时，必须回传完整 assistant `content`（含 `thinking` 与 tool-use 块）。若省略思考内容，服务**可能**用 tool-call ID 尝试恢复；**需要恢复但失败时返回 400**。不要依赖自动恢复。

**Chat Completions**
- 把 assistant message 连同 **`server_tool_calls` 原样回传**；读链接的页面由该 call 的 `signature` 恢复。
- **若框架/网关丢掉了 `server_tool_calls`，请求仍然成功**，但**之前读过的页面不再在上下文中**（静默降级，极难排查）。

**Responses**
- 把之前的 `output` items 原样放进 `input`，含 `kind` 与 `signature`。

### 5.11 计费（web 工具）

- Messages 最终 `message_delta`（或非流式响应）的 `usage` 是**整个请求跨多次推理步的计费总和**：

| 字段 | 含义 |
|---|---|
| `input_tokens` | 未被上下文缓存服务的输入 token |
| `cache_read_input_tokens` | 命中缓存的输入 token |
| `output_tokens` | 输出 token |
| `output_tokens_details.thinking_tokens` | 其中的思考 token（思考开启时返回） |
| `cache_creation_input_tokens` | 恒 0 |
| `server_tool_use.web_search_requests` / `web_fetch_requests` | 响应中搜索结果块 / 抓取结果块的**数量（含错误）** |
| `server_tool_use.tool_search` / `tool_fetch` / `tool_image_search` | 搜索（不含图片搜索）/ 抓取 / 图片搜索的次数 |

- **这些 server 工具本身不计费**（文本搜索、图片搜索、页面抓取），**只按模型 token 计费**。
  （Pricing 页补充：自北京时间 2026-11-18 12:00 起，调模型时触发的服务端搜索/抓取不再计费。）

### 5.12 错误（web 工具场景）

- 输入被内容审核拦截 → `400 Content Exists Risk`；上下文超模型上限 → `400`。
- 常见 `error.message`（逐字）：

| 原因 | `error.message` |
|---|---|
| 同一工具声明两次 | ``tools: `deepseek_web_search` can only be declared once`` |
| 与其他 server tool 混用 | ``tools: other tools cannot be used together with `deepseek_web_search`, `deepseek_read_url`, `safety_check` or `title` yet`` |
| 给了 `allowed_domains`/`blocked_domains`/`user_location` | ``tools: `allowed_domains` is not supported by `deepseek_web_search` `` |
| `tool_choice` 点名了 web 工具 | ``tool_choice: `deepseek_web_search` cannot be forced`` |
| `safety_check` 无有效 level | ``safety_check: `level` must be `low` or `high` `` |
| 要续写的回复用过 web 工具 | ``messages: the last `assistant` message used `deepseek_web_search` or `deepseek_read_url` and cannot be continued; resend the previous request`` |

---

## 6. Vision 图片输入

`deepseek-flash` 支持图文混排；`deepseek-v4-pro` **不支持 vision**（Anthropic 协议下会把图片替换为文本 `[Unsupported Image]`）。

### 6.1 支持格式
**JPEG、PNG、GIF、WebP**。格式由**实际文件内容**判定，**不看文件名、不看声明的 MIME**。

### 6.2 三种提供方式（Chat Completions）

**① Base64 内联（最简单，适合本地文件）**
```json
{
  "role": "user",
  "content": [
    {"type": "text", "text": "What is in this image?"},
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,<BASE64_DATA>"}}
  ]
}
```
> 编码后的数据计入 **48 MiB** 请求体上限。

**② 外链 URL**
```json
{"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
```
> URL ≤ **8192 字符**；图片文件 ≤ **32 MiB**；下载必须在 **60 秒**内完成。

**③ Files API `file_id`（推荐：多次复用 / 图片超过 48MiB 上限）**
```json
{"type": "file", "file_id": "file-api-xxxxxxxxxxxxxxxx"}
```
> `file_id` 图片可达 **64 MiB**，**不受 32 MiB 单图限制**。
> 也可内联：`{"type":"file","file_data":"data:image/jpeg;base64,<B64>","filename":"image.jpg"}`（`file_data` 与 `file_id` 互斥）。

### 6.3 `detail` 档位

| 值 | 行为 |
|---|---|
| `low` | 缩放到 **512×512**，更快更便宜（细节不重要时用） |
| `high` | 保留原图（为兼容提供，等价 `original`） |
| `original` | 保留原图 |
| `auto` | 自动，当前等价 `original` |

### 6.4 Token 计算（重要，影响成本）

- 图片按尺寸折算 token，与文本 token 一起计费。
- 推理前**自动缩放**：
  - 总像素数低于约 **544×544** 的图**放大**（保持宽高比）；
  - 更大的图**缩小**（保持宽高比），缩放后总像素数约为 **1300×1300**。
- 结果：**每张图上限 1024 token**（例：2000×2000 与 5000×5000 缩放后 token 相同）。
- 多图请求中**每张图独立按同一规则计**，没有多图专用算法。
- 精确估算用官方 "Token & Token Usage" 页的 image token calculator。**（具体像素→token 公式文档未覆盖）**

### 6.5 限制表（逐字）

| 限制 | 值 |
|---|---|
| 支持格式 | JPEG, PNG, GIF, WebP |
| 外链 URL 长度 | 8192 字符 |
| 请求体大小 | 48 MiB |
| 单图上限（base64 / 外链） | 32 MiB |
| 单图上限（Files API `file_id`） | 64 MiB |
| 单请求图片数 | **600** |
| 单请求图片总大小 | 64 MiB（不含 `file_id` 图片）；含 `file_id` 图片最多 **200 MiB** |
| 单边最大像素 | **8192 px**；请求含 **15 张及以上**图片时降为 **4096 px** |

### 6.6 限制与约束

- 图片可出现在 **`user`、`system`、`tool`** 消息中；**`assistant` 消息里的图片返回 400**。
- 开启内容安全时，送模型的图片会被审核；未通过的图片会让响应以 refusal 结束并**点名被封的图片**（Chat Completions 里在 `message.refusal`，流式为最后 chunk 的 `delta.refusal`）。
- Messages 侧：`deepseek-flash` 支持 `user` 消息与 `tool_result` 内容里的图片；`deepseek-v4-pro` **不处理图片**，替换为文本 `[Unsupported Image]`。

### 6.7 Messages / Responses 的图片块形状

**Messages**
```json
{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "<BASE64_DATA>"}}
```

| `source.type` | 等价 OpenAI 方式 | 备注 |
|---|---|---|
| `base64` | Base64 内联 | **必须**带 `media_type`：`image/jpeg` / `image/png` / `image/gif` / `image/webp` |
| `url` | 外链 URL | ≤8192 字符 |
| `file` | Files API `file_id` | **需要头 `anthropic-beta: files-api-2025-04-14`** |

**Responses**
```json
{"type": "input_image", "image_url": "https://example.com/image.jpg", "detail": "low"}
```
- `image_url`（`http(s)` ≤8192 字符，或 base64 data URL）与 `file_id` **互斥**；都不给 400 `"input_image must have image_url or file_id"`，都给 400 `"input_image cannot have both image_url and file_id"`。
- `detail` 在给了 `file_id` 时被忽略。
- 图片可出现在 `user`/`system`/`developer` 消息，以及 `function_call_output` / `custom_tool_call_output` 的输出里（让模型能看工具返回的截图）。

---

## 7. Files API 文件上传

支持两类文件：
- **图片**：JPEG、PNG、GIF、WebP（按内容判定格式）
- **文档**：PDF、Word、PowerPoint、Excel、电子书、纯文本

上传后文件配合 `deepseek-flash` 使用。

### 7.1 上传 `POST /files`

`multipart/form-data`，表单字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 是 | 要上传的文件；可接受类型取决于 `purpose` |
| `purpose` | 是 | 见下表 |
| `expires_after[anchor]` | 否 | 若给则必须为 `created_at`；与 `expires_after[seconds]` 必须同时出现 |
| `expires_after[seconds]` | 否 | 有效期秒数，`3600`–`2592000`（1 小时到 30 天）。两个 `expires_after` 都不给 = 永久保留 |

**`purpose` 取值**

| `purpose` | 可传文件 | 用途 |
|---|---|---|
| `user_data` | 图片（JPEG/PNG/GIF/WebP）；纯文本（txt、md、csv、json、源码等）；表格（XLSX、XLS）；电子书（EPUB、MOBI） | 在 chat 请求里引用图片；纯文本/表格/电子书见 §8 |
| `text_recognition` | PDF、Word（DOC、DOCX）、PowerPoint（PPT、PPTX），以及 PNG/JPEG/WebP/GIF/BMP/TIFF 图片 | **只解析文字**，文档里的图不给模型 |
| `rich_layout_recognition` | 同上 | **文字 + 文档里的图**一起给模型 |

> **硬性要求**：文档类上传时，`purpose` 字段必须**排在 `file` 字段之前**。用 OpenAI Python SDK 无需改（SDK 先发表单字段再发文件）。**把 PDF/Word/PPT 用 `user_data` 上传会返回 400。**

**curl**
```bash
curl https://api.deepseek.com/files \
  -H "Authorization: Bearer <DeepSeek API Key>" \
  -F purpose="user_data" \
  -F file="@image.jpg"
```

**响应**
```json
{
  "id": "file-api-xxxxxxxxxxxxxxxx",
  "object": "file",
  "bytes": 102400,
  "created_at": 1700000000,
  "filename": "image.jpg",
  "purpose": "user_data",
  "expires_at": 1700003600
}
```
`expires_at` **只有上传时设置了有效期才出现**。

### 7.2 列出 `GET /files`

查询参数：

| 参数 | 说明 |
|---|---|
| `after` | `file_id` 游标，返回该文件之后的 |
| `limit` | 1–1000（OpenAI 兼容默认 1000） |
| `order` | 按创建时间排序：`asc`（默认）或 `desc` |
| `purpose` | 过滤：`user_data` / `text_recognition` / `rich_layout_recognition` |

```json
{
  "object": "list",
  "data": [ { "id":"file-api-...","object":"file","bytes":102400,"created_at":1700000000,"filename":"image.jpg","purpose":"user_data" } ],
  "first_id": "file-api-xxxxxxxxxxxxxxxx",
  "last_id": "file-api-xxxxxxxxxxxxxxxx",
  "has_more": false
}
```

### 7.3 查询 / 删除

- `GET /files/{file_id}` → 文件对象
- `DELETE /files/{file_id}` → `{"id":"file-api-...","object":"file","deleted":true}`

### 7.4 在 chat 请求里引用

```json
{"type": "file", "file_id": "file-api-xxxxxxxxxxxxxxxx"}
```
- **文件属于账号**：同账号下所有 API key 共享，两个 API 家族都能引用。
- OpenAI 兼容接口引用**不需要**额外头；**Anthropic 兼容 `/messages` 引用需要 `anthropic-beta: files-api-2025-04-14`**。
- `file_id` 图片不受 32 MiB 限制（单图可达 64 MiB）。
- `file_data` 内联时可带 `filename`；`filename` **不能**与 `file_id` 同用。

### 7.5 限制（逐字）

| 限制 | 值 |
|---|---|
| 支持格式 | 图片：JPEG、PNG、GIF、WebP；其他文件见 `purpose` 表 |
| 单文件上限 | 图片 64 MiB；PDF/Word/PPT 等文档 100 MiB；纯文本/表格/电子书 32 MiB |
| 上传时限 | 文档（PDF/Word/PPT）**120 秒**；其他 **10 分钟** |
| 文件名最大长度 | 512 字节 |
| 单用户存储上限 | **25 GiB** |
| 单用户文件数上限 | **10000** |
| 有效期范围 | 1 小时 – 30 天，或永久（省略 `expires_after`） |

### 7.6 Anthropic 兼容 Files API

`base_url = https://api.deepseek.com/anthropic`，**所有请求都必须带 `anthropic-beta: files-api-2025-04-14`**。端点：`POST /anthropic/v1/files`、`GET /anthropic/v1/files`、`GET /anthropic/v1/files/{file_id}`、`DELETE /anthropic/v1/files/{file_id}`。

| | OpenAI 兼容 | Anthropic 兼容 |
|---|---|---|
| 列表分页 | `after` | `after_id` / `before_id`（互斥） |
| 列表 `limit` | 1–1000，默认 1000 | 1–1000，**默认 20** |
| 列表 `order` / `purpose` | 支持 | **不支持** |
| 列表顶层 `object` | `"list"` | 省略 |
| 文件对象大小字段 | `bytes` | `size_bytes` |
| 文件对象类型字段 | `object` | `type` |
| `created_at` | Unix 时间戳（秒） | **RFC 3339 字符串** |
| 必需头 | 无 | `anthropic-beta: files-api-2025-04-14` |

```json
{
  "id": "file-api-xxxxxxxxxxxxxxxx",
  "type": "file",
  "size_bytes": 102400,
  "created_at": "2026-01-01T00:00:00+00:00",
  "filename": "image.jpg",
  "mime_type": "image/jpeg"
}
```
- Anthropic 侧 `purpose` **可选，默认 `user_data`**；传文档仍需把 `purpose` 放在 `file` 之前。
- 删除返回 `{ "id": "...", "type": "file_deleted" }`。

---

## 8. File Parsing 文档解析（PDF/Word/PPT）

两步：
1. 用 Files API 上传文档（选解析方式 `purpose`）；
2. 在 chat 请求里引用返回的 `file_id`。

**文件在上传时即解析，只有解析成功才返回 `file_id`。**

### 8.1 选解析目的

| `purpose` | 模型拿到什么 | 适合 |
|---|---|---|
| `text_recognition` | **只有文字**。图表、照片、示意图被丢弃 | 纯文字文档：合同、论文、扫描文本 |
| `rich_layout_recognition` | **文字 + 文档中的图**：图表/照片/示意图被裁出，按原文位置给模型 | 需要看懂图的文档：带图表的报告、幻灯片、带示意图的手册 |

- 图是解析时**自动检测并裁切**的，**不保证每张图都被检出**；没被裁出的图模型仍然看不到。
- `rich_layout_recognition` 裁出的图**消耗输入 token**，且**计入单请求图片数上限**。不需要看图就用 `text_recognition`。

### 8.2 Step 1 上传解析

```bash
curl https://api.deepseek.com/files \
  -H "Authorization: Bearer <DeepSeek API Key>" \
  -F purpose="text_recognition" \
  -F file="@report.pdf"
```
```json
{
  "id": "file-api-xxxxxxxxxxxxxxxx",
  "object": "file",
  "bytes": 1048576,
  "created_at": 1762790000,
  "filename": "report.pdf",
  "purpose": "text_recognition"
}
```
- **响应要等解析完成才返回**，解析期间不发送任何内容。**客户端与中间任何代理的 timeout 必须覆盖「上传时间 + 解析时间」**。
- 客户端断开后**解析仍会跑完**；成功则文件被存储并计费，可在 `GET /files` 看到。
- 失败的上传**不存储、不计费**。
- **原始文件与解析结果都无法下载**。

### 8.3 Step 2 在 chat 里引用（三协议）

**Messages**（必须带 `anthropic-beta: files-api-2025-04-14`）
```json
{"role":"user","content":[
  {"type":"document","source":{"type":"file","file_id":"file-api-xxxxxxxxxxxxxxxx"}},
  {"type":"text","text":"Summarize the key points of this document."}
]}
```

**Responses**
```json
{"role":"user","content":[
  {"type":"input_file","file_id":"file-api-xxxxxxxxxxxxxxxx"},
  {"type":"input_text","text":"Summarize the key points of this document."}
]}
```

**Chat Completions**
```json
{"role":"user","content":[
  {"type":"file","file_id":"file-api-xxxxxxxxxxxxxxxx"},
  {"type":"text","text":"Summarize the key points of this document."}
]}
```

**规则**
- 用这两种 purpose 上传的文档**不能当图片用**：放进 image 块返回 400。
- 需要解析的文档**只能用 `file_id` 引用**；不支持在请求里直接传文件内容或文件 URL。
- `rich_layout_recognition` 裁出的图按原位置给模型，**计入单请求图片数上限**。
- **单请求最多引用 20 个文档，其文本总量最多 8 MiB**。同一 `file_id` 重复引用**分别计数**。超限返回 400。
- **跨轮次**：被引用 `file_id` 文档的**完整解析内容会一直留在上下文里**。太长就返回 400，**不会静默截断**。
- 开启内容安全时，裁出的图与请求里的其他图片一样接受审核。

### 8.4 纯文本 / 表格 / 电子书（无需解析）

用 `purpose: "user_data"` 上传，引用方式同上：
- 纯文本：txt、md、csv、json、源码等
- 表格（XLSX、XLS）与电子书（EPUB、MOBI）：**上传时转成 Markdown**
- **AZW3 与带 DRM 的电子书不支持**
- 原文件 ≤ **32 MiB**，文本 ≤ **8 MiB**；**这类上传不计费**

Messages 协议还可以不传文件、直接在 `document` 块里给文本：
```json
{"type": "document", "source": {"type": "text", "media_type": "text/plain", "data": "The document text"}}
```

### 8.5 限制与错误（逐字）

| 限制 | 值 |
|---|---|
| 文件格式 | PDF、Word（DOC/DOCX）、PowerPoint（PPT/PPTX），以及 PNG/JPEG/WebP/GIF/BMP/TIFF 图片；格式按实际内容判定 |
| 文件大小 | 100 MiB；超过返回 `413` |
| 页数 | 1,000 页 |
| 上传 | 必须 120 秒内完成，否则 `408` |
| 解析时间 | 文件提交后 120 秒内；超时 `504` |
| 单账号进行中的文档上传 | **15** 个（与 OCR API **分别计数**） |

| 状态 | 原因 |
|---|---|
| `400` | 文件无法解析 / 格式不支持 / 有密码保护 / `purpose` 排在 `file` 之后 |
| `408` | 上传太慢 |
| `413` | 文件太大 |
| `429` | 账号进行中的文档上传过多 |
| `500` | 解析结果不完整 |
| `503` | 服务繁忙，稍后重试 |
| `504` | 解析超时 |

### 8.6 计费

- **上传时**：按文档**页数**计费一次，**仅解析成功时**计费（价格见 Pricing 的 OCR 定价）。
- **chat 时**：**不重复收解析费**；每个引用该文档的 chat 请求按其输入 token 的正常模型输入价计费。

---

## 9. OCR

识别 PDF / Word / PowerPoint / 图片中的文本，**按页返回**。文件**不存入 Files API**，也**不传给 chat 模型**。若要让模型回答文档问题，用 §8 File Parsing。

```http
POST https://api.deepseek.com/v1/tools/ocr
Authorization: Bearer <API Key>
Content-Type: multipart/form-data
```

### 9.1 请求

两个字段，**都必填**；**带任何其他字段返回 400**。

| 字段 | 说明 |
|---|---|
| `file` | 要识别的文件，需带文件名。支持 PDF、Word（DOC/DOCX）、PowerPoint（PPT/PPTX），以及 PNG/JPEG/WebP/GIF/BMP/TIFF 图片。格式按实际内容判定 |
| `purpose` | `text_recognition`：无图的 Word/PPT 直接抽文字，其他文件逐页识别；`rich_layout_recognition`：所有文件逐页识别。输出差异见 §9.2 |

```bash
curl https://api.deepseek.com/v1/tools/ocr \
  -H "Authorization: Bearer <DeepSeek API Key>" \
  -F purpose="text_recognition" \
  -F file="@document.pdf"
```

**限制**

| 限制 | 值 |
|---|---|
| 文件大小 | 100 MiB；超过 `413` |
| 页数 | 1,000 页 |
| 上传 | 120 秒内完成，且**单次停顿不超过 30 秒**；否则 `408` |
| 总时长 | 从上传开始 **180 秒**，覆盖上传 + 识别 + 结果返回 |

### 9.2 响应

识别期间服务端**发换行符保活**，然后把结果作为**一个 JSON 对象**发出。换行是前导空白，**整个响应体可直接当 JSON 解析**。

```json
{
  "id": "ocr-9b2f4c1e-...",
  "object": "ocr.result",
  "created": 1762790000,
  "purpose": "text_recognition",
  "page_count": 2,
  "pages": [
    {"index": 0, "text": "...", "finish_reason": "stop"},
    {"index": 1, "text": "...", "finish_reason": "length"}
  ],
  "usage": {"input_tokens": 1536, "output_tokens": 412, "total_tokens": 1948}
}
```

| 字段 | 说明 |
|---|---|
| `id` | 识别 ID |
| `purpose` | 请求的 purpose |
| `page_count` | 页数，等于 `pages` 长度 |
| `pages[].index` | 页号，从 0 开始 |
| `pages[].text` | 该页的**模型原始输出，未做任何清理** |
| `pages[].finish_reason` | `stop`；或 `length`（输出到上限、该页文本不完整） |
| `usage` | 所有页的输入/输出 token，**仅供参考，不用于计费** |

**特殊 token（可自动定位文字、裁图）**
- 逐页识别的文本保留 `<｜ref｜>`、`<｜box｜>` 等特殊 token 与坐标，例如
  `<｜ref｜>Title<｜/ref｜><｜box｜>[[52, 40, 948, 96]]<｜/box｜>`
- 直接抽文字的文档**没有**这些 token。
- 坐标 `[[x1, y1, x2, y2]]`：区域左上角与右下角。**原点为页面左上角**，值按页宽/页高**归一化到 0–1000**：
  `像素 x = x × 页宽 ÷ 1000`，`像素 y = y × 页高 ÷ 1000`。
- `text_recognition` 下，**无图的 Word/PPT 直接抽文字**而非识别，但结果仍报 `text_recognition`。

### 9.3 错误

上传阶段的错误返回 HTTP 状态：

| 状态 | 原因 |
|---|---|
| `400` | 表单或 `purpose` 无效，或文件无法处理 |
| `402` | 余额不足 |
| `408` | 上传太慢 |
| `413` | 文件太大 |
| `429` | 账号进行中的识别过多 |
| `500` | 文件无法上传或提交识别 |
| `503` | 服务繁忙，稍后重试 |
| `504` | 上传+提交超过总时长 |

**识别开始后状态已是 `200`**；失败或超时时 body 是错误对象而非结果，**必须检查是否含 `error`**：
```json
{"error":{"message":"OCR did not finish in time","type":"gateway_timeout_error","param":null,"code":"gateway_timeout_error"}}
```

**重试无用的失败**

| 情况 | 处理 | `error.message` |
|---|---|---|
| 文件有打开密码 | 去密码重传 | `The file is password-protected and cannot be processed. Remove the password and upload it again.` |
| 文件无法解析/格式不支持/图片无法解码 | 修复或转格式 | `Failed to recognize the file: the file could not be parsed or its format is not supported` / `...the file format is not supported` / `...the image could not be decoded` |
| 文档超过 1,000 页 | 拆分/削减 | `Failed to recognize the file: the document has more than 1000 pages` |
| 文件太大 | ≤100 MiB | `file is too large: max 100 MiB` |
| 识别超时 | 换更小文件 | `OCR did not finish in time` / `OCR did not finish within 180 seconds` |

**可重试的临时失败**：服务繁忙 `The OCR service is temporarily unavailable. Please try again later.`；内部错误 `Internal Server Error`。

### 9.4 计费与限流

- **$0.225 / 1,000 页**，按**成功识别的页数**（`page_count`）计费；失败或超时不计费。
- **断开连接不会取消识别**：文件一旦接收完，识别会跑到结束，完成则计费。
- **单账号最多 15 个进行中的识别**，与 chat 模型**分别计数**；超限 `429`。客户端断开后未完成的识别**仍占额度**。

---

## 10. TTS 语音合成

| 模式 | 请求 | 输入 | 输出 |
|---|---|---|---|
| 全文 | `POST https://api.deepseek.com/v1/tools/tts` | JSON body 里的完整文本 | 响应体内音频流 |
| 流式 | WebSocket `wss://api.deepseek.com/v1/tools/tts` | 分块发送文本（例如模型还在生成时） | 音频帧 |

### 10.1 音色

| `voice_id` | 音色 |
|---|---|
| `stella` | Stella，女声，**默认** |
| `tide` | Tide，男声 |

### 10.2 支持语言（无语言参数，从文本自动检测）

普通话 `zh`、粤语 `yue`、英语 `en`、日语 `ja`、韩语 `ko`、马来语 `ms`、阿拉伯语 `ar`、印尼语 `id`、泰语 `th`、越南语 `vi`。

### 10.3 全文请求

| 字段 | 必填 | 说明 |
|---|---|---|
| `text` | 是 | 要读的文本。**不能为空**，最多 **10,000 计费字符**；请求体 ≤ **64 KiB** |
| `voice_id` | 否 | `stella`（默认）或 `tide` |
| `format` | 否 | `wav`（默认）或 `pcm` |
| `filter_markdown` | 否 | 朗读前是否去掉 Markdown 格式，默认 `true` |

```bash
curl https://api.deepseek.com/v1/tools/tts \
  -H "Authorization: Bearer <DeepSeek API Key>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from DeepSeek.", "voice_id": "stella"}' \
  --output speech.wav
```
- 音频边合成边流式返回；**单请求最多 30 分钟音频**。
- `wav` 返回 `audio/wav`；`pcm` 返回**裸 16-bit 单声道 PCM @ 24 kHz**。
- **不支持语速控制**，**不支持**恢复被中断的请求。
- 开始输出音频后若失败，响应会被截断 → **提前结束的响应按失败处理**。

| 状态 | 原因 |
|---|---|
| `400` | 没有可读文本，或文本未通过内容审核（`Content Exists Risk`） |
| `429` | 账号进行中的请求过多 |
| `503` | 服务繁忙，稍后重试 |
| `504` | 合成超时 |

### 10.4 WebSocket 流式

1. 连接 `wss://api.deepseek.com/v1/tools/tts`。可选 query 参数：`voice_id`、`format`（**默认 `pcm`**，或 `opus`）、`filter_markdown`。`opus` 返回**无容器的 Opus 包**，无法直接存成 Ogg。
2. 鉴权两种：头 `Authorization: Bearer <API key>`，或 WebSocket 子协议 `Sec-WebSocket-Protocol: tts, bearer.<API key>`。
3. 文本用 JSON 文本帧发送：`{"event": "text", "text": "..."}`；最后一帧发 `{"event": "finish_text"}`。
4. 音频以**二进制帧**到达。会话以文本帧结束：`{"event": "finish", "code": "...", "message": "..."}`，`code` 为 `success` 或错误码，例如 `invalid_input`、`content_filter`、`input_timeout`、`service_error`。

**限制**：60 秒内无文本到达会话终止；单会话最长 30 分钟；单会话文本最多 **10,000 计费字符 / 64 KiB**；**服务端每 25 秒发一次 WebSocket ping**。

```python
import asyncio, json, os, websockets

async def main():
    url = "wss://api.deepseek.com/v1/tools/tts?voice_id=stella&format=pcm"
    headers = {"Authorization": f"Bearer {os.environ['DEEPSEEK_API_KEY']}"}
    async with websockets.connect(url, additional_headers=headers) as ws:
        for chunk in ["Hello ", "from ", "DeepSeek."]:
            await ws.send(json.dumps({"event": "text", "text": chunk}))
        await ws.send(json.dumps({"event": "finish_text"}))
        with open("speech.pcm", "wb") as f:
            async for message in ws:
                if isinstance(message, bytes):
                    f.write(message)          # raw 16-bit signed mono PCM @ 24 kHz
                    continue
                finish = json.loads(message)
                if finish["code"] != "success":
                    raise RuntimeError(f"{finish['code']}: {finish['message']}")
                break

asyncio.run(main())
```

### 10.5 计费与限流

| 计费单位 | 标价 | 限时价（5 折） |
|---|---|---|
| 每 10,000 字符 | **$0.45** | $0.225 |

**中文汉字按 2 字符计**；其他字符（字母、数字、空格）按 1 字符计。
**单账号最多 50 个进行中的请求**，超限 `429`。

---

## 11. ASR 语音识别

```http
POST https://api.deepseek.com/v1/tools/asr
Authorization: Bearer <API Key>
Content-Type: multipart/form-data
```
**整个音频文件一次发送，返回完整转写文本；不支持流式识别。**

### 11.1 支持语言（无语言参数，从音频自动检测）

中文 `zh`、粤语 `yue`、英语 `en`、日语 `ja`、韩语 `ko`、德语 `de`、法语 `fr`、西班牙语 `es`、葡萄牙语 `pt`、意大利语 `it`、俄语 `ru`、阿拉伯语 `ar`、印地语 `hi`、印尼语 `id`、越南语 `vi`、泰语 `th`、土耳其语 `tr`、马来语 `ms`、菲律宾语 `fil`、波兰语 `pl`、匈牙利语 `hu`。

### 11.2 请求

音频放 `multipart/form-data` 的 `file` 字段：

- 格式：**16-bit PCM WAV 或 Ogg Opus**，按文件内容判定。WAV 支持采样率 **8000 / 16000 / 22050 / 24000 / 32000 / 44100 / 48000 Hz**。
- 声道：单声道或立体声。**立体声只识别左声道**。
- 大小：≤ **8 MiB**。上传须在 **10 分钟**内完成。
- 时长：≤ **120 秒**。

```bash
curl https://api.deepseek.com/v1/tools/asr \
  -H "Authorization: Bearer <DeepSeek API Key>" \
  -F file="@speech.wav"
```

### 11.3 响应

```json
{
  "request_id": "...",
  "text": "What is the weather like in Shanghai today?",
  "duration_ms": 3200
}
```

| 字段 | 说明 |
|---|---|
| `request_id` | 请求 ID |
| `text` | 转写文本 |
| `duration_ms` | 音频时长，毫秒 |

### 11.4 错误

| 状态 | 原因 |
|---|---|
| `400` | 音频不是 16-bit PCM WAV 或 Ogg Opus，或缺 `file` 字段 |
| `408` | 10 分钟内未完成上传 |
| `413` | 文件大于 8 MiB |
| `429` | 账号进行中的请求过多 |
| `503` | 服务繁忙，稍后重试 |
| `504` | 识别超时 |

### 11.5 计费与限流

| 计费单位 | 标价 | 限时价（5 折） |
|---|---|---|
| 每小时音频 | **$0.116** | $0.058 |

按**音频时长按秒**计费；**不足 1 秒按 1 秒计**。**单账号最多 50 个进行中请求**。

---

## 12. safety_check 内容安全

```json
{"safety_check": {"level": "high"}}
```

| `level` | 审查 |
|---|---|
| `high` | 开启基础风控（本节描述的内容） |
| `low` | API 默认的检查，**等同省略 `safety_check`** |

- `level` 只能是 `low` / `high`，否则 **400**。
- 三协议都支持，参数在**顶层**。
- **可与 web 工具一起用**；**不声明 web 工具时**，模型不会联网，且 `tool_choice` 必须是 `auto` 或 `none`，否则 400。
- 声明 web 工具、`safety_check=high`、或开启 `title` 时，服务端会接管部分参数（见 §5.8 的各协议忽略清单）。

### 12.1 审查范围

**输入和输出都审**。输入包括 user 消息、`tool_result` 内容等。未通过时：请求返回 **`400 Content Exists Risk`**，或输出以 **refusal** 结束。

### 12.2 处理 refusal（三协议差异，逐字）

**Messages**
```json
{
  "stop_reason": "refusal",
  "stop_details": {"type": "refusal", "category": null, "explanation": null}
}
```
- 流式：若 refusal 前没发过 `text` 块，会在 `message_delta` 前发一个**空 `text` 块**，避免读最终文本的 SDK helper 报错。
- 非流式：思考与答案文本被移除；`content` 保留已执行的工具块和**一个空 `text` 块**。

**Responses**
```json
{
  "status": "incomplete",
  "incomplete_details": {"reason": "content_filter"},
  "output": []
}
```
- `output` 只保留已执行的 `web_search_call` items。

**Chat Completions**
```json
{
  "choices": [
    {"index": 0, "message": {"role": "assistant", "content": ""}, "finish_reason": "content_filter"}
  ]
}
```
- `finish_reason` 为 `content_filter`；`content` 为空字符串、`annotations` 省略；`server_tool_calls` 保留但**每步思考被清空**。

### 12.3 图片被拦

请求里的图片未通过审核时，响应同样以 refusal 结束并**点名被拦图片**，例如：
`The following images were blocked by content moderation: messages.1.content.0`
这个说明的位置：
- Messages：`stop_details.explanation`
- Responses：`message` item 的 `refusal` 内容
- Chat Completions：`message.refusal`（流式为最后一个 chunk 的 `delta.refusal`）

### 12.4 三协议共通规则

- **已经流出去的文本无法撤回**。响应以 refusal 结束时，**要清掉已显示的回答**，改显示自己的拒答文案。
- 响应**不给具体拒答原因**。
- 声明了 web 工具但**没开 `safety_check`** 的请求**也可能**以 refusal 结束。
- **refusal 之前消耗的 token 照样计费**。

### 12.5 计费

- 安全审核消耗的 token **按输出 token 计费**，已包含在 `usage` 的输出 token 内，并单独报在：
  - Messages / Responses：`usage.output_tokens_details.safety_tokens`
  - Chat Completions：`usage.completion_tokens_details.safety_tokens`
- **输入未通过审核返回 400 时，输入 token 仍计费，按 cache hit 价格。**

### 12.6 合规要求（原文要点）

- 面向公众提供服务应开启该参数，并自行履行服务提供者义务（内容安全审核、大模型备案、AI 标识等）。
- 需遵守 Open Platform Terms of Service。

---

## 13. Conversation Title 标题生成

`{"title": {"enabled": true}}` → 响应带回会话短标题。**模型与答案一起写标题，不需要额外请求。**

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
    "model": "deepseek-flash",
    "tools": [{"type": "deepseek_web_search"}, {"type": "deepseek_read_url"}],
    "title": {"enabled": true},
    "messages": [{"role": "user", "content": "Will it rain in Beijing tomorrow?"}],
    "stream": true
  }'
```

**标题出现位置**

| 协议 | 非流式 | 流式 |
|---|---|---|
| Messages | 顶层 `title` | `message_delta` 事件的 `delta.title` |
| Responses | 顶层 `title` | 最后一个事件的 `response.title` |
| Chat Completions | `message.title` | **最后一个 chunk** 的 `delta.title` |

```
event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null,"title":"Beijing weather tomorrow"},"usage":{...}}
```

**要点（工程上必须注意）**
- 答案结束后，响应**最多再等 5 秒**等标题，然后才结束 → **会拖慢流式结束时间**。
- **只在会话的第一个请求开启**，拿到标题后就关掉。
- **可能没有标题**（例如 refusal 或 error 之后）。要降级，比如用用户消息前几个字。
- **标题不计费**。

---

## 14. latest_reminder 用户元数据标记

告诉模型今天日期、用户位置、平台与语言，让回答贴合用户处境。

**格式**：`<date>,<weekday>,<location>,<platform>,<language>`

| 字段 | 说明 |
|---|---|
| `date` | `YYYY-MM-DD` |
| `weekday` | `date` 的星期，**用 `language` 指定的语言书写**，例如 `Monday` 或 `星期一` |
| `location` | **可选**，可为空，**可以含逗号** |
| `platform` | **`App`** 或 **`Web`** |
| `language` | 用该语言自身书写的语言名，例如 `English` 或 `中文` |

示例：`2026-11-09,Monday,Singapore,Web,English`

**放置方式**：在 `messages` 里放 `{"role": "latest_reminder", "content": "..."}`，**紧接在它所属的 `user` 消息之前**。可用于 Messages API（无论有无 web 工具）与 Chat Completions API。**Responses API 不接受。**

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
    "model": "deepseek-flash",
    "messages": [
      {"role": "latest_reminder", "content": "2026-11-10,Tuesday,Singapore,Web,English"},
      {"role": "user", "content": "What is DeepSeek?"},
      {"role": "assistant", "content": "DeepSeek is ..."},
      {"role": "latest_reminder", "content": "2026-11-11,Wednesday,Singapore,Web,English"},
      {"role": "user", "content": "What is in the news today?"}
    ]
  }'
```

**规则**
- 每轮都可以有自己的 latest_reminder，与 DeepSeek Chat 一致。**历史里的也要回传**；不回传允许，但**会降低上下文缓存命中**。
- `content` **必须是字符串**，否则 body 无法解析返回 **422**。**格式不匹配返回 400，并点名字段名**。
- **必须紧跟一个 `user` 消息**，否则 **400**。**不能放在 `tool_use` 与它的 `tool_result` 之间**。
- 该消息里的**链接不会被读取**；该消息**不影响模型是否搜索**。
- Anthropic SDK 的消息类型里没有 `latest_reminder` role，但 SDK **运行时不校验**；Python 里直接传 dict 并 `# type: ignore`。

**支持的 language 取值（逐字，完整清单）**
`Afrikaans`, `አማርኛ`, `العربية`, `Azərbaycanca`, `беларуская`, `български`, `বাংলা`, `català`, `čeština`, `dansk`, `Deutsch`, `Ελληνικά`, `English`, `español`, `eesti`, `euskara`, `فارسی`, `suomi`, `Filipino`, `français`, `galego`, `ગુજરાતી`, `עברית`, `हिन्दी`, `hrvatski`, `magyar`, `հայերեն`, `Indonesia`, `íslenska`, `italiano`, `日本語`, `ქართული`, `қазақтілі`, `ខ្មែរ`, `ಕನ್ನಡ`, `한국어`, `кыргызча`, `ລາວ`, `lietuvių`, `latviešu`, `македонски`, `മലയാളം`, `монгол`, `मराठी`, `Melayu`, `မြန်မာ`, `नेपाली`, `Nederlands`, `ਪੰਜਾਬੀ`, `polski`, `português`, `română`, `русский`, `සිංහල`, `slovenčina`, `slovenščina`, `shqip`, `српски`, `svenska`, `Kiswahili`, `தமிழ்`, `తెలుగు`, `ไทย`, `Türkçe`, `українська`, `اردو`, `TiếngViệt`, `中文`, `中文繁體`, `中文香港`, `isiZulu`

---

## 15. Context Caching（kv_cache）计费字段

**默认对所有用户开启，无需改代码。** 每次请求都会触发硬盘缓存构建；后续请求若有**重叠前缀**，重叠部分只从缓存取（= "cache hit"）。

### 15.1 命中规则（Sliding Window Attention 后的新规则）

**一次命中要求对应前缀已被"持久化"（写入磁盘缓存）。每个缓存前缀是一个独立、完整的单元。后续请求必须"完全匹配某个 cache prefix unit"才能命中。**

**何时持久化 cache prefix unit（三条）**
1. **请求边界持久化**：每个请求会在**用户输入结束位置**和**模型输出结束位置**各产生两个 cache prefix unit。后续请求**完全匹配**它们就命中。
2. **公共前缀检测持久化**：系统检测到多个请求的公共前缀时，会把它作为独立 cache prefix unit 持久化。后续请求**完全复用**它即命中。
3. **固定 token 间隔持久化**：对长输入/长输出，系统会按固定 token 间隔切出 cache prefix unit，避免长前缀因为永远到不了结束位置而完全不可缓存。

**官方示例**
- 例 1：第 1 轮 `A + B`，第 2 轮 `A + B + C` → 第 2 轮可完全匹配 `A + B`，命中。
- 例 2：第 1 轮 `A + B`，第 2 轮 `A + C` → **第 2 轮不命中**（`A + C` 没有完全匹配 `A + B`）；但系统会检测到公共前缀 `A` 并把它持久化为 cache prefix unit。第 3 轮 `A + D` 就能完全匹配 `A`，命中 `A`。

> **对 App 的推论**：会话历史**必须逐字稳定地回传**才能吃到缓存。任何"每轮重写 system prompt""随机排序""插入变化的时间戳"都会毁掉命中率。`latest_reminder` 虽然每轮变，但官方明确"不回传会降低命中"，所以按轮保留是正确做法。

### 15.2 命中字段（响应 `usage` 里）

| 字段 | 含义 |
|---|---|
| `prompt_cache_hit_tokens` | 本次请求输入中**命中**缓存的 token 数 |
| `prompt_cache_miss_tokens` | 本次请求输入中**未命中**缓存的 token 数 |

各协议的等价字段：
- Chat Completions：`prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` / `prompt_tokens_details.cached_tokens`
- Messages：`input_tokens`（不含缓存命中）+ `cache_read_input_tokens`（命中）+ `cache_creation_input_tokens`（**恒 0**）；总输入 = 三者之和
- Responses：`usage.input_tokens`，其中 `input_tokens_details.cached_tokens` 为命中数

### 15.3 注意

1. **硬盘缓存只匹配输入的前缀部分**；输出仍由计算推理生成，受 temperature 等参数影响，**仍有随机性**。
2. 缓存是 **best-effort**，**不保证 100% 命中率**。
3. **缓存构建需要数秒**；不再使用后自动清除，**通常几小时到几天**。

---

## 16. JSON Output（json_mode）

开启方式（三条都必须满足）：

1. `response_format` 设为 `{'type': 'json_object'}`；
2. **system 或 user prompt 里必须出现 "json" 字样**，并给出期望的 JSON 格式示例；
3. 合理设置 `max_tokens`，防止 JSON 被中途截断。

> **坑（原文加重）**：**若模型输出无法被识别为 JSON，API 会把非 JSON 内容替换成空格（`U+0020`）**。因此 `content` **可能只有空格（看起来是空）**，即使 `finish_reason` 是 `stop`。要处理空 `content`（例如重试）。`finish_reason="length"` 时内容可能被部分截断。

```python
response = client.chat.completions.create(
    model="deepseek-flash",
    messages=messages,
    response_format={'type': 'json_object'},
)
print(json.loads(response.choices[0].message.content))
```

- `response_format.type` 枚举：`["text","json_object"]`。
- **声明 web 工具时**：`response_format` 只允许 `text`，其他值返回 **400**。

---

## 17. Tool Calls（函数调用 / strict 模式）

### 17.1 基本流程（非思考模式，官方示例）

1. 用户提问；
2. 模型返回 `get_weather({location: 'Hangzhou'})`；
3. 客户端执行函数，把结果以 `{"role":"tool","tool_call_id":<tool.id>,"content":"24℃"}` 回传；
4. 模型用自然语言回答。

工具定义（Chat Completions）：
```json
{"type":"function","function":{"name":"get_weather","description":"...","parameters":{"type":"object","properties":{"location":{"type":"string","description":"..."}},"required":["location"]}}}
```
- `function.name`：`a-z`、`A-Z`、`0-9`、`_`、`-`，**≤128 字符**。
- `function.parameters`：JSON Schema 对象；省略 = 空参数列表。
- `function.strict`：布尔，默认 `false`，**Beta**。

### 17.2 思考模式下的 tool calls

见 §4.5。**关键**：带 `tools` 的请求，历史轮次的 `reasoning_content` **必须全部回传**，否则 **400**。

### 17.3 会话中插入 tool call（协议差异）

- **支持**插入 tool call 消息，也支持插入 `system` 消息：**Messages API**、**Responses API**。
- **不支持**插入 tool call 消息，但**支持**插入 `system` 消息：**Chat Completion API**。（需要在会话中间插 tool call 就得换协议。）

### 17.4 `strict` 模式（Beta）

开启条件：
1. `base_url="https://api.deepseek.com/beta"`；
2. `tools` 里**所有** `function` 都设 `strict: true`；
3. 服务端会校验你给的 JSON Schema；不合规或用不支持的类型会报错。

**支持的 JSON Schema 类型**：`object`、`string`、`number`、`integer`、`boolean`、`array`、`enum`、`anyOf`。

| 类型 | 支持 | 不支持 |
|---|---|---|
| `object` | **每个 `object` 的所有属性都必须放进 `required`，且 `additionalProperties` 必须为 `false`** | — |
| `string` | `pattern`；`format`（`email`、`hostname`、`ipv4`、`ipv6`、`uuid`） | `minLength`、`maxLength` |
| `number`/`integer` | `const`、`default`、`minimum`、`maximum`、`exclusiveMinimum`、`exclusiveMaximum`、`multipleOf` | — |
| `array` | items | `minItems`、`maxItems` |
| `enum` | 支持 | — |
| `anyOf` | 支持 | — |

- 可用 `$def` 定义可复用模块 + `$ref` 引用（也支持递归结构）：

```json
{"type":"object","properties":{"authors":{"type":"array","items":{"$ref":"#/$def/author"}}},"required":["authors"],"additionalProperties":false,
 "$def":{"author":{"type":"object","properties":{"name":{"type":"string"}},"additionalProperties":false,"required":["name"]}}}
```

---

## 18. 错误码

| CODE | 描述 |
|---|---|
| **400 - Invalid Format** | **原因**：请求体格式非法。**处理**：按错误信息提示修改请求体。 |
| **401 - Authentication Fails** | **原因**：API key 错误导致鉴权失败。**处理**：检查 API key。 |
| **402 - Insufficient Balance** | **原因**：余额用尽。**处理**：充值。 |
| **408 - Request Timeout** | **原因**：文件上传太慢，例如 OCR 或语音识别 API。**处理**：检查网络后重试，见该 API 的限制。 |
| **413 - Request Too Large** | **原因**：上传文件太大，例如 OCR 或语音识别 API。**处理**：减小文件大小。 |
| **422 - Invalid Parameters** | **原因**：请求含非法参数。**处理**：按错误信息提示修改参数。 |
| **429 - Rate Limit Reached** | **原因**：请求过快，或超过并发/QPS 限制。**处理**：合理控制请求节奏。 |
| **500 - Server Error** | **原因**：服务端问题。**处理**：稍等重试；持续出现则联系官方。 |
| **503 - Server Overloaded** | **原因**：流量过大导致过载。**处理**：稍等重试。 |
| **504 - Gateway Timeout** | **原因**：请求未在时限内完成，例如 OCR API 或文档上传。**处理**：稍后重试，或发更小的文件。 |

**Messages 协议的 `error.type` 与 HTTP 状态映射（逐字）**

| `error.type` | HTTP |
|---|---|
| `invalid_request_error` | 400, 422 |
| `authentication_error` | 401 |
| `billing_error` | 402 |
| `permission_error` | 403 |
| `not_found_error` | 404 |
| `request_too_large` | 413 |
| `rate_limit_error` | 429 |
| `timeout_error` | 408, 504 |
| `overloaded_error` | 503 |
| `api_error` | 500 及其他 |

Messages 错误体：
```json
{"type":"error","error":{"type":"invalid_request_error","message":"messages: at least one message is required"}}
```

**业务/语义类错误（散布各页，汇总）**
- `400 Content Exists Risk`：输入被内容审核拦截。
- `400`：上下文超过模型上限（Responses API 明确：`truncation` 不支持，超窗直接 400，**不静默截断**）。
- `400`：文档引用超过 20 个或文本超过 8 MiB。
- `400`：`tool_choice` 使用 `required`/具名但思考模式开启。
- `422`：`latest_reminder.content` 不是字符串。
- `400`：`latest_reminder` 不在 user 消息前，或格式不符（会点名字段）。

---

## 19. 限流与隔离

### 19.1 并发上限（账号级）

| | `deepseek-flash` | `deepseek-v4-pro` |
|---|---|---|
| 并发上限 | **2500** | **500** |

- 从"请求发出"到"模型响应完成"算一个并发连接。
- **并发按账号计算，与用哪个 API Key 无关**。
- 超出并发 → **HTTP 429**。
- 需要更高并发可提交扩容申请（**不额外收费**）。

### 19.2 `user_id` 隔离

`user_id` 的三个作用：
- **内容安全隔离**：区分你侧的用户身份，用于内容安全处理。
- **KVCache 隔离**：为你侧用户的隐私管理隔离 KVCache。
- **调度隔离**：
  - 普通 API 用户：所有 `user_id` **合并**计算并发上限。
  - 已扩容的 API 用户：账号下有总并发上限，**同时对每个 `user_id` 也限流**（**空 id 视为一个特殊 `user_id`**）。每个 `user_id` 的上限同样是 flash 2500 / v4-pro 500。某 `user_id` 超限 → 该 `user_id` 的请求 429。

**设置方式**

Chat Completions（HTTP body 顶层）：
```json
{"model":"deepseek-flash","messages":[{"role":"user","content":"Hello!"}],"user_id":"your_user_id"}
```
OpenAI SDK 必须放 `extra_body`：
```python
client.chat.completions.create(..., extra_body={"user_id": "your_user_id"})
```
Messages（`metadata.user_id`）：
```json
{"model":"deepseek-flash","messages":[...],"metadata":{"user_id":"your_user_id"},"max_tokens":1024}
```
Responses：用顶层 `user` 参数。

### 19.3 Keep-Alive（必须处理，否则解析炸）

- **非流式请求**：持续返回**空行**。
- **流式请求**：持续返回 SSE 注释 **`: keep-alive`**。
- 这些内容**不影响 JSON body 解析**，但**自己解析 HTTP 响应时必须容忍**。
- **若 10 分钟内未开始推理，服务端关闭连接**。

---

## 20. Responses API 摘要

**base_url**：`https://api.deepseek.com`，端点 `POST /responses`。定位是满足 Codex 需求。

```python
from openai import OpenAI
client = OpenAI(api_key="...", base_url="https://api.deepseek.com")
response = client.responses.create(
    model="deepseek-flash",
    instructions="You are a helpful assistant.",
    input="Hi, how are you?",
)
print(response.output_text)
```

### 20.1 流式事件（完整清单，逐字）

`stream: true` → 语义化 SSE，每个事件带 `event` 名与**单调递增的 `sequence_number`**。以 `response.completed` / `response.incomplete` / `response.failed` 结束，**没有 `data: [DONE]`**。

| 事件 | 说明 |
|---|---|
| `response.created` | 第一个事件；响应已创建，status `in_progress` |
| `response.in_progress` | 正在生成 |
| `response.output_item.added` / `response.output_item.done` | 一个 output item（`reasoning`/`message`/`function_call`/`custom_tool_call`/`web_search_call`/`tool_search_call`）开始/完成 |
| `response.content_part.added` / `response.content_part.done` | output item 内的 content part 开始/完成 |
| `response.reasoning_text.delta` / `response.reasoning_text.done` | 增量/完整 CoT 文本 |
| `response.output_text.delta` / `response.output_text.done` | 增量/完整输出文本 |
| `response.function_call_arguments.delta` / `...done` | 函数调用参数增量/完整 |
| `response.custom_tool_call_input.delta` / `...done` | custom tool call（`apply_patch`）输入增量/完整 |
| `response.web_search_call.in_progress` / `.searching` / `.completed` | 服务端 `web_search` 调用开始/运行/完成（**仅 `deepseek-v4-pro`**） |
| `response.completed` | 正常结束，携带完整 `response` 对象（含 `usage`） |
| `response.incomplete` | 被截断（如达到 `max_output_tokens`），携带完整 `response` |
| `response.failed` | 失败，携带完整 `response` 与 `error` 详情 |

### 20.2 顶层请求参数支持状态（关键项）

| 参数 | 状态 |
|---|---|
| `model` / `input` / `instructions` / `stream` / `max_output_tokens` / `top_logprobs` | 支持 |
| `temperature` | 支持（[0.0, 2.0]；**思考模式无效**） |
| `top_p` | 支持；行为按模型（同 §3.2） |
| `tools` | **部分支持**：`function` 支持；`web_search` 仅 `deepseek-v4-pro`；其他类型忽略。`deepseek_web_search`/`deepseek_read_url` 支持 |
| `tool_choice` | 支持 `none`/`auto`/`required`/具名 function |
| `reasoning` | 部分支持：`effort` 支持；`summary` 接受但**不生成摘要** |
| `text` | 部分支持：`format` 完全支持；`verbosity` 接受但**无效** |
| `user` | 支持 |
| `parallel_tool_calls` | **忽略**（并行工具调用始终启用） |
| `max_tool_calls` | **忽略** |
| `previous_response_id` / `conversation` | **不支持**（无状态 API） |
| `store` | 不支持，响应恒 `store: false` |
| `background` / `metadata` / `include` / `prompt` / `truncation` / `service_tier` / `safety_identifier` | **不支持** |
| `safety_check` / `title` | **DeepSeek 扩展，支持** |
| `prompt_cache_key` / `prompt_cache_retention` / `context_management` / `stream_options` | 不支持 |

> **重要**：不支持的参数是**静默忽略、不报错**，所以现有 Responses 客户端可以不改配置接进来。（与 Chat Completions 相反，后者不少情况直接 400。）

### 20.3 input items

| 类型 | 状态 |
|---|---|
| `message` | 支持。角色 `user`/`assistant`/`system`/`developer`（`developer` 在 flash 上当 `system`、在 v4-pro 上当 `user`）；content 支持 string、`input_text`/`output_text`/`input_image`。user 消息里 `input_file` 用 `file_id` 引用上传文件；**`file_url` 不支持** |
| `function_call` | 支持（合并进相邻 assistant message） |
| `function_call_output` | 支持；`output` 可为字符串或 content part 列表，其中的 `input_image` 当真实图片处理 |
| `reasoning` | 支持。纯文本 `content` 合并进相邻 assistant message；**`summary` 与 `encrypted_content` 不支持** |
| `custom_tool_call` / `custom_tool_call_output` | 支持（`apply_patch`，带 `call_id` 配对校验） |
| 其他类型 | 忽略 |

- 注意：`web_search_call` items 可以回传进 `input`，搜索结果会被恢复并拼入上下文。

### 20.4 tools

| 类型 | 状态 |
|---|---|
| `function` | 支持 |
| `custom` | 仅 `{"type":"custom","name":"apply_patch"}`；其他名字 400 |
| `web_search` | 仅 `deepseek-v4-pro`；服务端执行搜索并把结果加入上下文后继续生成。**`deepseek-flash` 下被忽略** |
| `deepseek_web_search` / `deepseek_read_url` | 支持；**不能与 `web_search` 同时声明** |
| `file_search` / `code_interpreter` / `computer_use` / `mcp` / 其他内置工具 | 忽略 |

### 20.5 usage

- `usage.input_tokens`，其中 `input_tokens_details.cached_tokens` = 命中上下文缓存的 token
- `usage.output_tokens`，其中 `output_tokens_details.reasoning_tokens` = CoT token
- `usage.server_tool_use`：`tool_search`（成功的 web 搜索查询数，**一次多 query 的搜索计入多次**）、`tool_fetch`（成功的网页读取数，含 open_page 与页内查找；**web 工具下页内查找不计**）、`tool_image_search`（仅 web 工具时返回）。**三项全为 0 时整个字段省略**；字段存在时三项都会给（含 0）。
- 流式时要从最终 `response.completed` / `incomplete` / `failed` 的 `response.usage` 读，**不作为独立 usage 事件发送**，且**初始事件的 `usage` 为 `null`**。

### 20.6 不能做的事（做 App 要避开）

- **不接受 `latest_reminder`**。
- **不支持续写**（`input` 以 assistant `message` 或 `reasoning` item 结尾返回 **400**）。
- 无状态：`previous_response_id` / `conversation` 不支持，必须自己拼完整历史。

---

## 21. Messages API（Anthropic 格式）摘要

`POST https://api.deepseek.com/anthropic/v1/messages`；`base_url` 设为 `https://api.deepseek.com/anthropic` 时 Anthropic SDK 会自动追加 `/v1/messages`。鉴权 `x-api-key` 或 `Authorization: Bearer`（同时给时 `Authorization` 优先）。`anthropic-version` **被忽略**。

### 21.1 简单字段支持状态（关键项）

| 字段 | 状态 |
|---|---|
| `model` | 用 DeepSeek 模型名；`claude*` 会被映射（§1.2） |
| `max_tokens` | 支持。**HTTP 层面可选**；SDK 要求必填。默认与实际上限取决于模型、思考模式、effort。超过模型上限会被截到上限，且输入+输出必须落在上下文内。**某些 Claude Code / OpenCode 主 agent 的思考模式请求，兼容处理会把有效 `max_tokens` 抬到高于请求值** → **它不是严格输出上限** |
| `system` | 支持。只能是字符串、text 块数组、或 `null` |
| `stream` | 支持 |
| `temperature` | 有效区间 [0.0, 2.0]；**非思考模式生效，思考模式固定 1.0** |
| `thinking` | 支持 `type: "enabled"` / `"disabled"`；**`adaptive` 视为 `enabled`**；**`budget_tokens` 被忽略** |
| `output_config` | **只有 `effort` 支持** |
| `stop_sequences` | 完全支持；≤16 条，每条非空 ≤512 字节 |
| `top_p` | 按模型（同 §3.2） |
| `top_k` | **忽略** |
| `metadata` | **只有 `user_id` 支持**，其他忽略 |
| `container` / `mcp_servers` / `service_tier` | **忽略** |
| `safety_check` / `title` | **DeepSeek 扩展，支持** |

### 21.2 tools

- 客户端工具：给 `name`、`input_schema`、可选 `description`，**省略 `type`**。**给 `type: "custom"` 返回 422**。`cache_control` 忽略。
- 服务端工具：`{"type":"deepseek_web_search","name":"deepseek_web_search"}`、`{"type":"deepseek_read_url","name":"deepseek_read_url"}`。**不能与其他 server tool 同时声明**。
- 空数组视为无工具；工具名必须唯一。

### 21.3 tool_choice

| 值 | 状态 |
|---|---|
| `none` | 完全支持 |
| `auto` | 支持（`disable_parallel_tool_use` 忽略） |
| `any` | 非思考模式下强制调用工具；**思考模式下若声明了 server tool 则视为 `auto`，若只有客户端工具则 400** |
| `tool`（具名） | 非思考模式选指定客户端工具；**思考模式返回 400** |

### 21.4 回传 tool_result 的硬规则

- 每轮都发完整历史。
- 含客户端 `tool_use` 块的 assistant 消息之后，**紧跟的下一条消息必须是 `user` 角色**，并且**为每个 tool call 提供 `tool_result`**，`tool_use_id` 必须对应。
- **所有 `tool_result` 块要放在该 user 消息里任何文本之前**。
- 思考模式续工具调用时：**保留并回传 assistant 完整的 `content` 数组（含 `thinking` 与 tool-use 块）**。省略思考内容时服务可能用 tool-call ID 恢复，**需要恢复但失败则 400**。不要依赖自动恢复。

### 21.5 message content 块支持状态

| 块 | 状态 |
|---|---|
| `text` | 完全支持；`cache_control` / `citations` 忽略 |
| `image` | `deepseek-flash` 支持 user 消息与 `tool_result` 里的图片；assistant 消息里的图片 **400**。`deepseek-v4-pro` 不处理图片，替换为 `[Unsupported Image]`。`source.type` 可为 `base64`/`url`/`file`（`file` 需 `anthropic-beta: files-api-2025-04-14`） |
| `document` | user 消息里支持 `file` 与 `text` 两种 source；其他 source 400 |
| `thinking` | **支持** |
| `redacted_thinking` | **不支持** |
| `tool_use` / `tool_result` | 支持（`cache_control`、`is_error` 忽略） |
| `server_tool_use` / `web_search_tool_result` | **支持** |
| `search_result` | **不支持** |
| `code_execution_tool_result` / `mcp_tool_use` / `mcp_tool_result` / `container_upload` | **不支持** |

- 用 web 工具或 `safety_check` 的请求，assistant 消息里也接受 `web_fetch_tool_result` 块，以及扩展字段 `kind` / `signature`。

### 21.6 流式与 usage

- 正常流：`message_start` → 若干 `content_block_start` / `content_block_delta` / `content_block_stop` → `message_delta` → `message_stop`。**中间可能有 `ping` 事件**。**没有 `data: [DONE]`**。
- 正常事件**既有 SSE `event` 名，也有 JSON `type` 字段**。也可能插入 keep-alive 注释。
- **等待生成开始超时时**，服务可能发出一个**无 SSE `event` 名、无顶层 `type` 的未命名 `data` 帧**，内容是 `{"error":{"message":"..."}}`，随后关闭连接。
- **在 `message_stop` 之前关闭连接 = 响应不完整。**
- **usage 取最终 `message_delta.usage`，不要加到 `message_start` 的 usage 上**。`input_tokens` 不含缓存命中；`cache_read_input_tokens` 是命中；`cache_creation_input_tokens` 目前恒 0。**总输入 = `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`**。
- `usage.server_tool_use`：`web_search_requests`（尝试次数，含被 `max_uses` 拒绝、非法 query、失败）、`tool_search`（成功且至少返回 1 条结果的搜索次数，**按调用计，不按结果条数**）。**没有任何搜索尝试时该对象省略**。

### 21.7 `stop_reason` 枚举（逐字）

`["end_turn","max_tokens","stop_sequence","tool_use","refusal",null]`

---

## 22. 技术选型建议

### 22.1 结论先行

| 场景 | 推荐协议 |
|---|---|
| **做「类官方 DeepSeek App」：联网搜索 + 思考 + 引用卡片 + 文件 + 标题生成，全部要** | **Messages（Anthropic 格式）为首选**；理由见下 |
| 团队已有 OpenAI 生态（SDK、网关、日志、评测），能接受"引用只在最后一帧""无法流式区分思考所属步" | **Chat Completions**，功能不缺、SSE 最简 |
| Codex / 需要 `apply_patch` custom tool / 需要"忽略未知参数"的宽松兼容 | **Responses** |
| **不建议**把 Responses 当作 App 主协议 | 无 `latest_reminder`、不支持续写、无状态、事件最多 |

### 22.2 五维打分（满分 5，★ 越多越成熟/越省事）

| 维度 | Messages | Chat Completions | Responses |
|---|---|---|---|
| 联网搜索（块结构完整度） | ★★★★★ `server_tool_use` / `web_search_tool_result` / `web_fetch_tool_result` 一等公民，带 `kind` + `signature` | ★★★★ 只有 `server_tool_calls` 扩展字段（step → calls 两层）；流式有 `server_tool_event` 但 `call_completed` 无 `signature` | ★★★★ `web_search_call` item；`web_search` 仅 v4-pro |
| 思考展示（流式可渲染性） | ★★★★★ 独立 `thinking` 块 + `thinking_delta` + `signature_delta`，天然折叠面板 | ★★★★ `delta.reasoning_content` 全步连续流出、**无分隔符**；要靠 `step_reasoning_done` 归属步骤 | ★★★★ `reasoning_text.delta`，但摘要 `summary` 不生成 |
| 引用卡片（能否实时） | ★★★★★ **`citations_delta` 逐条流式到达**，可边出字边出角标 | ★★★ **`annotations` 只在最后一个 chunk 一次性给**，角标只能收尾时补画 | ★★★★ `response.output_text.annotation.added` 实时 |
| 文件（PDF/图片） | ★★★★ `document` / `image` 块最语义化；**但用 `file_id` 必须加 `anthropic-beta` 头** | ★★★★★ `{"type":"file","file_id":...}` 最简单 | ★★★★ `input_file` / `input_image` |
| 标题生成 | ★★★★★ `message_delta.delta.title` 与答案同流，末尾一次拿到 | ★★★★ 最后一个 chunk 的 `delta.title` | ★★★ 终态事件的 `response.title` |

**额外加减分项**

| 项 | Messages | Chat Completions | Responses |
|---|---|---|---|
| `latest_reminder`（日期/地点/语言，App 体验强相关） | ✓ | ✓ | **✗** |
| `safety_check` | ✓ | ✓ | ✓ |
| 断线续写 | ✓ | 仅 Beta + `prefix:true` | **✗** |
| 会话中插入 tool call | ✓ | **✗** | ✓ |
| 思考模式下强制工具调用 | 部分（具名 400） | **✗**（`required`/具名 400） | `required` 视为 `auto` |
| SSE 解析难度 | 中（块状态机，按 `index`） | **低**（单流 + 2 个扩展事件） | 高（30+ 事件） |
| 未知参数容错 | 中（大量"忽略"字段） | **低**（不少情况 400） | **高**（静默忽略） |
| 与官方开源 demo 的对应关系 | **高**：官方 demo 的说明就是按 `thinking` / `server_tool_use` + `web_search_tool_result` / `web_fetch_tool_result` / `text` with `citations` 这几类"块"来写的，与 Messages 的 `content[]` 一一对应 | 中：需要自己把 step/calls 映射成同一套 UI 块 | 中高：item 也可映射 |

### 22.3 为什么主推 Messages 做 App

1. **UI 与协议同构**。官方文档「Render a Response」直接按块描述要怎么显示：`thinking` → 折叠思考面板；`server_tool_use` + `web_search_tool_result` → 搜索结果卡（title / site name / icon）；`server_tool_use` + `web_fetch_tool_result` → 打开的页面/读过的链接；`text` with `citations` → 带角标的答案；`stop_reason: "refusal"` → 换成拒答。**Messages 的 `content[]` 就是这几类块**，客户端几乎可以 1:1 渲染。Chat Completions 需要先把 `server_tool_calls` 的 step→calls 两层结构"翻译"成同样的块序列。
2. **引用可以实时出**。`citations_delta` 在文本流中到达，角标可以边生成边贴。Chat Completions 的 `annotations` 只在最后一个 chunk 给，做不到。
3. **`latest_reminder` 可用**（Responses 不行）。类 DeepSeek App 的"今天几号/我在哪"体验依赖它。
4. **功能无缺口**：web 工具、`safety_check`、`title`、文件、图片、续写全都在。

**代价**：需要维护一个按 `index` 的块状态机；用 `file_id` 引用图片/文档**必须带 `anthropic-beta: files-api-2025-04-14`**；`max_tokens` 不是严格上限（Claude Code 类主 agent 请求会被抬高）；`latest_reminder` / `deepseek_web_search` 这类 role/name 不在 Anthropic 官方类型里（运行时能过，但 TS/类型检查要 `# type: ignore` / 类型补丁）。

### 22.4 如果选 Chat Completions（完全可行）

功能上不缺，但必须在架构上接受三件事：
1. **引用只在最后一个 chunk 到**（`delta.annotations`），UI 需在"生成结束"回调里补画角标；
2. **思考无法按步流式切分**——`delta.reasoning_content` 是所有 step 连续流出、**无分隔符**，要用 `step_reasoning_done` 事件去归属；且 `message.reasoning_content` **只保留最后一步**；
3. **`server_tool_calls` 必须无损透传**：框架/网关一旦丢掉这个字段，请求仍然成功，但**之前读过的页面全部不在上下文中**（静默降级，是最难查的 bug）。

另外：`web_search_options` / 非 `text` 的 `response_format` / `logprobs` 在声明 web 工具时**直接 400**；`tool_choice` 的 `required`/具名在思考模式**直接 400**；无法在会话中插入 tool call。

### 22.5 为什么不用 Responses 做 App

- **`latest_reminder` 明确不接受** → 日期/地点元数据标记这条能力直接缺失。
- **不支持续写**（`input` 以 assistant `message`/`reasoning` 结尾 → 400）→ 断线重连后"接着写"做不了。
- 无状态且 `previous_response_id` / `conversation` 不支持 → 与另两个协议一样要自己拼历史，但事件模型最复杂。
- `web_search` 内置工具**仅 v4-pro**，而 App 想用的 vision 只有 flash → 两套能力互斥。
- 优点（静默忽略未知参数、`apply_patch`、Codex 生态）对 App 没价值。

### 22.6 落地建议（不依赖最终选型）

无论选哪个协议，下面这些是**共同前提**：

1. **端点/路径别拼错**：chat 无 `/v1`，tools 有 `/v1`，Anthropic 是 `/anthropic/v1/messages`。
2. **必须处理 keep-alive**：流式 `: keep-alive`、非流式空行；10 分钟无推理会被服务端关连接。
3. **HTTP 200 也可能失败**：生成中途出错时三协议都是 200，必须在流尾判 `error` / `response.failed` / `finish_reason`。
4. **`max_tokens` 是"每步"限制**（声明 web 工具/安全审核/标题时），不是整轮。
5. **历史逐字回传**才能吃上下文缓存；`signature` / `server_tool_calls` / `reasoning_content`（带 tools 时）一个都不能丢。

---

## 23. 附录：抓取来源清单 / 未覆盖项

### 23.1 抓取逐一核对（全部 HTTP 200，英文 `.md` 版）

| # | 页面 | URL |
|---|---|---|
| 1 | 思考模式 | `https://api-docs.deepseek.com/guides/thinking_mode.md` |
| 2 | Chat Completions API | `https://api-docs.deepseek.com/api/create-chat-completion.md` |
| 3 | Web Tools | `https://api-docs.deepseek.com/guides/web_tools.md` |
| 4 | Vision | `https://api-docs.deepseek.com/guides/vision.md` |
| 5 | File Parsing（文档解析） | `https://api-docs.deepseek.com/guides/document_parsing.md` |
| 6 | Files API | `https://api-docs.deepseek.com/guides/files_api.md` |
| 7 | TTS | `https://api-docs.deepseek.com/guides/tts.md` |
| 8 | ASR | `https://api-docs.deepseek.com/guides/asr.md` |
| 9 | OCR | `https://api-docs.deepseek.com/guides/ocr.md` |
| 10 | Model Content Safety | `https://api-docs.deepseek.com/guides/safety.md` |
| 11 | Conversation Title | `https://api-docs.deepseek.com/guides/conversation_title.md` |
| 12 | User Metadata Marker | `https://api-docs.deepseek.com/guides/latest_reminder.md` |
| 13 | Context Caching | `https://api-docs.deepseek.com/guides/kv_cache.md`（注：`/guides/context_caching` 路径不存在，会 302 到首页） |
| 14 | Error Codes | `https://api-docs.deepseek.com/quick_start/error_codes.md` |
| 15 | Rate Limit & Isolation | `https://api-docs.deepseek.com/quick_start/rate_limit.md` |
| 16 | Responses API | `https://api-docs.deepseek.com/guides/responses_api.md` |
| 17 | Anthropic API | `https://api-docs.deepseek.com/guides/anthropic_api.md` |
| 18 | JSON Output | `https://api-docs.deepseek.com/guides/json_mode.md` |
| 19 | Tool Calls | `https://api-docs.deepseek.com/guides/tool_calls.md` |
| 20 | Build a Chatbot（App 全能力总览 + Ignored Parameters） | `https://api-docs.deepseek.com/guides/build_a_chatbot.md` |
| 21 | Models & Pricing | `https://api-docs.deepseek.com/quick_start/pricing.md` |
| 22 | Messages API（Anthropic 参考） | `https://api-docs.deepseek.com/api/create-message.md` |

> 补充发现：`/guides/build_a_chatbot` 是官方给「做自己的聊天机器人」的入口页，含**功能地图**、三协议快速示例、**Render a Response**（各类块怎么显示）与 **Ignored Parameters** 表——做 App 必读。官方还提供开源 demo：试玩 `https://cdn.deepseek.com/chat-demo`，源码 `https://github.com/deepseek-ai/chat-demo`（含 web 搜索/深度思考搜索/URL 读取、上传图片与文档、内容安全（含图片审核）、会话标题与重命名删除、编辑消息/重新生成/续写、朗读与语音输入、语言与位置设置传给模型、历史导入导出、Markdown + Mermaid 渲染、中英双语与明暗主题）。

### 23.2 明确「文档未覆盖」的项（不要靠猜实现）

1. **Chat Completions `stream_options` 的字段表**：请求 schema 里只写了引用 `ChatCompletionStreamOptions`，没有列字段（例如 `include_usage` 是否存在）。实测注意事项：**不传它也会有 usage**（最后一个 chunk 带）。
2. **Chat Completions `server_tool_event` 的原始 chunk 全文**：只给了"是 choice 上与 `delta` 平级的扩展字段"+ 三个事件的字段表，**没有给出完整原始 SSE 帧**。本文 §3.5 的示例是按字段表拼的示意。
3. **图片像素 → token 的精确公式**：只给了「缩放到约 1300×1300 总像素」「每图上限 1024 token」「低于约 544×544 会放大」三条规则；精确计算需用官方 Token & Token Usage 页的计算器。
4. **Files API 上传/解析的完整错误码清单**：Files 页只给限制，错误码集中在 File Parsing 页（400/408/413/429/500/503/504）。
5. **TTS/ASR 的音色与语言之外的细项**：TTS 只有 `stella`/`tide` 两个音色；无语速控制、无中断恢复；ASR 无流式、无 `language` 参数。
6. **OCR 对 `rich_layout_recognition` 的版面/图块输出格式**：页面只说明"逐页识别"与 `<｜ref｜>`/`<｜box｜>` 特殊 token 的存在，**没有给图块/版面块的独立字段**。
7. **Chat Completions 是否支持 `web_search_options`（单独使用）**：文档只说"在声明 `deepseek_web_search`/`deepseek_read_url` 的请求里 `web_search_options` 返回 400"，且请求 schema 未列出该字段——**是否已完全移除未明确**。
8. **`deepseek-v4-pro` 在 Chat Completions 侧收到图片时的确切行为**：pricing 表只说 Vision「Not supported」；只有 Anthropic 页明确"替换为文本 `[Unsupported Image]`"。OpenAI 格式侧的行为**文档未覆盖**。

### 23.3 版本与时效提醒

- 抓取时点：2026-11-18。模型标识 `deepseek-flash` = DeepSeek-V4.1-Flash-1017；`deepseek-v4-pro` = DeepSeek-V4-Pro-0813。
- 价格分**峰谷**：峰时为 UTC 周一至周五 `01:00–04:00` 与 `06:00–10:00`（不含中国法定节假日），其余时段为谷时（谷时是峰时的一半）。
- **自北京时间 2026-11-18 12:00 起**，调用模型时触发的服务端搜索/抓取**不再单独计费**，只收模型 token 费。

---

*本文档由逐页抓取官方英文文档整理；所有代码块中的 URL、端点、字段名可直接使用。任何与官方页面冲突之处，以官方页面为准。*
