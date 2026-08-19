import Canvas3D from './components/Canvas3D'
import ControlPanel from './components/ControlPanel'

export default function App() {
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
