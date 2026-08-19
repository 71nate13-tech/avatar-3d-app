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

/** Materials grouped by which control tints them. */
export interface CharacterMaterials {
  skin: THREE.MeshStandardMaterial[]
  hair: THREE.MeshStandardMaterial[]
  clothing: THREE.MeshStandardMaterial[]
  all: THREE.MeshStandardMaterial[]
}

export interface LoadedCharacter {
  group: THREE.Group
  mixer: THREE.AnimationMixer
  /** Clips keyed by the name we gave them, not the name inside the file. */
  clips: Map<string, THREE.AnimationClip>
  materials: CharacterMaterials
  dispose: () => void
}

// Rough guesses at what a material covers, from its name. Mixamo has no
// convention worth relying on, so this is a best effort that degrades to
// "treat it as clothing" rather than failing.
const HAIR_PATTERN = /hair|beard|brow|lash/i
const CLOTHING_PATTERN = /shirt|pant|cloth|dress|jacket|shoe|top|bottom|outfit|suit|vest|sock|boot/i
const SKIN_PATTERN = /skin|body|head|face|arm|leg|hand|foot|joint/i

function bucketMaterials(all: THREE.MeshStandardMaterial[]): CharacterMaterials {
  const buckets: CharacterMaterials = { skin: [], hair: [], clothing: [], all }

  for (const material of all) {
    const name = material.name ?? ''
    if (HAIR_PATTERN.test(name)) buckets.hair.push(material)
    else if (CLOTHING_PATTERN.test(name)) buckets.clothing.push(material)
    else if (SKIN_PATTERN.test(name)) buckets.skin.push(material)
    else buckets.clothing.push(material)
  }

  // A control wired to an empty bucket looks broken — you click it and nothing
  // moves. With at least two materials, make sure skin and clothing both have
  // one, borrowing from whichever bucket is overfull.
  if (all.length >= 2) {
    if (buckets.skin.length === 0 && buckets.clothing.length > 1) {
      buckets.skin.push(buckets.clothing.pop()!)
    } else if (buckets.clothing.length === 0 && buckets.skin.length > 1) {
      buckets.clothing.push(buckets.skin.pop()!)
    }
  }

  console.info(
    '[avatar] materials:',
    all.map((m) => m.name || '(unnamed)'),
    '→ skin:', buckets.skin.length,
    'hair:', buckets.hair.length,
    'clothing:', buckets.clothing.length,
  )

  return buckets
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

  const collected: THREE.MeshStandardMaterial[] = []
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = true
    child.receiveShadow = true
    // FBX arrives with Phong materials; convert so it lights the same way as
    // the rest of the scene, which is built on the standard PBR model.
    const source = Array.isArray(child.material) ? child.material : [child.material]
    child.material = source.map((old: THREE.Material) => {
      // Start white with no texture, so a picked colour comes out exactly as
      // picked. Tinting on top of baked-in artwork is only ever a wash over
      // someone else's skin and clothing — a deep tone would dim the whole
      // character rather than actually change its skin. Losing the texture
      // costs the character's painted detail; being able to choose a colour
      // and get that colour is worth more here.
      // No `skinning` flag: three handles that from the mesh type since r151.
      const converted = new THREE.MeshStandardMaterial({
        name: old.name,
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0,
      })
      collected.push(converted)
      old.dispose()
      return converted
    })
    if (Array.isArray(child.material) && child.material.length === 1) {
      child.material = child.material[0]
    }
  })

  const materials = bucketMaterials(collected)

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
      materials.all.forEach((m) => m.dispose())
    },
  }
}
