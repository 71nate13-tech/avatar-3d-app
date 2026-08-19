import { create } from 'zustand'

/** Everything about how the avatar looks. Kept flat so the 3D layer can apply
 *  a whole appearance in one pass without diffing nested objects. */
export interface AvatarAppearance {
  skinColor: string
  hairColor: string
  clothingColor: string
}

/** Must stay in sync with the material defaults in `three/avatar/humanoid.ts`,
 *  so the first paint matches the store before any subscription fires. */
export const DEFAULT_APPEARANCE: AvatarAppearance = {
  skinColor: '#8d5524',
  hairColor: '#2b1b12',
  clothingColor: '#3b6ea5',
}

/** Which parts the loaded model actually exposes. A control wired to nothing
 *  looks broken — you click it and the avatar does not change — so the UI hides
 *  those rather than offering a dead one. Mixamo's mannequins have no separate
 *  hair mesh, for instance. */
export interface TintableParts {
  skin: boolean
  hair: boolean
  clothing: boolean
}

interface AvatarStore extends AvatarAppearance {
  tintable: TintableParts
  setSkinColor: (color: string) => void
  setHairColor: (color: string) => void
  setClothingColor: (color: string) => void
  setTintable: (parts: TintableParts) => void
  reset: () => void
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  ...DEFAULT_APPEARANCE,
  // The placeholder figure has all three, and it is what shows first.
  tintable: { skin: true, hair: true, clothing: true },
  setTintable: (tintable) => set({ tintable }),
  setSkinColor: (skinColor) => set({ skinColor }),
  setHairColor: (hairColor) => set({ hairColor }),
  setClothingColor: (clothingColor) => set({ clothingColor }),
  reset: () => set({ ...DEFAULT_APPEARANCE }),
}))
