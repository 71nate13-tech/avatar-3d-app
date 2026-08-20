/**
 * Brand moments: what somebody sees after scanning a code out in the world.
 *
 * The whole idea rests on the avatar already being theirs. Scanning does not
 * hand you a generic advert — it drops the character you built into a brand's
 * scene. So a moment carries only the staging: a look, a dance, and something
 * to say. Everything about who is standing there comes from the saved avatar.
 *
 * These are samples. In the real thing a brand would be a record somewhere
 * rather than a line in this file, but the shape would be the same.
 */
export interface Moment {
  id: string
  brand: string
  headline: string
  caption: string
  /** Dance id from `data/dances`, played on arrival. */
  dance: string
  /** CSS background behind the transparent canvas. Gradients are the cheapest
   *  way to make each brand feel like a different place. */
  background: string
  /** The floor the avatar stands on. */
  ground: string
  /** Text colour that stays legible against the background above. */
  ink: string
}

export const MOMENTS: Moment[] = [
  {
    id: 'cafe',
    brand: 'Rise & Grind',
    headline: 'Your 3pm is served',
    caption: 'Show this at the counter for a free pastry',
    dance: 'idle',
    background: 'linear-gradient(160deg, #3b2417 0%, #7a4a24 55%, #c98f4b 100%)',
    ground: '#4a3120',
    ink: '#ffeede',
  },
  {
    id: 'festival',
    brand: 'Northside Festival',
    headline: 'You are on the list',
    caption: 'Main stage, Saturday, 9pm',
    dance: 'hiphop',
    background: 'linear-gradient(160deg, #1a0f3d 0%, #5b2a86 50%, #d94f8a 100%)',
    ground: '#241546',
    ink: '#ffe9f4',
  },
  {
    id: 'trainers',
    brand: 'Kerb Athletics',
    headline: 'Try the new drop',
    caption: 'Scan in store to see them on you',
    dance: 'shuffle',
    background: 'linear-gradient(160deg, #06231d 0%, #0f6b52 55%, #4ecfa0 100%)',
    ground: '#0c3329',
    ink: '#e6fff5',
  },
]

export function findMoment(id: string | null): Moment | null {
  if (!id) return null
  return MOMENTS.find((moment) => moment.id === id) ?? null
}

/** Reads the moment from the address bar. A plain query parameter, because a
 *  QR code has to encode something a phone camera will simply open. */
export function momentFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('moment')
}

/** The URL a code should encode, built from wherever the app is being served
 *  so a code scanned on the same network reaches the same place. */
export function momentUrl(id: string): string {
  const url = new URL(window.location.href)
  url.search = `?moment=${encodeURIComponent(id)}`
  url.hash = ''
  return url.toString()
}
