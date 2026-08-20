import {
  DEFAULT_APPEARANCE,
  type AvatarAppearance,
} from '../stores/avatarStore'
import type { TopStyle, BottomStyle } from '../three/avatar/clothing'
import type { ExpressionName } from '../three/avatar/face'
import type { HairStyle } from '../three/avatar/hair'
import type { HatStyle, GlassesStyle, EarringStyle } from '../three/avatar/accessories'

/**
 * An avatar as a short string, so it can be traded.
 *
 * The avatar is not a mesh we author — it is a recipe: a body plus a set of
 * choices. So what gets handed over is the recipe, which means an entire
 * character fits in 52 characters instead of several megabytes, survives being
 * texted or written down, and stays editable once it arrives. It also sidesteps
 * redistributing the model, since nothing about the model is in here.
 *
 * The layout is fixed at 39 bytes, which is divisible by three and therefore
 * encodes to base64 with no padding — the code is always exactly 52 characters.
 *
 *   0        version
 *   1..27    nine colours, three bytes each
 *   28..36   nine style choices, one byte each
 *   37       height
 *   38       build
 *
 * A byte per style is more than any of these lists needs, and that is the
 * point: they can grow to 256 entries before the layout has to change.
 */

const VERSION = 1
const BYTES = 39

/**
 * The wire order of every choice, which is NOT the order they appear in the UI.
 *
 * These lists are append-only forever. Reordering one silently repaints every
 * code ever generated — an avatar traded last week would come back wearing
 * somebody else's hair — and nothing would throw to say so. Add to the end,
 * never rearrange, and if an entry is retired leave a hole rather than closing
 * it up. That is also why these are spelled out here rather than derived from
 * the UI lists in `hair.ts` and `accessories.ts`: those exist to be reordered
 * whenever the panel reads better a different way.
 */
const HAIR_ORDER: HairStyle[] = [
  'none', 'buzz', 'coils', 'afro', 'locs', 'braids', 'ponytail', 'long',
]
const EXPRESSION_ORDER: ExpressionName[] = [
  'neutral', 'happy', 'sad', 'surprised', 'angry', 'wink',
]
const TOP_ORDER: TopStyle[] = ['none', 'tank', 'tshirt', 'long']
const BOTTOM_ORDER: BottomStyle[] = ['none', 'shorts', 'trousers']
const HAT_ORDER: HatStyle[] = ['none', 'beanie', 'cap', 'brim']
const GLASSES_ORDER: GlassesStyle[] = ['none', 'round', 'square']
const EARRING_ORDER: EarringStyle[] = ['none', 'studs', 'hoops']

/** Slider ranges, matched to the controls so a decoded value lands on a step
 *  the UI can actually show rather than between two of them. */
const HEIGHT = { min: 0.88, max: 1.12, step: 0.005 }
const BUILD = { min: -0.3, max: 0.6, step: 0.02 }

function packColor(hex: string, into: Uint8Array, at: number) {
  // A colour can come from the free picker as well as the palette, so it is
  // stored as the actual value rather than an index into a list.
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean
  const n = Number.parseInt(full, 16)
  if (!Number.isFinite(n) || full.length !== 6) {
    into[at] = 0
    into[at + 1] = 0
    into[at + 2] = 0
    return
  }
  into[at] = (n >> 16) & 0xff
  into[at + 1] = (n >> 8) & 0xff
  into[at + 2] = n & 0xff
}

function unpackColor(bytes: Uint8Array, at: number): string {
  const hex = ((bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2])
    .toString(16)
    .padStart(6, '0')
  return `#${hex}`
}

function quantize(value: number, range: { min: number; max: number }): number {
  const t = (value - range.min) / (range.max - range.min)
  return Math.max(0, Math.min(255, Math.round(t * 255)))
}

function dequantize(byte: number, range: { min: number; max: number; step: number }): number {
  const raw = range.min + (byte / 255) * (range.max - range.min)
  // Snapped, so a decoded avatar sits on a slider step instead of a hair's
  // breadth off one, where the readout would disagree with the handle.
  const snapped = Math.round(raw / range.step) * range.step
  return Number(snapped.toFixed(4))
}

/** Falls back rather than failing: a code from a newer build naming a hair
 *  style this one has never heard of should still produce an avatar. */
function indexOf<T>(order: T[], value: T): number {
  const i = order.indexOf(value)
  return i < 0 ? 0 : i
}

function valueAt<T>(order: T[], byte: number, fallback: T): T {
  return order[byte] ?? fallback
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const standard = text.replace(/-/g, '+').replace(/_/g, '/')
    // Re-padded because the encoder strips it. At 39 bytes there is never any
    // to strip, but a hand-typed or older code might carry some.
    const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

export function encodeAppearance(a: AvatarAppearance): string {
  const bytes = new Uint8Array(BYTES)
  bytes[0] = VERSION

  packColor(a.skinColor, bytes, 1)
  packColor(a.hairColor, bytes, 4)
  packColor(a.eyeColor, bytes, 7)
  packColor(a.topColor, bytes, 10)
  packColor(a.bottomColor, bytes, 13)
  packColor(a.shoesColor, bytes, 16)
  packColor(a.glovesColor, bytes, 19)
  packColor(a.hatColor, bytes, 22)
  packColor(a.accentColor, bytes, 25)

  bytes[28] = indexOf(HAIR_ORDER, a.hairStyle)
  bytes[29] = indexOf(EXPRESSION_ORDER, a.expression)
  bytes[30] = indexOf(TOP_ORDER, a.outfit.top)
  bytes[31] = indexOf(BOTTOM_ORDER, a.outfit.bottom)
  bytes[32] = a.outfit.shoes ? 1 : 0
  bytes[33] = a.outfit.gloves ? 1 : 0
  bytes[34] = indexOf(HAT_ORDER, a.hat)
  bytes[35] = indexOf(GLASSES_ORDER, a.glasses)
  bytes[36] = indexOf(EARRING_ORDER, a.earrings)

  bytes[37] = quantize(a.height, HEIGHT)
  bytes[38] = quantize(a.build, BUILD)

  return toBase64Url(bytes)
}

/** Null for anything that is not a code this build can read, so a mistyped
 *  string is reported rather than silently becoming a default avatar. */
export function decodeAppearance(code: string): AvatarAppearance | null {
  const trimmed = code.trim()
  if (!trimmed) return null

  const bytes = fromBase64Url(trimmed)
  if (!bytes || bytes.length !== BYTES) return null
  if (bytes[0] !== VERSION) return null

  const d = DEFAULT_APPEARANCE
  return {
    skinColor: unpackColor(bytes, 1),
    hairColor: unpackColor(bytes, 4),
    eyeColor: unpackColor(bytes, 7),
    topColor: unpackColor(bytes, 10),
    bottomColor: unpackColor(bytes, 13),
    shoesColor: unpackColor(bytes, 16),
    glovesColor: unpackColor(bytes, 19),
    hatColor: unpackColor(bytes, 22),
    accentColor: unpackColor(bytes, 25),
    hairStyle: valueAt(HAIR_ORDER, bytes[28], d.hairStyle),
    expression: valueAt(EXPRESSION_ORDER, bytes[29], d.expression),
    outfit: {
      top: valueAt(TOP_ORDER, bytes[30], d.outfit.top),
      bottom: valueAt(BOTTOM_ORDER, bytes[31], d.outfit.bottom),
      shoes: bytes[32] === 1,
      gloves: bytes[33] === 1,
    },
    hat: valueAt(HAT_ORDER, bytes[34], d.hat),
    glasses: valueAt(GLASSES_ORDER, bytes[35], d.glasses),
    earrings: valueAt(EARRING_ORDER, bytes[36], d.earrings),
    height: dequantize(bytes[37], HEIGHT),
    build: dequantize(bytes[38], BUILD),
  }
}

/** Reads a shared avatar out of the address bar, the same way a moment is
 *  read, because a QR code has to encode something a camera will just open. */
export function avatarFromUrl(): { code: string; name: string | null } | null {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('avatar')
  if (!code) return null
  return { code, name: params.get('by') }
}

/** How long a traded avatar's name may be. Long enough to be a name, short
 *  enough that it cannot bloat the code it travels with. */
export const MAX_NAME = 24

/**
 * The URL a code should encode, built from wherever the app is being served so
 * one scanned on the same network reaches the same place.
 *
 * The name rides alongside the payload rather than inside it. That keeps the
 * binary layout fixed — it is the reason a code is always the same length —
 * and has the side effect of leaving the name readable in the URL, so a link
 * pasted into a message says who it is from before anybody opens it.
 */
export function avatarUrl(code: string, name?: string | null): string {
  const url = new URL(window.location.href)
  const params = new URLSearchParams({ avatar: code })
  const clean = name?.trim().slice(0, MAX_NAME)
  if (clean) params.set('by', clean)
  url.search = `?${params.toString()}`
  url.hash = ''
  return url.toString()
}
