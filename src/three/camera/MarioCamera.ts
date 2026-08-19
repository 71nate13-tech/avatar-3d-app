import * as THREE from 'three'

/**
 * Mario 64 style orbit camera.
 *
 * The camera always looks at a fixed target (the avatar) and moves on a sphere
 * around it, so dragging feels like flying a drone in a circle rather than
 * turning your head. Input sets a *desired* position; `update` eases the real
 * camera toward it every frame, which is what gives the movement its weight.
 */

export interface MarioCameraOptions {
  minRadius?: number
  maxRadius?: number
  /** Clamp away from the exact poles, where the orbit math degenerates. */
  minPolar?: number
  maxPolar?: number
  /** Higher is snappier. Roughly "how much of the gap is closed per second". */
  damping?: number
  rotateSpeed?: number
  zoomSpeed?: number
}

const DEFAULTS: Required<MarioCameraOptions> = {
  minRadius: 1.8,
  maxRadius: 9,
  minPolar: 0.15,
  maxPolar: Math.PI - 0.35,
  damping: 9,
  rotateSpeed: 0.006,
  zoomSpeed: 0.0015,
}

export class MarioCamera {
  readonly camera: THREE.PerspectiveCamera
  readonly target = new THREE.Vector3(0, 0.95, 0)

  private readonly dom: HTMLElement
  private readonly opts: Required<MarioCameraOptions>

  // Where the user has asked the camera to be.
  private theta = Math.PI * 0.25
  private phi = Math.PI * 0.42
  private radius = 4.5

  // Where the camera actually is, chasing the values above.
  private smoothTheta = this.theta
  private smoothPhi = this.phi
  private smoothRadius = this.radius

  /** Active pointers, so one finger rotates and two pinch. */
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private pinchDistance = 0

  constructor(dom: HTMLElement, aspect: number, options: MarioCameraOptions = {}) {
    this.dom = dom
    this.opts = { ...DEFAULTS, ...options }

    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100)
    this.applyToCamera()

    dom.addEventListener('pointerdown', this.onPointerDown)
    dom.addEventListener('pointermove', this.onPointerMove)
    dom.addEventListener('pointerup', this.onPointerUp)
    dom.addEventListener('pointercancel', this.onPointerUp)
    dom.addEventListener('wheel', this.onWheel, { passive: false })
    // Otherwise a drag that leaves the canvas selects the page text behind it.
    dom.style.touchAction = 'none'
  }

  private onPointerDown = (e: PointerEvent) => {
    this.dom.setPointerCapture(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinchDistance()
  }

  private onPointerMove = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId)
    if (!prev) return

    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (this.pointers.size === 1) {
      this.theta -= dx * this.opts.rotateSpeed
      this.phi -= dy * this.opts.rotateSpeed
      this.clampAngles()
    } else if (this.pointers.size === 2) {
      const distance = this.currentPinchDistance()
      // Fingers spreading apart pulls the camera in.
      this.radius -= (distance - this.pinchDistance) * 0.01
      this.pinchDistance = distance
      this.clampRadius()
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId)
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.radius += e.deltaY * this.opts.zoomSpeed * this.radius
    this.clampRadius()
  }

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  private clampAngles() {
    this.phi = THREE.MathUtils.clamp(this.phi, this.opts.minPolar, this.opts.maxPolar)
  }

  private clampRadius() {
    this.radius = THREE.MathUtils.clamp(this.radius, this.opts.minRadius, this.opts.maxRadius)
  }

  /** Call once per frame with the seconds elapsed since the last one. */
  update(delta: number) {
    // Frame-rate independent easing: the same fraction of the gap closes per
    // second whether we run at 30fps or 144fps.
    const t = 1 - Math.exp(-this.opts.damping * delta)
    this.smoothTheta += (this.theta - this.smoothTheta) * t
    this.smoothPhi += (this.phi - this.smoothPhi) * t
    this.smoothRadius += (this.radius - this.smoothRadius) * t
    this.applyToCamera()
  }

  private applyToCamera() {
    const sinPhi = Math.sin(this.smoothPhi)
    this.camera.position.set(
      this.target.x + this.smoothRadius * sinPhi * Math.sin(this.smoothTheta),
      this.target.y + this.smoothRadius * Math.cos(this.smoothPhi),
      this.target.z + this.smoothRadius * sinPhi * Math.cos(this.smoothTheta),
    )
    this.camera.lookAt(this.target)
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown)
    this.dom.removeEventListener('pointermove', this.onPointerMove)
    this.dom.removeEventListener('pointerup', this.onPointerUp)
    this.dom.removeEventListener('pointercancel', this.onPointerUp)
    this.dom.removeEventListener('wheel', this.onWheel)
    this.pointers.clear()
  }
}
