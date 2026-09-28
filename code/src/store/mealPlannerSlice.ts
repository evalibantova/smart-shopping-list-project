import type { MealPlanEntry } from '../types'
import { mealPlanService } from '../features/meal-planner/services/mealPlanService'

export interface MealPlannerSlice {
  mealPlan: MealPlanEntry[]
  loadMealPlan: () => void
  addMealPlanEntry: (entry: Omit<MealPlanEntry, 'id'>) => MealPlanEntry
  updateMealPlanEntry: (entry: MealPlanEntry) => void
  deleteMealPlanEntry: (id: string) => void
}

export const createMealPlannerSlice = (set: (fn: (s: any) => any) => void): MealPlannerSlice => ({
  mealPlan: [],

  loadMealPlan() {
    set(() => ({ mealPlan: mealPlanService.getAll() }))
  },

  addMealPlanEntry(entry) {
    const created = mealPlanService.create(entry)
    set((s: any) => ({ mealPlan: [...s.mealPlan, created] }))
    return created
  },

  updateMealPlanEntry(entry) {
    mealPlanService.update(entry)
    set((s: any) => ({ mealPlan: s.mealPlan.map((e: MealPlanEntry) => e.id === entry.id ? entry : e) }))
  },

  deleteMealPlanEntry(id) {
    mealPlanService.delete(id)
    set((s: any) => ({ mealPlan: s.mealPlan.filter((e: MealPlanEntry) => e.id !== id) }))
  },
})
