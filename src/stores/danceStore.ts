import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Which dances actually loaded, and which one is running. */
interface DanceStore {
  /** Ids of dances whose files were found. Empty while loading, or when the
   *  primitive fallback figure is in use — it has no skeleton to animate. */
  available: string[]
  current: string | null
  status: 'loading' | 'ready' | 'fallback'

  setAvailable: (ids: string[]) => void
  setCurrent: (id: string | null) => void
  setStatus: (status: DanceStore['status']) => void
}

/**
 * Only the chosen dance is saved. `available` and `status` describe what this
 * run managed to load, so restoring them would claim dances exist before
 * anything has been read from disk.
 *
 * A saved choice is still checked against what actually loaded before it is
 * played — model files can be removed between launches.
 */
export const useDanceStore = create<DanceStore>()(
  persist(
    (set) => ({
      available: [],
      current: null,
      status: 'loading',
      setAvailable: (available) => set({ available }),
      setCurrent: (current) => set({ current }),
      setStatus: (status) => set({ status }),
    }),
    {
      name: 'avatar-dance',
      version: 1,
      partialize: (state) => ({ current: state.current }),
    },
  ),
)
