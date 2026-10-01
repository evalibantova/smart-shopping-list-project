export type IngredientUnit = 'g' | 'ml' | 'kg' | 'l' | 'pcs' | 'cloves' | 'tbsp' | 'tsp'

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
