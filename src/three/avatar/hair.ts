import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { HeadAnchor } from './headAnchor'

/**
 * Procedural hair, parented to the head bone.
 *
 * Every style is built from small spheres rather than a modelled mesh, which
 * makes texture the thing that varies rather than an afterthought. Coily and
 * curly hair is genuinely hard to fake with a smooth cap - the usual result is
 * a helmet that only reads as straight hair - but it falls out naturally from
 * clustered blobs, and straight styles are the same generator with the blobs
 * packed tight. So the full range is available for the same work, which is the
 * whole point: nobody should have to pick the closest wrong option.
 *
 * All the spheres for one style merge into a single mesh, so a two-hundred-blob
 * afro still costs one draw call.
 *
 * Positions are FRACTIONS of the head's half-extents, not absolute units: 1 is
 * the surface along that axis. An earlier version scaled every axis by one
 * average radius, which on a head measuring 8.8 wide by 13.3 tall by 12.4 deep
 * floated the sides almost 3 units clear of the skull and sank the top nearly
 * 2 units into it, leaving a bald patch at the crown that was only visible
 * looking down from above.
 *
 * The hair is rigid - it rides the head bone with no physics, so long styles do
 * not swing during a dance. Cloth simulation is a much larger job and would be
 * the wrong thing to spend it on before the shapes themselves are right.
 */

export type HairStyle = 'none' | 'buzz' | 'coils' | 'afro' | 'locs' | 'braids' | 'ponytail' | 'long'

export const HAIR_STYLES: { value: HairStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'buzz', label: 'Buzz' },
  { value: 'coils', label: 'Coils' },
  { value: 'afro', label: 'Afro' },
  { value: 'locs', label: 'Locs' },
  { value: 'braids', label: 'Braids' },
  { value: 'ponytail', label: 'Ponytail' },
  { value: 'long', label: 'Long' },
]

export interface HairRig {
  group: THREE.Group
  setStyle: (style: HairStyle) => void
  setColor: (color: string) => void
  /** Advances the swing of hanging strands. Call once per frame. */
  update: (delta: number) => void
  dispose: () => void
}

/** One hanging strand: where it is rooted, which way it hangs, and its blobs
 *  expressed relative to that root so the whole thing can pivot. */
interface StrandBuild {
  root: THREE.Vector3
  rest: THREE.Vector3
  geometry: THREE.BufferGeometry
}

interface StyleBuild {
  cap: THREE.BufferGeometry
  strands: StrandBuild[]
}

/**
 * A strand's swing, as a single pendulum.
 *
 * Simulating hair properly means many linked segments and collision against the
 * body, which is a large job and a poor fit for a phone. This instead lets each
 * strand pivot as one rigid piece about its root, pulled by three things: back
 * toward the way it was modelled, downward under gravity, and against whichever
 * way the head just accelerated. The last one is what actually reads as hair,
 * because hair lags behind the head rather than leading it.
 *
 * Everything is computed in the head bone's own space, so the rigid part of the
 * motion still comes free from the skeleton and only the deviation is
 * simulated.
 */
interface StrandState {
  pivot: THREE.Object3D
  rest: THREE.Vector3
  direction: THREE.Vector3
  spin: THREE.Vector3
}

const GRAVITY_PULL = 26
const REST_PULL = 34
const DRAG = 7
const INERTIA = 0.02
/** Radians a strand may deviate from rest. Without it a hard head movement
 *  flings hair through the shoulders and back out again. */
const MAX_SWING = 0.85

/** Seeded so a given style looks identical on every load. Randomness that
 *  changes between runs would make the avatar feel unstable. */
function makeRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Evenly spread directions over a sphere, without the clustering at the poles
 *  that naive angle stepping produces. */
function fibonacciDirections(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    points.push(new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius))
  }
  return points
}

interface StyleSpec {
  /** How far off the skull the blobs sit, as a multiple of the head surface. */
  shell: number
  /** Blob radius, as a fraction of the average head half-extent. */
  blob: number
  /** How many blobs cover the scalp. */
  density: number
  strands?: {
    count: number
    length: number
    /** Sideways wander per step, as a fraction of head width. */
    drift: number
    /** For a gathered tail, how tightly it bunches at the back. */
    spread: number
    /** Gather at the back of the skull instead of spreading around it. */
    back: boolean
    /**
     * How far forward of the ears strands may start and hang, as a fraction of
     * head depth. Real braids and locs are anchored behind the hairline, so
     * this stays at zero for them; a loose curtain can come further forward to
     * frame the face. It also hard-clamps drift, because a strand that wanders
     * forward over a dozen steps ends up laid across the cheek.
     */
    frontReach: number
    /** Vary thickness down the strand, so it reads as plaited rather than as a
     *  smooth tube. */
    plaited?: boolean
  }
}

/**
 * Blob size and density are linked, not free choices. Spacing between blob
 * centres is roughly `radius * sqrt(4*pi / samples)`, so a blob smaller than
 * half that leaves bare scalp showing between them. Buzz originally used 0.10
 * at 180 samples, which needs 0.13 to close up, and rendered as scattered dots
 * that read as balding rather than as short hair. Short styles therefore get
 * their fineness from more blobs, not smaller ones.
 */
const SPECS: Record<Exclude<HairStyle, 'none'>, StyleSpec> = {
  buzz: { shell: 1.04, blob: 0.115, density: 200 },
  coils: { shell: 1.1, blob: 0.19, density: 90 },
  afro: { shell: 1.3, blob: 0.3, density: 80 },
  locs: { shell: 1.07, blob: 0.145, density: 140, strands: { count: 18, length: 14, drift: 0.04, spread: 0.9, back: false, frontReach: 0.12 } },
  // Braids sit strictly behind the ears and are thicker and fewer than locs,
  // so each one reads as a distinct plait rather than as a fringe.
  braids: { shell: 1.06, blob: 0.17, density: 140, strands: { count: 11, length: 15, drift: 0.03, spread: 1.0, back: false, frontReach: 0, plaited: true } },
  ponytail: { shell: 1.06, blob: 0.145, density: 150, strands: { count: 5, length: 15, drift: 0.05, spread: 0.35, back: true, frontReach: 0 } },
  long: { shell: 1.1, blob: 0.2, density: 90, strands: { count: 22, length: 13, drift: 0.025, spread: 1.0, back: false, frontReach: 0.3 } },
}

function buildStyle(anchor: HeadAnchor, style: Exclude<HairStyle, 'none'>): StyleBuild {
  const spec = SPECS[style]
  const random = makeRandom(style.length * 9871 + 12345)
  const parts: THREE.BufferGeometry[] = []
  // Blob radius stays tied to the average extent, so texture reads at the same
  // coarseness regardless of which way the head is longer.
  const grain = anchor.radius

  /** Fractions of the head's half-extents, where 1 is the surface. */
  const toLocal = (right: number, up: number, forward: number) =>
    anchor.center
      .clone()
      .addScaledVector(anchor.right, right * anchor.halfWidth)
      .addScaledVector(anchor.up, up * anchor.halfHeight)
      .addScaledVector(anchor.forward, forward * anchor.halfDepth)

  const blob = (position: THREE.Vector3, size: number) => {
    // Low segment counts: these are lumps under a solid colour, and at this
    // scale extra detail is invisible but multiplies across hundreds of blobs.
    const geometry = new THREE.SphereGeometry(size, 7, 5)
    geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
    return geometry
  }

  const addBlob = (position: THREE.Vector3, size: number) => {
    parts.push(blob(position, size))
  }

  // Scalp coverage. The face is left clear, and the cut sits lower at the back
  // than the front so it reads as a hairline rather than a swim cap.
  for (const dir of fibonacciDirections(spec.density * 2)) {
    if (dir.y < -0.35) continue
    if (dir.z > 0.35 && dir.y < 0.3) continue // face
    const shell = spec.shell * (1 + (random() - 0.5) * 0.18)
    addBlob(
      toLocal(dir.x * shell, dir.y * shell, dir.z * shell),
      spec.blob * grain * (0.75 + random() * 0.5),
    )
  }

  // Hanging strands, grown downward from around the hairline. Each is built as
  // its own geometry, positioned relative to where it is rooted, so it can
  // pivot there independently of the cap and of every other strand.
  const strands: StrandBuild[] = []
  if (spec.strands) {
    const { count, length, drift, spread, back, frontReach, plaited } = spec.strands
    // Angles are (right, forward) around the head: 0 is the right ear, pi/2 the
    // face, 3*pi/2 the back of the skull. A tail bunches at the back; every
    // other style sweeps ear to ear round the back, widened by frontReach.
    //
    // An earlier sweep started at 0.65*pi, only 0.15*pi off the face, so the
    // first and last strands began on the cheeks and hung down across them.
    // Deriving the arc ends from frontReach means a strand can never start
    // further forward than the style allows.
    const BACK_ANGLE = Math.PI * 1.5
    const reach = Math.asin(THREE.MathUtils.clamp(frontReach, 0, 0.95))
    const startAngle = Math.PI - reach
    const sweep = Math.PI + reach * 2

    for (let s = 0; s < count; s++) {
      const angle = back
        ? BACK_ANGLE + (random() - 0.5) * spread
        : startAngle + (s / Math.max(count - 1, 1)) * sweep

      let right = Math.cos(angle) * 0.95
      let forward = Math.sin(angle) * 0.95
      let up = back ? 0.2 : -0.05
      // Drift accumulates over a dozen steps, so without a ceiling a strand
      // wanders forward and ends up laid across the jaw.
      const forwardLimit = frontReach + 0.05

      const root = toLocal(right, up, forward)
      const pieces: THREE.BufferGeometry[] = []
      let tip = root

      for (let i = 0; i < length; i++) {
        // A plait is a stack of segments rather than a smooth tube, so its
        // thickness pulses down the length instead of tapering evenly.
        const taper = plaited ? 0.78 + 0.34 * Math.abs(Math.sin(i * 1.7)) : 0.95 - i * 0.02
        tip = toLocal(right, up, forward)
        pieces.push(blob(tip.clone().sub(root), spec.blob * grain * taper))
        up -= 0.16
        right += (right >= 0 ? 1 : -1) * drift * random()
        forward += (random() - 0.5) * drift
        if (forward > forwardLimit) forward = forwardLimit
      }

      const geometry = mergeGeometries(pieces, false)
      pieces.forEach((p) => p.dispose())
      if (geometry) {
        const rest = tip.clone().sub(root)
        if (rest.lengthSq() < 1e-8) rest.set(0, -1, 0)
        strands.push({ root, rest: rest.normalize(), geometry })
      }
    }
  }

  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return { cap: merged ?? new THREE.BufferGeometry(), strands }
}

interface BuiltStyle {
  root: THREE.Group
  strands: StrandState[]
}

export function createHair(anchor: HeadAnchor): HairRig {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.85, metalness: 0 })
  // Styles are built the first time they are chosen, then kept. Rebuilding a
  // two-hundred-blob afro on every toggle would stutter on a tablet.
  const cache = new Map<HairStyle, BuiltStyle>()
  let active: BuiltStyle | null = null

  const setStyle = (style: HairStyle) => {
    cache.forEach((built) => (built.root.visible = false))
    active = null
    if (style === 'none') return

    let built = cache.get(style)
    if (!built) {
      const shape = buildStyle(anchor, style)
      const root = new THREE.Group()

      const cap = new THREE.Mesh(shape.cap, material)
      cap.castShadow = true
      root.add(cap)

      const strands = shape.strands.map(({ root: at, rest, geometry }) => {
        const pivot = new THREE.Object3D()
        pivot.position.copy(at)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = true
        pivot.add(mesh)
        root.add(pivot)
        return { pivot, rest, direction: rest.clone(), spin: new THREE.Vector3() }
      })

      built = { root, strands }
      cache.set(style, built)
      group.add(root)
    }
    built.root.visible = true
    active = built
  }

  // Head motion, tracked between frames to work out its acceleration.
  const previousPosition = new THREE.Vector3()
  const previousVelocity = new THREE.Vector3()
  let seenAFrame = false

  const velocity = new THREE.Vector3()
  const acceleration = new THREE.Vector3()
  const worldPosition = new THREE.Vector3()
  const worldQuaternion = new THREE.Quaternion()
  const inverseRotation = new THREE.Quaternion()
  const localAcceleration = new THREE.Vector3()
  const localDown = new THREE.Vector3()
  const torque = new THREE.Vector3()
  const term = new THREE.Vector3()

  const update = (delta: number) => {
    // A long frame makes a spring explode rather than lag, and one can happen
    // any time the tab is backgrounded or a style is being built.
    const step = Math.min(delta, 1 / 30)
    if (step <= 0) return

    anchor.bone.getWorldPosition(worldPosition)
    anchor.bone.getWorldQuaternion(worldQuaternion)

    if (!seenAFrame) {
      previousPosition.copy(worldPosition)
      seenAFrame = true
      return
    }

    velocity.subVectors(worldPosition, previousPosition).divideScalar(step)
    acceleration.subVectors(velocity, previousVelocity).divideScalar(step)
    previousPosition.copy(worldPosition)
    previousVelocity.copy(velocity)

    if (!active || active.strands.length === 0) return

    // Everything below is in the head's own space, so the rigid part of the
    // motion still comes free from the skeleton.
    inverseRotation.copy(worldQuaternion).invert()
    localAcceleration.copy(acceleration).applyQuaternion(inverseRotation)
    localDown.set(0, -1, 0).applyQuaternion(inverseRotation)

    for (const strand of active.strands) {
      const { rest, direction, spin } = strand

      // Each pull is a torque turning the strand from where it points toward
      // where something wants it to point.
      torque.set(0, 0, 0)
      torque.addScaledVector(term.crossVectors(direction, rest), REST_PULL)
      torque.addScaledVector(term.crossVectors(direction, localDown), GRAVITY_PULL)
      // Hair lags behind the head, so it swings against the acceleration.
      torque.addScaledVector(term.crossVectors(direction, localAcceleration), -INERTIA)
      torque.addScaledVector(spin, -DRAG)

      spin.addScaledVector(torque, step)
      term.copy(spin).multiplyScalar(step)
      const angle = term.length()
      if (angle > 1e-6) {
        direction.applyAxisAngle(term.divideScalar(angle), angle).normalize()
      }

      // Clamp the deviation, then bleed off the spin that pushed past it, so a
      // strand rests against the limit instead of grinding into it.
      const swing = direction.angleTo(rest)
      if (swing > MAX_SWING) {
        term.crossVectors(rest, direction).normalize()
        direction.copy(rest).applyAxisAngle(term, MAX_SWING)
        spin.multiplyScalar(0.5)
      }

      strand.pivot.quaternion.setFromUnitVectors(rest, direction)
    }
  }

  return {
    group,
    setStyle,
    setColor: (color: string) => material.color.set(color),
    update,
    dispose: () => {
      cache.forEach((built) => {
        built.root.traverse((child) => {
          if (child instanceof THREE.Mesh) child.geometry.dispose()
        })
      })
      material.dispose()
    },
  }
}
