import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Avatars somebody is keeping: ones they were traded, and ones of their own
 * they saved before changing into something else.
 *
 * Only the code is stored, never a decoded copy alongside it. Holding both
 * would mean holding two answers to the same question, and they would drift
 * the first time the decoder changed. The code is the avatar; everything shown
 * about one is derived from it when it is read.
 *
 * This is deliberately local. Trading works by showing each other codes, which
 * needs no account, no server and no connection — two phones in a room can do
 * it. A shared collection would need all three.
 */
export interface KeptAvatar {
  id: string
  /** Who it came from, or what its owner called it. */
  name: string
  code: string
  /** ISO 8601, so it survives being written to storage and read back. */
  savedAt: string
}

interface CollectionStore {
  /** What this device calls itself when handing an avatar over. Remembered so
   *  it is typed once rather than before every trade. */
  ownerName: string
  setOwnerName: (name: string) => void
  avatars: KeptAvatar[]
  /** Returns false when it was already held, so the UI can say so rather than
   *  silently appearing to do nothing. */
  keep: (code: string, name: string) => boolean
  remove: (id: string) => void
  rename: (id: string, name: string) => void
  has: (code: string) => boolean
}

/** Ids only have to be unique within one device's collection, and the code is
 *  already the identity — this just makes a stable React key out of it. */
function idFor(code: string): string {
  return code.slice(0, 12)
}

export const useCollectionStore = create<CollectionStore>()(
  persist(
    (set, get) => ({
      ownerName: '',
      setOwnerName: (ownerName) => set({ ownerName }),
      avatars: [],

      keep: (code, name) => {
        if (get().avatars.some((a) => a.code === code)) return false
        const kept: KeptAvatar = {
          id: idFor(code),
          name: name.trim() || 'Unnamed',
          code,
          savedAt: new Date().toISOString(),
        }
        // Newest first: a collection is read from the top, and the one just
        // traded is the one being looked for.
        set((s) => ({ avatars: [kept, ...s.avatars] }))
        return true
      },

      remove: (id) => set((s) => ({ avatars: s.avatars.filter((a) => a.id !== id) })),

      rename: (id, name) =>
        set((s) => ({
          avatars: s.avatars.map((a) =>
            a.id === id ? { ...a, name: name.trim() || a.name } : a,
          ),
        })),

      has: (code) => get().avatars.some((a) => a.code === code),
    }),
    {
      name: 'avatar-collection',
      version: 1,
      partialize: (state) => ({ avatars: state.avatars, ownerName: state.ownerName }),
    },
  ),
)
