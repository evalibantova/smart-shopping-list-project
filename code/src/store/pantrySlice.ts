import { StateCreator } from 'zustand'
import type { PantryItem } from '../types/pantry'
import { getAll, create, update, remove } from '../features/pantry/services/pantryService'

export interface PantrySlice {
  pantryItems: PantryItem[]
  initPantry: () => void
  addPantryItem: (data: Omit<PantryItem, 'id' | 'maxStock'> & { maxStock?: number }) => void
  updatePantryItem: (id: string, patch: Partial<PantryItem>) => void
  deletePantryItem: (id: string) => void
}

export const pantrySlice: StateCreator<PantrySlice> = (set, get) => ({
  pantryItems: [],

  initPantry: () => {
    const items = getAll()
    set({ pantryItems: items })
  },

  addPantryItem: (data: Omit<PantryItem, 'id' | 'maxStock'> & { maxStock?: number }) => {
    const tempId = crypto.randomUUID()
    const optimistic: PantryItem = {
      id: tempId,
      ingredientId: data.ingredientId,
      quantity: data.quantity,
      maxStock: data.maxStock ?? Math.max(1, data.quantity * 3),
    }
    set((state) => ({ pantryItems: [...state.pantryItems, optimistic] }))
    try {
      const saved = create(data)
      set((state) => ({
        pantryItems: state.pantryItems.map((item) =>
          item.id === tempId ? saved : item
        ),
      }))
    } catch {
      set((state) => ({
        pantryItems: state.pantryItems.filter((item) => item.id !== tempId),
      }))
      throw new Error('Could not save pantry item — please try again.')
    }
  },

  updatePantryItem: (id, patch) => {
    const prev = get().pantryItems.find((item) => item.id === id)
    if (!prev) return
    set((state) => ({
      pantryItems: state.pantryItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }))
    try {
      update(id, patch)
    } catch {
      set((state) => ({
        pantryItems: state.pantryItems.map((item) =>
          item.id === id ? prev : item
        ),
      }))
      throw new Error('Could not save pantry item — please try again.')
    }
  },

  deletePantryItem: (id) => {
    const prev = get().pantryItems.find((item) => item.id === id)
    if (!prev) return
    set((state) => ({
      pantryItems: state.pantryItems.filter((item) => item.id !== id),
    }))
    try {
      remove(id)
    } catch {
      set((state) => ({
        pantryItems: [...state.pantryItems, prev],
      }))
      throw new Error('Could not delete pantry item — please try again.')
    }
  },
})
