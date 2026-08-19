import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

/**
 * Loads a rigged Mixamo character and its dance clips.
 *
 * Everything here assumes the assets came from one Mixamo character, which is
 * what makes it simple: Mixamo names bones identically across its own rigs, so
 * animation-only exports drop straight onto the skeleton with no retargeting.
 */

/** Mixamo exports in centimetres; the rest of the scene is in metres. */
const MIXAMO_SCALE = 0.01

export interface LoadedCharacter {
  group: THREE.Group
  mixer: THREE.AnimationMixer
  /** Clips keyed by the name we gave them, not the name inside the file. */
  clips: Map<string, THREE.AnimationClip>
  /** Plain colour materials, present on Y Bot / X Bot, usable for tinting. */
  materials: THREE.MeshStandardMaterial[]
  dispose: () => void
}

const loader = new FBXLoader()

function load(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, () => reject(new Error(`Could not load ${url}`)))
  })
}

/**
 * Loads the character plus every named dance. Rejects if the character itself is
 * missing, so the caller can fall back to the primitive figure. Individual dances
 * that fail are skipped rather than taking the whole avatar down with them.
 */
export async function loadCharacter(
  characterUrl: string,
  danceUrls: Record<string, string>,
): Promise<LoadedCharacter> {
  const group = await load(characterUrl)
  group.scale.setScalar(MIXAMO_SCALE)

  const materials: THREE.MeshStandardMaterial[] = []
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = true
    child.receiveShadow = true
    // FBX arrives with Phong materials; convert so it lights the same way as
    // the rest of the scene, which is built on the standard PBR model.
    const source = Array.isArray(child.material) ? child.material : [child.material]
    child.material = source.map((old: THREE.Material) => {
      // No `skinning` flag: three handles that from the mesh type since r151.
      const converted = new THREE.MeshStandardMaterial({
        color: (old as THREE.MeshPhongMaterial).color ?? new THREE.Color(0xcccccc),
        map: (old as THREE.MeshPhongMaterial).map ?? null,
        roughness: 0.7,
        metalness: 0,
      })
      materials.push(converted)
      old.dispose()
      return converted
    })
    if (Array.isArray(child.material) && child.material.length === 1) {
      child.material = child.material[0]
    }
  })

  const mixer = new THREE.AnimationMixer(group)
  const clips = new Map<string, THREE.AnimationClip>()

  // The character export can carry a clip of its own (usually the T-pose).
  // Load the dances in parallel — they are independent requests.
  const results = await Promise.allSettled(
    Object.entries(danceUrls).map(async ([name, url]) => {
      const asset = await load(url)
      const clip = asset.animations[0]
      if (!clip) throw new Error(`${url} contains no animation`)
      // Mixamo names nearly every clip "mixamo.com", so the filename is the
      // only thing that actually distinguishes one dance from another.
      clip.name = name
      return [name, clip] as const
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const [name, clip] = result.value
      clips.set(name, clip)
    } else {
      console.warn('[avatar] dance failed to load:', result.reason)
    }
  }

  return {
    group,
    mixer,
    clips,
    materials,
    dispose: () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(group)
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
      })
      materials.forEach((m) => m.dispose())
    },
  }
}
