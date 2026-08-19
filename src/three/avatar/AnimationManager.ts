import * as THREE from 'three'

/**
 * Plays one dance at a time, crossfading between them.
 *
 * Crossfading rather than cutting matters: a hard switch snaps every limb to the
 * new clip's first frame, which reads as a glitch. Fading overlaps the two for a
 * moment so the body travels between poses.
 */
export class AnimationManager {
  private readonly mixer: THREE.AnimationMixer
  private readonly actions = new Map<string, THREE.AnimationAction>()
  private current: THREE.AnimationAction | null = null
  private currentName: string | null = null

  constructor(mixer: THREE.AnimationMixer, clips: Map<string, THREE.AnimationClip>) {
    this.mixer = mixer
    for (const [name, clip] of clips) {
      this.actions.set(name, mixer.clipAction(clip))
    }
  }

  get names(): string[] {
    return [...this.actions.keys()]
  }

  get playing(): string | null {
    return this.currentName
  }

  play(name: string, fadeDuration = 0.35) {
    const next = this.actions.get(name)
    if (!next || next === this.current) return

    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    next.enabled = true
    next.setEffectiveWeight(1)
    next.fadeIn(fadeDuration).play()

    this.current?.fadeOut(fadeDuration)
    this.current = next
    this.currentName = name
  }

  stop(fadeDuration = 0.25) {
    this.current?.fadeOut(fadeDuration)
    this.current = null
    this.currentName = null
  }

  update(delta: number) {
    this.mixer.update(delta)
  }
}
