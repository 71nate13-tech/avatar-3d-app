import { useAvatarStore } from '../stores/avatarStore'
import { SKIN_TONES, HAIR_COLORS, CLOTHING_COLORS } from '../data/palettes'
import ColorSwatches from './customization/ColorSwatches'
import StylePicker from './customization/StylePicker'
import DanceController from './dance/DanceController'
import type { TopStyle, BottomStyle } from '../three/avatar/clothing'

const TOP_OPTIONS: { value: TopStyle; label: string }[] = [
  { value: 'none', label: 'Bare' },
  { value: 'tank', label: 'Tank' },
  { value: 'tshirt', label: 'T-shirt' },
  { value: 'long', label: 'Long sleeve' },
]

const BOTTOM_OPTIONS: { value: BottomStyle; label: string }[] = [
  { value: 'none', label: 'Bare' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'trousers', label: 'Trousers' },
]

export default function ControlPanel() {
  const s = useAvatarStore()
  const { tintable, outfit } = s

  return (
    <aside className="flex max-h-[45vh] shrink-0 flex-col gap-5 overflow-y-auto border-t border-white/10 bg-[#17171f] p-4 md:max-h-none md:w-72 md:border-l md:border-t-0">
      <DanceController />

      {tintable.outfit && (
        <>
          <StylePicker label="Top" options={TOP_OPTIONS} value={outfit.top} onChange={s.setTop} />
          <StylePicker
            label="Bottom"
            options={BOTTOM_OPTIONS}
            value={outfit.bottom}
            onChange={s.setBottom}
          />
          <StylePicker
            label="Shoes"
            options={[
              { value: 'off', label: 'Barefoot' },
              { value: 'on', label: 'Shoes' },
            ]}
            value={outfit.shoes ? 'on' : 'off'}
            onChange={(v) => s.setShoes(v === 'on')}
          />
        </>
      )}

      {tintable.skin && (
        <ColorSwatches label="Skin" colors={SKIN_TONES} value={s.skinColor} onChange={s.setSkinColor} />
      )}
      {tintable.hair && (
        <ColorSwatches label="Hair" colors={HAIR_COLORS} value={s.hairColor} onChange={s.setHairColor} />
      )}
      {tintable.top && outfit.top !== 'none' && (
        <ColorSwatches
          label="Top colour"
          colors={CLOTHING_COLORS}
          value={s.topColor}
          onChange={s.setTopColor}
        />
      )}
      {tintable.bottom && outfit.bottom !== 'none' && (
        <ColorSwatches
          label="Bottom colour"
          colors={CLOTHING_COLORS}
          value={s.bottomColor}
          onChange={s.setBottomColor}
        />
      )}
      {tintable.shoes && outfit.shoes && (
        <ColorSwatches
          label="Shoe colour"
          colors={CLOTHING_COLORS}
          value={s.shoesColor}
          onChange={s.setShoesColor}
        />
      )}

      <button
        type="button"
        onClick={s.reset}
        className="mt-auto rounded-md border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white"
      >
        Reset
      </button>
    </aside>
  )
}
