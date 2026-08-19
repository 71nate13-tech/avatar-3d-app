import { useDanceStore } from '../../stores/danceStore'
import { DANCES } from '../../data/dances'

export default function DanceController() {
  const available = useDanceStore((s) => s.available)
  const current = useDanceStore((s) => s.current)
  const status = useDanceStore((s) => s.status)
  const setCurrent = useDanceStore((s) => s.setCurrent)

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-white/80">Dance</h3>

      {status === 'loading' && <p className="text-xs text-white/40">Loading character…</p>}

      {status === 'fallback' && (
        <p className="text-xs leading-relaxed text-amber-300/80">
          No character found, so the placeholder figure is showing. It has no skeleton, so it
          cannot dance. See <code className="text-amber-200/90">public/models/README.md</code>.
        </p>
      )}

      {status === 'ready' && (
        <div className="grid grid-cols-2 gap-1.5">
          {DANCES.filter((d) => available.includes(d.id)).map((dance) => (
            <button
              key={dance.id}
              type="button"
              onClick={() => setCurrent(dance.id)}
              aria-pressed={current === dance.id}
              className={`rounded-md border px-2 py-1.5 text-sm transition ${
                current === dance.id
                  ? 'border-white bg-white/15 text-white'
                  : 'border-white/15 text-white/70 hover:border-white/40 hover:text-white'
              }`}
            >
              {dance.label}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
