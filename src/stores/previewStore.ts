import { create } from 'zustand'
import type { AvatarAppearance } from './avatarStore'

/**
 * An appearance the 3D scene should show *instead of* the saved one, for as
 * long as it is set.
 *
 * This exists because looking at somebody else's avatar is not the same as
 * becoming them. The obvious implementation — drop the scanned avatar into the
 * appearance store and put the old one back afterwards — writes through to
 * local storage the moment the preview starts, so a visitor who scans a code
 * and then closes the tab loses the character they built. Putting it back
 * afterwards cannot help: there is no afterwards when a tab is closed.
 *
 * So a preview is kept somewhere that was never going to be saved. Nothing has
 * to be paused, snapshotted or restored, and the dangerous case stops existing
 * rather than being handled.
 */
interface PreviewStore {
  /** Null when the scene should show whatever the visitor actually owns. */
  appearance: AvatarAppearance | null
  setPreview: (appearance: AvatarAppearance | null) => void
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  appearance: null,
  setPreview: (appearance) => set({ appearance }),
}))
