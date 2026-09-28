import type { Ingredient } from '../types'
import { ingredientsDbService } from '../services/ingredientsDbService'

export interface IngredientsDbSlice {
  ingredientsDb: Ingredient[]
  loadIngredientsDb: () => void
  addIngredient: (name: string, default_unit: string, category?: string) => Ingredient
}

export const createIngredientsDbSlice = (set: (fn: (s: any) => any) => void): IngredientsDbSlice => ({
  ingredientsDb: [],

  loadIngredientsDb() {
    const seeded = ingredientsDbService.seed()
    set(() => ({ ingredientsDb: seeded }))
  },

  addIngredient(name, default_unit, category = 'Other') {
    const created = ingredientsDbService.create(name, default_unit, category)
    set((s: any) => ({ ingredientsDb: [...s.ingredientsDb, created] }))
    return created
  },
})
