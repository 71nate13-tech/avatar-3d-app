import * as THREE from 'three'

/**
 * Clothing without any clothing geometry.
 *
 * The Mixamo mannequin is a bare body — there is no shirt mesh to swap in. So
 * instead of adding garments, this paints regions of the body itself: a t-shirt
 * is "the torso and upper arms render with the shirt material". Because it is
 * still the same skinned mesh, every garment follows the skeleton through every
 * dance with no extra work, no cloth simulation, and no added download.
 *
 * Regions come from the skeleton rather than from height. Asking which bone
 * owns a vertex is exact, whereas a height cut cannot separate an arm from the
 * torso beside it — they occupy the same band, so sleeves would smear across
 * the chest.
 */

export type BodyPart =
  | 'head'
  | 'torso'
  | 'upperArm'
  | 'foreArm'
  | 'hand'
  | 'hips'
  | 'upperLeg'
  | 'lowerLeg'
  | 'foot'

/**
 * Mixamo names every bone `mixamorig:LeftForeArm` and so on, consistently across
 * its rigs. Order matters here and the specific cases have to come first:
 * "ForeArm" contains "Arm", and "UpLeg" contains "Leg", so the looser patterns
 * would swallow them.
 */
const PART_BY_BONE: Array<[RegExp, BodyPart]> = [
  [/toe|foot|ball/i, 'foot'],
  [/hand|finger|thumb|index|middle|ring|pinky/i, 'hand'],
  [/forearm/i, 'foreArm'],
  [/shoulder/i, 'torso'],
  [/arm/i, 'upperArm'],
  [/upleg/i, 'upperLeg'],
  [/leg|knee|shin|calf/i, 'lowerLeg'],
  [/hips|pelvis/i, 'hips'],
  [/head|eye|jaw/i, 'head'],
  [/neck|spine|chest|torso/i, 'torso'],
]

function partForBone(name: string): BodyPart {
  for (const [pattern, part] of PART_BY_BONE) {
    if (pattern.test(name)) return part
  }
  // Anything unrecognised counts as torso: it is the largest region, so a
  // stray vertex there is far less visible than a hole in a sleeve.
  return 'torso'
}

export type TopStyle = 'none' | 'tank' | 'tshirt' | 'long'
export type BottomStyle = 'none' | 'shorts' | 'trousers'

export interface Outfit {
  top: TopStyle
  bottom: BottomStyle
  shoes: boolean
}

const TOP_COVERS: Record<TopStyle, BodyPart[]> = {
  none: [],
  tank: ['torso'],
  tshirt: ['torso', 'upperArm'],
  long: ['torso', 'upperArm', 'foreArm'],
}

const BOTTOM_COVERS: Record<BottomStyle, BodyPart[]> = {
  none: [],
  shorts: ['hips', 'upperLeg'],
  trousers: ['hips', 'upperLeg', 'lowerLeg'],
}

/** Index into the mesh's material array. */
export const MATERIAL_SLOT = { skin: 0, top: 1, bottom: 2, shoes: 3 } as const

export interface ClothingAnalysis {
  /** Which body part each triangle belongs to. Fixed once the mesh is loaded. */
  trianglePart: BodyPart[]
  /** The original triangle order, since applying an outfit reorders the index. */
  baseIndex: Uint32Array
  mesh: THREE.SkinnedMesh
}

/**
 * Works out which body part each triangle belongs to, once. Applying an outfit
 * afterwards is only a re-sort, so switching garments never touches this.
 */
export function analyseForClothing(mesh: THREE.SkinnedMesh): ClothingAnalysis | null {
  const geometry = mesh.geometry
  const skinIndex = geometry.getAttribute('skinIndex')
  const skinWeight = geometry.getAttribute('skinWeight')
  if (!skinIndex || !skinWeight || !mesh.skeleton) return null

  // Each vertex is influenced by up to four bones. The heaviest one is what the
  // vertex reads as visually, which is all that is needed to place a garment.
  const boneParts = mesh.skeleton.bones.map((bone) => partForBone(bone.name))
  const vertexCount = skinIndex.count
  const vertexPart = new Array<BodyPart>(vertexCount)

  for (let v = 0; v < vertexCount; v++) {
    let bestWeight = -1
    let bestBone = 0
    for (let j = 0; j < 4; j++) {
      const weight = skinWeight.getComponent(v, j)
      if (weight > bestWeight) {
        bestWeight = weight
        bestBone = skinIndex.getComponent(v, j)
      }
    }
    vertexPart[v] = boneParts[bestBone] ?? 'torso'
  }

  // An unindexed mesh still needs an index to reorder triangles by garment.
  let index = geometry.getIndex()
  if (!index) {
    const generated = new Uint32Array(geometry.getAttribute('position').count)
    for (let i = 0; i < generated.length; i++) generated[i] = i
    index = new THREE.BufferAttribute(generated, 1)
    geometry.setIndex(index)
  }

  const baseIndex = new Uint32Array(index.count)
  for (let i = 0; i < index.count; i++) baseIndex[i] = index.getX(i)

  // A triangle straddling a boundary is assigned by majority vote, so the seam
  // lands between triangles rather than tearing through one.
  const triangleCount = baseIndex.length / 3
  const trianglePart = new Array<BodyPart>(triangleCount)
  for (let t = 0; t < triangleCount; t++) {
    const a = vertexPart[baseIndex[t * 3]]
    const b = vertexPart[baseIndex[t * 3 + 1]]
    const c = vertexPart[baseIndex[t * 3 + 2]]
    trianglePart[t] = a === b || a === c ? a : b === c ? b : a
  }

  return { trianglePart, baseIndex, mesh }
}

/**
 * Reorders triangles so each garment's triangles sit together, then declares one
 * geometry group per garment. Three renders a group with the matching material,
 * which is what puts a differently coloured shirt on an unchanged mesh.
 */
export function applyOutfit(analysis: ClothingAnalysis, outfit: Outfit) {
  const { trianglePart, baseIndex, mesh } = analysis

  const slotForPart = new Map<BodyPart, number>()
  for (const part of TOP_COVERS[outfit.top]) slotForPart.set(part, MATERIAL_SLOT.top)
  for (const part of BOTTOM_COVERS[outfit.bottom]) slotForPart.set(part, MATERIAL_SLOT.bottom)
  if (outfit.shoes) slotForPart.set('foot', MATERIAL_SLOT.shoes)

  // Bucket triangles per slot, then concatenate. Sorting an index array of a few
  // thousand entries is far cheaper than rebuilding the geometry.
  const buckets: number[][] = [[], [], [], []]
  for (let t = 0; t < trianglePart.length; t++) {
    buckets[slotForPart.get(trianglePart[t]) ?? MATERIAL_SLOT.skin].push(t)
  }

  const reordered = new Uint32Array(baseIndex.length)
  const geometry = mesh.geometry
  geometry.clearGroups()

  let cursor = 0
  buckets.forEach((triangles, slot) => {
    if (triangles.length === 0) return
    const start = cursor
    for (const t of triangles) {
      reordered[cursor++] = baseIndex[t * 3]
      reordered[cursor++] = baseIndex[t * 3 + 1]
      reordered[cursor++] = baseIndex[t * 3 + 2]
    }
    geometry.addGroup(start, cursor - start, slot)
  })

  const index = geometry.getIndex()!
  ;(index.array as Uint32Array).set(reordered)
  index.needsUpdate = true
}
