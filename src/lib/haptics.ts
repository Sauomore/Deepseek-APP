/** Haptics with a graceful web fallback (and a user-facing setting). */

import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { useSettingsStore } from '@/store/settings'

function enabled(): boolean {
  return useSettingsStore.getState().settings.hapticsEnabled
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}

export function tapFeedback(): void {
  if (!enabled()) return
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
  } else {
    vibrate(8)
  }
}

export function selectFeedback(): void {
  if (!enabled()) return
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined)
  } else {
    vibrate(12)
  }
}

export function successFeedback(): void {
  if (!enabled()) return
  if (Capacitor.isNativePlatform()) {
    void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined)
  } else {
    vibrate([10, 40, 12])
  }
}
