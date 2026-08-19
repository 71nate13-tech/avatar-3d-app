import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createScene } from '../three/scene'
import { createHumanoid } from '../three/avatar/humanoid'
import { MarioCamera } from '../three/camera/MarioCamera'
import { loadCharacter } from '../three/avatar/AvatarModel'
import { AnimationManager } from '../three/avatar/AnimationManager'
import { useAvatarStore, type AvatarAppearance } from '../stores/avatarStore'
import { useDanceStore } from '../stores/danceStore'
import { CHARACTER_URL, DANCE_URLS, EMBEDDED_CLIP_ID } from '../data/dances'

/**
 * Owns the Three.js lifecycle for one canvas: build the world, load the avatar,
 * run the render loop, and tear everything down on unmount.
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

    // Show the primitive figure straight away rather than an empty stage, then
    // swap it for the real character once that arrives.
    const placeholder = createHumanoid()
    scene.add(placeholder.group)

    const parent = canvas.parentElement!
    const camera = new MarioCamera(canvas, parent.clientWidth / parent.clientHeight)
    cameraRef.current = camera

    // Materials to tint, rebound when the real character replaces the placeholder.
    // The placeholder has one clothing material and no garment separation, so it
    // follows the top colour and leaves the other two controls hidden.
    type TintTargets = Record<'skin' | 'hair' | 'top' | 'bottom' | 'shoes', THREE.MeshStandardMaterial[]>
    let tintTargets: TintTargets = {
      skin: [placeholder.materials.skin],
      hair: [placeholder.materials.hair],
      top: [placeholder.materials.clothing],
      bottom: [],
      shoes: [],
    }
    let setOutfit: ((outfit: AvatarAppearance['outfit']) => void) | null = null
    let lastOutfit: AvatarAppearance['outfit'] | null = null
    let face: import('../three/avatar/face').FaceRig | null = null
    let hair: import('../three/avatar/hair').HairRig | null = null
    let lastHairStyle: string | null = null

    // Subscribe to the store outside React: colours change on every drag of the
    // picker, and pushing that through a re-render would rebuild the scene.
    // Writing straight to the materials is picked up by the next frame.
    const applyAppearance = (appearance: AvatarAppearance) => {
      tintTargets.skin.forEach((m) => m.color.set(appearance.skinColor))
      tintTargets.hair.forEach((m) => m.color.set(appearance.hairColor))
      tintTargets.top.forEach((m) => m.color.set(appearance.topColor))
      tintTargets.bottom.forEach((m) => m.color.set(appearance.bottomColor))
      tintTargets.shoes.forEach((m) => m.color.set(appearance.shoesColor))

      face?.setExpression(appearance.expression)
      face?.setEyeColor(appearance.eyeColor)
      hair?.setColor(appearance.hairColor)

      // Selecting a style builds its geometry the first time, so only touch it
      // on an actual change rather than on every colour drag.
      if (hair && appearance.hairStyle !== lastHairStyle) {
        hair.setStyle(appearance.hairStyle)
        lastHairStyle = appearance.hairStyle
      }

      // Changing an outfit rewrites the geometry index, which is far heavier
      // than setting a colour — so only do it when the outfit actually changed,
      // not on every drag of a colour picker.
      const outfit = appearance.outfit
      if (
        setOutfit &&
        (!lastOutfit ||
          lastOutfit.top !== outfit.top ||
          lastOutfit.bottom !== outfit.bottom ||
          lastOutfit.shoes !== outfit.shoes)
      ) {
        setOutfit(outfit)
        lastOutfit = { ...outfit }
      }
    }
    applyAppearance(useAvatarStore.getState())
    const unsubscribeAppearance = useAvatarStore.subscribe(applyAppearance)

    let animations: AnimationManager | null = null
    let unsubscribeDance: (() => void) | null = null
    let disposeCharacter: (() => void) | null = null
    let cancelled = false

    loadCharacter(CHARACTER_URL, DANCE_URLS, EMBEDDED_CLIP_ID)
      .then((character) => {
        // The effect can be torn down while the download is still in flight.
        if (cancelled) {
          character.dispose()
          return
        }

        scene.remove(placeholder.group)
        placeholder.dispose()
        scene.add(character.group)

        const hasClothing = character.clothing.length > 0
        const hasHead = character.face !== null
        tintTargets = {
          skin: [character.materials.skin],
          // Hair is its own generated mesh with its own material, so it is
          // coloured through the rig rather than through this list.
          hair: [],
          top: [character.materials.top],
          bottom: [character.materials.bottom],
          shoes: [character.materials.shoes],
        }
        setOutfit = hasClothing ? character.setOutfit : null
        lastOutfit = null
        face = character.face
        hair = character.hair
        lastHairStyle = null

        useAvatarStore.getState().setTintable({
          skin: true,
          hair: hasHead,
          top: hasClothing,
          bottom: hasClothing,
          shoes: hasClothing,
          outfit: hasClothing,
          head: hasHead,
        })
        applyAppearance(useAvatarStore.getState())

        animations = new AnimationManager(character.mixer, character.clips)
        disposeCharacter = character.dispose

        const available = animations.names
        useDanceStore.getState().setAvailable(available)
        useDanceStore.getState().setStatus('ready')

        unsubscribeDance = useDanceStore.subscribe((state) => {
          if (state.current) animations?.play(state.current)
          else animations?.stop()
        })

        // Standing perfectly still reads as broken, so start on idle if present.
        const first = available.includes('idle') ? 'idle' : available[0]
        if (first) useDanceStore.getState().setCurrent(first)
      })
      .catch((error) => {
        if (cancelled) return
        console.warn('[avatar] falling back to placeholder figure:', error)
        useDanceStore.getState().setStatus('fallback')
      })

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
      const delta = clock.getDelta()
      camera.update(delta)
      animations?.update(delta)
      renderer.render(scene, camera.camera)
    }
    tick()

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      unsubscribeAppearance()
      unsubscribeDance?.()
      camera.dispose()
      disposeCharacter?.()
      if (!disposeCharacter) placeholder.dispose()
      disposeScene()
      renderer.dispose()
    }
  }, [canvasRef])

  return cameraRef
}
