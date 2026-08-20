import { describe, it, expect } from 'vitest'
import { encodeAppearance, decodeAppearance } from './avatarCode'
import { DEFAULT_APPEARANCE, type AvatarAppearance } from '../stores/avatarStore'
import { HAIR_STYLES } from '../three/avatar/hair'
import { HAT_STYLES, GLASSES_STYLES, EARRING_STYLES } from '../three/avatar/accessories'

/**
 * A traded code outlives the build that made it, so the failures worth
 * catching here are the silent ones: a code that still decodes, still looks
 * like an avatar, and is quietly the wrong avatar.
 */

const FULLY_DRESSED: AvatarAppearance = {
  skinColor: '#5c3317',
  hairColor: '#d94f8a',
  eyeColor: '#2e6b4f',
  topColor: '#c04b4b',
  bottomColor: '#232329',
  shoesColor: '#e8e8e8',
  glovesColor: '#1f7a5c',
  hatColor: '#8e4585',
  accentColor: '#c9a227',
  hat: 'cap',
  glasses: 'round',
  earrings: 'hoops',
  outfit: { top: 'long', bottom: 'shorts', shoes: true, gloves: true },
  hairStyle: 'braids',
  expression: 'wink',
  height: 1.075,
  build: 0.34,
}

describe('round trip', () => {
  it('returns the default appearance unchanged', () => {
    expect(decodeAppearance(encodeAppearance(DEFAULT_APPEARANCE))).toEqual(DEFAULT_APPEARANCE)
  })

  it('returns a fully dressed appearance unchanged', () => {
    expect(decodeAppearance(encodeAppearance(FULLY_DRESSED))).toEqual(FULLY_DRESSED)
  })

  it('keeps a colour the palette does not contain', () => {
    // Every control has a free picker, which is why colours are stored as
    // values rather than as indexes into the palette.
    const custom = { ...DEFAULT_APPEARANCE, skinColor: '#123456', hairColor: '#abcdef' }
    const back = decodeAppearance(encodeAppearance(custom))
    expect(back?.skinColor).toBe('#123456')
    expect(back?.hairColor).toBe('#abcdef')
  })

  it('is always 52 characters, whatever the avatar', () => {
    for (const a of [DEFAULT_APPEARANCE, FULLY_DRESSED]) {
      expect(encodeAppearance(a)).toHaveLength(52)
    }
    // No padding to strip, and nothing a URL would escape.
    expect(encodeAppearance(FULLY_DRESSED)).toMatch(/^[A-Za-z0-9_-]{52}$/)
  })
})

describe('every choice the UI offers survives the trip', () => {
  // The bug this is here for: a style is added to the panel and forgotten in
  // the codec's wire order, so it encodes as index 0 and everybody who trades
  // that avatar hands over a bald one. Nothing throws when that happens.
  it.each(HAIR_STYLES.map((s) => s.value))('hair: %s', (hairStyle) => {
    const back = decodeAppearance(encodeAppearance({ ...DEFAULT_APPEARANCE, hairStyle }))
    expect(back?.hairStyle).toBe(hairStyle)
  })

  it.each(HAT_STYLES.map((s) => s.value))('hat: %s', (hat) => {
    expect(decodeAppearance(encodeAppearance({ ...DEFAULT_APPEARANCE, hat }))?.hat).toBe(hat)
  })

  it.each(GLASSES_STYLES.map((s) => s.value))('glasses: %s', (glasses) => {
    expect(decodeAppearance(encodeAppearance({ ...DEFAULT_APPEARANCE, glasses }))?.glasses).toBe(
      glasses,
    )
  })

  it.each(EARRING_STYLES.map((s) => s.value))('earrings: %s', (earrings) => {
    expect(decodeAppearance(encodeAppearance({ ...DEFAULT_APPEARANCE, earrings }))?.earrings).toBe(
      earrings,
    )
  })
})

describe('sliders', () => {
  it('lands on a step the control can actually show', () => {
    for (let h = 0.88; h <= 1.1201; h += 0.005) {
      const back = decodeAppearance(encodeAppearance({ ...DEFAULT_APPEARANCE, height: h }))!
      // Quantising to a byte cannot be lossless, but it must not drift far
      // enough that the handle sits visibly off where it was left.
      expect(Math.abs(back.height - h)).toBeLessThanOrEqual(0.005)
      expect(Math.round(back.height / 0.005) * 0.005).toBeCloseTo(back.height, 6)
    }
  })

  it('keeps the extremes exactly', () => {
    const low = decodeAppearance(encodeAppearance({ ...DEFAULT_APPEARANCE, height: 0.88, build: -0.3 }))
    const high = decodeAppearance(encodeAppearance({ ...DEFAULT_APPEARANCE, height: 1.12, build: 0.6 }))
    expect(low?.height).toBe(0.88)
    expect(low?.build).toBe(-0.3)
    expect(high?.height).toBe(1.12)
    expect(high?.build).toBe(0.6)
  })
})

describe('rejects what it cannot read', () => {
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['not base64', '!!!!not a code!!!!'],
    ['too short', 'AQIDBA'],
    ['too long', encodeAppearance(DEFAULT_APPEARANCE) + 'AAAA'],
  ])('%s', (_label, code) => {
    expect(decodeAppearance(code)).toBeNull()
  })

  it('refuses a version it does not know', () => {
    const bytes = Uint8Array.from(atob(encodeAppearance(DEFAULT_APPEARANCE)), (c) => c.charCodeAt(0))
    bytes[0] = 99
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    const future = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeAppearance(future)).toBeNull()
  })

  it('tolerates surrounding whitespace, since codes get pasted', () => {
    const code = encodeAppearance(FULLY_DRESSED)
    expect(decodeAppearance(`  ${code}\n`)).toEqual(FULLY_DRESSED)
  })
})

describe('the wire order is frozen', () => {
  /**
   * A golden code, pinned deliberately.
   *
   * Reordering any list in `avatarCode.ts` repaints every code ever generated
   * — an avatar traded last week comes back wearing somebody else's hair — and
   * nothing else in the codebase would notice. If this fails and the layout
   * change was intentional, bump VERSION rather than editing the string.
   */
  it('still produces the same code for the same avatar', () => {
    expect(encodeAppearance(FULLY_DRESSED)).toBe('AVwzF9lPii5rT8BLSyMjKejo6B96XI5FhcmiJwUFAwEBAQIBAs-1')
  })
})
