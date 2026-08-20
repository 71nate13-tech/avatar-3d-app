import { useRef } from 'react'
import { useThreeScene } from '../hooks/useThreeScene'
import { useSceneStore } from '../stores/sceneStore'

interface Canvas3DProps {
  /** Hidden inside a brand moment, where the point is the scene, not the
   *  controls that made it. */
  showHint?: boolean
}

export default function Canvas3D({ showHint = true }: Canvas3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const background = useSceneStore((s) => s.theme.background)
  useThreeScene(canvasRef)

  return (
    // The canvas renders transparent and this paints behind it, which is what
    // lets a brand supply a gradient rather than one flat colour.
    <div className="relative h-full w-full overflow-hidden" style={{ background }}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      {showHint && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/70">
          Drag to orbit · scroll or pinch to zoom
        </p>
      )}
    </div>
  )
}
