/**
 * Creation-mode store: projects, outline editing and the streaming generator.
 *
 * Each "continue writing" round is one Messages request; the streamed blocks are
 * rendered live with the same components the chat uses (thinking panel, search
 * cards, cited markdown), then the produced text is folded into the section as a
 * round so the thinking of every round stays reviewable.
 */

import { create } from 'zustand'
import { BlockAccumulator } from '@/api/accumulator'
import { isAbortError, streamMessages } from '@/api/client'
import { buildCreativeRequest } from '@/lib/creative'
import { prefixedId } from '@/lib/id'
import { flushProjects, loadProjects, saveProjects } from '@/lib/storage'
import { useSettingsStore } from '@/store/settings'
import { toast } from '@/store/ui'
import type { AssistantBlock, StreamEvent } from '@/types/api'
import type {
  CreativeChapter,
  CreativeCharacter,
  CreativeProject,
  CreativeRound,
  CreativeSection,
  ProjectGenre,
} from '@/types/project'
import { GENRE_LABELS, sectionText } from '@/types/project'
import type { ThinkingLevel } from '@/types/settings'

export interface CreativeStream {
  sectionId: string
  blocks: AssistantBlock[]
  status: 'streaming' | 'error'
  error?: string
}

interface ProjectState {
  projects: CreativeProject[]
  activeId: string | null
  hydrated: boolean
  generating: boolean
  stream: CreativeStream | null

  hydrate: () => Promise<void>
  createProject: (title: string, genre: ProjectGenre) => string
  deleteProject: (id: string) => void
  selectProject: (id: string | null) => void
  updateProject: (id: string, patch: Partial<CreativeProject>) => void

  setPremise: (premise: string) => void
  addCharacter: () => void
  updateCharacter: (id: string, patch: Partial<CreativeCharacter>) => void
  removeCharacter: (id: string) => void
  addChapter: () => void
  updateChapter: (id: string, patch: Partial<CreativeChapter>) => void
  removeChapter: (id: string) => void
  setActiveChapter: (id: string | null) => void
  setWordTarget: (value: number) => void
  setThinkingLevel: (level: ThinkingLevel) => void
  setSearchEnabled: (enabled: boolean) => void

  generate: (instruction: string) => Promise<void>
  stop: () => void
  persistNow: () => void
}

let controller: AbortController | null = null
let publishTimer: number | undefined

export function newProject(title: string, genre: ProjectGenre): CreativeProject {
  const now = Date.now()
  return {
    id: prefixedId('proj'),
    title: title.trim() || '未命名作品',
    genre,
    premise: '',
    characters: [],
    chapters: [],
    activeChapterId: null,
    sections: [],
    wordTarget: 1000,
    thinkingLevel: 'high',
    searchEnabled: false,
    createdAt: now,
    updatedAt: now,
  }
}

/** Find (or create) the section that belongs to the project's active chapter. */
function ensureSection(project: CreativeProject): { project: CreativeProject; section: CreativeSection } {
  const chapterId = project.activeChapterId
  const existing = project.sections.find((section) => section.chapterId === chapterId)
  if (existing) return { project, section: existing }

  const chapter = project.chapters.find((item) => item.id === chapterId)
  const section: CreativeSection = {
    id: prefixedId('sec'),
    chapterId,
    title: chapter?.title?.trim() || (chapter ? `第 ${project.chapters.indexOf(chapter) + 1} 章` : '正文'),
    rounds: [],
    updatedAt: Date.now(),
  }
  return {
    project: { ...project, sections: [...project.sections, section], updatedAt: Date.now() },
    section,
  }
}

function patchSection(
  project: CreativeProject,
  sectionId: string,
  updater: (section: CreativeSection) => CreativeSection,
): CreativeProject {
  return {
    ...project,
    updatedAt: Date.now(),
    sections: project.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
  }
}

/** Demo-mode stub so the writing flow can be tried without an API key. */
function mockCreativeStream(project: CreativeProject, onText: (chunk: string) => void): Promise<void> {
  const sample = [
    `（演示模式）${GENRE_LABELS[project.genre]}示例段落。`,
    '夜色压在屋檐上，风从巷口挤进来，把灯笼吹得摇摇晃晃。她停在门前，听见里面有人低声说话。',
    '门轴响了一声，屋里的人抬起头。两个人隔着桌面互相打量，谁都没有先开口。',
    '过了很久，他才把那只旧木匣推到桌子中间，说：“你要找的答案，就锁在这里面。”',
  ].join('\n\n')
  let index = 0
  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      const chunk = sample.slice(index, index + 12)
      index += 12
      if (chunk) onText(chunk)
      if (index >= sample.length) {
        window.clearInterval(timer)
        resolve()
      }
    }, 20)
  })
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const patchActive = (updater: (project: CreativeProject) => CreativeProject) => {
    const { activeId, projects } = get()
    if (!activeId) return
    const next = projects.map((project) => (project.id === activeId ? updater(project) : project))
    saveProjects(next)
    set({ projects: next })
  }

  return {
    projects: [],
    activeId: null,
    hydrated: false,
    generating: false,
    stream: null,

    hydrate: async () => {
      const stored = await loadProjects()
      const sorted = [...stored].sort((a, b) => b.updatedAt - a.updatedAt)
      set({ projects: sorted, hydrated: true })
    },

    createProject: (title, genre) => {
      const project = newProject(title, genre)
      const next = [project, ...get().projects]
      saveProjects(next)
      set({ projects: next, activeId: project.id })
      return project.id
    },

    deleteProject: (id) => {
      const next = get().projects.filter((project) => project.id !== id)
      saveProjects(next)
      set({ projects: next, activeId: get().activeId === id ? null : get().activeId })
    },

    selectProject: (id) => set({ activeId: id, stream: null }),

    updateProject: (id, patch) => {
      const next = get().projects.map((project) =>
        project.id === id ? { ...project, ...patch, updatedAt: Date.now() } : project,
      )
      saveProjects(next)
      set({ projects: next })
    },

    setPremise: (premise) => patchActive((project) => ({ ...project, premise, updatedAt: Date.now() })),

    addCharacter: () =>
      patchActive((project) => ({
        ...project,
        characters: [
          ...project.characters,
          { id: prefixedId('role'), name: '', desc: '' } as CreativeCharacter,
        ],
        updatedAt: Date.now(),
      })),

    updateCharacter: (id, patch) =>
      patchActive((project) => ({
        ...project,
        characters: project.characters.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        updatedAt: Date.now(),
      })),

    removeCharacter: (id) =>
      patchActive((project) => ({
        ...project,
        characters: project.characters.filter((item) => item.id !== id),
        updatedAt: Date.now(),
      })),

    addChapter: () =>
      patchActive((project) => {
        const chapter: CreativeChapter = {
          id: prefixedId('chap'),
          title: `第 ${project.chapters.length + 1} 章`,
          summary: '',
        }
        return {
          ...project,
          chapters: [...project.chapters, chapter],
          activeChapterId: project.activeChapterId ?? chapter.id,
          updatedAt: Date.now(),
        }
      }),

    updateChapter: (id, patch) =>
      patchActive((project) => ({
        ...project,
        chapters: project.chapters.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        updatedAt: Date.now(),
      })),

    removeChapter: (id) =>
      patchActive((project) => ({
        ...project,
        chapters: project.chapters.filter((item) => item.id !== id),
        activeChapterId: project.activeChapterId === id ? null : project.activeChapterId,
        updatedAt: Date.now(),
      })),

    setActiveChapter: (id) => patchActive((project) => ({ ...project, activeChapterId: id })),

    setWordTarget: (value) =>
      patchActive((project) => ({ ...project, wordTarget: Math.max(200, Math.min(8000, value)) })),

    setThinkingLevel: (level) => patchActive((project) => ({ ...project, thinkingLevel: level })),

    setSearchEnabled: (enabled) => patchActive((project) => ({ ...project, searchEnabled: enabled })),

    persistNow: () => flushProjects(get().projects),

    stop: () => {
      controller?.abort()
      controller = null
    },

    generate: async (instruction) => {
      const state = get()
      if (state.generating) return
      const activeId = state.activeId
      const project = state.projects.find((item) => item.id === activeId)
      if (!project) return

      const settings = useSettingsStore.getState().settings
      if (settings.demoMode === false && !settings.apiKey.trim()) {
        toast('还没有配置 API Key，无法创作', 'error')
        return
      }

      // Make sure there is a section to write into.
      const ensured = ensureSection(project)
      const withSection = ensured.project
      if (withSection !== project) {
        const next = state.projects.map((item) => (item.id === project.id ? withSection : item))
        saveProjects(next)
        set({ projects: next })
      }
      const { section } = ensured

      const body = buildCreativeRequest({ project: withSection, section, instruction }, settings)
      const accumulator = new BlockAccumulator()
      const abort = new AbortController()
      controller = abort
      set({ generating: true, stream: { sectionId: section.id, blocks: [], status: 'streaming' } })

      let scheduled = false
      const publish = () => {
        scheduled = false
        publishTimer = undefined
        const snapshot = accumulator.snapshot()
        set((current) =>
          current.stream
            ? { stream: { ...current.stream, blocks: snapshot.blocks } }
            : { stream: null },
        )
      }
      const schedule = () => {
        if (scheduled) return
        scheduled = true
        publishTimer = window.setTimeout(publish, 60)
      }

      let text = ''
      try {
        if (settings.demoMode) {
          await mockCreativeStream(withSection, (chunk) => {
            text += chunk
            accumulator.apply({
              type: 'content_block_start',
              index: 0,
              content_block: { type: 'text', text: '' },
            } as StreamEvent)
            accumulator.apply({
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: chunk },
            } as StreamEvent)
            schedule()
          })
        } else {
          await streamMessages({
            baseUrl: settings.baseUrl,
            apiKey: settings.apiKey,
            body,
            signal: abort.signal,
            onEvent: (event) => {
              if (accumulator.apply(event)) schedule()
            },
          })
        }

        const snapshot = accumulator.snapshot()
        const thinking = snapshot.blocks
          .filter((block) => block.type === 'thinking')
          .map((block) => (block as { thinking: string }).thinking)
          .join('\n\n')
        const answer =
          text ||
          snapshot.blocks
            .filter((block) => block.type === 'text')
            .map((block) => (block as { text: string }).text)
            .join('')

        if (!answer.trim()) {
          set({ generating: false, stream: null })
          toast('本轮没有产出正文，可以调整大纲或指令再试', 'error')
          return
        }

        const round: CreativeRound = {
          id: prefixedId('round'),
          thinking,
          text: answer.trim(),
          usage: snapshot.usage,
          createdAt: Date.now(),
        }

        set((current) => {
          const projects = current.projects.map((item) => {
            if (item.id !== project.id) return item
            const updated = patchSection(item, section.id, (target) => ({
              ...target,
              rounds: [...target.rounds, round],
              updatedAt: Date.now(),
            }))
            return { ...updated, updatedAt: Date.now() }
          })
          saveProjects(projects)
          return { projects, generating: false, stream: null }
        })
      } catch (error) {
        if (isAbortError(error)) {
          toast('已停止创作')
        } else {
          const message = error instanceof Error ? error.message : '生成失败'
          set({
            generating: false,
            stream: { sectionId: section.id, blocks: accumulator.snapshot().blocks, status: 'error', error: message },
          })
          toast(message, 'error')
        }
      } finally {
        if (publishTimer) {
          window.clearTimeout(publishTimer)
          publishTimer = undefined
        }
        controller = null
        set((current) => ({ generating: false, stream: current.generating ? current.stream : null }))
      }
    },
  }
})

/** Convenience selector for the current project. */
export function activeProject(state: ProjectState): CreativeProject | null {
  return state.projects.find((project) => project.id === state.activeId) ?? null
}

/** Text of the active section (used by the viewer). */
export function activeSectionText(project: CreativeProject | null): string {
  if (!project) return ''
  const section = project.sections.find((item) => item.chapterId === project.activeChapterId)
  return section ? sectionText(section) : ''
}
