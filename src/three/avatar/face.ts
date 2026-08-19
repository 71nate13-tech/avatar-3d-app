import * as THREE from 'three'
import { placeOnHead, type HeadAnchor } from './headAnchor'

/**
 * A cartoon face built from primitives, parented to the head bone.
 *
 * The mannequin's head is a featureless egg: no eyes, no mouth, and no morph
 * targets to drive. Rather than expressions deforming a face that does not
 * exist, the face is added, and an expression moves its parts. Lids close,
 * brows tilt, the mouth arc flips. That is how cartoon faces work anyway, and
 * it reads better at a distance than subtle deformation would.
 */

export type ExpressionName = 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry' | 'wink'

interface ExpressionPose {
  /** 0 shut, 1 wide. Per eye, so a wink is expressible. */
  leftEyeOpen: number
  rightEyeOpen: number
  /** Fraction of head height the brows sit above their resting position. */
  browLift: number
  /** Radians. Positive drives the inner ends down into a scowl. */
  browAngle: number
  /** -1 a full frown, 0 flat, +1 a full smile. */
  mouthCurve: number
  /** 0 closed, 1 wide open. */
  mouthOpen: number
}

const EXPRESSIONS: Record<ExpressionName, ExpressionPose> = {
  neutral: { leftEyeOpen: 1, rightEyeOpen: 1, browLift: 0, browAngle: 0, mouthCurve: 0.1, mouthOpen: 0 },
  happy: { leftEyeOpen: 0.7, rightEyeOpen: 0.7, browLift: 0.05, browAngle: -0.1, mouthCurve: 1, mouthOpen: 0.3 },
  sad: { leftEyeOpen: 0.8, rightEyeOpen: 0.8, browLift: -0.02, browAngle: -0.35, mouthCurve: -1, mouthOpen: 0 },
  surprised: { leftEyeOpen: 1.35, rightEyeOpen: 1.35, browLift: 0.1, browAngle: -0.15, mouthCurve: 0, mouthOpen: 1 },
  angry: { leftEyeOpen: 0.8, rightEyeOpen: 0.8, browLift: -0.03, browAngle: 0.5, mouthCurve: -0.6, mouthOpen: 0 },
  wink: { leftEyeOpen: 1, rightEyeOpen: 0.06, browLift: 0.04, browAngle: -0.1, mouthCurve: 0.85, mouthOpen: 0.2 },
}

export interface FaceRig {
  group: THREE.Group
  setExpression: (name: ExpressionName) => void
  setEyeColor: (color: string) => void
  dispose: () => void
}

// Placement as fractions of the head's half-extents, where 1 is its edge.
const EYE_SPACING = 0.42
const EYE_HEIGHT = 0.1
const BROW_HEIGHT = 0.38
const MOUTH_HEIGHT = -0.34
/** Just proud of the surface, so nothing is swallowed by the skull. */
const FACE_DEPTH = 0.92

export function createFace(anchor: HeadAnchor): FaceRig {
  const group = new THREE.Group()
  const r = anchor.radius

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const track = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g)

  const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f7f7, roughness: 0.4 })
  const irisMaterial = new THREE.MeshStandardMaterial({ color: 0x3b6ea5, roughness: 0.35 })
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1118, roughness: 0.6 })
  materials.push(whiteMaterial, irisMaterial, darkMaterial)

  /** One eye: white, iris, pupil. The whole group squashes to blink. */
  const buildEye = (side: number) => {
    const eye = new THREE.Group()
    // Flattened front to back, so it sits against the skull rather than bulging.
    const white = new THREE.Mesh(track(new THREE.SphereGeometry(r * 0.19, 20, 16)), whiteMaterial)
    white.scale.z = 0.5
    eye.add(white)

    const iris = new THREE.Mesh(track(new THREE.SphereGeometry(r * 0.095, 16, 12)), irisMaterial)
    iris.scale.z = 0.5
    iris.position.z = r * 0.09
    eye.add(iris)

    const pupil = new THREE.Mesh(track(new THREE.SphereGeometry(r * 0.045, 12, 10)), darkMaterial)
    pupil.scale.z = 0.5
    pupil.position.z = r * 0.12
    eye.add(pupil)

    placeOnHead(eye, anchor, side * EYE_SPACING, EYE_HEIGHT, FACE_DEPTH)
    // Turn the eye to face outward, so the iris points where the head points.
    // Children are positioned along local +Z, which lookAt aligns to forward.
    eye.lookAt(eye.position.clone().add(anchor.forward))
    group.add(eye)
    return eye
  }

  const leftEye = buildEye(1)
  const rightEye = buildEye(-1)

  const buildBrow = (side: number) => {
    const brow = new THREE.Mesh(
      track(new THREE.BoxGeometry(r * 0.32, r * 0.06, r * 0.08)),
      darkMaterial,
    )
    placeOnHead(brow, anchor, side * EYE_SPACING, BROW_HEIGHT, FACE_DEPTH * 0.95)
    brow.lookAt(brow.position.clone().add(anchor.forward))
    group.add(brow)
    return brow
  }

  const leftBrow = buildBrow(1)
  const rightBrow = buildBrow(-1)
  const leftBrowRest = leftBrow.position.clone()
  const rightBrowRest = rightBrow.position.clone()

  // The mouth is a half-torus arc. Rolling it half a turn takes a smile to a
  // frown, so one mesh covers the whole range with no geometry rebuild.
  const mouth = new THREE.Mesh(
    track(new THREE.TorusGeometry(r * 0.28, r * 0.05, 10, 28, Math.PI)),
    darkMaterial,
  )
  placeOnHead(mouth, anchor, 0, MOUTH_HEIGHT, FACE_DEPTH)
  mouth.lookAt(mouth.position.clone().add(anchor.forward))
  group.add(mouth)
  const mouthRest = mouth.position.clone()

  const setExpression = (name: ExpressionName) => {
    const pose = EXPRESSIONS[name] ?? EXPRESSIONS.neutral

    // Closing a lid is a vertical squash of the whole eye. Cheap, and at this
    // scale it reads exactly like a blink.
    leftEye.scale.y = Math.max(pose.leftEyeOpen, 0.05)
    rightEye.scale.y = Math.max(pose.rightEyeOpen, 0.05)

    leftBrow.position.copy(leftBrowRest).addScaledVector(anchor.up, pose.browLift * anchor.halfHeight)
    rightBrow.position.copy(rightBrowRest).addScaledVector(anchor.up, pose.browLift * anchor.halfHeight)
    // Mirrored, so one positive angle pulls both inner ends down into a scowl.
    leftBrow.rotation.z = -pose.browAngle
    rightBrow.rotation.z = pose.browAngle

    // A smile is the arc opening upward; rolled over, it becomes a frown.
    const curve = THREE.MathUtils.clamp(pose.mouthCurve, -1, 1)
    mouth.rotation.z = curve >= 0 ? Math.PI : 0
    mouth.scale.set(1, 0.3 + Math.abs(curve) * 0.7 + pose.mouthOpen, 1)
    // A frown pivots about the arc's ends, so nudge it down to keep the corners
    // where a closed mouth had them rather than riding up the face.
    mouth.position
      .copy(mouthRest)
      .addScaledVector(anchor.up, (curve >= 0 ? 0 : -0.06) * anchor.halfHeight)
  }

  setExpression('neutral')

  return {
    group,
    setExpression,
    setEyeColor: (color: string) => irisMaterial.color.set(color),
    dispose: () => {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
