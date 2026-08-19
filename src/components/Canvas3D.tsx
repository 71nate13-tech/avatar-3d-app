import { useRef } from 'react'
import { useThreeScene } from '../hooks/useThreeScene'

export default function Canvas3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useThreeScene(canvasRef)

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1a1a24]">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/70">
        Drag to orbit · scroll or pinch to zoom
      </p>
    </div>
  )
}
