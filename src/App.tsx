import Canvas3D from './components/Canvas3D'

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-[#12121a] text-white">
      <header className="flex-shrink-0 border-b border-white/10 px-5 py-3">
        <h1 className="text-lg font-semibold">Avatar 3D</h1>
        <p className="text-sm text-white/50">Orbit camera milestone — customisation and dancing next</p>
      </header>

      <main className="min-h-0 flex-1">
        <Canvas3D />
      </main>
    </div>
  )
}
