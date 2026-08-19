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

export const DANCES: Dance[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'hiphop', label: 'Hip Hop' },
  { id: 'salsa', label: 'Salsa' },
  { id: 'robot', label: 'Robot' },
  { id: 'shuffle', label: 'Shuffle' },
]

export const CHARACTER_URL = '/models/character.fbx'

export const DANCE_URLS: Record<string, string> = Object.fromEntries(
  DANCES.map((d) => [d.id, `/models/dances/${d.id}.fbx`]),
)
