import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Recipe } from '../types/recipe'

interface RecipesState {
  recipes: Recipe[]
}

export const useRecipesStore = create<RecipesState>()(
  persist(
    () => ({ recipes: [] as Recipe[] }),
    { name: 'slist_recipes' }
  )
)
