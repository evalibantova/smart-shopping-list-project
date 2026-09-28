import type { Recipe } from '../../../types'

const KEY = 'slist_recipes'

export const recipeService = {
  getAll(): Recipe[] {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw)
  },

  create(recipe: Omit<Recipe, 'id'>): Recipe {
    const all = recipeService.getAll()
    const newRecipe: Recipe = { ...recipe, id: crypto.randomUUID() }
    localStorage.setItem(KEY, JSON.stringify([...all, newRecipe]))
    return newRecipe
  },

  update(recipe: Recipe): Recipe {
    const all = recipeService.getAll()
    const updated = all.map(r => r.id === recipe.id ? recipe : r)
    localStorage.setItem(KEY, JSON.stringify(updated))
    return recipe
  },

  delete(id: string): void {
    const all = recipeService.getAll()
    localStorage.setItem(KEY, JSON.stringify(all.filter(r => r.id !== id)))
  },
}
