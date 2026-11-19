/** Full-screen image preview (tap a thumbnail or an attached picture). */

import { CloseIcon } from '@/components/icons'
import { useUiStore } from '@/store/ui'

export function ImageViewer() {
  const image = useUiStore((state) => state.imageViewer)
  const close = useUiStore((state) => state.closeImageViewer)

  if (!image) return null

  return (
    <div
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={image.alt ?? '图片预览'}
      onClick={close}
    >
      <button type="button" className="image-viewer-close" onClick={close} aria-label="关闭">
        <CloseIcon />
      </button>
      <img src={image.src} alt={image.alt ?? ''} onClick={(event) => event.stopPropagation()} />
    </div>
  )
}
