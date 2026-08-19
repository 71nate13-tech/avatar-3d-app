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
  dispose: () => void
}

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

function buildStyle(anchor: HeadAnchor, style: Exclude<HairStyle, 'none'>): THREE.BufferGeometry {
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

  const addBlob = (position: THREE.Vector3, size: number) => {
    // Low segment counts: these are lumps under a solid colour, and at this
    // scale extra detail is invisible but multiplies across hundreds of blobs.
    const geometry = new THREE.SphereGeometry(size, 7, 5)
    geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(position.x, position.y, position.z))
    parts.push(geometry)
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

  // Hanging strands, grown downward from around the hairline.
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

      for (let i = 0; i < length; i++) {
        // A plait is a stack of segments rather than a smooth tube, so its
        // thickness pulses down the length instead of tapering evenly.
        const taper = plaited ? 0.78 + 0.34 * Math.abs(Math.sin(i * 1.7)) : 0.95 - i * 0.02
        addBlob(toLocal(right, up, forward), spec.blob * grain * taper)
        up -= 0.16
        right += (right >= 0 ? 1 : -1) * drift * random()
        forward += (random() - 0.5) * drift
        if (forward > forwardLimit) forward = forwardLimit
      }
    }
  }

  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged ?? new THREE.BufferGeometry()
}

export function createHair(anchor: HeadAnchor): HairRig {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.85, metalness: 0 })
  // Styles are built the first time they are chosen, then kept. Rebuilding a
  // two-hundred-blob afro on every toggle would stutter on a tablet.
  const cache = new Map<HairStyle, THREE.Mesh>()

  const setStyle = (style: HairStyle) => {
    cache.forEach((mesh) => (mesh.visible = false))
    if (style === 'none') return

    let mesh = cache.get(style)
    if (!mesh) {
      mesh = new THREE.Mesh(buildStyle(anchor, style), material)
      mesh.castShadow = true
      cache.set(style, mesh)
      group.add(mesh)
    }
    mesh.visible = true
  }

  return {
    group,
    setStyle,
    setColor: (color: string) => material.color.set(color),
    dispose: () => {
      cache.forEach((mesh) => mesh.geometry.dispose())
      material.dispose()
    },
  }
}
