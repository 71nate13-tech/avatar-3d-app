import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { analyseForClothing, applyOutfit, type ClothingAnalysis, type Outfit } from './clothing'

/**
 * Loads a rigged Mixamo character and its dance clips.
 *
 * Everything here assumes the assets came from one Mixamo character, which is
 * what makes it simple: Mixamo names bones identically across its own rigs, so
 * animation-only exports drop straight onto the skeleton with no retargeting.
 */

/** Mixamo exports in centimetres; the rest of the scene is in metres. */
const MIXAMO_SCALE = 0.01

/**
 * One material per garment, shared by every mesh in the character.
 *
 * This replaced an earlier attempt to guess a material's role from its name.
 * That guess was wrong on the very first real character — the body loads as
 * `Beta_HighLimbsGeoSG3`, which reads as nothing in particular — and it failed
 * silently, tinting the wrong parts rather than erroring. Which bone owns a
 * vertex is a fact, so the naming never has to be interpreted.
 */
export interface CharacterMaterials {
  skin: THREE.MeshStandardMaterial
  top: THREE.MeshStandardMaterial
  bottom: THREE.MeshStandardMaterial
  shoes: THREE.MeshStandardMaterial
}

export interface LoadedCharacter {
  group: THREE.Group
  mixer: THREE.AnimationMixer
  /** Clips keyed by the name we gave them, not the name inside the file. */
  clips: Map<string, THREE.AnimationClip>
  materials: CharacterMaterials
  /** One per skinned mesh, so garments cover the joints as well as the body. */
  clothing: ClothingAnalysis[]
  setOutfit: (outfit: Outfit) => void
  dispose: () => void
}

const loader = new FBXLoader()

function load(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, () => reject(new Error(`Could not load ${url}`)))
  })
}

function createMaterial(name: string): THREE.MeshStandardMaterial {
  // White with no texture, so a picked colour comes out exactly as picked.
  // Tinting over baked-in artwork is only ever a wash across someone else's
  // skin and clothing: a deep tone would dim the whole character rather than
  // change its skin. A photoreal character loses its painted detail this way,
  // which is the price of a colour control that delivers the colour.
  return new THREE.MeshStandardMaterial({ name, color: 0xffffff, roughness: 0.7, metalness: 0 })
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

  const materials: CharacterMaterials = {
    skin: createMaterial('skin'),
    top: createMaterial('top'),
    bottom: createMaterial('bottom'),
    shoes: createMaterial('shoes'),
  }
  // Order matches MATERIAL_SLOT in clothing.ts — the geometry groups index
  // into this array, so the two must stay in step.
  const materialList = [materials.skin, materials.top, materials.bottom, materials.shoes]

  const clothing: ClothingAnalysis[] = []
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = true
    child.receiveShadow = true

    const previous = Array.isArray(child.material) ? child.material : [child.material]
    previous.forEach((m) => m.dispose())
    child.material = materialList

    if (child instanceof THREE.SkinnedMesh) {
      const analysis = analyseForClothing(child)
      if (analysis) clothing.push(analysis)
    }
  })

  if (clothing.length === 0) {
    console.warn('[avatar] no skinned mesh found — clothing will not be available')
  }

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
    clothing,
    setOutfit: (outfit) => clothing.forEach((analysis) => applyOutfit(analysis, outfit)),
    dispose: () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(group)
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
      })
      materialList.forEach((m) => m.dispose())
    },
  }
}
