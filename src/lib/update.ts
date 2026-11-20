/**
 * In-app update: talk to the GitHub Release API, compare versions, stream the
 * APK bytes and hand them to the native installer plugin.
 */

import { Capacitor, registerPlugin } from '@capacitor/core'
import { APP_VERSION } from '@/lib/version'

export const UPDATE_REPO = 'Sauomore/Deepseek-APP'
export const RELEASES_PAGE = `https://github.com/${UPDATE_REPO}/releases/latest`
const API_LATEST = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`

export interface UpdateInfo {
  current: string
  latest: string
  hasUpdate: boolean
  releaseUrl: string
  notes: string
  publishedAt: string
  apkUrl: string | null
  apkName: string | null
  apkSize: number
}

interface InstallerPlugin {
  downloadAndInstall(options: { url: string; fileName: string }): Promise<{ path: string; size: number }>
  install(options: { base64: string; fileName: string }): Promise<{ path: string }>
  addListener(
    event: 'progress',
    listener: (data: { progress?: number; received?: number; total?: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

const installer = registerPlugin<InstallerPlugin>('AppUpdater')

/** Numeric comparison of dotted versions (1.2.0 > 1.1.9). */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const pb = b.replace(/^v/i, '').split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(pa.length, pb.length)
  for (let i = 0; i < length; i += 1) {
    const left = pa[i] ?? 0
    const right = pb[i] ?? 0
    if (left !== right) return left > right ? 1 : -1
  }
  return 0
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const response = await fetch(API_LATEST, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) {
    if (response.status === 404) throw new Error('未找到 Release，请确认仓库已发布版本')
    if (response.status === 403) throw new Error('GitHub API 访问受限，请稍后再试')
    throw new Error(`检查更新失败（HTTP ${response.status}）`)
  }
  const data = (await response.json()) as {
    tag_name?: string
    html_url?: string
    body?: string
    published_at?: string
    assets?: Array<{ name: string; browser_download_url: string; size: number }>
  }

  const latest = String(data.tag_name ?? '').replace(/^v/i, '')
  const apk = (data.assets ?? []).find(
    (asset) => /\.apk$/i.test(asset.name) && !/debug/i.test(asset.name),
  )

  return {
    current: APP_VERSION,
    latest,
    hasUpdate: Boolean(latest) && compareVersions(latest, APP_VERSION) > 0,
    releaseUrl: data.html_url || RELEASES_PAGE,
    notes: data.body ?? '',
    publishedAt: data.published_at ?? '',
    apkUrl: apk?.browser_download_url ?? null,
    apkName: apk?.name ?? null,
    apkSize: apk?.size ?? 0,
  }
}

/** Whether the native installer bridge is available (Android build only). */
export function canInstallInApp(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Download the APK and open the system installer.
 *
 * The download runs natively: GitHub release assets redirect to
 * `objects.githubusercontent.com`, which sends no CORS headers, so a WebView
 * `fetch` is blocked.
 */
export async function downloadAndInstallApk(
  url: string,
  fileName: string,
  onProgress?: (ratio: number, received: number, total: number) => void,
): Promise<void> {
  const handle = await installer.addListener('progress', (data) => {
    onProgress?.(data.progress ?? 0, data.received ?? 0, data.total ?? 0)
  })
  try {
    await installer.downloadAndInstall({ url, fileName: fileName || 'update.apk' })
  } finally {
    await handle.remove().catch(() => undefined)
  }
}

/** Hand already-downloaded bytes to the system package installer. */
export async function installApk(base64: string, fileName: string): Promise<void> {
  await installer.install({ base64, fileName: fileName || 'update.apk' })
}
