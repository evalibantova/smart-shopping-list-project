import type { MealPlanEntry } from '../../types/mealPlan'
import type { Recipe } from '../../types/recipes'
import type { PantryItem } from '../../types/pantry'

export type AvailabilityStatus = 'ready' | 'almost' | 'far'

export interface CookNowCard {
  entryId: string
  recipeId: string
  recipeName: string
  emoji: string
  slot: MealPlanEntry['slot']
  servings: number
  availability: AvailabilityStatus
  missingCount: number
  totalIngredients: number
  cooked: boolean
}

const SLOT_ORDER: MealPlanEntry['slot'][] = ['breakfast', 'lunch', 'dinner']

export function computeCookNowCards(
  entries: MealPlanEntry[],
  recipes: Recipe[],
  pantryItems: PantryItem[],
  today: string
): CookNowCard[] {
  // Build pantry map aggregating qty by ingredientId (sum duplicates)
  const pantryMap = new Map<string, number>()
  for (const p of pantryItems) {
    pantryMap.set(p.ingredientId, (pantryMap.get(p.ingredientId) ?? 0) + p.quantity)
  }

  // Build recipe map
  const recipeMap = new Map(recipes.map((r) => [r.id, r]))

  const cards: CookNowCard[] = []

  for (const entry of entries) {
    if (entry.date !== today) continue
    const recipe = recipeMap.get(entry.recipeId)
    if (!recipe) continue

    const scale = recipe.servings > 0 ? entry.servings / recipe.servings : 1
    const totalIngredients = recipe.ingredients.length

    let missingCount = 0
    for (const ing of recipe.ingredients) {
      const pantryQty = pantryMap.get(ing.ingredientId) ?? 0
      const required = ing.quantity * scale
      if (pantryQty < required) {
        missingCount++
      }
    }

    let availability: AvailabilityStatus
    if (totalIngredients === 0 || missingCount === 0) {
      availability = 'ready'
    } else if (missingCount === totalIngredients) {
      availability = 'far'
    } else {
      availability = 'almost'
    }

    cards.push({
      entryId: entry.id,
      recipeId: entry.recipeId,
      recipeName: recipe.name,
      emoji: recipe.emoji,
      slot: entry.slot,
      servings: entry.servings,
      availability,
      missingCount,
      totalIngredients,
      cooked: entry.cooked ?? false,
    })
  }

  // Sort by slot order: breakfast → lunch → dinner
  cards.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))

  return cards
}
