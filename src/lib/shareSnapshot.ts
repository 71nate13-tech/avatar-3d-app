import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * Hands the rendered avatar to whatever the platform uses for sharing.
 *
 * On Android that is the system share sheet, which needs a real file rather
 * than a data URL, so the image is written to the cache directory first. Cache
 * rather than documents: it is a throwaway copy for handing to another app, and
 * Android is free to clean it up afterwards.
 *
 * On the web and in the desktop build there is no share sheet, so it saves
 * instead. The distinction is a platform check rather than a build flag,
 * because the same bundle runs in all three.
 */
export type ShareOutcome = 'shared' | 'saved' | 'cancelled' | 'failed'

export async function shareSnapshot(dataUrl: string): Promise<ShareOutcome> {
  const base64 = dataUrl.split(',')[1]
  if (!base64) return 'failed'

  const fileName = `avatar-${new Date().toISOString().replace(/[:.]/g, '-')}.png`

  if (Capacitor.isNativePlatform()) {
    try {
      const written = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      })
      await Share.share({
        title: 'My avatar',
        text: 'Made in Avatar 3D',
        files: [written.uri],
      })
      return 'shared'
    } catch (error) {
      // Dismissing the share sheet rejects, and that is not a failure worth
      // reporting as one.
      const message = error instanceof Error ? error.message : String(error)
      if (/cancel|abort|dismiss/i.test(message)) return 'cancelled'
      console.warn('[share] failed:', error)
      return 'failed'
    }
  }

  try {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = fileName
    link.click()
    return 'saved'
  } catch (error) {
    console.warn('[share] save failed:', error)
    return 'failed'
  }
}
