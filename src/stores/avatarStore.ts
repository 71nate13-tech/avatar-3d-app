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

interface AvatarStore extends AvatarAppearance {
  setSkinColor: (color: string) => void
  setHairColor: (color: string) => void
  setClothingColor: (color: string) => void
  reset: () => void
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  ...DEFAULT_APPEARANCE,
  setSkinColor: (skinColor) => set({ skinColor }),
  setHairColor: (hairColor) => set({ hairColor }),
  setClothingColor: (clothingColor) => set({ clothingColor }),
  reset: () => set({ ...DEFAULT_APPEARANCE }),
}))
