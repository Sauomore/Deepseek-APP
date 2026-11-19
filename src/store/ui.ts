import { create } from 'zustand'

export type ThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export interface ToastItem {
  id: number
  text: string
  tone?: 'default' | 'error' | 'success'
}

interface UiState {
  /* overlays */
  drawerOpen: boolean
  settingsOpen: boolean
  modelSheetOpen: boolean
  attachSheetOpen: boolean
  imageViewer: { src: string; alt?: string } | null

  /* feedback */
  toasts: ToastItem[]

  /* system */
  resolvedTheme: ResolvedTheme
  keyboardOpen: boolean

  openDrawer: () => void
  closeDrawer: () => void
  openSettings: () => void
  closeSettings: () => void
  setModelSheet: (open: boolean) => void
  setAttachSheet: (open: boolean) => void
  openImageViewer: (src: string, alt?: string) => void
  closeImageViewer: () => void

  toast: (text: string, tone?: ToastItem['tone']) => void
  dismissToast: (id: number) => void

  setResolvedTheme: (theme: ResolvedTheme) => void
  setKeyboardOpen: (open: boolean) => void
}

let toastSeq = 0

export const useUiStore = create<UiState>((set, get) => ({
  drawerOpen: false,
  settingsOpen: false,
  modelSheetOpen: false,
  attachSheetOpen: false,
  imageViewer: null,
  toasts: [],
  resolvedTheme: 'light',
  keyboardOpen: false,

  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setModelSheet: (open) => set({ modelSheetOpen: open }),
  setAttachSheet: (open) => set({ attachSheetOpen: open }),
  openImageViewer: (src, alt) => set({ imageViewer: { src, alt } }),
  closeImageViewer: () => set({ imageViewer: null }),

  toast: (text, tone = 'default') => {
    toastSeq += 1
    const id = toastSeq
    set({ toasts: [...get().toasts, { id, text, tone }] })
    window.setTimeout(() => {
      set({ toasts: get().toasts.filter((item) => item.id !== id) })
    }, tone === 'error' ? 3600 : 2400)
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((item) => item.id !== id) }),
  setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
  setKeyboardOpen: (keyboardOpen) => set({ keyboardOpen }),
}))

export const toast = (text: string, tone?: ToastItem['tone']) => useUiStore.getState().toast(text, tone)
