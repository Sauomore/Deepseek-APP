/** Chat screen shell: header, message list and composer. */

import { useCallback } from 'react'
import { Composer } from '@/components/Composer'
import { MessageList } from '@/components/MessageList'
import { MenuIcon, PlusIcon, SettingsIcon } from '@/components/icons'
import { selectActiveConversation, useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { tapFeedback } from '@/lib/haptics'
import { useUiStore } from '@/store/ui'

export function ChatScreen() {
  const conversation = useChatStore(selectActiveConversation)
  const generating = useChatStore((state) => state.generating)
  const send = useChatStore((state) => state.send)
  const regenerate = useChatStore((state) => state.regenerate)
  const stop = useChatStore((state) => state.stop)
  const createConversation = useChatStore((state) => state.createConversation)
  const settings = useSettingsStore((state) => state.settings)

  const openDrawer = useUiStore((state) => state.openDrawer)
  const openSettings = useUiStore((state) => state.openSettings)

  const messages = conversation?.messages ?? []

  const handleRegenerate = useCallback(
    (messageId: string) => {
      tapFeedback()
      void regenerate(messageId)
    },
    [regenerate],
  )

  const handleSuggestion = useCallback(
    (prompt: string) => {
      tapFeedback()
      void send(prompt)
    },
    [send],
  )

  return (
    <div className="chat-screen">
      <header className="chat-header">
        <button type="button" className="icon-btn" onClick={openDrawer} aria-label="打开对话列表">
          <MenuIcon />
        </button>

        <div className="header-title" />

        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              tapFeedback()
              createConversation(true)
            }}
            aria-label="新建对话"
          >
            <PlusIcon />
          </button>
          <button type="button" className="icon-btn" onClick={openSettings} aria-label="设置">
            <SettingsIcon />
          </button>
        </div>
      </header>

      <MessageList
        messages={messages}
        onRegenerate={handleRegenerate}
        onPickSuggestion={handleSuggestion}
        seed={conversation?.id ?? 'new'}
        suggestionsEnabled={settings.showSuggestions}
      />

      <Composer conversation={conversation} generating={generating} onStop={stop} />
    </div>
  )
}
