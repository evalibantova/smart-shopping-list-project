import { create } from 'zustand'

interface ToastState {
  message: string
  show: (message: string) => void
  dismiss: () => void
}

/** UI state: the one message the global toast shows (failed optimistic writes report through it). */
export const useToastStore = create<ToastState>()((set) => ({
  message: '',
  show: (message) => set({ message }),
  dismiss: () => set({ message: '' }),
}))
