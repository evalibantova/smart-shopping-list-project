export interface Ingredient {
  id: string
  name: string
  default_unit: string
  category: string
}

export interface RecipeIngredient {
  ingredientId: string
  quantity: number
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Recipe {
  id: string
  name: string
  emoji: string
  servings: number
  tagNames: string[]
  ingredients: RecipeIngredient[]
  notes: string
}

export interface MealPlanEntry {
  id: string
  date: string // "YYYY-MM-DD"
  slot: 'breakfast' | 'lunch' | 'dinner'
  recipeId: string
  servings: number
  cooked?: boolean
}

export interface PantryItem {
  id: string
  ingredientId: string
  quantity: number
  maxStock: number
}

export type RecipeDetailContext = 'recipes' | 'meal-planner'

export interface ToastMessage {
  id: string
  message: string
  variant: 'default' | 'amber'
}
