/**
 * The dances the UI offers, and where their files live.
 *
 * `id` doubles as the filename stem under `public/models/dances/`, so adding a
 * dance means dropping in `<id>.fbx` and adding a line here. Missing files are
 * skipped at load time rather than breaking the others.
 */
export interface Dance {
  id: string
  label: string
}

/** Built from BASE_URL rather than a leading slash, so the same code resolves
 *  under the dev server, a packaged Electron app loading over file://, and the
 *  Android bundle. An absolute path works only in the first of those. */
const MODELS_BASE = `${import.meta.env.BASE_URL}models`

export const CHARACTER_URL = `${MODELS_BASE}/character.fbx`

/**
 * The character file was exported With Skin, so it already carries the clip
 * that was selected when it was downloaded. Naming it here uses that clip
 * instead of fetching and parsing the same few megabytes a second time.
 */
export const EMBEDDED_CLIP_ID = 'idle'

export const DANCES: Dance[] = [
  { id: EMBEDDED_CLIP_ID, label: 'Idle' },
  { id: 'hiphop', label: 'Hip Hop' },
  { id: 'salsa', label: 'Salsa' },
  { id: 'robot', label: 'Robot' },
  { id: 'shuffle', label: 'Shuffle' },
  { id: 'uprock', label: 'Uprock' },
  { id: 'rumba', label: 'Rumba' },
  { id: 'house', label: 'House' },
]

export const DANCE_URLS: Record<string, string> = Object.fromEntries(
  DANCES.filter((d) => d.id !== EMBEDDED_CLIP_ID).map((d) => [
    d.id,
    `${MODELS_BASE}/dances/${d.id}.fbx`,
  ]),
)
