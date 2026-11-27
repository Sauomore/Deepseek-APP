import type { DeepSeekModel } from './api'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type FontScale = 'sm' | 'md' | 'lg'

/**
 * Thinking effort, mirroring the official levels:
 * `off` disables thinking entirely (`thinking.type = "disabled"`), while
 * `low` / `high` / `max` map to `output_config.effort`.
 */
export type ThinkingLevel = 'off' | 'low' | 'high' | 'max'

export interface Settings {
  /* ---- credentials / endpoint ---- */
  apiKey: string
  /** OpenAI-compatible root. The Messages endpoint is `{baseUrl}/anthropic/v1/messages`. */
  baseUrl: string

  /* ---- model behaviour ---- */
  model: DeepSeekModel
  thinkingLevel: ThinkingLevel
  searchEnabled: boolean
  readUrlEnabled: boolean
  safetyCheck: boolean
  /** Custom system prompt; empty string means "use the built-in default". */
  systemPrompt: string
  /** Max output tokens; 0 leaves the limit to the server default. */
  maxOutputTokens: number

  /* ---- app behaviour ---- */
  theme: ThemeMode
  fontScale: FontScale
  hapticsEnabled: boolean
  /** Demo mode: every request is served by the local mock engine. */
  demoMode: boolean
  /** Show the token usage row under each answer. */
  showUsage: boolean
  /** Send the current date & locale to the model as context. */
  userContextEnabled: boolean
  /** Show the four suggestion cards on an empty conversation. */
  showSuggestions: boolean
  /** False until the user finishes the first-run screen. */
  onboardingDone: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  thinkingLevel: 'high',
  searchEnabled: true,
  readUrlEnabled: true,
  safetyCheck: false,
  systemPrompt: '',
  maxOutputTokens: 0,
  theme: 'auto',
  fontScale: 'md',
  hapticsEnabled: true,
  demoMode: true,
  showUsage: true,
  userContextEnabled: true,
  showSuggestions: true,
  onboardingDone: false,
}

/** `max_output_tokens` reported by /models for both current models. */
export const MAX_OUTPUT_TOKEN_LIMIT = 2097152

export const THINKING_LEVELS: Array<{ value: ThinkingLevel; label: string; desc: string }> = [
  { value: 'off', label: '关闭', desc: '直接回答，不输出思考过程（最快、最省）' },
  { value: 'low', label: '低', desc: '轻量思考，适合简单问答' },
  { value: 'high', label: '高（默认）', desc: '官方默认强度，兼顾速度与质量' },
  { value: 'max', label: '极高', desc: '最深推理，复杂问题更稳但更慢更贵' },
]

/** Preset choices for the max-output-tokens setting. 0 = server default. */
export const MAX_OUTPUT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: '默认' },
  { value: 4096, label: '4K' },
  { value: 8192, label: '8K' },
  { value: 16384, label: '16K' },
  { value: 32768, label: '32K' },
  { value: 65536, label: '64K' },
  { value: 131072, label: '128K' },
  { value: 393216, label: '384K（上限）' },
]
