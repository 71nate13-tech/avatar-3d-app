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
// `joint` is here rather than under skin because on Mixamo's own mannequins the
// joints are accent pieces sitting on top of the body shell, so they behave far
// more like clothing than like skin.
const CLOTHING_PATTERN = /shirt|pant|cloth|dress|jacket|shoe|top|bottom|outfit|suit|vest|sock|boot|joint/i
// `limb` and `surface` catch Mixamo's mannequins, whose body shell loads as
// `Beta_HighLimbsGeoSG3`. That shell is most of what you see, so it belongs to
// the skin control — which is what makes picking a skin tone change the whole
// figure rather than a few accents.
const SKIN_PATTERN = /skin|body|head|face|arm|leg|hand|foot|surface|limb|torso/i

function bucketMaterials(
  all: THREE.MeshStandardMaterial[],
  /** Vertices drawn with each material, used to tell a body from its trim. */
  sizes: Map<THREE.Material, number>,
): CharacterMaterials {
  const buckets: CharacterMaterials = { skin: [], hair: [], clothing: [], all }
  const unmatched: THREE.MeshStandardMaterial[] = []

  for (const material of all) {
    const name = material.name ?? ''
    if (HAIR_PATTERN.test(name)) buckets.hair.push(material)
    else if (CLOTHING_PATTERN.test(name)) buckets.clothing.push(material)
    else if (SKIN_PATTERN.test(name)) buckets.skin.push(material)
    else unmatched.push(material)
  }

  // Names that matched nothing are sorted by how much of the model they cover.
  // The biggest is the body and belongs to skin; the rest read as trim. Going
  // by size rather than by load order matters, because the arbitrary choice is
  // wrong roughly half the time and fails silently: the figure still recolours,
  // just from the control nobody expects. That is exactly what happened with
  // Mixamo's mannequin, whose body shell is named `Beta_HighLimbsGeoSG3` and
  // matched none of the patterns above.
  if (unmatched.length > 0) {
    unmatched.sort((a, b) => (sizes.get(b) ?? 0) - (sizes.get(a) ?? 0))
    const [largest, ...rest] = unmatched
    if (buckets.skin.length === 0) buckets.skin.push(largest)
    else buckets.clothing.push(largest)
    buckets.clothing.push(...rest)
  }

  // A control wired to an empty bucket looks broken — you click it and nothing
  // moves — so make sure skin and clothing both have one where possible.
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
  /** Name to give the clip carried inside the character file, if it has one.
   *  Downloading the character With Skin bundles whichever animation was
   *  selected at the time, so that clip is already here and re-fetching the
   *  same file as a dance would parse several megabytes twice. */
  embeddedClipName?: string,
): Promise<LoadedCharacter> {
  const group = await load(characterUrl)
  group.scale.setScalar(MIXAMO_SCALE)

  const collected: THREE.MeshStandardMaterial[] = []
  const sizes = new Map<THREE.Material, number>()
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = true
    child.receiveShadow = true
    const vertexCount = child.geometry.getAttribute('position')?.count ?? 0
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
      // Split evenly when one mesh carries several materials — good enough to
      // rank a body against its trim, which is all this is used for.
      sizes.set(converted, (sizes.get(converted) ?? 0) + vertexCount / source.length)
      old.dispose()
      return converted
    })
    if (Array.isArray(child.material) && child.material.length === 1) {
      child.material = child.material[0]
    }
  })

  const materials = bucketMaterials(collected, sizes)

  const mixer = new THREE.AnimationMixer(group)
  const clips = new Map<string, THREE.AnimationClip>()

  const embedded = embeddedClipName ? group.animations[0] : undefined
  if (embedded && embeddedClipName) {
    embedded.name = embeddedClipName
    clips.set(embeddedClipName, embedded)
  }

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
