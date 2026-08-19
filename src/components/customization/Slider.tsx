interface SliderProps {
  label: string
  /** Shown on the right, e.g. "taller" or "as modelled". */
  readout: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}

/** A continuous control, for the things that are a range rather than a set of
 *  options. Bodies do not come in four sizes. */
export default function Slider({ label, readout, min, max, step, value, onChange }: SliderProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-white/80">{label}</h3>
        <span className="text-xs text-white/45">{readout}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-white"
      />
    </section>
  )
}
