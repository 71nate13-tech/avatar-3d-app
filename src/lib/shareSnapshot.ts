import { saveOrShare, stampedName, type SaveOutcome } from './saveFile'

/**
 * Hands the rendered avatar to whatever the platform uses for sharing.
 *
 * The platform differences all live in `saveFile`, which the model export uses
 * too — a picture and a `.glb` leave the device by exactly the same route.
 */
export type ShareOutcome = SaveOutcome

export async function shareSnapshot(dataUrl: string): Promise<ShareOutcome> {
  const base64 = dataUrl.split(',')[1]
  if (!base64) return 'failed'

  // Back to bytes, because the share sheet needs a real file and the browser
  // download wants a blob URL. Neither can use the data URL as it stands.
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'image/png' })

  return saveOrShare(blob, stampedName('avatar', 'png'), 'My avatar', 'Made in Avatar 3D')
}
