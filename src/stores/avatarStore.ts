import { create } from 'zustand'
import type { Outfit, TopStyle, BottomStyle } from '../three/avatar/clothing'
import type { ExpressionName } from '../three/avatar/face'
import type { HairStyle } from '../three/avatar/hair'

/** Everything about how the avatar looks. Kept flat so the 3D layer can apply
 *  a whole appearance in one pass without diffing nested objects. */
export interface AvatarAppearance {
  skinColor: string
  hairColor: string
  eyeColor: string
  topColor: string
  bottomColor: string
  shoesColor: string
  outfit: Outfit
  hairStyle: HairStyle
  expression: ExpressionName
}

/** Must stay in sync with the material defaults in `three/avatar/humanoid.ts`,
 *  so the first paint matches the store before any subscription fires. */
export const DEFAULT_APPEARANCE: AvatarAppearance = {
  skinColor: '#8d5524',
  hairColor: '#2b1b12',
  eyeColor: '#4a2c17',
  topColor: '#3b6ea5',
  bottomColor: '#2f4858',
  shoesColor: '#232329',
  outfit: { top: 'tshirt', bottom: 'trousers', shoes: true },
  hairStyle: 'coils',
  expression: 'happy',
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
  /** Face and hair need a head bone to hang from; the placeholder has none. */
  head: boolean
}

interface AvatarStore extends AvatarAppearance {
  tintable: TintableParts
  setSkinColor: (color: string) => void
  setHairColor: (color: string) => void
  setEyeColor: (color: string) => void
  setTopColor: (color: string) => void
  setBottomColor: (color: string) => void
  setShoesColor: (color: string) => void
  setTop: (style: TopStyle) => void
  setBottom: (style: BottomStyle) => void
  setShoes: (on: boolean) => void
  setHairStyle: (style: HairStyle) => void
  setExpression: (expression: ExpressionName) => void
  setTintable: (parts: TintableParts) => void
  reset: () => void
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  ...DEFAULT_APPEARANCE,
  // The placeholder figure shows first and has no garment separation.
  tintable: {
    skin: true,
    hair: true,
    top: true,
    bottom: false,
    shoes: false,
    outfit: false,
    head: false,
  },
  setTintable: (tintable) => set({ tintable }),
  setSkinColor: (skinColor) => set({ skinColor }),
  setHairColor: (hairColor) => set({ hairColor }),
  setEyeColor: (eyeColor) => set({ eyeColor }),
  setHairStyle: (hairStyle) => set({ hairStyle }),
  setExpression: (expression) => set({ expression }),
  setTopColor: (topColor) => set({ topColor }),
  setBottomColor: (bottomColor) => set({ bottomColor }),
  setShoesColor: (shoesColor) => set({ shoesColor }),
  setTop: (top) => set((s) => ({ outfit: { ...s.outfit, top } })),
  setBottom: (bottom) => set((s) => ({ outfit: { ...s.outfit, bottom } })),
  setShoes: (shoes) => set((s) => ({ outfit: { ...s.outfit, shoes } })),
  reset: () => set({ ...DEFAULT_APPEARANCE }),
}))
