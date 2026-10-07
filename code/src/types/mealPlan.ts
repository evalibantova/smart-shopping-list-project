export interface MealPlanEntry {
  id: string
  date: string
  slot: 'breakfast' | 'lunch' | 'dinner'
  recipeId: string
  servings: number
  cooked?: boolean
}
