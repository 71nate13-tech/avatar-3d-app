import * as THREE from 'three'

/**
 * Finds the head bone and measures the head, so face and hair can be built to
 * fit whatever character is loaded.
 *
 * Everything is expressed in the head bone's own space, because features get
 * added as children of that bone. That is what makes them ride along with the
 * skeleton: no per-frame work, no syncing, and they stay attached through every
 * dance because the bone is already being animated.
 *
 * Sizes are measured rather than hardcoded. A hardcoded eye radius is only
 * correct for one character at one export scale, and Mixamo exports in
 * centimetres while the scene is in metres — exactly the kind of mismatch that
 * puts eyes somewhere behind the skull.
 */
export interface HeadAnchor {
  bone: THREE.Bone
  /** Head centre, in bone-local space. */
  center: THREE.Vector3
  /** Average half-extent, for sizing features. */
  radius: number
  /** Half-extents along each axis. A head is noticeably taller than it is deep,
   *  so placing by a single radius pushes the face off the front of the skull. */
  halfWidth: number
  halfHeight: number
  halfDepth: number
  /** Out of the face, in bone-local space. */
  forward: THREE.Vector3
  up: THREE.Vector3
  right: THREE.Vector3
}

function findHeadBone(skeleton: THREE.Skeleton): THREE.Bone | null {
  // `HeadTop_End` is a leaf marker at the crown rather than the head itself, so
  // it must not win the match.
  const bones = skeleton.bones.filter((b) => /head/i.test(b.name) && !/top|end/i.test(b.name))
  return bones[0] ?? null
}

/**
 * Must run before any animation is played: this measures the mesh in its bind
 * pose, where the plain vertex positions still line up with the skeleton.
 */
export function measureHead(mesh: THREE.SkinnedMesh): HeadAnchor | null {
  const skeleton = mesh.skeleton
  if (!skeleton) return null

  const bone = findHeadBone(skeleton)
  if (!bone) return null

  const headBoneIndices = new Set(
    skeleton.bones.map((b, i) => (/head/i.test(b.name) ? i : -1)).filter((i) => i >= 0),
  )

  const position = mesh.geometry.getAttribute('position')
  const skinIndex = mesh.geometry.getAttribute('skinIndex')
  const skinWeight = mesh.geometry.getAttribute('skinWeight')
  if (!position || !skinIndex || !skinWeight) return null

  const headIndex = skeleton.bones.indexOf(bone)
  const boneInverse = skeleton.boneInverses[headIndex]
  if (!boneInverse) return null

  // Work in the bone's *bind* space rather than its current world transform.
  // An FBX stores node transforms at the first animation frame, not at the bind
  // pose, so the live bone matrix and the plain vertex positions describe two
  // different poses — mixing them puts the face somewhere behind the skull.
  // Going through the inverse bind matrix also sidesteps the export scale
  // entirely: the result is already in the units a child of this bone uses.
  const toBoneSpace = new THREE.Matrix4().multiplyMatrices(boneInverse, mesh.bindMatrix)

  // Bone axes are arbitrary, so take the model's own axes and convert. Mixamo
  // characters look down +Z with +Y up in their bind pose.
  const rotation = new THREE.Matrix3().setFromMatrix4(toBoneSpace)
  const forward = new THREE.Vector3(0, 0, 1).applyMatrix3(rotation).normalize()
  const up = new THREE.Vector3(0, 1, 0).applyMatrix3(rotation).normalize()
  const right = new THREE.Vector3().crossVectors(up, forward).normalize()

  // Measure along the face's own axes rather than the bone's. An axis-aligned
  // box in bone space would be measuring a tilted head along the wrong
  // directions, which shifts the eyes off-centre.
  const vertex = new THREE.Vector3()
  let found = 0
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const axes = [right, up, forward]

  for (let v = 0; v < position.count; v++) {
    let bestWeight = -1
    let bestBone = 0
    for (let j = 0; j < 4; j++) {
      const weight = skinWeight.getComponent(v, j)
      if (weight > bestWeight) {
        bestWeight = weight
        bestBone = skinIndex.getComponent(v, j)
      }
    }
    if (!headBoneIndices.has(bestBone)) continue
    vertex.fromBufferAttribute(position, v).applyMatrix4(toBoneSpace)
    for (let a = 0; a < 3; a++) {
      const d = vertex.dot(axes[a])
      if (d < min[a]) min[a] = d
      if (d > max[a]) max[a] = d
    }
    found++
  }

  if (found === 0) return null

  const halfWidth = (max[0] - min[0]) / 2
  const halfHeight = (max[1] - min[1]) / 2
  const halfDepth = (max[2] - min[2]) / 2
  const radius = (halfWidth + halfHeight + halfDepth) / 3

  const center = new THREE.Vector3()
    .addScaledVector(right, (max[0] + min[0]) / 2)
    .addScaledVector(up, (max[1] + min[1]) / 2)
    .addScaledVector(forward, (max[2] + min[2]) / 2)

  console.info(
    '[avatar] head:', bone.name,
    'vertices:', found,
    'half w/h/d:', halfWidth.toFixed(1), halfHeight.toFixed(1), halfDepth.toFixed(1),
  )

  return { bone, center, radius, halfWidth, halfHeight, halfDepth, forward, up, right }
}

/**
 * Places an object using head-relative fractions, where 1 is the edge of the
 * head along that axis. Each axis is scaled by its own half-extent, so
 * `forward: 0.9` lands just proud of the face whether the head is round or long.
 */
export function placeOnHead(
  object: THREE.Object3D,
  anchor: HeadAnchor,
  right: number,
  up: number,
  forward: number,
) {
  object.position
    .copy(anchor.center)
    .addScaledVector(anchor.right, right * anchor.halfWidth)
    .addScaledVector(anchor.up, up * anchor.halfHeight)
    .addScaledVector(anchor.forward, forward * anchor.halfDepth)
}
