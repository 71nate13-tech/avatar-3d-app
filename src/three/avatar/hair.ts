import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { HeadAnchor } from './headAnchor'

/**
 * Procedural hair, parented to the head bone.
 *
 * Every style is built from small spheres rather than a modelled mesh, which
 * makes texture the thing that varies rather than an afterthought. Coily and
 * curly hair is genuinely hard to fake with a smooth cap — the usual result is
 * a helmet that only reads as straight hair — but it falls out naturally from
 * clustered blobs, and straight styles are the same generator with the blobs
 * packed tight. So the full range is available for the same work, which is the
 * whole point: nobody should have to pick the closest wrong option.
 *
 * All the spheres for one style merge into a single mesh, so a two-hundred-blob
 * afro still costs one draw call.
 *
 * The hair is rigid — it rides the head bone with no physics, so long styles do
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
  /** How far off the skull the blobs sit, as a multiple of head radius. */
  shell: number
  /** Blob radius, as a fraction of head radius. */
  blob: number
  /** How many blobs cover the scalp. */
  density: number
  /** Hanging strands: how many, how long, and how far they drift outward. */
  strands?: { count: number; length: number; drift: number; spread: number; back: boolean }
}

/**
 * Blob size and density are linked, not free choices. Spacing between blob
 * centres is roughly `radius * sqrt(4π / samples)`, so a blob smaller than half
 * that leaves bare scalp showing between them. Buzz originally used 0.10 at 180
 * samples, which needs 0.13 to close up, and rendered as scattered dots that
 * read as balding rather than as short hair. Short styles therefore get their
 * fineness from more blobs, not smaller ones.
 */
const SPECS: Record<Exclude<HairStyle, 'none'>, StyleSpec> = {
  buzz: { shell: 1.02, blob: 0.115, density: 200 },
  coils: { shell: 1.1, blob: 0.19, density: 80 },
  afro: { shell: 1.28, blob: 0.3, density: 70 },
  locs: { shell: 1.06, blob: 0.145, density: 130, strands: { count: 16, length: 14, drift: 0.055, spread: 0.9, back: false } },
  braids: { shell: 1.05, blob: 0.14, density: 130, strands: { count: 10, length: 16, drift: 0.045, spread: 1.0, back: false } },
  ponytail: { shell: 1.05, blob: 0.145, density: 140, strands: { count: 4, length: 15, drift: 0.06, spread: 0.3, back: true } },
  long: { shell: 1.08, blob: 0.2, density: 80, strands: { count: 22, length: 13, drift: 0.03, spread: 1.0, back: false } },
}

function buildStyle(anchor: HeadAnchor, style: Exclude<HairStyle, 'none'>): THREE.BufferGeometry {
  const spec = SPECS[style]
  const r = anchor.radius
  const random = makeRandom(style.length * 9871 + 12345)
  const parts: THREE.BufferGeometry[] = []

  const toLocal = (right: number, up: number, forward: number) =>
    anchor.center
      .clone()
      .addScaledVector(anchor.right, right)
      .addScaledVector(anchor.up, up)
      .addScaledVector(anchor.forward, forward)

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
    const up = dir.y
    const forward = dir.z
    if (up < -0.35) continue
    if (forward > 0.35 && up < 0.3) continue // face
    const jitter = 1 + (random() - 0.5) * 0.22
    const shell = spec.shell * jitter
    addBlob(
      toLocal(dir.x * r * shell, up * r * shell, forward * r * shell),
      spec.blob * r * (0.75 + random() * 0.5),
    )
  }

  // Hanging strands, grown downward from around the hairline.
  if (spec.strands) {
    const { count, length, drift, spread, back } = spec.strands
    // Angles are (right, forward) around the head: 0 is the right ear, π/2 the
    // face, and 3π/2 the back of the skull. A tail bunches at the back; other
    // styles sweep the 1.7π of arc that excludes the face entirely, so no
    // strand has to be discarded and the requested count is what gets built.
    const BACK_ANGLE = Math.PI * 1.5
    for (let s = 0; s < count; s++) {
      const angle = back
        ? BACK_ANGLE + (random() - 0.5) * spread
        : Math.PI * 0.65 + (s / Math.max(count - 1, 1)) * Math.PI * 1.7
      const startX = Math.cos(angle) * 0.92
      const startZ = Math.sin(angle) * 0.92

      let right = startX * r
      let up = r * (back ? 0.15 : -0.05)
      let forward = startZ * r
      for (let i = 0; i < length; i++) {
        addBlob(toLocal(right, up, forward), spec.blob * r * (0.95 - i * 0.02))
        up -= r * 0.16
        // Drift outward and wander a little, so strands do not read as a
        // single extruded slab.
        right += (right >= 0 ? 1 : -1) * r * drift * random()
        forward += (random() - 0.5) * r * drift
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
