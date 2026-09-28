import type { Ingredient } from '../types'
import { SEED_INGREDIENTS } from '../data/ingredients'

const KEY = 'slist_ingredients_db'

export const ingredientsDbService = {
  getAll(): Ingredient[] {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw)
  },

  seed(): Ingredient[] {
    const existing = localStorage.getItem(KEY)
    if (existing) return JSON.parse(existing)
    const seeded: Ingredient[] = SEED_INGREDIENTS.map(ing => ({
      ...ing,
      id: crypto.randomUUID(),
    }))
    localStorage.setItem(KEY, JSON.stringify(seeded))
    return seeded
  },

  create(name: string, default_unit: string, category = 'Other'): Ingredient {
    const all = ingredientsDbService.getAll()
    const newEntry: Ingredient = { id: crypto.randomUUID(), name, default_unit, category }
    localStorage.setItem(KEY, JSON.stringify([...all, newEntry]))
    return newEntry
  },
}
