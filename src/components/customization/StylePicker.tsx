interface StyleOption<T extends string> {
  value: T
  label: string
}

interface StylePickerProps<T extends string> {
  label: string
  options: StyleOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** A row of mutually exclusive garment styles. */
export default function StylePicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: StylePickerProps<T>) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-white/80">{label}</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-md border px-2 py-1.5 text-sm transition ${
              value === option.value
                ? 'border-white bg-white/15 text-white'
                : 'border-white/15 text-white/70 hover:border-white/40 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}
