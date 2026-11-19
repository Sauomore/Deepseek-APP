/**
 * App version + release notes.
 *
 * `APP_VERSION` must match `versionName` in android/app/build.gradle.
 * The first element of `RELEASE_NOTES` is shown once after an install/update,
 * driven by `UpdateNotice`.
 */

export const APP_VERSION = '1.0.7'

export interface ReleaseNote {
  version: string
  date: string
  items: string[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.7',
    date: '2026-11-19',
    items: [
      '修复输入后发送按钮不亮、光标无法插入文段中间的问题',
      '修复深色模式顶部状态栏不跟随的问题',
      '修复字号设置未生效的问题（小 / 标准 / 大三档整站缩放）',
      '新增：自定义系统提示词，改动后已有对话下一轮自动重新注入',
      '新增：可设置最大输出 token',
      '思考强度改为官方同款：关闭 / 低 / 高 / 极高',
      '新增：设置里可查看更新日志',
      '新增：设置里可关闭首页推荐问题',
      '首页移除顶部模型切换与副标题描述',
      '输入框改为三行上限：超出一行自动扩展，最多三行，再超出则内部滚动并始终显示最新内容',
      '输入框抵达三行时右上角出现全屏编辑按钮，可整屏书写；清空后自动回缩到一行',
      '修正输入框行高与内边距：三行以内每行完整显示，不再被横向截断',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-11-19',
    items: [
      '修复了部分情况下复制粘贴失效的问题',
      '添加了 Mermaid 架构图保存的功能',
      '首页推荐问题改为从提示词库随机推荐',
    ],
  },
]

export const LATEST_VERSION = RELEASE_NOTES[0]?.version ?? APP_VERSION
