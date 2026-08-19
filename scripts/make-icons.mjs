import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Draws the app icon from vector shapes and writes the source PNGs that
 * `capacitor-assets generate` expands into every platform size.
 *
 * The artwork lives here as code rather than as a binary in the repo, so it can
 * be adjusted and regenerated instead of being re-drawn from scratch. Run with
 * `npm run icons`.
 *
 * Design notes: a dancing figure with an afro, over an orbit ring. Those are
 * the three things the app actually does, and a launcher icon is often seen at
 * 48px, so it is built from a handful of bold shapes with one strong contrast
 * rather than anything detailed enough to turn to mush at that size.
 */

const here = dirname(fileURLToPath(import.meta.url))
const assets = join(here, '..', 'assets')

const INK = '#fff3e6'
const ACCENT = '#ffb86b'

/** The dancer and their orbit, centred in a 1024 box. `scale` shrinks the
 *  subject to sit inside the safe zone Android crops adaptive icons to. */
const subject = (scale) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <ellipse cx="512" cy="588" rx="352" ry="126" fill="none"
             stroke="${ACCENT}" stroke-opacity="0.85" stroke-width="26"
             transform="rotate(-18 512 588)"/>
    <g fill="${INK}" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="512" cy="286" r="92"/>
      <circle cx="512" cy="218" r="50"/>
      <circle cx="430" cy="256" r="50"/>
      <circle cx="594" cy="256" r="50"/>
      <circle cx="446" cy="334" r="46"/>
      <circle cx="578" cy="334" r="46"/>
      <line x1="512" y1="352" x2="512" y2="416" stroke-width="46"/>
      <line x1="512" y1="424" x2="512" y2="596" stroke-width="100"/>
      <!-- Both arms leave the same shoulder point: starting them apart left a
           notch where the two round caps failed to meet. -->
      <line x1="512" y1="470" x2="700" y2="322" stroke-width="54"/>
      <line x1="512" y1="470" x2="330" y2="392" stroke-width="54"/>
      <line x1="512" y1="592" x2="404" y2="800" stroke-width="62"/>
      <line x1="512" y1="592" x2="628" y2="776" stroke-width="62"/>
    </g>
  </g>`

const backdrop = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b1f5c"/>
      <stop offset="1" stop-color="#6d3fa8"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>`

const svg = (body) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`,
  )

const files = [
  // The square icon, for launchers that do not use adaptive icons.
  ['icon.png', svg(backdrop + subject(0.86)), 1024],
  // Adaptive icons are two layers: Android crops them to whatever mask the
  // launcher uses, and shifts them slightly as the phone tilts. The subject is
  // scaled down so the mask never clips a limb off.
  ['icon-foreground.png', svg(subject(0.62)), 1024],
  ['icon-background.png', svg(backdrop), 1024],
  // Splash is one square, centre-cropped to whatever the screen shape is, so
  // the subject sits small and central with plenty of margin.
  ['splash.png', svg(backdrop + subject(0.34)), 2732],
  ['splash-dark.png', svg(backdrop + subject(0.34)), 2732],
]

await mkdir(assets, { recursive: true })

for (const [name, source, size] of files) {
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(assets, name))
  console.log(`wrote assets/${name} (${size}x${size})`)
}
