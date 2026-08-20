import { useEffect } from 'react'
import Canvas3D from './Canvas3D'
import ShareButton from './ShareButton'
import { useSceneStore } from '../stores/sceneStore'
import { useDanceStore } from '../stores/danceStore'
import type { Moment } from '../data/moments'

interface MomentViewProps {
  moment: Moment
  onLeave: () => void
}

/**
 * What somebody sees after scanning a code.
 *
 * The avatar is not fetched or chosen here — it is whatever they already saved,
 * loaded from storage exactly as in the builder. That is the entire point of
 * the idea: the character in the brand's scene is theirs, not a stock model, and
 * it costs nothing to arrange because the two screens share one store.
 */
export default function MomentView({ moment, onLeave }: MomentViewProps) {
  const setTheme = useSceneStore((s) => s.setTheme)
  const available = useDanceStore((s) => s.available)
  const setCurrent = useDanceStore((s) => s.setCurrent)

  useEffect(() => {
    setTheme({ background: moment.background, ground: moment.ground, grid: false })
  }, [moment, setTheme])

  // Wait for the character to finish loading before asking for the dance: the
  // list is empty until then, and a request made too early is simply dropped.
  useEffect(() => {
    if (available.includes(moment.dance)) setCurrent(moment.dance)
  }, [available, moment.dance, setCurrent])

  return (
    <div className="relative h-full w-full">
      <Canvas3D showHint={false} />

      {/* Text sits over the scene rather than beside it, so the avatar is the
          thing being looked at and the brand frames it. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 p-6 text-center"
        style={{ color: moment.ink }}
      >
        <p className="text-sm uppercase tracking-[0.2em] opacity-70">{moment.brand}</p>
        <h1 className="mt-1 text-3xl font-semibold drop-shadow-lg sm:text-4xl">{moment.headline}</h1>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 space-y-3 p-6 text-center"
        style={{ color: moment.ink }}
      >
        <p className="text-sm opacity-80 drop-shadow">{moment.caption}</p>
        <div className="mx-auto flex max-w-xs flex-col gap-2">
          <ShareButton />
          <button
            type="button"
            onClick={onLeave}
            className="rounded-md border px-3 py-2 text-sm transition"
            style={{ borderColor: `${moment.ink}55`, color: moment.ink }}
          >
            Change your avatar
          </button>
        </div>
      </div>
    </div>
  )
}
