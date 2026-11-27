# Deepseek APP · 长文档库分支

基于 [Sauomore/Deepseek-APP](https://github.com/Sauomore/Deepseek-APP) 1.2.0 的扩展分支。

在原版基础上增加了**本地长文档检索**，并优化了**流式输出**。

---

## 新增功能

### 长文档库

设置页新增「长文档库」入口。导入 `.txt` 后，App 会在本机建立全文索引；
之后每次提问，自动检索出最相关的几段原文，随问题一起发给模型。

```
设置 → 长文档库 → 导入 .txt
```

**技术方案**：SQLite FTS5 全文索引（WASM 版，跑在 WebView 里）

- 文本按行切块，块间保留重叠，避免答案被切在边界上
- 中文做字符级 2-gram 预处理后入库 —— FTS5 的 trigram 分词器对 2 字词无效，实测不可用
- 检索用 BM25 排序，查询词之间是 OR 关系而非 AND
- 索引整库导出后存进 IndexedDB，**不常驻内存**

**已验证**：导入大体积文本建库正常，提问能检索出相关段落并正确注入上下文。

### 索引不想要了

设置页同一处有「清空长文档库」，删除索引不影响对话记录。

---

## 改动

### 1. 流式输出优化

原版在长回复时会卡顿。原因是每次增量更新都会把所有段落重新解析一遍 Markdown：

每段渲染组件依赖的函数每次都是新引用，缓存全部失效，于是 N 段回复每帧重算 N 次。

三处改动：

| 改动 | 文件 |
|---|---|
| 渲染组件加 `memo`，只比较真正影响输出的字段 | `MarkdownView.tsx` |
| 新增 `light` 渲染模式，流式期间跳过高开销的二次解析 | `markdown.ts` |
| 更新节流间隔调大，减少布局次数 | `chat.ts` |

流式结束后会自动用完整模式重新渲染一次，公式、代码高亮、图表都正常。

### 2. 上下文上限

放宽了客户端侧的 token 上限常量：

| 常量 | 文件 |
|---|---|
| `MAX_TOKENS` | `src/api/request.ts` |
| `MAX_OUTPUT_TOKEN_LIMIT` | `src/types/settings.ts` |

> 客户端常量放宽不代表服务端一定接受，实际可用上限由服务端决定。

---

## 文件清单

**新增**

```
src/lib/longdoc/db.ts           长文档库（切块 / 分词 / 索引 / 检索 / 持久化）
src/components/LongdocPanel.tsx  设置页入口
public/sqlite3.wasm              SQLite WASM 运行时
```

**修改**

```
package.json                     + @sqlite.org/sqlite-wasm
src/api/request.ts               支持把检索结果注入最后一条用户消息
src/store/chat.ts                提问前触发检索；流式节流调整
src/components/SettingsPage.tsx  挂载长文档库面板
src/components/MarkdownView.tsx  memo + 流式跳过图表水合
src/lib/markdown.ts              light 轻量渲染模式
src/types/settings.ts            token 上限常量
```

---

## 构建

```bash
npm install
npm run build      # tsc -b && vite build  → dist/
npm run apk        # 需要本地 Android SDK
```

没有 Android SDK 时，只改前端可以这样绕过：

```
1. npm run build
2. 用 dist/ 的全部内容替换 APK 里 assets/public/（含 sqlite3.wasm）
3. 补齐 v2/v3 签名（jarsigner 只有 v1，targetSdk 36 会被系统拒绝安装）
```

---

## 数据与隐私

长文档库完全在本机运行 —— 切块、建索引、检索都在设备上完成，**原文不会上传**。

但整个 App 不是纯本地的，以下几点需要知道：

| 数据 | 是否出网 |
|---|---|
| 设置、对话记录、长文档索引 | 否 |
| 对话内容 | 是，随 API 请求发送 |
| 文件附件 | 是，上传到 Files API |
| 语音输入 | 是，上传到语音识别接口 |

去向只由设置页的 Base URL 决定，默认 `https://api.deepseek.com`。
另外 App 启动时会检查 GitHub Release 更新（只读版本号，无开关）。

---

## 已知限制

1. **只认字面** —— BM25 无法处理同义词。换个说法提问可能检索不到，
   需要主题索引层或 embedding 才能彻底解决；
2. **切换文档需重建** —— 目前不支持增量追加，换文档请先清空；
3. **签名** —— 本分支用 debug 签名，与官方包不一致，覆盖安装会失败。

---

## 致谢

上游项目：[Sauomore/Deepseek-APP](https://github.com/Sauomore/Deepseek-APP)
