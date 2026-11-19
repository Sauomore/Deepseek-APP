/** Toast layer — transient messages anchored above the composer. */

import { useUiStore } from '@/store/ui'

export function ToastLayer() {
  const toasts = useUiStore((state) => state.toasts)
  if (toasts.length === 0) return null

  return (
    <div className="toast-layer" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast"
          style={
            toast.tone === 'error'
              ? { background: 'var(--danger)', color: '#fff' }
              : toast.tone === 'success'
                ? { background: 'var(--success)', color: '#fff' }
                : undefined
          }
        >
          {toast.text}
        </div>
      ))}
    </div>
  )
}
