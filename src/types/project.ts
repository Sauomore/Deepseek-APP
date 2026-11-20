/**
 * Long-form creation mode (创作模式): papers, novels, serialized fiction.
 *
 * A project keeps an outline (premise + characters + chapters) and a draft made
 * of sections; every "continue writing" round streams a new chunk and is stored
 * as its own round so the thinking of each round stays reviewable.
 */

import type { Usage } from './api'
import type { ThinkingLevel } from './settings'

export type ProjectGenre = 'novel' | 'story' | 'paper' | 'other'

export const GENRE_LABELS: Record<ProjectGenre, string> = {
  novel: '长篇小说',
  story: '短篇 / 连载',
  paper: '论文 / 长文',
  other: '其他创作',
}

export interface CreativeCharacter {
  id: string
  name: string
  /** 性格、外貌、动机、人际关系等 */
  desc: string
}

export interface CreativeChapter {
  id: string
  title: string
  /** 本章剧情概要 / 论点 */
  summary: string
}

export interface CreativeRound {
  id: string
  /** Streaming or settled thinking text of this round. */
  thinking: string
  /** Generated body text of this round. */
  text: string
  usage?: Usage
  createdAt: number
}

export interface CreativeSection {
  id: string
  /** Outline chapter this section belongs to (null = 自由续写). */
  chapterId: string | null
  title: string
  rounds: CreativeRound[]
  updatedAt: number
}

export interface CreativeProject {
  id: string
  title: string
  genre: ProjectGenre
  /** 主题 / 设定 / 写作要求 */
  premise: string
  characters: CreativeCharacter[]
  chapters: CreativeChapter[]
  activeChapterId: string | null
  sections: CreativeSection[]
  /** 每轮目标字数 */
  wordTarget: number
  thinkingLevel: ThinkingLevel
  searchEnabled: boolean
  createdAt: number
  updatedAt: number
}

export function sectionText(section: CreativeSection): string {
  return section.rounds
    .map((round) => round.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

export function projectText(project: CreativeProject): string {
  const parts: string[] = [`${project.title}`, '']
  if (project.premise.trim()) {
    parts.push(project.premise.trim(), '')
  }
  for (const section of project.sections) {
    const text = sectionText(section)
    if (!text) continue
    parts.push(`【${section.title}】`, '', text, '')
  }
  return parts.join('\n').replace(/\n{4,}/g, '\n\n\n').trim()
}

/** Rough Chinese word count: CJK chars + latin words. */
export function countWords(text: string): number {
  const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff]/g) ?? []).length
  const latin = (text.match(/[A-Za-z0-9]+/g) ?? []).length
  return cjk + latin
}

export function projectWordCount(project: CreativeProject): number {
  return project.sections.reduce(
    (total, section) => total + section.rounds.reduce((sum, round) => sum + countWords(round.text), 0),
    0,
  )
}
