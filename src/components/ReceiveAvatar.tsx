import { useEffect, useState } from 'react'
import Canvas3D from './Canvas3D'
import { useAvatarStore } from '../stores/avatarStore'
import { usePreviewStore } from '../stores/previewStore'
import { useCollectionStore } from '../stores/collectionStore'
import { decodeAppearance, MAX_NAME } from '../lib/avatarCode'

/**
 * What somebody sees after scanning an avatar's code.
 *
 * The avatar is shown before any decision is asked for, because "keep this?"
 * is not answerable without seeing it. Showing it means wearing it, since the
 * whole 3D layer is driven by one store and a second one would mean a second
 * scene — so the visitor's own look is set aside on arrival and put back if
 * they leave without taking anything.
 *
 * Setting it aside in a ref is not enough on its own. The appearance store
 * writes through to local storage on every change, so previewing somebody
 * else's avatar would overwrite the visitor's saved one before they had
 * agreed to anything — and closing the tab at that moment would lose it for
 * good. Persistence is therefore paused for as long as the preview is up:
 * nothing reaches storage until a choice is actually made.
 */
interface ReceiveAvatarProps {
  code: string
  /** Whoever sent it, taken from the link. Only a suggestion — the person
   *  receiving it gets to file it under whatever name they like. */
  from: string | null
  onLeave: () => void
}

export default function ReceiveAvatar({ code, from, onLeave }: ReceiveAvatarProps) {
  const wear = useAvatarStore((s) => s.wear)
  const setPreview = usePreviewStore((s) => s.setPreview)
  const { keep, has } = useCollectionStore()
  const incoming = decodeAppearance(code)

  const [name, setName] = useState(from?.slice(0, MAX_NAME) ?? '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!incoming) return
    setPreview(incoming)
    // Clearing on unmount covers leaving by any route, including the back
    // button. Nothing needs restoring, because nothing was overwritten.
    return () => setPreview(null)
    // Only on arrival. Re-running on every render would fight the preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const label = () => name.trim() || (from ? `From ${from}` : 'Traded avatar')

  const keepIt = () => {
    keep(code, label())
    setSaved(true)
  }

  const wearIt = () => {
    keep(code, label())
    // The one path that means "and I am this now", and so the only one that
    // writes to the saved avatar at all.
    wear(incoming!)
    onLeave()
  }

  if (!incoming) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">That code did not read</h1>
        <p className="max-w-sm text-sm text-white/55">
          It may have been damaged, cut short, or made by a newer version of the app than this one.
          Ask for it again, or paste the 52-character code straight into the Trade panel.
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-md border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:border-white/50 hover:text-white"
        >
          Go to my avatar
        </button>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <Canvas3D showHint={false} />

      <div className="pointer-events-none absolute inset-x-0 top-0 p-5 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-white/50">
          {from ? `${from} shared an avatar` : 'Somebody shared an avatar'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold drop-shadow">Yours to keep</h1>
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-2.5 bg-gradient-to-t from-black/80 via-black/60 to-transparent p-5 pt-12">
        {saved ? (
          <p className="text-center text-sm text-emerald-300/90">
            Saved to your collection. It is yours now &mdash; wear it whenever you like.
          </p>
        ) : (
          <input
            type="text"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="Call it something"
            className="w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-white/50 focus:outline-none"
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={keepIt}
            disabled={saved || has(code)}
            className="rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:bg-white/25 disabled:text-white/60"
          >
            {has(code) && !saved ? 'Already yours' : saved ? 'Kept' : 'Keep it'}
          </button>
          <button
            type="button"
            onClick={wearIt}
            className="rounded-md border border-white/25 px-4 py-2.5 text-sm text-white/85 transition hover:border-white/60 hover:text-white"
          >
            Keep and wear
          </button>
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="w-full py-1 text-xs text-white/45 transition hover:text-white/75"
        >
          {saved ? 'Back to my avatar' : 'No thanks, back to my avatar'}
        </button>
      </div>
    </div>
  )
}
