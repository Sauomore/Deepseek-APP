# 质量验证报告

本文件记录交付前实际做过的验证、验证方法，以及**无法验证**的部分（诚实披露）。

---

## 1. 可以安装的产物

| 文件 | 大小 | 说明 |
| --- | --- | --- |
| `release/Deepseek-APP-1.0.8-release.apk` | 5.99 MB | **推荐安装**，已签名，versionCode 9 / versionName 1.0.8 |
| `release/Deepseek-APP-1.0.8-debug.apk` | 7.23 MB | 调试版，`chrome://inspect` 可远程调试 |
| `release/keystore-do-not-lose.keystore` | 2.7 KB | release 签名密钥（口令见 `android/keystore.properties`），**升级安装必须用同一密钥** |

> 修bug记录：1.0.1 粘贴 Key 后确认点不动 · 1.0.2 设置里模型/思考强度点不动 + 发送改为仅按钮 · 1.0.3 Key 在设置里不显示 + 输入法组词后按钮不出现 · 1.0.4 带图片发消息时文字丢失 + 搜索卡片折叠 · 1.0.5 发送按钮常驻 + 长按录音 · 1.0.6 粘贴失效 + 更新公告 + Mermaid 保存 + 推荐问题随机 · 1.0.7 输入框体验 + 系统提示词热更新 + 状态栏/字号修复 · 1.0.8 所有输入框支持中间插入。
> versionCode 每次 +1，可直接覆盖安装旧版本，无需先卸载。

签名信息（`apksigner verify --print-certs`）：

```
Signer #1 certificate DN: CN=DeepSeek Mobile, OU=Personal Use, O=Unofficial Client,
                          L=Shanghai, ST=Shanghai, C=CN
SHA-256: 27a2dd524fa50457ecc7748ec48a9a56161b51f300389eb5c3006cb3033b9823
```

APK 元信息（`aapt dump badging`）：

```
package: com.deepseek.mobile  versionCode=9  versionName=1.0.8
sdkVersion=24  targetSdkVersion=36  compileSdk=36
permissions: INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, VIBRATE
application-label: Deepseek APP
```

## 2. 真实 API 联调（用真实 Key 逐条验证）

这是本次交付最关键的部分：所有接口假设都拿真实服务验证过，而不是只对着文档写。

| 链路 | 验证方式 | 结果 |
| --- | --- | --- |
| 流式事件序列 | 直接抓原始 SSE | ✅ `message_start` → `content_block_start` ×N → `ping` → `content_block_delta` → `message_delta` → `message_stop`，与解析器完全对齐 |
| 思考模式 | `thinking.enabled` + `effort` | ✅ 返回 `thinking` 块且带 `signature`；`output_tokens_details.thinking_tokens` 有值 |
| 联网搜索 | 真实提问触发 `deepseek_web_search` | ✅ 一次返回 13–19 条来源；含 `open_page` 并行读页与 `web_fetch_tool_result` |
| 引用 | 正文 `citations` | ✅ `web_search_result_location` 带 url/title；角标编号与来源卡片一致 |
| 会话标题 | `title.enabled` | ✅ `message_delta.delta.title` 返回「V4.1上下文输出参数」 |
| 多轮上下文 | 回传思考块 + 工具块 + `signature` | ✅ 无 400；第二轮能引用第一轮结论 |
| 识图 | base64 PNG（形状图） | ✅ 准确描述「粉红圆形 / 蓝色圆角正方形 / 绿色三角形」 |
| 文档解析（DOCX） | `purpose=text_recognition` | ✅ 正确抽出项目代号/负责人/预算 |
| 文档解析（PDF） | `purpose=rich_layout_recognition` | ✅ 图像型 PDF 也能读出全部字段 |
| 表格（XLSX） | `purpose=user_data` | ✅ 转 Markdown 后正确回答三行预算 |
| 语音识别 | 系统 TTS 生成 16k 单声道 WAV | ✅ 转写与原文逐字一致 |
| 401 错误 | 故意用无效 Key | ✅ 中文提示 + 服务端原因 + request_id + 重试按钮 |

**联调中发现并修掉的 5 个真实缺陷**（如果只写不测，这些都会在用户手里炸）：

1. **缺 `anthropic-beta: files-api-2025-04-14`** —— 带文档的请求会 400 `Missing or invalid anthropic-beta header`。
2. **`purpose` 用错** —— txt/md/xlsx 等必须用 `user_data`，用解析类 purpose 直接 400。
3. **`open_page` 工具卡永久转圈** —— 这类调用的结果块是 `web_fetch_tool_result`，原先只按 `web_search_tool_result` 配对。
4. **引用角标编号错误** —— 原先取的是「数组最后一个下标」，导致所有角标显示同一个数字；改为 `register()` 返回稳定编号。
5. **一次搜索 19 条来源全渲染** —— 改为默认展示 4 条 + 展开，并把被引用的来源自动排到前面。

### 2.1 真机反馈修复

#### 1.2.0 —— 检查更新（应用内升级）+ 入口样式调整

**检查更新**

- `GET /repos/Sauomore/Deepseek-APP/releases/latest`（公开仓库，无需 token），取 `tag_name` 与资源里的 `*.apk`，用语义化版本比较当前版本。
- **WebView 无法直接下载安装包**：Release 资源会 302 到 `objects.githubusercontent.com`，该响应不带 CORS 头，页面内 `fetch` 直接 `TypeError: Failed to fetch`（已实测复现）。因此下载改由**原生插件 `AppUpdaterPlugin`** 用 `HttpURLConnection` 完成：写入 `cacheDir/updates/`，每 150ms 通过 `notifyListeners('progress')` 回报进度，完成后 `FileProvider` + `ACTION_VIEW` 拉起系统安装器。
- 首启需要「安装未知来源的应用」：插件里 `canRequestPackageInstalls()` 不通过时跳到 `ACTION_MANAGE_UNKNOWN_APP_SOURCES` 并提示。
- 安装完成后由 `PackageReplacedReceiver`（`MY_PACKAGE_REPLACED`）尝试重新拉起应用；Android 可能拦截后台 Activity 启动，安装器的「打开」按钮是兜底。
- 浏览器预览环境走 `openExternal(apkUrl)`，不安装。

**验证**

| 场景 | 结果 |
| --- | --- |
| 真实 GitHub API（当前 1.2.0，最新 v1.1.0） | 显示「已是最新版本 v1.2.0」，提示最新发布 v1.1.0 ✅ |
| 伪造 v9.9.9 响应 | 显示「发现新版本 v9.9.9（当前 v1.2.0）」+ 安装包约 6MB + 发布说明 + 按钮 ✅ |
| 页面内 fetch 真实 APK | `TypeError: Failed to fetch`（CORS 拦截）→ 证实必须原生下载 ✅ |
| Java 插件编译 | `assembleRelease` 通过 ✅ |

**UI 调整**

- 抽屉入口改为 `[图标] 创作模式 ›` 单行样式，无卡片底色（`background: rgba(0,0,0,0)`，无副标题）✅
- 创作模式灵感输入框占位为「请输入灵感」✅

#### 1.1.0 —— 创作模式（新功能）

长文写作工作台，面向论文、小说、连载等需要连续输出的场景。

**能力**

- 作品管理：多部作品并存，正文/大纲存 IndexedDB；列表显示类型、字数、章节数
- 大纲编写：设定/主题/写作要求、人物（姓名 + 性格经历动机）、章节大纲（标题 + 剧情概要）；大纲每轮重新注入 system prompt，改动下一轮即生效
- 多轮续写：每轮一次 Messages 请求，流式输出，保留该轮思考过程（折叠面板）；可设每轮目标字数 600–3000
- 联网查资料：创作模式内开关搜索/读链接，请求体按需声明 `deepseek_web_search` / `deepseek_read_url`
- 导出 TXT：全文拼接后经 `saveBlob`（Capacitor Filesystem + Share）保存/分享；浏览器环境回退为下载

**验证**

| 场景 | 结果 |
| --- | --- |
| 抽屉入口 → 新建作品 → 落地大纲页 | ✅ |
| 大纲编辑（设定/人物/章节）→ 切页再回来 | 值保留 ✅ |
| 刷新页面后重进 | 作品、大纲、正文、字数全部恢复 ✅ |
| 演示模式续写 | 流式写入第 1 轮，字数 112 ✅ |
| 真实 API 续写（600 字目标 / 思考高 / 搜索开） | 请求体 `thinking.enabled` + `effort.high` + `max_tokens 16384` + 两个搜索工具；system 含人物与章节大纲；产出 1337 tokens，界面出现思考面板，总字数 659 ✅ |
| 导出 | 触发保存并提示「已导出 TXT」✅ |

#### 1.0.9 —— 输入框无法在文段中间输入（已由用户确认修复）

1.0.8 发布后用户反馈问题仍在，而 Chrome 端用 `Input.imeSetComposition` 模拟中文组词完全正常
（composer：`abcdef` → 中间组词 → `abc中def`，caret 正确；设置 Key 同样正常）。说明问题在 Android WebView 原生层，
于是 1.0.9 加入可观测手段并同时做三处隔离：

- **`AndroidManifest` 显式声明 `android:windowSoftInputMode="adjustResize"`**（之前未声明；系统可能选 adjustPan，
  键盘/候选栏高度变化时平移窗口 → WebView 输入法连接被打断、光标复位到末尾）。这是最可能的根因。
- 输入框高度测量从隐藏 `<textarea>` 改为隐藏 `<div>`：页面不再存在第二个可编辑节点。
- 设置页 API Key / 接口地址移除逐键 `setState`，打字期间零 React 重渲染。
- 保留「设置 → 关于 → 输入诊断」作为常驻排查工具（记录 keydown / beforeinput / input / composition / select + 光标位置）。

用户安装 1.0.9 后确认问题解决。

#### 1.0.8 —— 所有输入框都无法在文字中间插入内容

**现象**：任何输入框（聊天输入框、搜索、重命名、API Key、接口地址、系统提示词）在文字中间点光标后再打字，字符会被吞掉或光标立刻跳到末尾，只能追加输入。

**根因（两类）**

1. **受控输入框被 React 重写**：`value={state}` + `onChange` 的输入框，每次 state 变化都会重渲染并回写 `input.value`。Android WebView 在回写时会把光标复位到末尾，输入法组词阶段尤其明显，所以中间插入基本不可用。
2. **聊天输入框每次按键都重排自身**：旧的自动增高为了测出内容高度，会把 `height` 先置为 `auto` 再读 `scrollHeight`。对被聚焦的 textarea 做重排会让 Android WebView 提交组词并把光标弹到末尾。

**修复**

- 5 个受控输入框全部改为**非受控**（`defaultValue` + ref，提交时读 DOM）：聊天搜索、会话重命名、引导页 Key、设置页 Key、接口地址；系统提示词输入框顺带修复了"二次打开显示旧草稿"的问题。
- 聊天输入框的自动增高改为**隐藏镜像测量**：用一个离屏 textarea 复刻字体/行高/内边距/宽度，在它上面量高度，真实输入框只在行数变化时改一次高度，并在改完后恢复选区。
- IME 组词期间（`compositionstart` → `compositionend`）完全跳过高度调整；另外每 220ms 的兜底轮询里也会补一次测量，避免某些键盘不发 `compositionend` 导致高度卡住。

**验证（逐项实测）**

| 输入框 | 操作 | 结果 |
| --- | --- | --- |
| 聊天输入框 | `abcdefghij` 在第 6 位插入 `XY` | `abcdeXYfghij`，caret=7 ✅ |
| API Key（设置） | 中间插入 `ZZ` | `sk-test-key-12ZZ34...`，caret=16 ✅ |
| 接口地址 | 中间插入 `YY` | `https://api.YYdeepseek.com`，caret=14 ✅ |
| 系统提示词 | 中间插入 `YY` | `你是一位YY严谨的技术顾问。`，caret=6 ✅ |
| 引导页 Key | 第 4 位插入 `MID` 并提交 | `sk-MIDonboarding-...`，保存进设置 ✅ |
| 会话重命名 | 第 3 位插入 `XX` 回车 | 标题变为 `新的XX对话` ✅ |
| 抽屉搜索 | 输入「苹果」→ 清空 | 2 条→1 条→2 条，清空按钮复位 ✅ |

输入框高度回归：40 / 64 / 88px（1/2/3 行），4 行锁定 88px 内部滚动并出现全屏按钮 ✅

#### 1.0.7 —— 输入体验 / 系统提示词热更新 / 状态栏与字号

**① 输入后发送按钮不亮、光标无法插入文段中间**

- 根因：Android WebView 的输入法可能只发 `compositionend`（甚至什么都不发），React 侧文字镜像不更新 → 发送按钮不变蓝；同时每次按键都重排 textarea 高度会让 WebView 把光标弹到末尾。
- 修复：
  - 新增 220ms 的 DOM 轮询同步（仅当 DOM 值与镜像不一致才 setState），键盘发不发事件都能跟上；
  - 高度不再反复翻转 `height:auto`，只在目标高度变化时重排，重排后立即恢复选区；
  - 组词期间（`compositionstart`→`compositionend`）完全不改高度。
- 验证：输入「测试文字」→ 按钮 `is-active`；光标移到第 2 位再输入 → `测试X文字`、caret=3。

**② 深色模式顶部状态栏不跟随**

- 根因：targetSdk 36 在 Android 15+ 强制边到边，`StatusBar.setBackgroundColor()` 变成 no-op，状态栏露出的是窗口背景（白色）。
- 修复：改为 `overlaysWebView: true`，让应用自己绘制状态栏区域（页面背景即状态栏背景），`chat-header` 增加 `--safe-top` 内边距，再用 `setStyle` 控制图标明暗。
- 验证（模拟 24px 状态栏）：聊天页 header 78px、菜单按钮顶 31px；抽屉首行 40px；设置页标题 38px —— 均未被遮挡。

**③ 字号设置未生效**

- 根因：之前只改 `--md-fs`（仅影响正文 Markdown），而 UI 大量字号是写死的 px。
- 修复：改用 `document.documentElement.style.zoom` 做整站缩放（0.92 / 1 / 1.12）。
- 验证：推荐卡片高度 92 / 100 / 132 px；三档均无横向溢出。

**④ 自定义系统提示词（热更新，已有对话也生效）**

- 每次请求都重建 system；按模型能力区分：`deepseek-flash` 为 `in-history`（对话中途改提示词会在历史尾部追加 system 消息，覆盖之前所有提示词），`deepseek-v4-pro` 为 `leading-only`（只改首条 system）。
- 验证（真实 API）：第二轮修改提示词为「回答里必须包含香蕉」，请求体 `system` 为新提示词 + 日期上下文，`messages` 末尾出现 `role: "system"`，回答以「香蕉」开头。

**⑤ 最大输出 token**

- 透传 `max_tokens`，上限 393216，0 表示交给服务端默认。
- 验证：设 64 → 请求 `max_tokens: 64`，回答被截断并出现「回答被截断」提示。

**⑥ 思考强度改为官方同款 off / low / high / max**

- `off` → `thinking:{type:"disabled"}` 且不带 `output_config`；其余 → `enabled` + `output_config.effort`。
- 验证：off 时请求体为 `thinking:{type:"disabled"}`，无 `output_config`。

**⑦ 设置新增更新日志 / 首页推荐开关，首页移除模型切换与副标题**

- 验证：更新日志列出 v1.0.7（当前）与 v1.0.6；关闭推荐后空对话 0 张卡片；首页无模型下拉、无副标题文案。

**⑧ 输入框三行上限 + 全屏编辑**

- 尺寸：一行 40px、两行 64px、三行 88px（24px 整数行高 + 8/8 内边距，整除不裁切）；超过三行锁定 88px 内部滚动，最新内容贴底（`scrollTop` 为 24 的整数倍）。
- 到三行时框上方预留 20px 条带出现全屏按钮；实测按钮矩形与文本区矩形**不相交**，不会遮住第一行右端。
- 全屏编辑器：收起按钮 / 字数 / 发送；打开自动聚焦并把光标放到末尾；收起文字不丢（57 字 → 57 字）；全屏内可直接发送。
- 回缩修复：测量前先把高度置为 `auto`，否则 `scrollHeight` 不低于当前高度、框只能长不能缩；实测 88 → 64 → 40 正常回缩。

#### 1.0.6 —— 粘贴失效修复 / 更新公告 / Mermaid 保存 / 推荐问题随机

**① 部分情况下复制粘贴失效（长文本粘贴没反应）**

- 先排除长度限制：用 10,000 字符实测可完整写入，`src` 里也没有任何 `maxLength`。
- 真正原因：1.0.5 加入的「长按输入框录音」占用了系统**长按粘贴**的同一个手势，
  而且在空输入框时还对 `contextmenu` 调了 `preventDefault()`，系统粘贴菜单直接被吞掉；
  一旦长按满 420ms 还会弹录音层并让输入框失焦，粘贴内容无处落地。
- 修复：
  - 移除 `contextmenu` 的 `preventDefault`，系统粘贴/选择菜单恢复；
  - 长按录音阈值提到 700ms，并在系统弹出长按菜单（`contextmenu` / `selectstart`）时立即取消录音；
  - 只在**输入框为空**时才启用长按录音；已有文字时长按完全交还系统做选中/粘贴。
- 验证（打包产物实测）：

| 场景 | 结果 |
| --- | --- |
| 空输入框派发 contextmenu | `defaultPrevented = false`（粘贴菜单可用）✅ |
| 粘贴 12,500 字符 | 完整写入，发送按钮变蓝 ✅ |
| 空输入框长按 1s | 仍能弹出录音层 ✅ |
| 已有文字时长按 1s | 不触发录音、交给系统选择 ✅ |

**② 首次安装打开显示更新公告**

- 新增 `UpdateNotice`：`localStorage['deepseek.lastSeenVersion.v1']` 与 `APP_VERSION` 不一致时弹窗，
  点「知道了」写入当前版本；中途强杀则下次继续提示。
- 公告内容来自 `src/lib/version.ts` 的 `RELEASE_NOTES`，本次三条即为用户指定文案。
- 验证：清空存储 → 进入演示模式后自动弹出「更新公告 / Deepseek APP v1.0.6 · 2026-11-19」，
  三条文案正确，点「知道了」后写入 `1.0.6` 并关闭 ✅

**③ Mermaid 架构图保存为图片**

- 每张图右上角新增「保存」按钮；导出流程：克隆 SVG → 取 `viewBox` 尺寸 → 补白底 →
  通过 `<img>` + canvas 以 2× 栅格化为 PNG；若 WebView 拒绝栅格化（含 `foreignObject` 的旧内核）
  则自动降级保存 `.svg` 矢量文件。
- 保存通道：Android 走 `@capacitor/filesystem`（写入缓存）+ `@capacitor/share`（系统分享面板，
  可存相册/文件或直接发送）；浏览器环境回退为下载。
- 验证（打包产物）：两处图块均出现保存按钮，点击后生成 1104×2256、240KB 级别的 PNG
  （58 万非白像素，确认不是空白图），并提示「图表已保存」✅

**④ 首页推荐问题改为随机**

- 新增提示词库 `src/lib/suggestions.ts`（24 条，覆盖联网搜索/深度思考/代码/架构图/写作/学习/生活），
  首页每次进入空会话随机抽 4 条，并按会话 id 重新抽取。
- 验证：连续新建 7 个会话得到 7 组不同组合 ✅

#### 1.0.5 —— 发送按钮常驻 + 语音改为长按输入框

用户反馈：多轮对话从第二轮开始"发送按钮消失"；建议把语音改成"长按对话框"，发送按钮改成右侧常驻。

- 根因：右侧按钮原本在「麦克风」和「发送」之间按 React state 切换；
  state 一旦没跟上原生输入框（同一类 IME/粘贴不同步问题），第二轮就会一直显示麦克风，
  看起来就是"发送按钮消失了"。
- 修复（按用户建议，彻底去掉这个状态分支）：
  - **发送按钮常驻右侧**，不再和麦克风互换；无内容时灰显、有内容时变蓝，但始终可点
    （点击时直接读输入框真实值，空内容静默忽略）。
  - **语音改为长按输入框**：按住约 0.4 秒弹出录音界面，松手停止并自动转写进输入框；
    首次聚焦会提示一次「长按输入框可以说话」。语音入口在「+」菜单里仍保留。
- 验证：

| 场景 | 结果 |
| --- | --- |
| 空输入框 | 发送按钮存在且灰显；无麦克风图标 ✅ |
| 输入文字 | 按钮变蓝（`is-active`）✅ |
| 第二轮输入 | 按钮仍在、仍变蓝（修复前会变回麦克风）✅ |
| 发送后 | 按钮回到灰显，不再"消失" ✅ |
| 长按输入框 0.7s | 弹出录音界面 ✅（无麦克风环境下停在"正在启动麦克风"） |

#### 1.0.4 —— 带图片发消息时文字丢失 / 搜索卡片折叠

**① 图片 + 文字一起发送时，文字丢失不显示**

用户反馈：带图片发消息，图片发了，但打的字没显示出来。

- 复现：给输入框写入文字但**不派发 `input` 事件**（输入法提交路径），同时已附图。
  此时发送按钮因附图而始终可用，`send()` 读到的 React state 仍是空 → 发出「只有图片、没有文字」的消息。
- 更深一层：输入框原本是**受控组件**，React 每次重渲染都会用 state 覆盖 DOM 值，
  所以"未同步进 state 的文字"在点发送前就已经被抹掉（探针显示 blur 时 `textarea.value` 已为空）。
  因此"仅在发送时读 DOM"不够。
- 修复：输入框改为**非受控**（`defaultValue` + ref 为准），DOM 成为唯一真相：
  - 发送时读 `textareaRef.current.value`；发送后手动清空 DOM 并复位高度；
  - 聚焦/失焦/输入/组词结束都同步 state 镜像（仅用于按钮与占位状态）；
  - 语音转写结果直接写入 DOM + state。
- 验证：

| 场景 | 结果 |
| --- | --- |
| 附图 + 静默写入文字后发送 | 气泡正确显示「这张图里有什么」✅（修复前为 null，只有图片） |
| 正常输入 | 发送按钮立即出现，麦克风隐藏 ✅ |
| 输入中按回车 | 换行、不发送 ✅ |
| 多行内容点按钮发送 | 两行原样保留 ✅ |
| 发送后 | 输入框清空、高度复位、麦克风按钮恢复 ✅ |

**② 搜索/网页预览改为折叠（与思考过程一致）**

- 需求：搜索时的网页预览像思考面板一样折叠起来，展开后保持原来的样子。
- 实现：「深度思考搜索」与「阅读网页」两张卡片的整个头部变成可点击的折叠开关
  （标题 + 摘要 + 数量角标 + 旋转箭头），**默认收起**；展开后显示查询词、
  来源列表（前 4 条 + 展开全部 N 条）、网页列表（前 3 个 + 展开全部）。
- 验证：真实 API 一轮返回 14 条来源 + 2 个网页，两张卡默认均为收起态；
  点开「阅读网页」正确列出 2 条网页记录 ✅

#### 1.0.1 —— 粘贴 Key 后「确认」点不动

用户反馈：把 API Key 粘贴进输入框后，下面的「填入 Key 并开始」点了没反应。

**根因**：部分安卓 WebView / 输入法用长按「粘贴」或键盘智能插入时，只改了输入框的 DOM 值，
**不派发 `input` 事件**，React 的受控 state 因此仍为空；而按钮当时用 state 长度做禁用条件
（`disabled={apiKey.length <= 10}` + `pointer-events: none`），于是永远点不动。

**修复**（已用"静默粘贴"精确复现并验证）：

- 按钮不再禁用，点击时**优先读取输入框的 DOM 值**，读不到才回退到 state；
- 补 `onInput` / `onBlur` 同步，并在按键区按下 Enter（输入法"确认/完成"键常映射为 Enter）也提交；
- 输入框下方实时显示「已识别 35 个字符」或「太短了」，给出明确反馈；
- 输入聚焦时自动把卡片滚动到视野中间，避免被软键盘遮住；
- 设置页的 API Key / Base URL 输入框同样改为读 DOM 值，避免同一类丢失。

验证方式（浏览器注入 `input.value = '...'` 且不派发任何事件，完全模拟该失败场景）：

| 场景 | 结果 |
| --- | --- |
| 静默粘贴后按钮状态 | `disabled = false`（旧版为 true） |
| 静默粘贴后点击 | 成功保存 35 字符 Key，进入聊天页 ✅ |
| 粘贴过短内容后点击 | 提示「API Key 看起来不完整」，停留在欢迎页 ✅ |
| 正常输入 + 按 Enter | 提示「已识别 35 个字符」，直接进入聊天页 ✅ |

#### 1.0.3 —— 开始页填的 Key 在设置里不显示 / 输入法组词后要再按一次回车才出现发送按钮

**① Key 显示为空（还会误删真 Key）**

用户反馈：在欢迎页填的 Key，进设置看不到，得在设置里重新填一次。

- 根因：`SettingsPage` 整个应用生命周期都挂载着（只是 `open` 为 false 时 `return null`），
  它用 `useState(settings.apiKey)` 做草稿副本，而 `useState` 只在**首次挂载**取一次值——
  那时 Key 还是空的。于是设置页永远显示空值。
- 副作用更危险：这个空字段一旦失焦，`commitKey()` 会把 `''` 写回存储，**真的把 Key 清掉**。
- 修复：打开设置时从 store 重新同步草稿（`useEffect(..., [open])`）。
- 验证：欢迎页填 Key → 设置页字段显示 35 字符；点进字段再 Tab 出去，存储里仍是 35 字符（旧版会变 0）。

**② 输入法组词后必须再按一次回车才出现发送按钮**

用户反馈：打完字发送按钮不出现，要再按一次 Enter 才出现。

- 根因：安卓输入法提交中文时，有些 WebView 只派发 `compositionend`，**不派发 `input` 事件**；
  React 的 `onChange` 依赖 input 事件，于是 `text` state 一直为空 → 按钮还停在麦克风图标。
  再按一次回车是普通按键，会补一个 input 事件，所以按钮"突然"出现了。
- 修复：给输入框补 `onInput` 与 `onCompositionEnd` 两条同步路径（都从 DOM 读值）。
- 验证：
  - 模拟"只发 compositionend"：输入框写入「你好世界」→ 按钮立即从麦克风切为发送 ✅
  - CDP 真实输入法路径：组词过程中（`nihao`）按钮就已出现，提交后变「你好」✅

**③ 文案调整**

- 输入框占位符 → 「与 Deepseek 聊天」
- 空状态标题 → 「今天想做点什么？」

#### 1.0.2 —— 设置里「当前模型 / 思考强度」点不动

用户反馈：设置页点这两行没有反应。

**根因**：这两行都会打开同一个底部弹层，但层级算错了——
`.settings-page` 用的是 `z-index: calc(--z-modal + 1) = 81`，而弹层 `.sheet` 是 `--z-sheet + 1 = 71`，
于是**弹层被设置页整个盖住**：DOM 里其实已经打开（`sheetInDom: true`），用户看不到也点不到。
用 `document.elementFromPoint()` 在该位置取到的元素是 `settings-field` 而非 sheet，直接证实。

**修复**：给整屏页面单独定义层级 `--z-settings: 62`（低于 `--z-sheet: 70`），
让所有从页面里打开的弹层/对话框都稳定浮在上面。

验证：

| 场景 | 结果 |
| --- | --- |
| 设置 → 当前模型 | 弹层可见（顶层元素为 `.sheet-head`），选 V4 Pro 生效，行文案变「V4 Pro」✅ |
| 设置 → 思考强度 | 弹层可见，选「极深」生效，行文案变「极深」✅ |

#### 1.0.2 —— 发送改为仅按钮

按需求去掉「回车发送 / Ctrl+Enter 发送」两档设置：现在**回车只换行**，发送只走右侧按钮。
设置页对应条目改为只读说明「按钮发送」，输入法回车键提示改为「换行」。

验证：

| 场景 | 结果 |
| --- | --- |
| 输入后按回车 | 文本框变成 `第一行\n`，没有发出消息 ✅ |
| 点右侧发送按钮 | 消息发出，多行内容原样保留 ✅ |

## 3. 已验证项（构建与静态核对）

| 项目 | 方法 | 结果 |
| --- | --- | --- |
| TypeScript 类型检查 | `npx tsc -b`（strict、noUnusedLocals） | 通过，0 error |
| 生产构建 | `npm run build` | 通过 |
| Android 构建 | `gradlew assembleDebug` / `assembleRelease` | 均 BUILD SUCCESSFUL |
| APK 签名 | `apksigner verify` | 通过 |
| APK 内容 | 解包核对 `assets/public/index.html` 引用与 dist 一致 | 一致 |
| WebView 配置 | 解包核对 `assets/capacitor.config.json` | `androidScheme: https`（CORS 关键） |
| 权限与清单 | `aapt dump badging` + 清单检查 | 录音权限齐全，`allowBackup=false` |
| 应用图标 | 检查 mipmap 产物 | 蓝色渐变 + 白色「DS」 |
| 启动图 | 检查各 drawable 产物 | 蓝色渐变 +「DS」+「Deepseek APP」 |
| 接口 CORS | 对 4 个端点发 `OPTIONS` 预检 | 全部回显 `Origin: https://localhost` |
| 打包后应用启动 | 以静态服务器托管 **APK 内实际产物**，浏览器加载 | 正常渲染，0 运行时错误 |
| 深/浅色、字号、主题 | 手测切换 | 正常，持久化生效 |
| 会话管理 | 重命名/置顶/删除/搜索 | 正常，重启后仍在（IndexedDB） |

## 4. 与官方开源实现的交叉验证

抓取并比对了 DeepSeek 官方开源的聊天客户端 [`deepseek-ai/chat-demo`](https://github.com/deepseek-ai/chat-demo)
源码（本地副本在 `.cache/chat-demo`，已 git 忽略），确认技术选择与官方一致：

| 项目 | 官方 demo | 本项目 |
| --- | --- | --- |
| 对话协议 | `${origin}/anthropic/v1` | 同 |
| 文件引用头 | `files-api-2025-04-14` | 同（联调后已修正） |
| 引用类型 | `web_search_result_location` | 同 |
| 工具块 | `kind: search/deep_search/read_link/...` | 同 |
| 拒答处理 | 丢弃 thinking/text，保留工具块 | 同 |
| 历史回传 | 思考块回传，`signature` 缺失补空串 | 同（已修正） |

## 5. 未验证项

| 项目 | 原因 | 建议 |
| --- | --- | --- |
| **真机安装运行** | 开发机无 Android 设备，且无硬件虚拟化（`HypervisorPresent: False`），模拟器无法启动 | 安装后按 `docs/BUILD.md` 第 6 节清单逐项确认 |
| 真实麦克风录音 | 服务器/桌面环境无麦克风 | ASR 接口本身已用 TTS 音频验证通过；录音链路（Web Audio → 16k WAV）按规范实现 |
| 系统相册/相机选图 | 无 UI 交互设备 | `<input type=file>` + Capacitor `onShowFileChooser` 标准链路；文件注入方式已验证图片处理与上传 |
| iOS | 未构建 iOS 工程 | 同一份 Web 代码可 `npx cap add ios` 复用 |

## 6. 已知问题与取舍

1. **应用体积 5.9 MB**：约 4 MB 来自 Mermaid 图表解析器（含 `elk` 布局引擎），已懒加载，不影响首屏。
2. **中文角标偶发换行**：行尾排满时 `[n]。` 的句号可能被挤到下一行，属 CJK 断行规则，不影响语义。
3. **历史图片只保留最近 6 轮**：避免请求体随对话无限膨胀（真实 API 支持更长），可调 `IMAGE_HISTORY_TURNS`。
4. **演示模式的回答是预设内容**：不是模型生成；UI 与交互是真实链路，仅数据源被替换。
5. **无插画 logo**：按需求改为纯文字「DS」字标，桌面图标同款；应用名 `Deepseek APP`。

## 7. 复核步骤

```bash
# 1. 类型与构建
npx tsc -b && npm run build

# 2. 重新打包
npm run apk:release

# 3. 安装并观察日志
adb install -r release/Deepseek-APP-1.0.0-release.apk
adb logcat -s Capacitor:V CapacitorConsole:V

# 4. 真实接口冒烟（需要一个 Key，放在 secrets/deepseek-api-key.txt）
node scripts/probe-api.mjs chat
node scripts/probe-api.mjs search
node scripts/probe-api.mjs vision
```
