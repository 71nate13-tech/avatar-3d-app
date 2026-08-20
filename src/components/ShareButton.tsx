import { useState } from 'react'
import { useSceneStore } from '../stores/sceneStore'
import { shareSnapshot, type ShareOutcome } from '../lib/shareSnapshot'

const MESSAGE: Record<ShareOutcome, string> = {
  shared: 'Shared',
  saved: 'Saved to downloads',
  cancelled: '',
  failed: 'Could not share',
}

export default function ShareButton() {
  const capture = useSceneStore((s) => s.capture)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    if (!capture || busy) return
    setBusy(true)
    setStatus('')
    try {
      const outcome = await shareSnapshot(capture())
      setStatus(MESSAGE[outcome])
      // Clear the confirmation rather than leaving it as a permanent label,
      // which would read as a state the app is in.
      if (MESSAGE[outcome]) window.setTimeout(() => setStatus(''), 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onClick}
        disabled={!capture || busy}
        className="w-full rounded-md border border-white/25 px-3 py-2 text-sm text-white/85 transition hover:border-white/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Preparing…' : 'Share a snapshot'}
      </button>
      {status && <p className="text-center text-xs text-white/45">{status}</p>}
    </div>
  )
}
