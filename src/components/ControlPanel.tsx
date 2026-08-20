import { useState } from 'react'
import { useAvatarStore } from '../stores/avatarStore'
import { useDanceStore } from '../stores/danceStore'
import { SKIN_TONES, HAIR_COLORS, CLOTHING_COLORS, EYE_COLORS } from '../data/palettes'
import ColorSwatches from './customization/ColorSwatches'
import StylePicker from './customization/StylePicker'
import Slider from './customization/Slider'
import Section from './customization/Section'
import DanceController from './dance/DanceController'
import ShareButton from './ShareButton'
import { DANCES } from '../data/dances'
import { HAIR_STYLES } from '../three/avatar/hair'
import { HAT_STYLES, GLASSES_STYLES, EARRING_STYLES } from '../three/avatar/accessories'
import type { TopStyle, BottomStyle } from '../three/avatar/clothing'
import type { ExpressionName } from '../three/avatar/face'

const EXPRESSION_OPTIONS: { value: ExpressionName; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' },
  { value: 'surprised', label: 'Surprised' },
  { value: 'angry', label: 'Angry' },
  { value: 'wink', label: 'Wink' },
]

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

/** Looks up a label for a summary line, falling back to the raw value. */
function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value
}

/** Lists only what is actually worn, so the summary says something. */
function joinWorn(parts: (string | null)[]): string {
  const worn = parts.filter(Boolean)
  return worn.length ? worn.join(', ') : 'None'
}

type SectionName = 'dance' | 'body' | 'face' | 'hair' | 'clothing' | 'accessories' | 'skin'

export default function ControlPanel() {
  const s = useAvatarStore()
  const currentDance = useDanceStore((d) => d.current)
  const { tintable, outfit } = s
  // One section at a time. With every group open the panel ran to several
  // screens, which is what made it worth collapsing in the first place.
  const [open, setOpen] = useState<SectionName | null>('dance')
  const toggle = (name: SectionName) => setOpen((current) => (current === name ? null : name))

  return (
    <aside className="flex max-h-[55vh] shrink-0 flex-col border-t border-white/10 bg-[#17171f] md:max-h-none md:w-72 md:border-l md:border-t-0">
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <Section
          title="Dance"
          summary={DANCES.find((d) => d.id === currentDance)?.label}
          open={open === 'dance'}
          onToggle={() => toggle('dance')}
        >
          <DanceController />
        </Section>

        {tintable.body && (
          <Section
            title="Body"
            summary={`${s.height === 1 ? 'as modelled' : s.height > 1 ? 'taller' : 'shorter'}, ${
              s.build > 0.05 ? 'fuller' : s.build < -0.05 ? 'slighter' : 'as modelled'
            }`}
            open={open === 'body'}
            onToggle={() => toggle('body')}
          >
            <Slider
              label="Height"
              readout={s.height > 1.02 ? 'taller' : s.height < 0.98 ? 'shorter' : 'as modelled'}
              min={0.88}
              max={1.12}
              step={0.005}
              value={s.height}
              onChange={s.setHeight}
            />
            <Slider
              label="Build"
              readout={s.build > 0.05 ? 'fuller' : s.build < -0.05 ? 'slighter' : 'as modelled'}
              min={-0.3}
              max={0.6}
              step={0.02}
              value={s.build}
              onChange={s.setBuild}
            />
          </Section>
        )}

        {tintable.skin && (
          <Section title="Skin" open={open === 'skin'} onToggle={() => toggle('skin')}>
            <ColorSwatches
              label="Skin tone"
              colors={SKIN_TONES}
              value={s.skinColor}
              onChange={s.setSkinColor}
            />
          </Section>
        )}

        {tintable.head && (
          <Section
            title="Face"
            summary={labelOf(EXPRESSION_OPTIONS, s.expression)}
            open={open === 'face'}
            onToggle={() => toggle('face')}
          >
            <StylePicker
              label="Expression"
              options={EXPRESSION_OPTIONS}
              value={s.expression}
              onChange={s.setExpression}
            />
            <ColorSwatches
              label="Eyes"
              colors={EYE_COLORS}
              value={s.eyeColor}
              onChange={s.setEyeColor}
            />
          </Section>
        )}

        {tintable.head && (
          <Section
            title="Hair"
            summary={labelOf(HAIR_STYLES, s.hairStyle)}
            open={open === 'hair'}
            onToggle={() => toggle('hair')}
          >
            <StylePicker
              label="Style"
              options={HAIR_STYLES}
              value={s.hairStyle}
              onChange={s.setHairStyle}
            />
            {s.hairStyle !== 'none' && (
              <ColorSwatches
                label="Colour"
                colors={HAIR_COLORS}
                value={s.hairColor}
                onChange={s.setHairColor}
              />
            )}
          </Section>
        )}

        {tintable.outfit && (
          <Section
            title="Clothing"
            summary={joinWorn([
              outfit.top === 'none' ? null : labelOf(TOP_OPTIONS, outfit.top),
              outfit.bottom === 'none' ? null : labelOf(BOTTOM_OPTIONS, outfit.bottom),
            ])}
            open={open === 'clothing'}
            onToggle={() => toggle('clothing')}
          >
            <StylePicker label="Top" options={TOP_OPTIONS} value={outfit.top} onChange={s.setTop} />
            {outfit.top !== 'none' && (
              <ColorSwatches
                label="Top colour"
                colors={CLOTHING_COLORS}
                value={s.topColor}
                onChange={s.setTopColor}
              />
            )}

            <StylePicker
              label="Bottom"
              options={BOTTOM_OPTIONS}
              value={outfit.bottom}
              onChange={s.setBottom}
            />
            {outfit.bottom !== 'none' && (
              <ColorSwatches
                label="Bottom colour"
                colors={CLOTHING_COLORS}
                value={s.bottomColor}
                onChange={s.setBottomColor}
              />
            )}

            <StylePicker
              label="Shoes"
              options={[
                { value: 'off', label: 'Barefoot' },
                { value: 'on', label: 'Shoes' },
              ]}
              value={outfit.shoes ? 'on' : 'off'}
              onChange={(v) => s.setShoes(v === 'on')}
            />
            {outfit.shoes && (
              <ColorSwatches
                label="Shoe colour"
                colors={CLOTHING_COLORS}
                value={s.shoesColor}
                onChange={s.setShoesColor}
              />
            )}

            <StylePicker
              label="Gloves"
              options={[
                { value: 'off', label: 'Bare' },
                { value: 'on', label: 'Gloves' },
              ]}
              value={outfit.gloves ? 'on' : 'off'}
              onChange={(v) => s.setGloves(v === 'on')}
            />
            {outfit.gloves && (
              <ColorSwatches
                label="Glove colour"
                colors={CLOTHING_COLORS}
                value={s.glovesColor}
                onChange={s.setGlovesColor}
              />
            )}
          </Section>
        )}

        {tintable.head && (
          <Section
            title="Accessories"
            summary={joinWorn([
              s.hat === 'none' ? null : labelOf(HAT_STYLES, s.hat),
              s.glasses === 'none' ? null : labelOf(GLASSES_STYLES, s.glasses),
              s.earrings === 'none' ? null : labelOf(EARRING_STYLES, s.earrings),
            ])}
            open={open === 'accessories'}
            onToggle={() => toggle('accessories')}
          >
            <StylePicker label="Hat" options={HAT_STYLES} value={s.hat} onChange={s.setHat} />
            {s.hat !== 'none' && (
              <ColorSwatches
                label="Hat colour"
                colors={CLOTHING_COLORS}
                value={s.hatColor}
                onChange={s.setHatColor}
              />
            )}

            <StylePicker
              label="Glasses"
              options={GLASSES_STYLES}
              value={s.glasses}
              onChange={s.setGlasses}
            />
            <StylePicker
              label="Earrings"
              options={EARRING_STYLES}
              value={s.earrings}
              onChange={s.setEarrings}
            />
            {(s.glasses !== 'none' || s.earrings !== 'none') && (
              <ColorSwatches
                label="Trim colour"
                colors={CLOTHING_COLORS}
                value={s.accentColor}
                onChange={s.setAccentColor}
              />
            )}
          </Section>
        )}
      </div>

      {/* Pinned, so they do not scroll away behind whichever section is open. */}
      <div className="shrink-0 space-y-2 border-t border-white/10 p-4">
        <ShareButton />
        <button
          type="button"
          onClick={s.reset}
          className="w-full rounded-md border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white"
        >
          Reset
        </button>
      </div>
    </aside>
  )
}
