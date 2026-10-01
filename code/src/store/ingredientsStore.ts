import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { INGREDIENTS_SEED } from '../data/ingredients-seed'
import type { Ingredient, IngredientUnit, IngredientCategory } from '../types/ingredient'

interface IngredientsState {
  ingredientsDb: Ingredient[]
  seedIngredients: () => void
  addIngredient: (name: string, defaultUnit: IngredientUnit, category: IngredientCategory) => Ingredient
}

let _counter = 0

export const useIngredientsStore = create<IngredientsState>()(
  persist(
    (set, get) => ({
      ingredientsDb: [],

      seedIngredients() {
        if (get().ingredientsDb.length > 0) return
        set({ ingredientsDb: [...INGREDIENTS_SEED] })
      },

      addIngredient(name, defaultUnit, category) {
        _counter++
        const newIngredient: Ingredient = {
          id: `ing_custom_${_counter}_${Math.random().toString(36).slice(2)}`,
          name,
          defaultUnit,
          category,
        }
        set(s => ({ ingredientsDb: [...s.ingredientsDb, newIngredient] }))
        return newIngredient
      },
    }),
    { name: 'slist_ingredients' }
  )
)
