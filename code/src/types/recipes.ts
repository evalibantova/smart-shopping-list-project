export interface RecipeIngredient {
  ingredientId: string
  quantity: number
}

export interface Recipe {
  id: string
  emoji: string
  name: string
  servings: number
  tagIds: string[]
  ingredients: RecipeIngredient[]
  notes: string
  createdAt: number
}

export interface Tag {
  id: string
  name: string
  color: string
}
