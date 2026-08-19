import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { analyseForClothing, applyOutfit, type ClothingAnalysis, type Outfit } from './clothing'
import { measureHead } from './headAnchor'
import { createFace, type FaceRig } from './face'
import { createHair, type HairRig } from './hair'

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
  /** Null when the character has no recognisable head bone to attach to. */
  face: FaceRig | null
  hair: HairRig | null
  dispose: () => void
}

/**
 * Pins a dance in place by holding the hips' horizontal position.
 *
 * Mixamo animates the hips, and any clip downloaded without its In Place option
 * ticked travels across the floor. The camera orbits a fixed point, so the
 * character simply walks out of frame — which is what Salsa was doing.
 *
 * Only X and Z are held. Y is left alone, so bobbing, crouching, and jumping
 * survive; zeroing the whole track would flatten the dance onto one level.
 */
function pinRootMotion(clip: THREE.AnimationClip) {
  for (const track of clip.tracks) {
    if (!/hips?\.position$/i.test(track.name)) continue
    const values = track.values
    const startX = values[0]
    const startZ = values[2]
    for (let i = 0; i < values.length; i += 3) {
      values[i] = startX
      values[i + 2] = startZ
    }
  }
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

  // Measure and attach before any clip plays: measureHead reads the mesh in its
  // bind pose, where plain vertex positions still line up with the skeleton.
  // Once an animation is running they no longer do, and the face lands wherever
  // the head happened to be on frame one.
  let face: FaceRig | null = null
  let hair: HairRig | null = null
  const bodyMesh = clothing[0]?.mesh
  const anchor = bodyMesh ? measureHead(bodyMesh) : null
  if (anchor) {
    face = createFace(anchor)
    hair = createHair(anchor)
    // Parenting to the bone rather than the group is what makes these ride the
    // animation: the bone is already being posed every frame.
    anchor.bone.add(face.group)
    anchor.bone.add(hair.group)
  } else {
    console.warn('[avatar] no head bone found — face and hair unavailable')
  }

  const mixer = new THREE.AnimationMixer(group)
  const clips = new Map<string, THREE.AnimationClip>()

  const embedded = embeddedClipName ? group.animations[0] : undefined
  if (embedded && embeddedClipName) {
    embedded.name = embeddedClipName
    pinRootMotion(embedded)
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
      pinRootMotion(clip)
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
    face,
    hair,
    dispose: () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(group)
      face?.dispose()
      hair?.dispose()
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
      })
      materialList.forEach((m) => m.dispose())
    },
  }
}
