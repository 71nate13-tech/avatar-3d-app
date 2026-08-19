import { create } from 'zustand'

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

export const useDanceStore = create<DanceStore>((set) => ({
  available: [],
  current: null,
  status: 'loading',
  setAvailable: (available) => set({ available }),
  setCurrent: (current) => set({ current }),
  setStatus: (status) => set({ status }),
}))
