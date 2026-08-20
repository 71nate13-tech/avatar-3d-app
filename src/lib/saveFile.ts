import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Hands a finished file to whatever the platform uses for getting files out.
 *
 * On Android that is the system share sheet, which needs a real file on disk
 * rather than anything held in memory, so it is written to the cache directory
 * first. Cache rather than documents: it is a throwaway copy being handed to
 * another app, and Android is free to clean it up afterwards.
 *
 * On the web and in the desktop build there is no share sheet, so it saves
 * instead. The distinction is a platform check rather than a build flag,
 * because the same bundle runs in all three.
 */
export type SaveOutcome = 'shared' | 'saved' | 'cancelled' | 'failed'

/** Capacitor's filesystem takes base64, and a Blob is the only thing both the
 *  canvas and the glTF exporter can agree to produce. */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') return reject(new Error('unreadable'))
      const comma = result.indexOf(',')
      resolve(comma < 0 ? result : result.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('unreadable'))
    reader.readAsDataURL(blob)
  })
}

export async function saveOrShare(
  blob: Blob,
  fileName: string,
  title: string,
  text?: string,
): Promise<SaveOutcome> {
  if (Capacitor.isNativePlatform()) {
    try {
      const written = await Filesystem.writeFile({
        path: fileName,
        data: await toBase64(blob),
        directory: Directory.Cache,
      })
      await Share.share({ title, text, files: [written.uri] })
      return 'shared'
    } catch (error) {
      // Dismissing the share sheet rejects, and that is not a failure worth
      // reporting as one.
      const message = error instanceof Error ? error.message : String(error)
      if (/cancel|abort|dismiss/i.test(message)) return 'cancelled'
      console.warn('[save] share failed:', error)
      return 'failed'
    }
  }

  let url: string | null = null
  try {
    url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    return 'saved'
  } catch (error) {
    console.warn('[save] download failed:', error)
    return 'failed'
  } finally {
    // Not immediately: revoking before the click has been serviced cancels the
    // download in some browsers.
    const created = url
    if (created) setTimeout(() => URL.revokeObjectURL(created), 10_000)
  }
}

/** A timestamped name, so saving twice does not silently overwrite. */
export function stampedName(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `${prefix}-${stamp}.${extension}`
}
