import type { ToastMessage } from '../types'

export interface UiSlice {
  toasts: ToastMessage[]
  savingCount: number
  showToast: (message: string, variant?: 'default' | 'amber') => void
  dismissToast: (id: string) => void
  incSaving: () => void
  decSaving: () => void
}

export const createUiSlice = (set: (fn: (s: any) => any) => void): UiSlice => ({
  toasts: [],
  savingCount: 0,

  showToast(message, variant = 'default') {
    const id = crypto.randomUUID()
    set((s: any) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => {
      set((s: any) => ({ toasts: s.toasts.filter((t: ToastMessage) => t.id !== id) }))
    }, 2500)
  },

  dismissToast(id) {
    set((s: any) => ({ toasts: s.toasts.filter((t: ToastMessage) => t.id !== id) }))
  },

  incSaving() {
    set((s: any) => ({ savingCount: s.savingCount + 1 }))
  },

  decSaving() {
    set((s: any) => ({ savingCount: Math.max(0, s.savingCount - 1) }))
  },
})
