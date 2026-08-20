import { useCallback, useEffect, useState } from 'react'
import Canvas3D from './components/Canvas3D'
import ControlPanel from './components/ControlPanel'
import MomentView from './components/MomentView'
import { findMoment, momentFromUrl } from './data/moments'
import { DEFAULT_THEME, useSceneStore } from './stores/sceneStore'

export default function App() {
  // The moment lives in the address bar, because a QR code has to encode
  // something a phone camera will simply open. Kept in state as well so
  // leaving one does not need a page reload.
  const [momentId, setMomentId] = useState<string | null>(() => momentFromUrl())
  const setTheme = useSceneStore((s) => s.setTheme)

  // Back and forward should move between the moment and the builder, since the
  // address bar is what distinguishes them.
  useEffect(() => {
    const onPop = () => setMomentId(momentFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const leaveMoment = useCallback(() => {
    window.history.pushState({}, '', window.location.pathname)
    setMomentId(null)
    setTheme(DEFAULT_THEME)
  }, [setTheme])

  const moment = findMoment(momentId)
  if (moment) {
    return (
      <div className="h-screen bg-[#12121a] text-white">
        <MomentView moment={moment} onLeave={leaveMoment} />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[#12121a] text-white">
      <header className="flex-shrink-0 border-b border-white/10 px-5 py-3">
        <h1 className="text-lg font-semibold">Avatar 3D</h1>
        <p className="text-sm text-white/50">Drag to fly around · pick a dance and a colour</p>
      </header>

      {/* Panel sits beside the canvas on wide screens and below it on narrow
          ones, which is also the phone layout for the Android build later. */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main className="min-h-0 flex-1">
          <Canvas3D />
        </main>
        <ControlPanel />
      </div>
    </div>
  )
}
