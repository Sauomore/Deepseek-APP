/** Small platform helpers that behave well both in the browser and in the WebView. */

import { Capacitor } from '@capacitor/core'

export const isNative = (): boolean => Capacitor.isNativePlatform()

/**
 * Open a URL outside the app.
 * Capacitor turns the `_system` target into a real Intent; browsers fall back to
 * a new tab. We never navigate the WebView itself — that would destroy the app.
 */
export function openExternal(url: string): void {
  if (!/^https?:\/\//i.test(url)) return
  try {
    const opened = window.open(url, '_system')
    if (!opened) window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/** Clipboard write with a legacy fallback for older WebViews. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/** Hostname for display next to a source favicon. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function safeDecode(value: string | undefined): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
