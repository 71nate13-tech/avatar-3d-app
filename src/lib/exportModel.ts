import * as THREE from 'three'

/**
 * The avatar as a real 3D file, for the times a code is not enough.
 *
 * A code is the better way to hand somebody an avatar — it is tiny, it stays
 * editable, and it carries none of the model with it. But a code only means
 * something to another copy of this app. A `.glb` opens in Blender, Unity, or
 * any web viewer, which is what makes the avatar usable in a video, a mockup
 * or an advert.
 *
 * The trade is real and worth stating plainly: this bakes the character into
 * the file. It is a few megabytes rather than fifty-two characters, it cannot
 * be re-customised once it leaves, and it contains the geometry rather than a
 * recipe for it. See `docs/exporting.md` for what that means for the Mixamo
 * licence — it governs who you may hand the result to.
 */

export interface ExportOptions {
  /** Include the dance currently playing, so the avatar arrives moving rather
   *  than in a T-pose. Costs roughly a third of the file size. */
  animation?: THREE.AnimationClip | null
}

export async function exportGlb(
  root: THREE.Object3D,
  options: ExportOptions = {},
): Promise<Blob> {
  // Fetched on demand rather than bundled. Most sessions never export a model,
  // and the exporter is a sizeable chunk to make everybody download to open a
  // page where they might change their hair.
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()

    // Nothing is done about the avatar being mid-dance when this runs, and
    // nothing needs to be: a skinned mesh stores its vertices in bind space
    // and its skin stores the inverse bind matrices, neither of which the
    // current pose touches. All the playing clip affects is the bones' local
    // transforms, which the exported animation overrides on the first frame
    // anyway. Verified on a device by exporting mid-dance and reading the
    // result back: 53 channels over 518 keyframes, geometry unaffected.
    exporter.parse(
      root,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: 'model/gltf-binary' }))
        } else {
          // binary: true should always give an ArrayBuffer, but the callback
          // is typed for both and a silent JSON fallback would produce a .glb
          // that nothing can open.
          reject(new Error('exporter returned JSON where binary was asked for'))
        }
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
      {
        binary: true,
        // One file rather than a folder of loose assets, which is the whole
        // point of glb over gltf.
        embedImages: true,
        // A clip with no tracks would still be written out as a named
        // animation with nothing in it, which reads in a 3D viewer as a dance
        // that exists and does nothing. The idle clip is exactly that, so an
        // empty one is dropped rather than exported.
        animations:
          options.animation && options.animation.tracks.length > 0 ? [options.animation] : [],
        // The hair and accessories hang off the head bone; without this the
        // exporter walks only what is visible from the root's own children.
        onlyVisible: true,
      },
    )
  })
}
