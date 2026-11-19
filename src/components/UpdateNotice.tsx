/**
 * "What's new" dialog — shown once after the app is installed or updated.
 *
 * The seen-version marker lives in localStorage; it is written only when the
 * user dismisses the dialog, so a force-quit in the middle shows it again.
 */

import { useEffect, useState } from 'react'
import { BrandMark } from '@/components/BrandMark'
import { APP_VERSION, LATEST_VERSION, RELEASE_NOTES } from '@/lib/version'
import { useSettingsStore } from '@/store/settings'
import { tapFeedback } from '@/lib/haptics'

const SEEN_KEY = 'deepseek.lastSeenVersion.v1'

export function UpdateNotice() {
  const onboardingDone = useSettingsStore((state) => state.settings.onboardingDone)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!onboardingDone) return
    let seen: string | null = null
    try {
      seen = localStorage.getItem(SEEN_KEY)
    } catch {
      seen = null
    }
    if (seen !== APP_VERSION) setVisible(true)
  }, [onboardingDone])

  if (!visible) return null

  const note = RELEASE_NOTES.find((item) => item.version === LATEST_VERSION) ?? RELEASE_NOTES[0]

  const dismiss = () => {
    tapFeedback()
    try {
      localStorage.setItem(SEEN_KEY, APP_VERSION)
    } catch {
      /* storage unavailable — the dialog will simply show again next launch */
    }
    setVisible(false)
  }

  return (
    <div className="update-overlay" role="dialog" aria-modal="true" aria-label="更新公告">
      <div className="update-card">
        <BrandMark size={52} className="update-brand" />
        <div className="update-title">更新公告</div>
        <div className="update-version">
          Deepseek APP v{note?.version ?? APP_VERSION}
          {note?.date ? ` · ${note.date}` : ''}
        </div>

        <ul className="update-list">
          {(note?.items ?? []).map((item) => (
            <li key={item} className="update-item">
              <span className="update-dot" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn--primary btn--block" onClick={dismiss}>
          知道了
        </button>
      </div>
    </div>
  )
}
