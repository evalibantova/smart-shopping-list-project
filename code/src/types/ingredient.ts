export const INGREDIENT_UNITS = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp'] as const
export type IngredientUnit = typeof INGREDIENT_UNITS[number]

export type IngredientCategory =
  | 'Produce'
  | 'Meat'
  | 'Fish & Seafood'
  | 'Dairy'
  | 'Pantry & Dry Goods'
  | 'Other'

export interface Ingredient {
  id: string
  name: string
  defaultUnit: IngredientUnit
  category: IngredientCategory
}
