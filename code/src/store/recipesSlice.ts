import type { Recipe } from '../types'
import { recipeService } from '../features/recipes/services/recipeService'

export interface RecipesSlice {
  recipes: Recipe[]
  loadRecipes: () => void
  addRecipe: (recipe: Omit<Recipe, 'id'>) => Recipe
  updateRecipe: (recipe: Recipe) => void
  deleteRecipe: (id: string) => void
}

export const createRecipesSlice = (set: (fn: (s: any) => any) => void): RecipesSlice => ({
  recipes: [],

  loadRecipes() {
    set(() => ({ recipes: recipeService.getAll() }))
  },

  addRecipe(recipe) {
    const created = recipeService.create(recipe)
    set((s: any) => ({ recipes: [...s.recipes, created] }))
    return created
  },

  updateRecipe(recipe) {
    recipeService.update(recipe)
    set((s: any) => ({ recipes: s.recipes.map((r: Recipe) => r.id === recipe.id ? recipe : r) }))
  },

  deleteRecipe(id) {
    recipeService.delete(id)
    set((s: any) => ({ recipes: s.recipes.filter((r: Recipe) => r.id !== id) }))
  },
})
