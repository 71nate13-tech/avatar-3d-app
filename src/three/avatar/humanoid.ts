import * as THREE from 'three'

/**
 * A placeholder avatar built from primitives.
 *
 * This exists so the app is explorable before any real model is downloaded, and
 * stays as the fallback if a GLB fails to load. Body parts are grouped by which
 * material they use, so recolouring skin or clothing is a single assignment
 * rather than a walk of the scene graph.
 */

export interface HumanoidMaterials {
  skin: THREE.MeshStandardMaterial
  clothing: THREE.MeshStandardMaterial
  hair: THREE.MeshStandardMaterial
}

export interface Humanoid {
  group: THREE.Group
  materials: HumanoidMaterials
  dispose: () => void
}

// Proportions, in metres, with the feet at y = 0.
const LEG_HEIGHT = 0.85
const TORSO_HEIGHT = 0.6
const TORSO_TOP = LEG_HEIGHT + TORSO_HEIGHT // 1.45
const HEAD_RADIUS = 0.145
const ARM_HEIGHT = 0.58

export function createHumanoid(): Humanoid {
  const group = new THREE.Group()

  const materials: HumanoidMaterials = {
    // Mid-brown default rather than a "default" pale tone — the full range is
    // the point, so the starting value should not imply one end of it is normal.
    skin: new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.75, metalness: 0 }),
    clothing: new THREE.MeshStandardMaterial({ color: 0x3b6ea5, roughness: 0.85, metalness: 0 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.9, metalness: 0 }),
  }

  const geometries: THREE.BufferGeometry[] = []
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z = 0) => {
    geometries.push(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    group.add(mesh)
    return mesh
  }

  // Head and hair.
  add(new THREE.SphereGeometry(HEAD_RADIUS, 32, 24), materials.skin, 0, TORSO_TOP + 0.05 + HEAD_RADIUS)
  // A half-sphere cap, slightly larger than the head so it reads as hair.
  add(
    new THREE.SphereGeometry(HEAD_RADIUS * 1.06, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55),
    materials.hair,
    0,
    TORSO_TOP + 0.05 + HEAD_RADIUS,
  )

  // Neck.
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 16), materials.skin, 0, TORSO_TOP + 0.03)

  // Torso.
  add(new THREE.CapsuleGeometry(0.21, TORSO_HEIGHT - 0.28, 8, 24), materials.clothing, 0, LEG_HEIGHT + TORSO_HEIGHT / 2)

  // Arms, hanging just outside the torso.
  for (const side of [-1, 1]) {
    add(
      new THREE.CapsuleGeometry(0.055, ARM_HEIGHT - 0.11, 6, 16),
      materials.skin,
      side * 0.27,
      TORSO_TOP - ARM_HEIGHT / 2 - 0.05,
    )
  }

  // Legs.
  for (const side of [-1, 1]) {
    add(
      new THREE.CapsuleGeometry(0.078, LEG_HEIGHT - 0.16, 6, 16),
      materials.clothing,
      side * 0.1,
      LEG_HEIGHT / 2,
    )
  }

  return {
    group,
    materials,
    dispose: () => {
      geometries.forEach((g) => g.dispose())
      Object.values(materials).forEach((m) => m.dispose())
    },
  }
}
