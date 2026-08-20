import { useCallback, useEffect, useState } from 'react'
import Canvas3D from './components/Canvas3D'
import ControlPanel from './components/ControlPanel'
import MomentView from './components/MomentView'
import ReceiveAvatar from './components/ReceiveAvatar'
import { findMoment, momentFromUrl } from './data/moments'
import { avatarFromUrl } from './lib/avatarCode'
import { DEFAULT_THEME, useSceneStore } from './stores/sceneStore'

/*
 * Heights are `dvh` rather than `vh` throughout. On a phone or tablet browser
 * `100vh` counts the strip behind the address bar and the system buttons, so
 * anything pinned to the bottom of the page sits underneath them — which on
 * the arrival screen meant the two buttons the whole thing exists for were
 * below the fold. `dvh` measures what is actually on screen. In the installed
 * app there is no browser furniture and the two are the same.
 */

/** Everything a scanned code can put the app into. Both live in the address
 *  bar, because a QR code has to encode something a camera will simply open. */
function readUrl() {
  return { moment: momentFromUrl(), shared: avatarFromUrl() }
}

export default function App() {
  // Kept in state as well as in the URL so leaving one does not need a reload.
  const [route, setRoute] = useState(readUrl)
  const setTheme = useSceneStore((s) => s.setTheme)

  // Back and forward should move between a scanned screen and the builder,
  // since the address bar is what distinguishes them.
  useEffect(() => {
    const onPop = () => setRoute(readUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const goHome = useCallback(() => {
    window.history.pushState({}, '', window.location.pathname)
    setRoute({ moment: null, shared: null })
    setTheme(DEFAULT_THEME)
  }, [setTheme])

  // A shared avatar wins over a moment. If a link somehow carries both, the
  // avatar is the thing being handed over and the staging is decoration.
  if (route.shared) {
    return (
      <div className="h-dvh bg-[#12121a] text-white">
        <ReceiveAvatar code={route.shared.code} from={route.shared.name} onLeave={goHome} />
      </div>
    )
  }

  const moment = findMoment(route.moment)
  if (moment) {
    return (
      <div className="h-dvh bg-[#12121a] text-white">
        <MomentView moment={moment} onLeave={goHome} />
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-[#12121a] text-white">
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
