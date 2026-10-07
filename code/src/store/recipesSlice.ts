import { StateCreator } from 'zustand'
import { Recipe, Tag } from '../types/recipes'
import { recipeService } from '../features/recipes/services/recipeService'
import { tagService } from '../features/recipes/services/tagService'

export interface RecipesSlice {
  recipes: Recipe[]
  tags: Tag[]
  selectedId: string | null
  setRecipes: (recipes: Recipe[]) => void
  setTags: (tags: Tag[]) => void
  selectRecipe: (id: string | null) => void
  addRecipe: (recipe: Recipe) => void
  updateRecipe: (recipe: Recipe) => void
  removeRecipe: (id: string) => void
  addTag: (tag: Tag) => void
  initRecipes: () => void
}

export const recipesSlice: StateCreator<RecipesSlice> = (set) => ({
  recipes: [],
  tags: [],
  selectedId: null,

  setRecipes: (recipes) => set({ recipes }),
  setTags: (tags) => set({ tags }),
  selectRecipe: (id) => set({ selectedId: id }),

  addRecipe: (recipe) =>
    set((state) => ({ recipes: [...state.recipes, recipe] })),

  updateRecipe: (recipe) =>
    set((state) => ({
      recipes: state.recipes.map((r) => (r.id === recipe.id ? recipe : r)),
    })),

  removeRecipe: (id) =>
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  addTag: (tag) =>
    set((state) => ({ tags: [...state.tags, tag] })),

  initRecipes: () => {
    const recipes = recipeService.getAll()
    const tags = tagService.getAll()
    set({ recipes, tags })
  },
})
