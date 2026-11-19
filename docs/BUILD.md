# 构建说明

本文覆盖「从零把项目编译成可安装 APK」的完整流程，以及在真机/模拟器上验证的方法。

---

## 1. 前置条件

| 依赖 | 版本要求 | 检查命令 |
| --- | --- | --- |
| Node.js | ≥ 20.19（推荐 22/24） | `node -v` |
| JDK | **21**（Capacitor 8 + AGP 8.13 要求 ≥ 21） | `java -version` |
| Android SDK Platform | **android-36** | `sdkmanager --list_installed` |
| Android SDK Build-Tools | **36.0.0** | 同上 |
| Android Platform-Tools | 任意近期版本（提供 adb） | `adb version` |

> 注意：JDK 8/11/17 会导致 Gradle 构建失败，必须用 21。

安装 SDK 组件（若缺失）：

```bash
sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools"
```

## 2. 环境变量

PowerShell：

```powershell
$env:JAVA_HOME      = "E:\AndroidDev\jdk21"
$env:ANDROID_HOME   = "E:\AndroidDev\android-sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

`android/local.properties` 里写 SDK 路径（已生成，换机需改）：

```properties
sdk.dir=E\:\\AndroidDev\\android-sdk
```

## 3. 构建 Debug APK（最常用）

```bash
npm install
npm run apk
```

`npm run apk` 等价于：

```bash
npm run build          # 1. tsc 类型检查 + vite 打包到 dist/
npx cap sync android   # 2. 把 dist/ 与插件同步进 Android 工程
cd android
./gradlew assembleDebug
```

产物：

```
android/app/build/outputs/apk/debug/app-debug.apk
```

> **构建卡住怎么办**：Gradle 解析依赖时会访问 `repo1.maven.org` / `plugins.gradle.org`，
> 国内网络经常"连上但收不到数据"，表现为日志停在 `> Configure project :...` 一直不动。
> 仓库已内置一份国内镜像 init 脚本，打包时加上 `--init-script` 即可：
>
> ```bash
> cd android
> ./gradlew assembleRelease --init-script aliyun-mirrors.init.gradle
> ```
>
> `android/gradle.properties` 里也设置了 15s/30s 的下载超时，避免无限等待。

安装到已连接的手机：

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 4. 构建 Release APK（可分发）

### 4.1 生成签名密钥（只需一次）

```bash
keytool -genkeypair -v -keystore deepseek-release.keystore \
  -alias deepseek -keyalg RSA -keysize 2048 -validity 10000
```

把 keystore 放在 `android/` 下（`.gitignore` 已忽略 `*.keystore`，不会误提交）。

### 4.2 配置签名

新建 `android/keystore.properties`（同样被 git 忽略，建议手动添加该规则）：

```properties
storeFile=deepseek-release.keystore
storePassword=你的口令
keyAlias=deepseek
keyPassword=你的口令
```

在 `android/app/build.gradle` 的 `android { }` 中加入：

```gradle
def keystoreProperties = new Properties()
def keystoreFile = rootProject.file('keystore.properties')
if (keystoreFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystoreFile))
}

android {
    // ...
    signingConfigs {
        release {
            if (keystoreFile.exists()) {
                storeFile rootProject.file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 4.3 打包

```bash
npm run apk:release
```

产物：`android/app/build/outputs/apk/release/app-release.apk`

## 5. 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 浏览器热更新开发（可先用 Chrome 手机模拟调试 UI） |
| `npm run build` | 类型检查 + 生产打包 |
| `npm run assets` | 由内联 SVG 重新生成全部图标与启动图 |
| `npm run cap:sync` | 同步 Web 产物与原生插件 |
| `npm run cap:open` | 用 Android Studio 打开原生工程 |

## 6. 验证清单

安装后逐项确认：

- [ ] 首次启动进入引导页，可填 Key 或选择演示模式
- [ ] 演示模式下发送「你好」，有流式输出与思考面板
- [ ] 发送「DeepSeek V4.1 有什么新特性」→ 出现搜索卡片、来源列表、引用角标
- [ ] 发送数学题 → 公式正常排版（KaTeX）
- [ ] 发送「画一个架构图」→ Mermaid 图表渲染
- [ ] 点「+」→ 相册/拍照/文件/语音四个入口可用；文档能显示解析进度
- [ ] 长按/点麦克风 → 授权后录音，停止后出现转写文字（真实 Key 模式）
- [ ] 顶部模型名可切换 flash / v4-pro
- [ ] 侧边栏会话：重命名、置顶、删除生效，重启 App 后仍在
- [ ] 设置中切换深/浅色、字号、模型、思考强度即时生效（模型/强度弹层要从设置页里能点开）
- [ ] 返回键：先关弹层，再最小化，不会直接退出

## 7. 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| `UnsupportedClassVersionError` | JAVA_HOME 指向了旧 JDK，改成 21 |
| `SDK location not found` | 补 `android/local.properties` 的 `sdk.dir` |
| Gradle 下载卡住 | 换网络/代理，或把 `gradle-wrapper.properties` 指向本机已缓存的 Gradle 版本 |
| 构建时报 `licenses` 未接受 | `sdkmanager --licenses` 全选 y |
| App 打开白屏 | 检查 `npx cap sync android` 是否执行；用 Chrome `chrome://inspect` 看控制台 |
| 请求失败 `CORS` | 必须是 `https://localhost` 源；确认没改 `androidScheme` |
| 麦克风无反应 | 系统设置里给 App 麦克风权限；`getUserMedia` 需 HTTPS 源（Capacitor 默认满足） |
| 识别报 400 | ASR 只接受 16-bit PCM WAV / Ogg Opus，App 已内置换算，若自定义需保持该格式 |
| 图片在 v4-pro 下失效 | 该模型不支持视觉，切回 `deepseek-flash` |
