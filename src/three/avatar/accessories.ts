import * as THREE from 'three'
import type { HeadAnchor } from './headAnchor'

/**
 * Hats, glasses, and earrings, built from primitives and hung on the head bone.
 *
 * Everything is authored inside a frame aligned to the head, so a piece can be
 * described in plain terms - "just forward of the eyes, a little above centre"
 * - instead of every position being a separate combination of the head's three
 * axes. Sizes come from the measured half-extents, so a piece fits whatever
 * character is loaded rather than one particular skull.
 */

export type HatStyle = 'none' | 'beanie' | 'cap' | 'brim'
export type GlassesStyle = 'none' | 'round' | 'square'
export type EarringStyle = 'none' | 'studs' | 'hoops'

export const HAT_STYLES: { value: HatStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'beanie', label: 'Beanie' },
  { value: 'cap', label: 'Cap' },
  { value: 'brim', label: 'Sun hat' },
]

export const GLASSES_STYLES: { value: GlassesStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
]

export const EARRING_STYLES: { value: EarringStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'studs', label: 'Studs' },
  { value: 'hoops', label: 'Hoops' },
]

export interface AccessoryRig {
  group: THREE.Group
  setHat: (style: HatStyle) => void
  setGlasses: (style: GlassesStyle) => void
  setEarrings: (style: EarringStyle) => void
  setHatColor: (color: string) => void
  setAccentColor: (color: string) => void
  dispose: () => void
}

export function createAccessories(anchor: HeadAnchor): AccessoryRig {
  const group = new THREE.Group()

  // A frame whose axes are the head's own: +X right, +Y up, +Z out of the face.
  // Every piece below is authored in these terms.
  const frame = new THREE.Group()
  frame.position.copy(anchor.center)
  frame.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(anchor.right, anchor.up, anchor.forward),
  )
  group.add(frame)

  const w = anchor.halfWidth
  const h = anchor.halfHeight
  const d = anchor.halfDepth

  const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x8e4585, roughness: 0.8 })
  // Slightly metallic, so frames and jewellery catch a highlight and read as a
  // different material rather than as more clothing.
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a227,
    roughness: 0.35,
    metalness: 0.6,
  })

  const geometries: THREE.BufferGeometry[] = []
  const track = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g)

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const m = new THREE.Mesh(track(geometry), material)
    m.castShadow = true
    return m
  }

  /** Hats clear the scalp by a wide margin. A closer fit looks better bare but
   *  buries itself in anything longer than a buzz cut. */
  const HAT_LIFT = 1.16

  /**
   * Where a hat's lower edge sits.
   *
   * y = 0 is the middle of the head, not the top of it, and the eyes are only
   * a tenth of a half-height above that. A hat placed near zero therefore lands
   * across the eyes like a blindfold, which is exactly what the first version
   * did. Everything is measured up from the brow instead.
   */
  const BROW = h * 0.24

  const buildHat = (style: Exclude<HatStyle, 'none'>) => {
    const hat = new THREE.Group()

    // Every hat starts with a crown: a dome capping the skull from the brow up.
    const crownHeight = (h - BROW) * (style === 'beanie' ? 1.14 : 0.95)
    const crown = mesh(
      new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hatMaterial,
    )
    crown.scale.set(w * HAT_LIFT, crownHeight, d * HAT_LIFT)
    crown.position.y = BROW
    hat.add(crown)

    if (style === 'beanie') {
      // A rolled band around the lower edge, which is what makes a dome read as
      // a beanie rather than as a swimming cap.
      const band = mesh(new THREE.TorusGeometry(1, 0.15, 10, 32), hatMaterial)
      band.rotation.x = Math.PI / 2
      // After the rotation, local Z is the tube's thickness and now runs
      // vertically, so that is the axis controlling how deep the band looks.
      band.scale.set(w * HAT_LIFT * 1.02, d * HAT_LIFT * 1.02, h * 0.75)
      band.position.y = BROW + h * 0.04
      hat.add(band)
    }

    if (style === 'cap') {
      // A peak, flattened and pushed forward over the brow.
      const peak = mesh(new THREE.CylinderGeometry(1, 1, 0.12, 24, 1, false, 0, Math.PI), hatMaterial)
      peak.scale.set(w * 1.1, h * 0.5, d * 1.6)
      peak.position.set(0, BROW + h * 0.03, d * 0.3)
      peak.rotation.y = Math.PI
      hat.add(peak)
    }

    if (style === 'brim') {
      const brim = mesh(new THREE.CylinderGeometry(1, 1, 0.09, 40), hatMaterial)
      brim.scale.set(w * 2.2, h * 0.45, d * 2.2)
      brim.position.y = BROW + h * 0.02
      hat.add(brim)
    }

    return hat
  }

  const EYE_SPACING = 0.42
  const EYE_HEIGHT = 0.1

  const buildGlasses = (style: Exclude<GlassesStyle, 'none'>) => {
    const glasses = new THREE.Group()
    const lensRadius = w * 0.3
    const front = d * 0.98

    for (const side of [-1, 1]) {
      const rim =
        style === 'round'
          ? mesh(new THREE.TorusGeometry(lensRadius, lensRadius * 0.13, 8, 24), accentMaterial)
          : mesh(
              new THREE.BoxGeometry(lensRadius * 2, lensRadius * 1.5, lensRadius * 0.16),
              accentMaterial,
            )
      rim.position.set(side * EYE_SPACING * w, EYE_HEIGHT * h, front)
      glasses.add(rim)

      // An arm back toward the ear, which is what stops glasses looking like
      // two rings floating in front of a face.
      const arm = mesh(
        new THREE.BoxGeometry(lensRadius * 0.12, lensRadius * 0.12, d * 0.9),
        accentMaterial,
      )
      arm.position.set(side * w * 0.82, EYE_HEIGHT * h, front - d * 0.5)
      glasses.add(arm)
    }

    const bridge = mesh(
      new THREE.BoxGeometry(w * 0.2, lensRadius * 0.12, lensRadius * 0.14),
      accentMaterial,
    )
    bridge.position.set(0, EYE_HEIGHT * h + lensRadius * 0.2, front)
    glasses.add(bridge)

    if (style === 'square') {
      // Squared frames need a top bar or the two rims read as separate blocks.
      const brow = mesh(
        new THREE.BoxGeometry(w * 1.1, lensRadius * 0.16, lensRadius * 0.16),
        accentMaterial,
      )
      brow.position.set(0, EYE_HEIGHT * h + lensRadius * 0.75, front)
      glasses.add(brow)
    }

    return glasses
  }

  const buildEarrings = (style: Exclude<EarringStyle, 'none'>) => {
    const earrings = new THREE.Group()
    for (const side of [-1, 1]) {
      const piece =
        style === 'studs'
          ? mesh(new THREE.SphereGeometry(w * 0.1, 14, 10), accentMaterial)
          : mesh(new THREE.TorusGeometry(w * 0.2, w * 0.035, 8, 22), accentMaterial)
      // Hoops hang below the lobe; a stud sits on it.
      piece.position.set(side * w * 0.98, style === 'hoops' ? -h * 0.28 : -h * 0.1, -d * 0.05)
      if (style === 'hoops') piece.rotation.y = Math.PI / 2
      earrings.add(piece)
    }
    return earrings
  }

  const hats = new Map<HatStyle, THREE.Group>()
  const glasses = new Map<GlassesStyle, THREE.Group>()
  const earrings = new Map<EarringStyle, THREE.Group>()

  /** Styles are built on first use and kept, then shown or hidden. */
  const swap = <T extends string>(
    cache: Map<T, THREE.Group>,
    style: T,
    build: (style: T) => THREE.Group,
  ) => {
    cache.forEach((object) => (object.visible = false))
    if (style === 'none') return
    let object = cache.get(style)
    if (!object) {
      object = build(style)
      cache.set(style, object)
      frame.add(object)
    }
    object.visible = true
  }

  return {
    group,
    setHat: (style) => swap(hats, style, (s) => buildHat(s as Exclude<HatStyle, 'none'>)),
    setGlasses: (style) =>
      swap(glasses, style, (s) => buildGlasses(s as Exclude<GlassesStyle, 'none'>)),
    setEarrings: (style) =>
      swap(earrings, style, (s) => buildEarrings(s as Exclude<EarringStyle, 'none'>)),
    setHatColor: (color) => hatMaterial.color.set(color),
    setAccentColor: (color) => accentMaterial.color.set(color),
    dispose: () => {
      geometries.forEach((g) => g.dispose())
      hatMaterial.dispose()
      accentMaterial.dispose()
    },
  }
}
