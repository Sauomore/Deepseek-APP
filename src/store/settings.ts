import { create } from 'zustand'
import { loadSettings, saveSettings, saveSettingsNow } from '@/lib/storage'
import { DEFAULT_SETTINGS, type Settings } from '@/types/settings'

interface SettingsState {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  replace: (settings: Settings) => void
  reset: () => void
  /** Write pending changes to disk immediately (called when backgrounding). */
  flush: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadSettings(),

  update: (patch) => {
    const next: Settings = { ...get().settings, ...patch }
    saveSettings(next)
    set({ settings: next })
  },

  replace: (settings) => {
    const next: Settings = { ...DEFAULT_SETTINGS, ...settings }
    saveSettingsNow(next)
    set({ settings: next })
  },

  reset: () => {
    const next = { ...DEFAULT_SETTINGS }
    saveSettingsNow(next)
    set({ settings: next })
  },

  flush: () => {
    saveSettingsNow(get().settings)
  },
}))

/** Convenience selectors (avoid re-rendering on unrelated settings changes). */
export const selectSettings = (state: SettingsState) => state.settings
export const selectDemoMode = (state: SettingsState) => state.settings.demoMode
export const selectHasKey = (state: SettingsState) => state.settings.apiKey.trim().length > 0
