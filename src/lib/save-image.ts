/**
 * Export + save utilities for rendered Mermaid diagrams.
 *
 * Rendering path: clone the live `<svg>` → rasterise through an `<img>` + canvas
 * (2× for crisp output) → PNG blob. Some WebViews refuse to rasterise SVGs that
 * contain `<foreignObject>` (Mermaid uses it for HTML labels), so a failed PNG
 * export falls back to saving the vector `.svg` itself — always something saved.
 *
 * Saving path: on Android the file is written to the app cache and handed to the
 * system share sheet (from which the user can "save to Photos/Downloads" or send
 * it anywhere). In a plain browser it falls back to a download.
 */

import { Capacitor } from '@capacitor/core'

const SVG_NS = 'http://www.w3.org/2000/svg'

function timestamp(): string {
  const now = new Date()
  const pad = (value: number) => `${value}`.padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const [, , width, height] = viewBox.split(/[\s,]+/).map(Number)
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height }
    }
  }
  const rect = svg.getBoundingClientRect()
  return { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) }
}

/** Serialise a live SVG into a standalone document ready to be rasterised. */
function serialiseSvg(svg: SVGSVGElement, background: string): { markup: string; width: number; height: number } {
  const { width, height } = svgSize(svg)
  const clone = svg.cloneNode(true) as SVGSVGElement

  clone.setAttribute('xmlns', SVG_NS)
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', `${width}`)
  clone.setAttribute('height', `${height}`)
  // Strip inherited page styling that would distort the export.
  clone.removeAttribute('style')
  clone.style.background = background

  const rect = document.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('x', '0')
  rect.setAttribute('y', '0')
  rect.setAttribute('width', '100%')
  rect.setAttribute('height', '100%')
  rect.setAttribute('fill', background)
  clone.insertBefore(rect, clone.firstChild)

  return { markup: new XMLSerializer().serializeToString(clone), width, height }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图表渲染失败'))
    image.src = src
  })
}

/** Rasterise an SVG element to a PNG blob (2× scale). */
export async function svgToPng(svg: SVGSVGElement, background = '#ffffff', scale = 2): Promise<Blob> {
  const { markup, width, height } = serialiseSvg(svg, background)
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  const image = await loadImage(dataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前设备不支持图片导出')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('图片生成失败')
  return blob
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

/** Write/share a blob through the OS, or download it in a plain browser. */
export async function saveBlob(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const base64 = await blobToBase64(blob)
    const written = await Filesystem.writeFile({
      path: `mermaid/${filename}`,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    })
    await Share.share({
      title: filename,
      text: '来自 Deepseek APP 的 Mermaid 图表',
      files: [written.uri],
      dialogTitle: '保存或分享图表',
    })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}

/**
 * Export a rendered Mermaid `<svg>` and save it.
 * Returns the file format that was actually written (`png` or `svg`).
 */
export async function exportMermaidImage(
  svg: SVGSVGElement,
  options: { background?: string } = {},
): Promise<'png' | 'svg'> {
  const background = options.background || '#ffffff'
  const base = `deepseek-mermaid-${timestamp()}`

  try {
    const png = await svgToPng(svg, background)
    // A blank export means the WebView refused to rasterise SVG-internal HTML.
    if (png.size < 2000) throw new Error('png too small')
    await saveBlob(png, `${base}.png`)
    return 'png'
  } catch {
    const { markup } = serialiseSvg(svg, background)
    await saveBlob(new Blob([markup], { type: 'image/svg+xml' }), `${base}.svg`)
    return 'svg'
  }
}
