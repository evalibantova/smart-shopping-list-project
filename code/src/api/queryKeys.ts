/** One flat key per resource: every list is fetched, cached and invalidated as a whole. */
export const queryKeys = {
  recipes: ['recipes'],
  tags: ['tags'],
  ingredients: ['ingredients'],
  pantry: ['pantry'],
  mealPlan: ['meal-plan'],
} as const
