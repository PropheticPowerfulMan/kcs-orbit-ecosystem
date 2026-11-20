import { create } from 'zustand'
/** Ephemeral UI state only: never persisted and never contains an image or an identity. */
export const usePhotoPreparationStore = create<{ pending: Record<string, true>; setPending: (id: string, busy: boolean) => void }>(set => ({
  pending: {}, setPending: (id, busy) => set(state => { const pending = { ...state.pending }; if (busy) pending[id] = true; else delete pending[id]; return { pending } }),
}))
