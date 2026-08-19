import { useAvatarStore } from '../stores/avatarStore'
import { SKIN_TONES, HAIR_COLORS, CLOTHING_COLORS } from '../data/palettes'
import ColorSwatches from './customization/ColorSwatches'
import DanceController from './dance/DanceController'

export default function ControlPanel() {
  const skinColor = useAvatarStore((s) => s.skinColor)
  const hairColor = useAvatarStore((s) => s.hairColor)
  const clothingColor = useAvatarStore((s) => s.clothingColor)
  const setSkinColor = useAvatarStore((s) => s.setSkinColor)
  const setHairColor = useAvatarStore((s) => s.setHairColor)
  const setClothingColor = useAvatarStore((s) => s.setClothingColor)
  const reset = useAvatarStore((s) => s.reset)

  return (
    <aside className="flex max-h-[45vh] shrink-0 flex-col gap-5 overflow-y-auto border-t border-white/10 bg-[#17171f] p-4 md:max-h-none md:w-72 md:border-l md:border-t-0">
      <DanceController />

      <ColorSwatches label="Skin" colors={SKIN_TONES} value={skinColor} onChange={setSkinColor} />
      <ColorSwatches label="Hair" colors={HAIR_COLORS} value={hairColor} onChange={setHairColor} />
      <ColorSwatches label="Clothing" colors={CLOTHING_COLORS} value={clothingColor} onChange={setClothingColor} />

      <button
        type="button"
        onClick={reset}
        className="mt-auto rounded-md border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white"
      >
        Reset
      </button>
    </aside>
  )
}
