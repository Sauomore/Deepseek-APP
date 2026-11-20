/**
 * Conversation drawer — history, search, rename / pin / delete, settings entry.
 */

import { useMemo, useRef, useState } from 'react'
import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  MoreIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from '@/components/icons'
import { BrandMark } from '@/components/BrandMark'
import { dateGroupLabel, formatRelative } from '@/lib/format'
import { tapFeedback } from '@/lib/haptics'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import type { Conversation } from '@/types/chat'

export function ConversationDrawer() {
  const open = useUiStore((state) => state.drawerOpen)
  const closeDrawer = useUiStore((state) => state.closeDrawer)
  const openSettings = useUiStore((state) => state.openSettings)
  const openCreative = useUiStore((state) => state.openCreative)
  const demoMode = useSettingsStore((state) => state.settings.demoMode)

  const allConversations = useChatStore((state) => state.conversations)
  const activeId = useChatStore((state) => state.activeId)
  const selectConversation = useChatStore((state) => state.selectConversation)
  const createConversation = useChatStore((state) => state.createConversation)
  const deleteConversation = useChatStore((state) => state.deleteConversation)
  const renameConversation = useChatStore((state) => state.renameConversation)
  const togglePin = useChatStore((state) => state.togglePin)

  // Sort inside a memo: a selector that builds a new array on every call would
  // make zustand re-render forever (useSyncExternalStore strict equality).
  const conversations = useMemo(
    () =>
      [...allConversations].sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      }),
    [allConversations],
  )

  const [query, setQuery] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)
  /**
   * Both text fields stay **uncontrolled** (the DOM owns the text): a controlled
   * input gets its value rewritten on every React render, which on Android
   * WebView moves the caret to the end — that made mid-text editing impossible.
   */
  const searchRef = useRef<HTMLInputElement>(null)
  const renameRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return conversations
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(keyword))
  }, [conversations, query])

  const groups = useMemo(() => {
    const buckets = new Map<string, Conversation[]>()
    for (const conversation of filtered) {
      const label = conversation.pinned ? '已置顶' : dateGroupLabel(conversation.updatedAt)
      const list = buckets.get(label) ?? []
      list.push(conversation)
      buckets.set(label, list)
    }
    return Array.from(buckets.entries())
  }, [filtered])

  if (!open) return null

  const startRename = (conversation: Conversation) => {
    setRenamingId(conversation.id)
    setMenuId(null)
  }

  const commitRename = () => {
    const value = renameRef.current?.value ?? ''
    if (renamingId) renameConversation(renamingId, value)
    setRenamingId(null)
  }

  return (
    <>
      <div className="scrim" onClick={closeDrawer} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="对话记录">
        <div className="drawer-head">
          <BrandMark size={28} />
          <span className="drawer-brand">Deepseek APP</span>
          <button
            type="button"
            className="icon-btn drawer-new"
            aria-label="新建对话"
            onClick={() => {
              tapFeedback()
              createConversation(true)
              closeDrawer()
            }}
          >
            <PlusIcon />
          </button>
          <button type="button" className="icon-btn" aria-label="关闭" onClick={closeDrawer}>
            <CloseIcon />
          </button>
        </div>

        <button
          type="button"
          className="drawer-feature"
          onClick={() => {
            tapFeedback()
            closeDrawer()
            openCreative()
          }}
        >
          <span className="drawer-feature-icon">
            <PencilIcon size={17} />
          </span>
          <span className="drawer-feature-body">
            <span className="drawer-feature-title">创作模式</span>
            <span className="drawer-feature-desc">长文写作工作台 · 大纲 / 多轮续写 / 导出 TXT</span>
          </span>
          <span className="chev">
            <ChevronRightIcon size={15} />
          </span>
        </button>

        <div className="drawer-search">
          <SearchIcon size={16} />
          <input
            ref={searchRef}
            defaultValue=""
            onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
            placeholder="搜索对话"
            aria-label="搜索对话"
            inputMode="search"
          />
          {query ? (
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                if (searchRef.current) searchRef.current.value = ''
                setQuery('')
              }}
              aria-label="清空搜索"
            >
              <CloseIcon size={14} />
            </button>
          ) : null}
        </div>

        <div className="drawer-list">
          {groups.length === 0 ? (
            <div className="drawer-empty">
              {query ? '没有找到匹配的对话' : '还没有对话记录\n点击右上角 + 开始新的对话'}
            </div>
          ) : (
            groups.map(([label, items]) => (
              <div key={label}>
                <div className="drawer-label">{label}</div>
                {items.map((conversation) => {
                  const isActive = conversation.id === activeId
                  const isRenaming = renamingId === conversation.id
                  return (
                    <div key={conversation.id}>
                      <div
                        className={`conv-item${isActive ? ' is-active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (isRenaming) return
                          selectConversation(conversation.id)
                          closeDrawer()
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !isRenaming) {
                            selectConversation(conversation.id)
                            closeDrawer()
                          }
                        }}
                      >
                        {isRenaming ? (
                          <input
                            ref={renameRef}
                            className="conv-title"
                            style={{
                              background: 'var(--bg-elevated)',
                              borderRadius: 6,
                              padding: '3px 6px',
                              width: '100%',
                            }}
                            defaultValue={conversation.title}
                            autoFocus
                            onFocus={(event) => {
                              const element = event.currentTarget
                              const length = element.value.length
                              try {
                                element.setSelectionRange(length, length)
                              } catch {
                                /* ignore */
                              }
                            }}
                            onBlur={commitRename}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') commitRename()
                              if (event.key === 'Escape') setRenamingId(null)
                            }}
                            onClick={(event) => event.stopPropagation()}
                          />
                        ) : (
                          <>
                            <span className="conv-body">
                              <span className="conv-title">{conversation.title}</span>
                              <span className="conv-meta">
                                {conversation.messages.length > 0
                                  ? `${conversation.messages.length} 条消息 · ${formatRelative(conversation.updatedAt)}`
                                  : '空对话'}
                              </span>
                            </span>
                            {conversation.pinned ? (
                              <span className="conv-pin" aria-label="已置顶">
                                <PinIcon />
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className="conv-more"
                              aria-label="更多操作"
                              onClick={(event) => {
                                event.stopPropagation()
                                setMenuId(menuId === conversation.id ? null : conversation.id)
                              }}
                            >
                              <MoreIcon size={16} />
                            </button>
                          </>
                        )}
                      </div>

                      {menuId === conversation.id ? (
                        <div style={{ display: 'flex', gap: 6, padding: '2px 10px 8px 10px' }}>
                          <button
                            type="button"
                            className="pill"
                            onClick={() => startRename(conversation)}
                          >
                            <PencilIcon size={13} />
                            重命名
                          </button>
                          <button
                            type="button"
                            className="pill"
                            onClick={() => {
                              togglePin(conversation.id)
                              setMenuId(null)
                            }}
                          >
                            <PinIcon size={13} />
                            {conversation.pinned ? '取消置顶' : '置顶'}
                          </button>
                          <button
                            type="button"
                            className="pill"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => {
                              setPendingDelete(conversation)
                              setMenuId(null)
                            }}
                          >
                            <TrashIcon size={13} />
                            删除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="drawer-foot">
          <button
            type="button"
            className="drawer-foot-row"
            onClick={() => {
              openSettings()
              closeDrawer()
            }}
          >
            <SettingsIcon />
            设置
            {demoMode ? (
              <span className="sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span className="demo-dot" />
                演示模式
              </span>
            ) : null}
          </button>
        </div>
      </aside>

      {pendingDelete ? (
        <>
          <div className="scrim scrim--sheet" onClick={() => setPendingDelete(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="确认删除">
            <div className="sheet-grabber" />
            <div className="sheet-head">
              <div>
                <div className="sheet-title">删除这个对话？</div>
                <div className="sheet-sub">「{pendingDelete.title}」及其消息将被永久删除</div>
              </div>
            </div>
            <div className="sheet-body">
              <div className="confirm-sheet-actions">
                <button
                  type="button"
                  className="confirm-item confirm-item--danger"
                  onClick={() => {
                    deleteConversation(pendingDelete.id)
                    setPendingDelete(null)
                  }}
                >
                  <TrashIcon />
                  删除对话
                </button>
                <button type="button" className="confirm-item" onClick={() => setPendingDelete(null)}>
                  <CheckIcon />
                  取消
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
