/**
 * Image intake for the vision path.
 *
 * The API accepts JPEG / PNG / GIF / WebP inline as base64 (≤32 MiB, ≤48 MiB
 * request body). It resizes internally to ≈1300×1300 and caps at 1024 tokens,
 * so shipping a 12 MP phone photo is pure waste — we downscale first, which
 * makes uploads fast on mobile data and keeps conversation storage small.
 */

export interface PreparedImage {
  /** `data:image/jpeg;base64,...` — used for the local thumbnail. */
  dataUrl: string
  /** Raw base64 without the data-URL prefix — sent to the API. */
  base64: string
  mediaType: string
  width: number
  height: number
  bytes: number
}

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.86
const ACCEPTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function isSupportedImage(file: File): boolean {
  return ACCEPTED.includes(file.type)
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
}

function splitDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const comma = dataUrl.indexOf(',')
  const header = dataUrl.slice(0, comma)
  const mediaType = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg'
  return { mediaType, base64: dataUrl.slice(comma + 1) }
}

/** Downscale + re-encode an image for the vision API. */
export async function prepareImage(file: File | Blob): Promise<PreparedImage> {
  const type = file.type || 'image/jpeg'
  if (!ACCEPTED.includes(type)) {
    throw new Error('仅支持 JPG / PNG / GIF / WebP 图片')
  }
  if (file.size > 32 * 1024 * 1024) {
    throw new Error('图片超过 32MB，请先压缩')
  }

  const originalDataUrl = await readAsDataUrl(file)

  // Small PNG (screenshots, diagrams) keeps its lossless form and transparency.
  if (type === 'image/png' && file.size <= 2.5 * 1024 * 1024) {
    try {
      const img = await loadImage(originalDataUrl)
      if (Math.max(img.naturalWidth, img.naturalHeight) <= MAX_DIMENSION) {
        const { mediaType, base64 } = splitDataUrl(originalDataUrl)
        return {
          dataUrl: originalDataUrl,
          base64,
          mediaType,
          width: img.naturalWidth,
          height: img.naturalHeight,
          bytes: file.size,
        }
      }
    } catch {
      /* fall through to the canvas path */
    }
  }

  const img = await loadImage(originalDataUrl)
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前设备不支持图片处理')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // Flatten onto white so transparent PNGs don't turn black in JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const { mediaType, base64 } = splitDataUrl(dataUrl)
  return {
    dataUrl,
    base64,
    mediaType,
    width,
    height,
    bytes: Math.round((base64.length * 3) / 4),
  }
}

/** Read any small file as base64 (used for thumbnails of unknown types). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await readAsDataUrl(blob)
  return splitDataUrl(dataUrl).base64
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** i
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}
