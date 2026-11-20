/**
 * Prompt construction for the long-form creation mode.
 *
 * The outline (premise + characters + chapters) is rebuilt into the system
 * prompt on **every** round, so editing the outline mid-work immediately
 * affects the next continuation (same hot-update idea as the chat system
 * prompt). The user message carries the writing instruction plus the tail of
 * the existing text for continuity.
 */

import type { ChatMessageParam, DeepSeekModel, MessagesRequest } from '@/types/api'
import type { Settings } from '@/types/settings'
import type { CreativeChapter, CreativeProject, CreativeSection } from '@/types/project'
import { GENRE_LABELS, projectWordCount, sectionText } from '@/types/project'

/** How many trailing characters of existing text are sent as context. */
const CONTEXT_TAIL = 4000

/** Creative rounds default to a generous output budget when the user left it on "default". */
const CREATIVE_MAX_TOKENS = 16384

const GENRE_GUIDE: Record<string, string> = {
  novel:
    '你是一位资深小说家：擅长人物塑造、场景描写与节奏控制，文风自然，避免流水账和空泛抒情。',
  story:
    '你是一位擅长连载的网文作者：每轮结尾留有推进力，对话与动作交织，保持读者追读欲。',
  paper:
    '你是一位严谨的学术写作者：论点清晰、论据充分、逻辑层层递进，必要时给出过渡句与小结。',
  other: '你是一位专业写作者：根据大纲稳定地产出高质量正文。',
}

export interface CreativePromptInput {
  project: CreativeProject
  section: CreativeSection
  /** User's per-round instruction, e.g. "让主角在雨夜遇到旧友". */
  instruction: string
}

function outlineBlock(project: CreativeProject): string {
  const lines: string[] = []
  if (project.premise.trim()) {
    lines.push('【整体设定 / 主题】', project.premise.trim(), '')
  }
  if (project.characters.length > 0) {
    lines.push('【人物】')
    for (const character of project.characters) {
      const desc = character.desc.trim()
      lines.push(`- ${character.name.trim() || '未命名'}${desc ? `：${desc}` : ''}`)
    }
    lines.push('')
  }
  if (project.chapters.length > 0) {
    lines.push('【章节大纲】')
    project.chapters.forEach((chapter: CreativeChapter, index) => {
      const summary = chapter.summary.trim()
      lines.push(`${index + 1}. ${chapter.title.trim() || `第 ${index + 1} 章`}${summary ? ` —— ${summary}` : ''}`)
    })
    lines.push('')
  }
  return lines.join('\n').trim()
}

export function buildCreativeSystemPrompt(project: CreativeProject): string {
  const blocks: string[] = []
  blocks.push(GENRE_GUIDE[project.genre] ?? GENRE_GUIDE.other)
  blocks.push(
    `你正在协助用户完成一部${GENRE_LABELS[project.genre]}，作品名为《${project.title}》。请严格依据下方大纲写作。`,
  )

  const outline = outlineBlock(project)
  if (outline) blocks.push(outline)

  const current = project.chapters.find((chapter) => chapter.id === project.activeChapterId)
  if (current) {
    blocks.push(`【本轮所在章节】${current.title}${current.summary ? ` —— ${current.summary}` : ''}`)
  }

  blocks.push(
    [
      '【本轮要求】',
      `- 目标：这一轮直接续写约 ${project.wordTarget} 字正文。`,
      '- 只输出正文内容：不要解释、不要复述大纲、不要写「以下是……」「好的」之类的开场白。',
      '- 与前文保持人称、时态、语气一致，衔接自然，不要重复已有的句子。',
      '- 可以使用 Markdown 段落与必要的小标题，但不要输出代码块或与作品无关的说明。',
      project.genre === 'paper'
        ? '- 论文写作：注意论证层次与术语一致性；如需引用资料，用正文语言自然转述。'
        : '- 叙事写作：用具体动作、对话与细节推进，避免空泛概括。',
    ].join('\n'),
  )

  return blocks.join('\n\n')
}

export function buildCreativeRequest(input: CreativePromptInput, settings: Settings): MessagesRequest {
  const { project, section, instruction } = input
  const model: DeepSeekModel = settings.model

  const tailSource = [sectionText(section), ...project.sections.slice(0, -1).map(sectionText)]
    .filter(Boolean)
    .join('\n\n')
  const tail = tailSource.slice(-CONTEXT_TAIL)

  const asked = instruction.trim()
  const userLines: string[] = []
  if (tail) {
    userLines.push('【已有正文（末尾片段，供衔接）】', tail, '')
  }
  userLines.push(
    asked
      ? `【本轮指令】${asked}\n请据此继续写作。`
      : `请从这里开始继续写作《${section.title}》。`,
  )
  userLines.push(
    `（当前全文约 ${projectWordCount(project)} 字，本轮目标约 ${project.wordTarget} 字。）`,
  )

  const maxTokens =
    settings.maxOutputTokens > 0 ? settings.maxOutputTokens : CREATIVE_MAX_TOKENS

  const body: MessagesRequest = {
    model,
    max_tokens: maxTokens,
    stream: true,
    thinking: { type: project.thinkingLevel === 'off' ? 'disabled' : 'enabled' },
    system: buildCreativeSystemPrompt(project),
    messages: [{ role: 'user', content: [{ type: 'text', text: userLines.join('\n') }] } as ChatMessageParam],
  }
  if (project.thinkingLevel !== 'off') {
    body.output_config = { effort: project.thinkingLevel }
  }

  if (project.searchEnabled && settings.searchEnabled) {
    const tools: NonNullable<MessagesRequest['tools']> = [
      { type: 'deepseek_web_search', name: 'deepseek_web_search' },
    ]
    if (settings.readUrlEnabled) {
      tools.push({ type: 'deepseek_read_url', name: 'deepseek_read_url' })
    }
    body.tools = tools
    body.tool_choice = { type: 'auto' }
  }

  if (settings.safetyCheck) body.safety_check = { level: 'high' }

  return body
}

/** Filename-safe name for the exported .txt. */
export function exportFilename(project: CreativeProject): string {
  const safe = project.title.replace(/[\\/:*?"<>|\n\r\t]/g, ' ').trim() || '未命名作品'
  return `${safe.slice(0, 60)}.txt`
}
