/**
 * App shell.
 *
 * Responsibilities beyond layout:
 *  - resolve and apply the theme (auto / light / dark) before first paint
 *  - apply the user's reading size
 *  - native integration: status bar, Android back button, app-pause flushing
 *  - hide the boot splash once local history is hydrated
 */

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

import { ChatScreen } from '@/components/ChatScreen'
import { ConversationDrawer } from '@/components/ConversationDrawer'
import { CreativeMode } from '@/components/CreativeMode'
import { ImageViewer } from '@/components/ImageViewer'
import { ModelSheet } from '@/components/ModelSheet'
import { Onboarding } from '@/components/Onboarding'
import { SettingsPage } from '@/components/SettingsPage'
import { ToastLayer } from '@/components/ToastLayer'
import { UpdateNotice } from '@/components/UpdateNotice'
import { useChatStore } from '@/store/chat'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import type { FontScale } from '@/types/settings'

const FONT_SCALES: Record<FontScale, number> = {
  sm: 0.92,
  md: 1,
  lg: 1.12,
}

/**
 * Reading size. Many components pin their text to px, so scaling individual
 * tokens only moved a fraction of the UI; CSS `zoom` on the root scales every
 * text size (and its layout) consistently — verified to keep the fixed composer
 * and sheets anchored and to avoid horizontal overflow.
 */
function applyFontScale(scale: FontScale): void {
  const factor = FONT_SCALES[scale] ?? 1
  document.documentElement.style.zoom = factor === 1 ? '' : String(factor)
}

function hideBootSplash(): void {
  const splash = document.getElementById('boot-splash')
  if (!splash) return
  splash.classList.add('hide')
  window.setTimeout(() => splash.remove(), 320)
}

export default function App() {
  const hydrated = useChatStore((state) => state.hydrated)
  const hydrate = useChatStore((state) => state.hydrate)
  const themeMode = useSettingsStore((state) => state.settings.theme)
  const fontScale = useSettingsStore((state) => state.settings.fontScale)
  const setResolvedTheme = useUiStore((state) => state.setResolvedTheme)

  /* ------------------------------ hydrate ------------------------------ */
  useEffect(() => {
    void hydrate()
  }, [hydrate])

  /* ------------------------------- theme ------------------------------- */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const resolved: 'light' | 'dark' =
        themeMode === 'auto' ? (media.matches ? 'dark' : 'light') : themeMode

      document.documentElement.setAttribute('data-theme', resolved)
      setResolvedTheme(resolved)

      // Keep the OS status bar / theme-colour in sync.
      const meta = document.querySelector('meta[name="theme-color"]:not([media])')
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#17181c' : '#ffffff')

      if (Capacitor.isNativePlatform()) {
        // Draw under the status bar so the app's own background paints it —
        // `setBackgroundColor` is a no-op on Android 15+ (targetSdk 36), which
        // is why the strip stayed white while the page was dark.
        void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined)
        void StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light }).catch(
          () => undefined,
        )
      }
    }

    apply()
    if (themeMode !== 'auto') return undefined

    const listener = () => apply()
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [themeMode, setResolvedTheme])

  /* ---------------------------- reading size ---------------------------- */
  useEffect(() => {
    applyFontScale(fontScale)
  }, [fontScale])

  /* ------------------------- splash + native wiring ------------------------- */
  useEffect(() => {
    // Safety net: never leave the native splash up if hydration throws.
    const fallback = window.setTimeout(() => {
      hideBootSplash()
      if (Capacitor.isNativePlatform()) void SplashScreen.hide().catch(() => undefined)
    }, 5000)

    if (!hydrated) return () => window.clearTimeout(fallback)

    window.clearTimeout(fallback)
    hideBootSplash()
    if (Capacitor.isNativePlatform()) {
      void SplashScreen.hide().catch(() => undefined)
    }
    return undefined
  }, [hydrated])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    const backListener = CapApp.addListener('backButton', () => {
      const ui = useUiStore.getState()
      if (ui.imageViewer) {
        ui.closeImageViewer()
        return
      }
      if (ui.creativeOpen) {
        ui.closeCreative()
        return
      }
      if (ui.settingsOpen) {
        ui.closeSettings()
        return
      }
      if (ui.modelSheetOpen) {
        ui.setModelSheet(false)
        return
      }
      if (ui.attachSheetOpen) {
        ui.setAttachSheet(false)
        return
      }
      if (ui.drawerOpen) {
        ui.closeDrawer()
        return
      }
      // At the root, behave like a home button rather than killing the app.
      void CapApp.minimizeApp().catch(() => undefined)
    })

    const stateListener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        useChatStore.getState().persistNow()
        // Persist the API key before the process can be frozen.
        useSettingsStore.getState().flush()
      }
    })

    const visibilityListener = () => {
      if (document.visibilityState === 'hidden') {
        useChatStore.getState().persistNow()
        useSettingsStore.getState().flush()
      }
    }
    document.addEventListener('visibilitychange', visibilityListener)

    return () => {
      void backListener.then((handle) => handle.remove())
      void stateListener.then((handle) => handle.remove())
      document.removeEventListener('visibilitychange', visibilityListener)
    }
  }, [])

  return (
    <div className="app-shell">
      <div className="app-main">
        <ChatScreen />
      </div>

      <ConversationDrawer />
      <CreativeMode />
      <SettingsPage />
      <ModelSheet />
      <ImageViewer />
      <ToastLayer />
      <Onboarding />
      <UpdateNotice />
    </div>
  )
}
