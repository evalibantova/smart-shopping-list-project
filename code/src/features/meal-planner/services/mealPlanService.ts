import type { MealPlanEntry } from '../../../types'

const KEY = 'slist_meal_plan'

export const mealPlanService = {
  getAll(): MealPlanEntry[] {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw)
  },

  create(entry: Omit<MealPlanEntry, 'id'>): MealPlanEntry {
    const all = mealPlanService.getAll()
    const newEntry: MealPlanEntry = { ...entry, id: crypto.randomUUID() }
    localStorage.setItem(KEY, JSON.stringify([...all, newEntry]))
    return newEntry
  },

  update(entry: MealPlanEntry): MealPlanEntry {
    const all = mealPlanService.getAll()
    const updated = all.map(e => e.id === entry.id ? entry : e)
    localStorage.setItem(KEY, JSON.stringify(updated))
    return entry
  },

  delete(id: string): void {
    const all = mealPlanService.getAll()
    localStorage.setItem(KEY, JSON.stringify(all.filter(e => e.id !== id)))
  },
}
