import { create } from 'zustand'

/**
 * UI state only. Server data (recipes, tags, ingredients, pantry, meal plan) lives in TanStack Query (`src/api`);
 * the global toast message lives in `toastStore.ts`.
 */
export interface UiStore {
  selectedId: string | null
  selectRecipe: (id: string | null) => void
}

export const useStore = create<UiStore>()((set) => ({
  selectedId: null,
  selectRecipe: (id) => set({ selectedId: id }),
}))
