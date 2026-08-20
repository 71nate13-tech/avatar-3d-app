import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  /** What is currently chosen, shown while collapsed. */
  summary?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * One collapsible group of controls.
 *
 * The summary matters more than it looks: collapsed sections would otherwise be
 * a list of nouns with no indication of what the avatar is actually wearing,
 * which means opening each one just to find out — exactly the scrolling the
 * collapsing was meant to remove.
 */
export default function Section({ title, summary, open, onToggle, children }: SectionProps) {
  return (
    <section className="border-b border-white/10 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-3 text-left"
      >
        <span
          aria-hidden
          className={`text-white/40 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        <span className="flex-1 text-sm font-medium text-white/85">{title}</span>
        {!open && summary && (
          <span className="max-w-[45%] truncate text-xs text-white/40">{summary}</span>
        )}
      </button>
      {open && <div className="space-y-4 pb-4">{children}</div>}
    </section>
  )
}
