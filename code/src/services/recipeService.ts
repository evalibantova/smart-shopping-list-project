import { useRecipesStore } from '../store/recipesStore'
import type { Recipe } from '../types/recipe'

export const recipeService = {
  create(data: Omit<Recipe, 'id' | 'createdAt'>): Recipe {
    const recipe: Recipe = { ...data, id: crypto.randomUUID(), createdAt: Date.now() }
    useRecipesStore.setState(s => ({ recipes: [...s.recipes, recipe] }))
    return recipe
  },

  update(id: string, data: Partial<Omit<Recipe, 'id' | 'createdAt'>>): Recipe {
    const recipes = useRecipesStore.getState().recipes
    const existing = recipes.find(r => r.id === id)!
    const updated: Recipe = { ...existing, ...data }
    useRecipesStore.setState({ recipes: recipes.map(r => (r.id === id ? updated : r)) })
    return updated
  },

  delete(id: string): void {
    useRecipesStore.setState(s => ({ recipes: s.recipes.filter(r => r.id !== id) }))
  },
}
