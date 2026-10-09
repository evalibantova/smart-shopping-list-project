import type { Recipe } from '../../../types/recipes'
import type { MealPlanEntry } from '../../../types/mealPlan'
import type { PantryItem } from '../../../types/pantry'

export type AvailabilityTier = 'ready' | 'almost' | 'far'

export interface MealAvailability {
  tier: AvailabilityTier
  missingCount: number
  maxServings: number
  ingredientAvailability: Record<string, boolean>
}

export function computeAvailability(
  recipe: Recipe,
  entry: Pick<MealPlanEntry, 'servings'>,
  pantryItems: PantryItem[]
): MealAvailability {
  const scale = (recipe.servings > 0 && entry.servings > 0) ? entry.servings / recipe.servings : 1
  const pantryMap = new Map(pantryItems.map((p) => [p.ingredientId, p.quantity]))

  const ingredientAvailability: Record<string, boolean> = {}
  let missingCount = 0
  const n = recipe.ingredients.length

  // Max servings from pantry (independent of requested serving scale)
  let maxServings = recipe.servings > 0 ? Infinity : 0
  for (const ing of recipe.ingredients) {
    const pantryQty = pantryMap.get(ing.ingredientId) ?? 0
    const sufficient = pantryQty >= ing.quantity * scale
    ingredientAvailability[ing.ingredientId] = sufficient
    if (!sufficient) missingCount++
    if (recipe.servings > 0 && ing.quantity > 0) {
      maxServings = Math.min(maxServings, Math.floor(pantryQty * recipe.servings / ing.quantity))
    }
  }
  if (maxServings === Infinity) maxServings = recipe.servings

  let tier: AvailabilityTier
  if (n === 0 || missingCount === 0) {
    tier = 'ready'
  } else if (missingCount <= 4) {
    tier = 'almost'
  } else {
    tier = 'far'
  }

  return { tier, missingCount, maxServings, ingredientAvailability }
}
