import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Outfit, TopStyle, BottomStyle } from '../three/avatar/clothing'
import type { ExpressionName } from '../three/avatar/face'
import type { HairStyle } from '../three/avatar/hair'
import type { HatStyle, GlassesStyle, EarringStyle } from '../three/avatar/accessories'

/** Everything about how the avatar looks. Kept flat so the 3D layer can apply
 *  a whole appearance in one pass without diffing nested objects. */
export interface AvatarAppearance {
  skinColor: string
  hairColor: string
  eyeColor: string
  topColor: string
  bottomColor: string
  shoesColor: string
  glovesColor: string
  hatColor: string
  /** Shared by glasses and earrings — both read as metal trim. */
  accentColor: string
  hat: HatStyle
  glasses: GlassesStyle
  earrings: EarringStyle
  outfit: Outfit
  hairStyle: HairStyle
  expression: ExpressionName
  /** 1 is the modelled height; the range either side is roughly ±12%. */
  height: number
  /** -0.3 slighter, 0 as modelled, +0.6 heavier. */
  build: number
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
  glovesColor: '#2f4858',
  hatColor: '#8e4585',
  accentColor: '#c9a227',
  hat: 'none',
  glasses: 'none',
  earrings: 'none',
  outfit: { top: 'tshirt', bottom: 'trousers', shoes: true, gloves: false },
  hairStyle: 'coils',
  expression: 'happy',
  height: 1,
  build: 0,
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
  /** Build needs a skinned mesh to reshape; height works on anything. */
  body: boolean
}

interface AvatarStore extends AvatarAppearance {
  tintable: TintableParts
  setSkinColor: (color: string) => void
  setHairColor: (color: string) => void
  setEyeColor: (color: string) => void
  setTopColor: (color: string) => void
  setBottomColor: (color: string) => void
  setShoesColor: (color: string) => void
  setGlovesColor: (color: string) => void
  setHatColor: (color: string) => void
  setAccentColor: (color: string) => void
  setTop: (style: TopStyle) => void
  setBottom: (style: BottomStyle) => void
  setShoes: (on: boolean) => void
  setGloves: (on: boolean) => void
  setHat: (style: HatStyle) => void
  setGlasses: (style: GlassesStyle) => void
  setEarrings: (style: EarringStyle) => void
  setHairStyle: (style: HairStyle) => void
  setExpression: (expression: ExpressionName) => void
  setHeight: (height: number) => void
  setBuild: (build: number) => void
  setTintable: (parts: TintableParts) => void
  reset: () => void
}

/**
 * The look is saved to local storage and restored on the next launch.
 *
 * Rehydration is synchronous, so by the time the 3D layer reads the store the
 * saved values are already in place and the avatar is simply built correctly
 * the first time. There is no flash of the default look and nothing to re-apply.
 *
 * Only appearance is stored. `tintable` is derived from whichever model loaded,
 * so persisting it would let a stale answer outlive the model it described.
 */
export const useAvatarStore = create<AvatarStore>()(
  persist(
    (set) => ({
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
        body: false,
      },
      setTintable: (tintable) => set({ tintable }),
      setSkinColor: (skinColor) => set({ skinColor }),
      setHairColor: (hairColor) => set({ hairColor }),
      setEyeColor: (eyeColor) => set({ eyeColor }),
      setHairStyle: (hairStyle) => set({ hairStyle }),
      setExpression: (expression) => set({ expression }),
      setHeight: (height) => set({ height }),
      setBuild: (build) => set({ build }),
      setTopColor: (topColor) => set({ topColor }),
      setBottomColor: (bottomColor) => set({ bottomColor }),
      setShoesColor: (shoesColor) => set({ shoesColor }),
      setTop: (top) => set((s) => ({ outfit: { ...s.outfit, top } })),
      setBottom: (bottom) => set((s) => ({ outfit: { ...s.outfit, bottom } })),
      setShoes: (shoes) => set((s) => ({ outfit: { ...s.outfit, shoes } })),
      setGloves: (gloves) => set((s) => ({ outfit: { ...s.outfit, gloves } })),
      setGlovesColor: (glovesColor) => set({ glovesColor }),
      setHatColor: (hatColor) => set({ hatColor }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setHat: (hat) => set({ hat }),
      setGlasses: (glasses) => set({ glasses }),
      setEarrings: (earrings) => set({ earrings }),
      reset: () => set({ ...DEFAULT_APPEARANCE }),
    }),
    {
      name: 'avatar-appearance',
      // Bump when the shape of what is stored changes. Without it, a saved
      // look from an older build rehydrates into fields that no longer exist.
      version: 1,
      partialize: (state) => ({
        skinColor: state.skinColor,
        hairColor: state.hairColor,
        eyeColor: state.eyeColor,
        topColor: state.topColor,
        bottomColor: state.bottomColor,
        shoesColor: state.shoesColor,
        glovesColor: state.glovesColor,
        hatColor: state.hatColor,
        accentColor: state.accentColor,
        hat: state.hat,
        glasses: state.glasses,
        earrings: state.earrings,
        outfit: state.outfit,
        hairStyle: state.hairStyle,
        expression: state.expression,
        height: state.height,
        build: state.build,
      }),
    },
  ),
)
