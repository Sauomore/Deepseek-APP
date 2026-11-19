/**
 * Attachment intake: turn a picked File into an `Attachment` ready for a request.
 *
 * - Images are downscaled locally and sent inline as base64 (vision path).
 * - Documents are uploaded to the Files API and referenced by `file_id`.
 *
 * Two upload families exist and they are NOT interchangeable (verified live):
 *
 *   parsed      purpose = text_recognition | rich_layout_recognition
 *               PDF / DOC / DOCX / PPT / PPTX / images — parsed per page, billed
 *   user_data   purpose = user_data
 *               txt / md / csv / json / source code / XLSX / XLS / EPUB / MOBI —
 *               converted to Markdown server-side, not billed, 32 MiB cap
 *
 * Sending a txt file with a parsing purpose returns 400, which is why the
 * purpose is derived from the file extension rather than being fixed.
 */

import { mockUploadFile } from '@/api/mock/engine'
import { uploadFile } from '@/api/client'
import { prefixedId } from '@/lib/id'
import { prepareImage } from '@/lib/image'
import type { Settings } from '@/types/settings'
import type { Attachment } from '@/types/chat'
import type { FilePurpose } from '@/types/api'

/** Files the server parses (billed per page). */
const PARSED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx'] as const

/** Files that only need conversion to Markdown (`user_data`, not billed). */
const USER_DATA_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'xls',
  'xlsx',
  'epub',
  'mobi',
  // A few common source-code extensions ride the same plain-text path.
  'js',
  'ts',
  'py',
  'java',
  'go',
  'rs',
  'sh',
  'sql',
  'html',
  'css',
  'xml',
  'yaml',
  'yml',
] as const

export const DOCUMENT_EXTENSIONS = [...PARSED_EXTENSIONS, ...USER_DATA_EXTENSIONS]

export const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',')

const MAX_PARSED_BYTES = 100 * 1024 * 1024
const MAX_USER_DATA_BYTES = 32 * 1024 * 1024

export function isDocumentFile(file: File): boolean {
  const ext = fileExtension(file.name)
  return (DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/** Map an extension to the Files API purpose it requires. */
export function purposeFor(file: File): FilePurpose {
  const ext = fileExtension(file.name)
  if ((USER_DATA_EXTENSIONS as readonly string[]).includes(ext)) return 'user_data'
  // PDFs and slides usually carry charts, so ask for rich layout parsing.
  if (ext === 'ppt' || ext === 'pptx') return 'rich_layout_recognition'
  if (ext === 'pdf') return 'rich_layout_recognition'
  return 'text_recognition'
}

export async function createImageAttachment(file: File): Promise<Attachment> {
  const prepared = await prepareImage(file)
  return {
    id: prefixedId('img'),
    kind: 'image',
    name: file.name || '图片',
    mimeType: prepared.mediaType,
    size: prepared.bytes,
    previewUrl: prepared.dataUrl,
    base64: prepared.base64,
    uploadState: 'ready',
    meta: { width: prepared.width, height: prepared.height },
  }
}

export interface DocumentUploadOptions {
  settings: Settings
  signal?: AbortSignal
  onProgress?: (ratio: number) => void
}

export async function createDocumentAttachment(
  file: File,
  opts: DocumentUploadOptions,
): Promise<Attachment> {
  if (!isDocumentFile(file)) {
    throw new Error('暂不支持这种文件格式')
  }

  const purpose = purposeFor(file)
  const limit = purpose === 'user_data' ? MAX_USER_DATA_BYTES : MAX_PARSED_BYTES
  if (file.size > limit) {
    throw new Error(
      purpose === 'user_data'
        ? '文本/表格类文件不能超过 32MB'
        : '文档不能超过 100MB，请压缩或拆分后再上传',
    )
  }

  const base: Attachment = {
    id: prefixedId('doc'),
    kind: 'document',
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    uploadState: 'uploading',
    progress: 0,
    purpose,
    blob: file,
  }

  const onProgress = (ratio: number) => opts.onProgress?.(ratio)

  if (opts.settings.demoMode) {
    const uploaded = await mockUploadFile({
      file,
      filename: file.name,
      purpose,
      signal: opts.signal,
      onProgress,
    })
    return { ...base, fileId: uploaded.id, uploadState: 'ready', progress: 1 }
  }

  if (!opts.settings.apiKey.trim()) {
    throw new Error('请先在设置中填写 API Key')
  }

  const uploaded = await uploadFile({
    baseUrl: opts.settings.baseUrl,
    apiKey: opts.settings.apiKey,
    file,
    filename: file.name,
    purpose,
    signal: opts.signal,
    onProgress,
  })

  return {
    ...base,
    fileId: uploaded.id,
    uploadState: 'ready',
    progress: 1,
    // For user_data uploads the server returns the converted size, not the original.
    meta: uploaded.bytes ? { serverBytes: uploaded.bytes } : undefined,
  }
}
