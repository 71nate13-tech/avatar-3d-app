import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createScene } from '../three/scene'
import { createHumanoid } from '../three/avatar/humanoid'
import { MarioCamera } from '../three/camera/MarioCamera'
import { useAvatarStore, type AvatarAppearance } from '../stores/avatarStore'

/**
 * Owns the Three.js lifecycle for one canvas: build the world, run the render
 * loop, and tear everything down on unmount.
 *
 * Three.js objects live in refs rather than state — they change every frame and
 * re-rendering React on that would be pointless work.
 */
export function useThreeScene(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const cameraRef = useRef<MarioCamera | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const { scene, dispose: disposeScene } = createScene()
    const avatar = createHumanoid()
    scene.add(avatar.group)

    const parent = canvas.parentElement!
    const camera = new MarioCamera(canvas, parent.clientWidth / parent.clientHeight)
    cameraRef.current = camera

    // Subscribe to the store outside React: colours change on every drag of the
    // picker, and pushing that through a re-render would rebuild the scene.
    // Writing straight to the materials is picked up by the next frame.
    const applyAppearance = (appearance: AvatarAppearance) => {
      avatar.materials.skin.color.set(appearance.skinColor)
      avatar.materials.hair.color.set(appearance.hairColor)
      avatar.materials.clothing.color.set(appearance.clothingColor)
    }
    applyAppearance(useAvatarStore.getState())
    const unsubscribeAppearance = useAvatarStore.subscribe(applyAppearance)

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = parent
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.setAspect(w / h)
    }
    resize()

    // ResizeObserver rather than window.onresize: the canvas can change size
    // when the layout changes without the window ever resizing.
    const observer = new ResizeObserver(resize)
    observer.observe(parent)

    const clock = new THREE.Clock()
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      camera.update(clock.getDelta())
      renderer.render(scene, camera.camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      unsubscribeAppearance()
      camera.dispose()
      avatar.dispose()
      disposeScene()
      renderer.dispose()
    }
  }, [canvasRef])

  return cameraRef
}
