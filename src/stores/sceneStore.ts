import { create } from 'zustand'

/**
 * A handle from the 3D layer back up to the UI.
 *
 * The share button lives in the control panel, but only the render loop can
 * produce an image, and the two are siblings rather than parent and child.
 * Passing the function through the store keeps them decoupled: the panel does
 * not need to know a canvas exists, and the canvas does not need to know
 * anything is going to ask.
 *
 * Nothing here is persisted — it is a live function, meaningless across runs.
 */
interface SceneStore {
  /** Renders a frame and returns it as a PNG data URL. Null before the scene
   *  is up, which is what disables the share button. */
  capture: (() => string) | null
  setCapture: (capture: (() => string) | null) => void
}

export const useSceneStore = create<SceneStore>((set) => ({
  capture: null,
  setCapture: (capture) => set({ capture }),
}))
