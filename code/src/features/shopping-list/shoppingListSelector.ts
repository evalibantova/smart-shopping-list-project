import type { MealPlanEntry } from '../../types/mealPlan'
import type { Recipe } from '../../types/recipes'
import type { IngredientDbEntry } from '../../types/ingredients'
import type { PantryItem } from '../../types/pantry'
import { getDayDates, toDateStr } from '../meal-planner/utils/calendarUtils'

export interface ShoppingItem {
  ingredientId: string
  name: string
  quantity: number
  unit: string
  category: string
}

export const CATEGORY_ORDER: { key: string; emoji: string }[] = [
  { key: 'Produce', emoji: '🥬' },
  { key: 'Fish & Seafood', emoji: '🐟' },
  { key: 'Meat', emoji: '🥩' },
  { key: 'Dairy', emoji: '🥛' },
  { key: 'Pantry & Dry Goods', emoji: '🫙' },
  { key: 'Other', emoji: '📦' },
]

export function computeShoppingList(
  entries: MealPlanEntry[],
  recipes: Recipe[],
  ingredientsDb: IngredientDbEntry[],
  weekStart: Date,
  pantryItems: PantryItem[]
): ShoppingItem[] {
  const weekDateSet = new Set(getDayDates(weekStart).map(toDateStr))
  const recipeMap = new Map(recipes.map((r) => [r.id, r]))
  const ingMap = new Map(ingredientsDb.map((i) => [i.id, i]))
  const totals = new Map<string, number>()

  for (const entry of entries) {
    if (!weekDateSet.has(entry.date)) continue
    if (entry.cooked) continue
    const recipe = recipeMap.get(entry.recipeId)
    if (!recipe) continue
    const scale = recipe.servings > 0 ? entry.servings / recipe.servings : 1
    for (const ing of recipe.ingredients) {
      totals.set(ing.ingredientId, (totals.get(ing.ingredientId) ?? 0) + ing.quantity * scale)
    }
  }

  // Build pantry map and subtract stock from totals; sum duplicates rather than last-wins
  const pantryMap = new Map<string, number>()
  for (const p of pantryItems) {
    pantryMap.set(p.ingredientId, (pantryMap.get(p.ingredientId) ?? 0) + p.quantity)
  }

  const items: ShoppingItem[] = []
  for (const [ingredientId, quantity] of totals) {
    const ing = ingMap.get(ingredientId)
    if (!ing) continue
    const pantryQty = pantryMap.get(ingredientId) ?? 0
    const deficit = Math.max(0, quantity - pantryQty)
    if (deficit <= 0) continue
    items.push({
      ingredientId,
      name: ing.name,
      quantity: Math.round(deficit * 100) / 100,
      unit: ing.default_unit,
      category: ing.category,
    })
  }

  return items
}
