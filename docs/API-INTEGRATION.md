# 接口接入说明

本文记录 App 与 DeepSeek 官方开放平台之间的**全部接口约定**，以及为什么这样设计。
所有内容来自官方文档（离线副本在 `docs/research/raw/`）。

---

## 1. 用到的端点

| 用途 | 方法与路径 | 认证头 |
| --- | --- | --- |
| 对话（主协议） | `POST {base}/anthropic/v1/messages` | `x-api-key` 或 `Authorization: Bearer` |
| 文档上传解析 | `POST {base}/files`（multipart） | `Authorization: Bearer` |
| 语音转文字 | `POST {base}/v1/tools/asr`（multipart） | `Authorization: Bearer` |
| 连通性自检 | `GET {base}/models` | 同上 |

`base` 默认 `https://api.deepseek.com`，可在设置中修改（例如自建兼容网关）。

## 2. 为什么选 Messages（Anthropic 兼容）协议

同一个能力在三种协议里都有，本项目选 Messages 的理由：

1. **响应天然是离散 block**：`thinking`、`server_tool_use`、`web_search_tool_result`、
   `web_fetch_tool_result`、带 `citations` 的 `text`。这正好对应官方 App 里
   「思考面板 / 搜索卡片 / 来源列表 / 引用角标」四类 UI，无需二次拼装。
2. **服务端执行工具**：客户端只负责把返回的块展示出来、下一轮原样回传；
   不用自己实现搜索或网页抓取。
3. **内置会话标题**：`title: {enabled: true}` 让最后一帧带上标题，省一次请求。
4. **内置内容安全**：`safety_check: {level: "high"}`，refusal 有明确的 `stop_reason`。
5. **识图、文件、思考强度都支持**，且参数已经在同一份 body 里。

Chat Completions 也支持这些（返回 `server_tool_calls` + `annotations`），
但需要客户端把工具调用与引用重新组装成块，UI 侧代码会明显更复杂。

## 3. 请求构造

`src/api/request.ts` 产出如下 body（已裁剪）：

```jsonc
{
  "model": "deepseek-flash",
  "messages": [
    { "role": "user", "content": [
        { "type": "image", "source": { "type": "base64", "media_type": "image/jpeg", "data": "..." } },
        { "type": "document", "source": { "type": "file", "file_id": "file-api-..." } },
        { "type": "text", "text": "总结这份文档的要点" }
    ]},
    { "role": "assistant", "content": [
        { "type": "thinking", "thinking": "...", "signature": "..." },
        { "type": "server_tool_use", "id": "srvtoolu_...", "name": "deepseek_web_search",
          "input": { "action": "search", "queries": ["..."] }, "kind": "search" },
        { "type": "web_search_tool_result", "tool_use_id": "srvtoolu_...",
          "content": [ { "type": "web_search_result", "title": "...", "url": "..." } ], "kind": "search" },
        { "type": "text", "text": "答案..." }
    ]}
  ],
  "max_tokens": 32768,
  "stream": true,
  "thinking": { "type": "enabled" },
  "output_config": { "effort": "high" },
  "tools": [
    { "type": "deepseek_web_search", "name": "deepseek_web_search" },
    { "type": "deepseek_read_url",  "name": "deepseek_read_url" }
  ],
  "tool_choice": { "type": "auto" },
  "safety_check": { "level": "high" },
  "title": { "enabled": true },
  "system": "当前日期：2026-11-18（周三）。用户语言：中文（简体）。"
}
```

要点：

- **工具声明**：只有开关打开时才声明；都不开时不传 `tools`。
- **`title` 只在首轮**开启，拿到标题后不再请求（官方建议，避免每轮等 5 秒）。
- **`system`** 注入当前日期/语言，等价于官方 `latest_reminder` 的效果（可在设置关闭）。
- **`max_tokens`** 是每步推理的输出上限，不是整轮上限。
- 开启思考模式后 `temperature` / `frequency_penalty` 等无效，因此不传。

## 4. 流式事件 → UI

| SSE 事件 | 处理 |
| --- | --- |
| `message_start` | 记录 model / message id |
| `content_block_start` (`thinking`) | 新建思考块，展开面板 |
| `content_block_delta` (`thinking_delta`) | 追加思考文本 |
| `content_block_delta` (`signature_delta`) | 记录签名（回传历史需要） |
| `content_block_start` (`server_tool_use`) | 渲染搜索/读链接卡片（加载态） |
| `content_block_start` (`web_search_tool_result` / `web_fetch_tool_result`) | 用结果填充卡片 |
| `content_block_start` (`text`) | 开始答案段落 |
| `content_block_delta` (`text_delta`) | 追加正文，40ms 合并刷新 |
| `content_block_delta` (`citations_delta`) | 记录该段引用，段尾渲染角标 |
| `message_delta` | `stop_reason`、`title`、`usage` |
| `message_stop` | 结束，落盘 |

解析细节（`src/api/client.ts`）：

- 必须**先按 `\n\n` 分帧再 JSON.parse**，网络分块与 SSE 帧没有对齐关系。
- `TextDecoder` 用 `{ stream: true }`，否则中文跨块会乱码。
- 忽略 `: keep-alive` 注释行。
- 用 `AbortController` 中断；停止后保留已生成内容并标记为 `aborted`。

## 5. 多轮对话的硬性要求

1. **助手回复要原样回传**，包括 `kind` 与 `signature`。
   被读取过的网页以加密形式放在 `signature` 里，不回传则后续轮次读不到网页内容。
2. 搜索/思考内容不会进入下一轮上下文，**只有答案正文会**（但块仍需回传，否则可能 400）。
3. 中断/报错的助手消息要先净化（`sanitizeBlocksForHistory`）：
   丢弃空文本块、无签名的思考块、没有配对结果的工具调用及其结果。
4. 历史图片只为最近 6 轮用户消息保留，避免请求体不断膨胀（1M 上下文下仍是好习惯）。

## 6. 内容安全与拒答

`stop_reason: "refusal"` 时：

- 已流式输出的正文**不可撤回**，客户端必须主动清空已显示的回答，只保留已执行的工具块；
- 展示统一的拒答提示，不展示具体原因（服务端不会给）；
- 输入侧违规会直接返回 `400`，错误信息含 `Content Exists Risk`，其中文提示为「内容未通过安全审核」。

## 7. Files API（文档解析）

```http
POST {base}/files
Content-Type: multipart/form-data
Authorization: Bearer sk-...

purpose=rich_layout_recognition   ← 必须在 file 之前
file=@report.pdf
```

- 响应在**解析完成后**才返回，大文件耗时较长（客户端超时设为 5 分钟并显示进度）。
- **两类 purpose 不可混用**（联调实测：用错直接 400）：

| 文件类型 | `purpose` | 上限 | 计费 |
| --- | --- | --- | --- |
| PDF / DOC / DOCX / PPT / PPTX（及图片） | `text_recognition` 或 `rich_layout_recognition` | 100 MB | 按页计费 |
| txt / md / csv / json / 源码、XLSX / XLS、EPUB / MOBI | **`user_data`** | 32 MB | 不计费 |

  `text_recognition` 只取文字；`rich_layout_recognition` 额外把图表切出来按原位置给模型（PDF/PPT 默认用这档）。
- 引用方式：`{ "type": "document", "source": { "type": "file", "file_id": "file-api-..." } }`
- **Messages 接口必须带请求头 `anthropic-beta: files-api-2025-04-14`**，否则返回
  `400 Missing or invalid anthropic-beta header`（联调实测）。本项目在每次对话请求上都发送该头。
- 单次请求最多 20 个文档、合计 8MiB 文本。

## 8. 视觉（识图）

- 仅 `deepseek-flash` 支持；`deepseek-v4-pro` 会把图片替换成 `[Unsupported Image]`，
  因此界面在 Pro 下会提示并阻止添加图片。
- 传输方式：`image` 块 + `source.type = base64`，`media_type` 支持
  `image/jpeg|png|gif|webp`。
- 限制：单图 ≤ 32MiB（base64/URL），请求体 ≤ 48MiB，最多 600 张。
- 图片会按约 1300×1300 重采样，**单图最多 1024 tokens**，所以 App 端先压到最长边
  1600px / JPEG 0.86，既省流量也不损失识别效果。

## 9. 语音转文字（ASR）

```http
POST {base}/v1/tools/asr
Content-Type: multipart/form-data
file=@speech.wav
```

- 只接受 **16-bit PCM WAV** 或 **Ogg Opus**；时长 ≤ 120 秒，大小 ≤ 8MiB。
- 浏览器 `MediaRecorder` 产出的是 WebM/Opus 或 MP4/AAC，**不能直接用**。
- 因此 App 用 Web Audio 直接抓 PCM，重采样到 16kHz 单声道并手写 WAV 头
  （`src/lib/audio.ts`），不依赖 `decodeAudioData` 的容器支持，安卓 WebView 上更稳。
- 无语言参数，服务端自动识别（支持中/粤/英/日/韩等 21 种）。

## 10. 错误码与提示

| 状态码 | 含义 | App 提示 |
| --- | --- | --- |
| 400 | 格式错误；或 `Content Exists Risk` | 「内容未通过安全审核，请修改后重试」 |
| 401 | Key 无效 | 「API Key 无效或已失效（401）」 |
| 402 | 余额不足 | 「账户余额不足（402）」 |
| 408 / 413 | 上传超时 / 文件过大 | 对应提示 |
| 422 | 参数无效 | 对应提示 |
| 429 | 触发限流 | 「请求过于频繁，请稍后再试（429）」 |
| 500 / 503 / 504 | 服务端问题 | 建议稍后重试 |

并发上限：`deepseek-flash` 2500、`deepseek-v4-pro` 500。

## 11. CORS 与「不需要后端」的依据

实测（`OPTIONS` 预检，`Origin: https://localhost`）：

| 端点 | Access-Control-Allow-Origin |
| --- | --- |
| `/anthropic/v1/messages` | 回显 `https://localhost` |
| `/files` | 回显 |
| `/v1/tools/asr` | 回显 |
| `/models` | 回显 |

Capacitor 的 `androidScheme: 'https'` 使 WebView 源固定为 `https://localhost`，
因此可以纯前端直连；Key 只存在设备本地。

## 12. 计费参考（官方价格，USD / 1M tokens）

| 模型 | 输入(缓存命中) | 输入(未命中) | 输出 |
| --- | --- | --- | --- |
| `deepseek-flash` | $0.003（低谷）/ $0.006（高峰） | $0.15 / $0.3 | $0.6 / $1.2 |
| `deepseek-v4-pro` | $0.022 / $0.044 | $0.66 / $1.32 | $1.98 / $3.96 |

高峰时段为 UTC 周一至周五 01:00–04:00 与 06:00–10:00，其余为低谷（价格减半）。
App 中每条回答下方会按高峰价估算花费，仅供参考。
