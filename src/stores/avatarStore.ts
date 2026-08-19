import { create } from 'zustand'
import type { Outfit, TopStyle, BottomStyle } from '../three/avatar/clothing'

/** Everything about how the avatar looks. Kept flat so the 3D layer can apply
 *  a whole appearance in one pass without diffing nested objects. */
export interface AvatarAppearance {
  skinColor: string
  hairColor: string
  topColor: string
  bottomColor: string
  shoesColor: string
  outfit: Outfit
}

/** Must stay in sync with the material defaults in `three/avatar/humanoid.ts`,
 *  so the first paint matches the store before any subscription fires. */
export const DEFAULT_APPEARANCE: AvatarAppearance = {
  skinColor: '#8d5524',
  hairColor: '#2b1b12',
  topColor: '#3b6ea5',
  bottomColor: '#2f4858',
  shoesColor: '#232329',
  outfit: { top: 'tshirt', bottom: 'trousers', shoes: true },
}

/** Which parts the loaded model actually exposes. A control wired to nothing
 *  looks broken — you click it and the avatar does not change — so the UI hides
 *  those rather than offering a dead one. The placeholder figure has no
 *  skeleton, for instance, so it cannot wear separate garments. */
export interface TintableParts {
  skin: boolean
  hair: boolean
  top: boolean
  bottom: boolean
  shoes: boolean
  /** Whether garment styles can be chosen at all. */
  outfit: boolean
}

interface AvatarStore extends AvatarAppearance {
  tintable: TintableParts
  setSkinColor: (color: string) => void
  setHairColor: (color: string) => void
  setTopColor: (color: string) => void
  setBottomColor: (color: string) => void
  setShoesColor: (color: string) => void
  setTop: (style: TopStyle) => void
  setBottom: (style: BottomStyle) => void
  setShoes: (on: boolean) => void
  setTintable: (parts: TintableParts) => void
  reset: () => void
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  ...DEFAULT_APPEARANCE,
  // The placeholder figure shows first and has no garment separation.
  tintable: { skin: true, hair: true, top: true, bottom: false, shoes: false, outfit: false },
  setTintable: (tintable) => set({ tintable }),
  setSkinColor: (skinColor) => set({ skinColor }),
  setHairColor: (hairColor) => set({ hairColor }),
  setTopColor: (topColor) => set({ topColor }),
  setBottomColor: (bottomColor) => set({ bottomColor }),
  setShoesColor: (shoesColor) => set({ shoesColor }),
  setTop: (top) => set((s) => ({ outfit: { ...s.outfit, top } })),
  setBottom: (bottom) => set((s) => ({ outfit: { ...s.outfit, bottom } })),
  setShoes: (shoes) => set((s) => ({ outfit: { ...s.outfit, shoes } })),
  reset: () => set({ ...DEFAULT_APPEARANCE }),
}))
