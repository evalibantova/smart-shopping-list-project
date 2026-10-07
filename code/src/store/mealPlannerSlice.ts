import { StateCreator } from 'zustand'
import { MealPlanEntry } from '../types/mealPlan'
import { getAll } from '../features/meal-planner/services/mealPlanService'

export interface MealPlannerSlice {
  entries: MealPlanEntry[]
  setEntries: (entries: MealPlanEntry[]) => void
  initMealPlan: () => void
  addEntry: (entry: MealPlanEntry) => void
  updateEntry: (id: string, patch: Partial<MealPlanEntry>) => void
  removeEntry: (id: string) => void
}

export const mealPlannerSlice: StateCreator<MealPlannerSlice> = (set) => ({
  entries: [],

  setEntries: (entries) => set({ entries }),

  initMealPlan: () => {
    const entries = getAll()
    set({ entries })
  },

  addEntry: (entry) =>
    set((state) => ({ entries: [...state.entries, entry] })),

  updateEntry: (id, patch) =>
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  removeEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    })),
})
