import { useState } from 'react'
import { useSceneStore } from '../../stores/sceneStore'
import { saveOrShare, stampedName } from '../../lib/saveFile'

/**
 * The avatar as a real 3D file, for the places a code cannot go.
 *
 * Separated from the code above it, and worded to say what it costs, because
 * the two are not interchangeable. A code is small, stays editable and carries
 * no geometry; a glb is none of those things but opens in software that has
 * never heard of this app. Somebody choosing between them should be able to
 * tell which one they want without trying both.
 */
export default function ExportModelButton() {
  const exportModel = useSceneStore((s) => s.exportModel)
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')

  const run = async () => {
    if (!exportModel) return
    setState('working')
    try {
      const blob = await exportModel()
      const outcome = await saveOrShare(
        blob,
        stampedName('avatar', 'glb'),
        'My avatar',
        'A 3D model made in Avatar 3D',
      )
      setState(outcome === 'failed' ? 'failed' : 'done')
    } catch (error) {
      console.warn('[export] could not build the model:', error)
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2600)
  }

  const label =
    state === 'working'
      ? 'Building the file…'
      : state === 'done'
        ? 'Model saved'
        : state === 'failed'
          ? 'Could not export'
          : 'Download 3D model'

  return (
    <div className="space-y-1.5 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={run}
        disabled={!exportModel || state === 'working'}
        className="w-full rounded-md border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-default disabled:border-white/10 disabled:text-white/30"
      >
        {label}
      </button>
      <p className="text-xs leading-relaxed text-white/40">
        A <code className="text-white/55">.glb</code> for Blender, Unity or any 3D viewer, with the
        current dance baked in. Several megabytes, and frozen &mdash; it cannot be edited back here
        the way a code can.
      </p>
    </div>
  )
}
