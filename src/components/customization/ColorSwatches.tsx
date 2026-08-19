interface ColorSwatchesProps {
  label: string
  colors: string[]
  value: string
  onChange: (color: string) => void
}

/** A palette of preset colours plus a free picker for anything not listed. */
export default function ColorSwatches({ label, colors, value, onChange }: ColorSwatchesProps) {
  const selected = value.toLowerCase()

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/80">{label}</h3>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-white/50 hover:text-white/80">
          Custom
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Custom ${label.toLowerCase()}`}
            className="h-6 w-6 cursor-pointer rounded border border-white/20 bg-transparent p-0"
          />
        </label>
      </div>

      <div className="grid grid-cols-8 gap-1.5">
        {colors.map((color) => {
          const isSelected = color.toLowerCase() === selected
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={color}
              aria-pressed={isSelected}
              style={{ backgroundColor: color }}
              className={`aspect-square rounded-md border transition ${
                isSelected
                  ? 'border-white ring-2 ring-white/70'
                  : 'border-white/15 hover:border-white/50'
              }`}
            />
          )
        })}
      </div>
    </section>
  )
}
