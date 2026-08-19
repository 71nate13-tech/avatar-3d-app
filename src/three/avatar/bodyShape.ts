import * as THREE from 'three'
import { partForBone, type BodyPart } from './clothing'

/**
 * Body build, by reshaping the mesh in its bind pose.
 *
 * The obvious approach - scaling bones - is the wrong one. Bone scale is
 * inherited by every child, so a wider chest drags the arms outward with it,
 * and scaling along a bone moves the joint at its end, which makes elbows and
 * knees bend in the wrong place partway through a dance.
 *
 * Instead each vertex is pushed away from the axis of the bone that owns it.
 * Distance *along* the bone is left untouched, so every joint stays exactly
 * where the skeleton puts it and the animations are unaffected; only the
 * thickness around each bone changes. The result survives skinning because the
 * edit is made to the bind pose, which is what skinning starts from.
 *
 * Height is deliberately not handled here — it is a uniform scale on the whole
 * character, which is one line and cannot distort anything.
 */

/** How strongly build affects each region. The head is excluded outright: the
 *  face and hair are anchored to measurements of it, so reshaping it would
 *  drift the eyes and mouth off the skull. */
const BUILD_WEIGHT: Record<BodyPart, number> = {
  torso: 1,
  hips: 0.95,
  upperLeg: 0.85,
  lowerLeg: 0.6,
  upperArm: 0.55,
  foreArm: 0.45,
  hand: 0.25,
  foot: 0.2,
  head: 0,
}

export interface BodyAnalysis {
  mesh: THREE.SkinnedMesh
  /** Bind-pose positions, kept so every change is applied to the original
   *  rather than compounding on the last one. */
  original: Float32Array
  boneOfVertex: Uint16Array
  buildWeight: Float32Array
  boneOrigin: THREE.Vector3[]
  boneAxis: THREE.Vector3[]
}

export function analyseBody(mesh: THREE.SkinnedMesh): BodyAnalysis | null {
  const geometry = mesh.geometry
  const position = geometry.getAttribute('position')
  const skinIndex = geometry.getAttribute('skinIndex')
  const skinWeight = geometry.getAttribute('skinWeight')
  const skeleton = mesh.skeleton
  if (!position || !skinIndex || !skinWeight || !skeleton) return null

  // A bone's inverse bind matrix maps model space into that bone's space, so
  // inverting it back out gives where the bone sits in the bind pose.
  const boneOrigin = skeleton.boneInverses.map((inverse) =>
    new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(inverse).invert()),
  )

  // A bone points at its child. Leaves have none, so they borrow their parent's
  // direction — a fingertip thickens along the finger, not along nothing.
  const boneAxis = boneOrigin.map(() => new THREE.Vector3(0, 1, 0))
  const indexOfBone = new Map(skeleton.bones.map((bone, i) => [bone, i]))
  skeleton.bones.forEach((bone, i) => {
    const childIndex = bone.children
      .map((child) => indexOfBone.get(child as THREE.Bone))
      .find((index) => index !== undefined)
    if (childIndex !== undefined) {
      boneAxis[i].subVectors(boneOrigin[childIndex], boneOrigin[i])
    } else {
      const parentIndex = indexOfBone.get(bone.parent as THREE.Bone)
      if (parentIndex !== undefined) boneAxis[i].subVectors(boneOrigin[i], boneOrigin[parentIndex])
    }
    if (boneAxis[i].lengthSq() < 1e-8) boneAxis[i].set(0, 1, 0)
    boneAxis[i].normalize()
  })

  const boneWeight = skeleton.bones.map((bone) => BUILD_WEIGHT[partForBone(bone.name)] ?? 0.5)

  const count = position.count
  const boneOfVertex = new Uint16Array(count)
  const buildWeight = new Float32Array(count)

  for (let v = 0; v < count; v++) {
    let bestWeight = -1
    let bestBone = 0
    for (let j = 0; j < 4; j++) {
      const weight = skinWeight.getComponent(v, j)
      if (weight > bestWeight) {
        bestWeight = weight
        bestBone = skinIndex.getComponent(v, j)
      }
    }
    boneOfVertex[v] = bestBone
    buildWeight[v] = boneWeight[bestBone] ?? 0
  }

  return {
    mesh,
    original: Float32Array.from(position.array as Float32Array),
    boneOfVertex,
    buildWeight,
    boneOrigin,
    boneAxis,
  }
}

/**
 * `build` runs from about -0.3 (slighter) through 0 (as modelled) to +0.6
 * (heavier). Always applied to the stored original, so dragging a control back
 * and forth cannot accumulate error.
 */
export function applyBuild(analysis: BodyAnalysis, build: number) {
  const { mesh, original, boneOfVertex, buildWeight, boneOrigin, boneAxis } = analysis
  const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  const target = position.array as Float32Array

  const point = new THREE.Vector3()
  const along = new THREE.Vector3()

  for (let v = 0; v < boneOfVertex.length; v++) {
    const i = v * 3
    const factor = 1 + build * buildWeight[v]
    if (factor === 1) {
      target[i] = original[i]
      target[i + 1] = original[i + 1]
      target[i + 2] = original[i + 2]
      continue
    }

    const bone = boneOfVertex[v]
    const origin = boneOrigin[bone]
    const axis = boneAxis[bone]

    point.set(original[i] - origin.x, original[i + 1] - origin.y, original[i + 2] - origin.z)
    // Split the offset into the part running along the bone, which is left
    // alone, and the part standing off it, which is what gets scaled.
    along.copy(axis).multiplyScalar(point.dot(axis))
    point.sub(along).multiplyScalar(factor).add(along)

    target[i] = origin.x + point.x
    target[i + 1] = origin.y + point.y
    target[i + 2] = origin.z + point.z
  }

  position.needsUpdate = true
  // Normals are derived from the surface, so without this the lighting keeps
  // describing the old shape and a widened torso looks oddly flat.
  mesh.geometry.computeVertexNormals()
  mesh.geometry.computeBoundingSphere()
}
