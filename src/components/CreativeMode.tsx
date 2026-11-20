/**
 * 创作模式 — long-form writing workspace.
 *
 * Flow: pick/create a project → fill the outline (premise / characters /
 * chapters) → press 继续创作 repeatedly; every round streams a chunk (with
 * thinking and optional web search) into the current chapter, and the result can
 * be exported as a .txt through the OS share sheet.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  SparkIcon,
  StopIcon,
  TrashIcon,
} from '@/components/icons'
import { ThinkingPanel } from '@/components/content-blocks'
import { MarkdownView } from '@/components/MarkdownView'
import { AssistantMessage } from '@/components/messages'
import { tapFeedback } from '@/lib/haptics'
import { exportFilename } from '@/lib/creative'
import { projectText, projectWordCount, GENRE_LABELS, type ProjectGenre } from '@/types/project'
import { THINKING_LEVELS, type ThinkingLevel } from '@/types/settings'
import { useProjectStore } from '@/store/projects'
import { useSettingsStore } from '@/store/settings'
import { toast, useUiStore } from '@/store/ui'
import type { ChatMessage } from '@/types/chat'

const GENRES: ProjectGenre[] = ['novel', 'story', 'paper', 'other']
const WORD_TARGETS = [600, 1000, 1500, 2000, 3000]
type Tab = 'draft' | 'outline' | 'settings'

/** Uncontrolled textarea that commits on blur and after a short idle period. */
function AutoTextarea({
  value,
  placeholder,
  onChange,
  rows = 2,
  className,
}: {
  value: string
  placeholder?: string
  onChange: (next: string) => void
  rows?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const commit = () => {
    const next = ref.current?.value ?? ''
    if (next !== value) onChange(next)
  }
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])
  return (
    <textarea
      ref={ref}
      className={className ?? 'creative-textarea'}
      defaultValue={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => {
        const next = event.target.value
        if (timer.current) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => onChange(next), 500)
      }}
      onBlur={commit}
    />
  )
}

export function CreativeMode() {
  const open = useUiStore((state) => state.creativeOpen)
  const close = useUiStore((state) => state.closeCreative)
  const projects = useProjectStore((state) => state.projects)
  const activeId = useProjectStore((state) => state.activeId)
  const hydrated = useProjectStore((state) => state.hydrated)
  const generating = useProjectStore((state) => state.generating)
  const stream = useProjectStore((state) => state.stream)
  const settings = useSettingsStore((state) => state.settings)

  const hydrate = useProjectStore((state) => state.hydrate)
  const createProject = useProjectStore((state) => state.createProject)
  const deleteProject = useProjectStore((state) => state.deleteProject)
  const selectProject = useProjectStore((state) => state.selectProject)
  const setPremise = useProjectStore((state) => state.setPremise)
  const addCharacter = useProjectStore((state) => state.addCharacter)
  const updateCharacter = useProjectStore((state) => state.updateCharacter)
  const removeCharacter = useProjectStore((state) => state.removeCharacter)
  const addChapter = useProjectStore((state) => state.addChapter)
  const updateChapter = useProjectStore((state) => state.updateChapter)
  const removeChapter = useProjectStore((state) => state.removeChapter)
  const setActiveChapter = useProjectStore((state) => state.setActiveChapter)
  const setWordTarget = useProjectStore((state) => state.setWordTarget)
  const setThinkingLevel = useProjectStore((state) => state.setThinkingLevel)
  const setSearchEnabled = useProjectStore((state) => state.setSearchEnabled)
  const generate = useProjectStore((state) => state.generate)
  const stop = useProjectStore((state) => state.stop)

  const [tab, setTab] = useState<Tab>('draft')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newGenre, setNewGenre] = useState<ProjectGenre>('novel')
  const [instruction, setInstruction] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const instructionRef = useRef<HTMLTextAreaElement>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && !hydrated) void hydrate()
  }, [open, hydrated, hydrate])

  const project = useMemo(
    () => projects.find((item) => item.id === activeId) ?? null,
    [projects, activeId],
  )

  // Follow the newest text while a round streams in.
  useEffect(() => {
    if (!stream) return
    const node = listScrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [stream])

  if (!open) return null

  const closeAll = () => {
    stop()
    close()
  }

  const exportTxt = async () => {
    if (!project) return
    const text = projectText(project)
    if (!text.trim()) {
      toast('还没有正文内容可以导出', 'error')
      return
    }
    try {
      const { saveBlob } = await import('@/lib/save-image')
      await saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), exportFilename(project))
      toast('已导出 TXT', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : '导出失败', 'error')
    }
  }

  const runningText = stream?.blocks
    ?.filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('')
    .trim()

  /* ------------------------------- projects ------------------------------- */
  if (!project) {
    return (
      <div className="creative" role="dialog" aria-modal="true" aria-label="创作模式">
        <header className="creative-head">
          <span className="creative-head-title">创作模式</span>
          <button type="button" className="icon-btn" onClick={closeAll} aria-label="关闭创作模式">
            <CloseIcon />
          </button>
        </header>

        <div className="creative-scroll">
          <p className="creative-intro">
            长文本创作工作台：先写大纲（设定、人物、章节），再一轮轮续写。
            每一轮都有独立的思考过程，可随时联网查资料，完成后导出为 TXT。
          </p>

          {!creating ? (
            <button
              type="button"
              className="btn btn--primary creative-new"
              onClick={() => {
                tapFeedback()
                setCreating(true)
              }}
            >
              <PlusIcon size={16} /> 新建作品
            </button>
          ) : (
            <div className="creative-card creative-create">
              <label className="creative-label">作品名</label>
              <input
                className="text-input"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="例如：雾港纪事"
                autoFocus
              />
              <label className="creative-label">类型</label>
              <div className="segmented">
                {GENRES.map((genre) => (
                  <button
                    type="button"
                    key={genre}
                    aria-pressed={newGenre === genre}
                    onClick={() => setNewGenre(genre)}
                  >
                    {GENRE_LABELS[genre]}
                  </button>
                ))}
              </div>
              <div className="creative-create-actions">
                <button type="button" className="btn btn--ghost" onClick={() => setCreating(false)}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    createProject(newTitle, newGenre)
                    setCreating(false)
                    setNewTitle('')
                    setTab('outline')
                  }}
                >
                  创建
                </button>
              </div>
            </div>
          )}

          {projects.length > 0 ? (
            <div className="creative-list">
              {projects.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="creative-card creative-project"
                  onClick={() => {
                    selectProject(item.id)
                    setTab('draft')
                  }}
                >
                  <span className="creative-project-main">
                    <span className="creative-project-title">{item.title}</span>
                    <span className="creative-project-meta">
                      {GENRE_LABELS[item.genre]} · {projectWordCount(item)} 字 ·{' '}
                      {item.chapters.length} 章大纲
                    </span>
                  </span>
                  <span className="chev">
                    <ChevronRightIcon />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="creative-empty">还没有作品，先新建一个吧</div>
          )}
        </div>
      </div>
    )
  }

  /* ------------------------------- workspace ------------------------------- */
  const sections = project.sections
  const streamingMessage: ChatMessage | null = stream
    ? {
        id: 'creative-stream',
        role: 'assistant',
        createdAt: Date.now(),
        blocks: stream.blocks,
        status: stream.status === 'error' ? 'error' : 'streaming',
      }
    : null

  return (
    <div className="creative" role="dialog" aria-modal="true" aria-label="创作模式">
      <header className="creative-head">
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            stop()
            selectProject(null)
          }}
          aria-label="返回作品列表"
        >
          <ArrowLeftIcon />
        </button>
        <span className="creative-head-title" title={project.title}>
          {project.title}
        </span>
        <button type="button" className="mini-btn" onClick={() => void exportTxt()}>
          <CopyIcon size={13} /> 导出
        </button>
        <button type="button" className="icon-btn" onClick={closeAll} aria-label="关闭创作模式">
          <CloseIcon />
        </button>
      </header>

      <div className="creative-tabs">
        {(['draft', 'outline', 'settings'] as Tab[]).map((item) => (
          <button
            type="button"
            key={item}
            className={`creative-tab${tab === item ? ' is-active' : ''}`}
            onClick={() => setTab(item)}
          >
            {item === 'draft' ? '正文' : item === 'outline' ? '大纲' : '设置'}
          </button>
        ))}
        <span className="creative-count">{projectWordCount(project)} 字</span>
      </div>

      {/* ------------------------------- 正文 ------------------------------- */}
      {tab === 'draft' ? (
        <>
          <div className="creative-scroll" ref={listScrollRef}>
            {sections.length === 0 && !stream ? (
              <div className="creative-empty">
                还没有正文。可以先到「大纲」里写设定与章节，回来点下面的「继续创作」。
              </div>
            ) : null}

            {sections.map((section) => (
              <div className="creative-section" key={section.id}>
                <div className="creative-section-title">
                  <BookOpenIcon size={14} /> {section.title}
                </div>
                {section.rounds.map((round, index) => (
                  <div className="creative-round" key={round.id}>
                    {round.thinking ? (
                      <ThinkingPanel text={round.thinking} streaming={false} hasAnswer />
                    ) : null}
                    <div className="creative-round-text">
                      <MarkdownView text={round.text} />
                    </div>
                    <div className="creative-round-meta">
                      第 {index + 1} 轮
                      {round.usage?.output_tokens ? ` · ${round.usage.output_tokens} tokens` : ''}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {streamingMessage ? (
              <div className="creative-section creative-section--live">
                <div className="creative-section-title">
                  <SparkIcon size={14} /> 正在写作…
                </div>
                <AssistantMessage message={streamingMessage} onRegenerate={() => undefined} />
              </div>
            ) : null}

            {stream?.status === 'error' ? (
              <div className="creative-error">{stream.error ?? '生成失败，请重试'}</div>
            ) : null}
          </div>

          <div className="creative-dock">
            <div className="creative-instruction">
              <textarea
                ref={instructionRef}
                className="creative-instruction-input"
                placeholder="请输入灵感"
                rows={1}
                defaultValue={instruction}
                onChange={(event) => setInstruction(event.target.value)}
              />
              {generating ? (
                <button
                  type="button"
                  className="composer-btn composer-stop"
                  onClick={() => stop()}
                  aria-label="停止创作"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  type="button"
                  className="composer-btn composer-send is-active"
                  onClick={() => {
                    tapFeedback()
                    void generate(instruction)
                    setInstruction('')
                    if (instructionRef.current) instructionRef.current.value = ''
                  }}
                  aria-label="继续创作"
                >
                  <SendIcon />
                </button>
              )}
            </div>
            <div className="creative-dock-hint">
              每轮约 {project.wordTarget} 字 · 思考强度{' '}
              {THINKING_LEVELS.find((level) => level.value === project.thinkingLevel)?.label ?? '高'}
              {project.searchEnabled ? ' · 联网搜索开' : ''}
              {settings.demoMode ? ' · 演示模式' : ''}
            </div>
          </div>
        </>
      ) : null}

      {/* ------------------------------- 大纲 ------------------------------- */}
      {tab === 'outline' ? (
        <div className="creative-scroll">
          <div className="creative-card">
            <label className="creative-label">设定 / 主题 / 写作要求</label>
            <AutoTextarea
              value={project.premise}
              rows={4}
              placeholder="世界观、时代背景、文风要求、论点与研究对象……"
              onChange={setPremise}
            />
          </div>

          <div className="creative-card">
            <div className="creative-card-head">
              <span className="creative-label">人物</span>
              <button type="button" className="mini-btn" onClick={addCharacter}>
                <PlusIcon size={13} /> 添加人物
              </button>
            </div>
            {project.characters.length === 0 ? (
              <div className="creative-hint">还没有人物，添加后可定义姓名与性格、经历、动机。</div>
            ) : null}
            {project.characters.map((character) => (
              <div className="creative-role" key={character.id}>
                <div className="creative-role-head">
                  <input
                    className="text-input creative-role-name"
                    value={character.name}
                    placeholder="姓名"
                    onChange={(event) => updateCharacter(character.id, { name: event.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-btn creative-role-remove"
                    onClick={() => removeCharacter(character.id)}
                    aria-label="删除人物"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
                <AutoTextarea
                  value={character.desc}
                  rows={2}
                  placeholder="性格、外貌、背景、动机、与他人的关系……"
                  onChange={(desc) => updateCharacter(character.id, { desc })}
                />
              </div>
            ))}
          </div>

          <div className="creative-card">
            <div className="creative-card-head">
              <span className="creative-label">章节大纲</span>
              <button type="button" className="mini-btn" onClick={addChapter}>
                <PlusIcon size={13} /> 添加章节
              </button>
            </div>
            {project.chapters.length === 0 ? (
              <div className="creative-hint">还没有章节。添加章节后点「写这一章」即切换到该章正文。</div>
            ) : null}
            {project.chapters.map((chapter, index) => (
              <div
                className={`creative-chapter${project.activeChapterId === chapter.id ? ' is-active' : ''}`}
                key={chapter.id}
              >
                <div className="creative-chapter-head">
                  <button
                    type="button"
                    className="creative-chapter-pick"
                    aria-pressed={project.activeChapterId === chapter.id}
                    onClick={() => setActiveChapter(chapter.id)}
                  >
                    {project.activeChapterId === chapter.id ? <CheckIcon size={13} /> : null}
                    {project.activeChapterId === chapter.id ? '正在写' : '写这一章'}
                  </button>
                  <span className="creative-chapter-index">第 {index + 1} 章</span>
                  <button
                    type="button"
                    className="icon-btn creative-role-remove"
                    onClick={() => removeChapter(chapter.id)}
                    aria-label="删除章节"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
                <input
                  className="text-input creative-chapter-title"
                  value={chapter.title}
                  placeholder={`第 ${index + 1} 章`}
                  onChange={(event) => updateChapter(chapter.id, { title: event.target.value })}
                />
                <AutoTextarea
                  value={chapter.summary}
                  rows={2}
                  placeholder="本章剧情概要 / 论点 / 关键转折……"
                  onChange={(summary) => updateChapter(chapter.id, { summary })}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ------------------------------- 设置 ------------------------------- */}
      {tab === 'settings' ? (
        <div className="creative-scroll">
          <div className="creative-card">
            <label className="creative-label">每轮目标字数</label>
            <div className="segmented">
              {WORD_TARGETS.map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={project.wordTarget === value}
                  onClick={() => setWordTarget(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="creative-card">
            <label className="creative-label">思考强度</label>
            <div className="segmented">
              {THINKING_LEVELS.map((level) => (
                <button
                  type="button"
                  key={level.value}
                  aria-pressed={project.thinkingLevel === level.value}
                  onClick={() => setThinkingLevel(level.value as ThinkingLevel)}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          <div className="creative-card">
            <div className="creative-row">
              <span className="creative-row-main">
                <span className="creative-label" style={{ marginBottom: 0 }}>
                  允许联网查资料
                </span>
                <span className="creative-hint">写论文时开启，模型会先搜索再落笔</span>
              </span>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={project.searchEnabled}
                aria-label="允许联网查资料"
                onClick={() => setSearchEnabled(!project.searchEnabled)}
              />
            </div>
          </div>

          <div className="creative-card">
            <div className="creative-row">
              <span className="creative-row-main">
                <span className="creative-label" style={{ marginBottom: 0 }}>
                  模型
                </span>
                <span className="creative-hint">使用设置里的当前模型（{settings.model}）</span>
              </span>
            </div>
          </div>

          <div className="creative-card">
            <div className="creative-row">
              <span className="creative-row-main">
                <span className="creative-label" style={{ marginBottom: 0 }}>
                  删除作品
                </span>
                <span className="creative-hint">删除后正文与大纲都无法恢复</span>
              </span>
              <button
                type="button"
                className="icon-btn"
                style={{ color: 'var(--danger)' }}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true)
                    toast('再点一次确认删除', 'error')
                    return
                  }
                  deleteProject(project.id)
                  setConfirmDelete(false)
                  selectProject(null)
                  toast('已删除作品', 'success')
                }}
                aria-label="删除作品"
              >
                <TrashIcon />
              </button>
            </div>
          </div>

          <div className="creative-card">
            <div className="creative-row">
              <span className="creative-row-main">
                <span className="creative-label" style={{ marginBottom: 0 }}>
                  导出全文
                </span>
                <span className="creative-hint">
                  {runningText ? '' : ''}TXT 格式，保存到手机或分享出去
                </span>
              </span>
              <button type="button" className="mini-btn" onClick={() => void exportTxt()}>
                <PencilIcon size={13} /> 导出 TXT
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
