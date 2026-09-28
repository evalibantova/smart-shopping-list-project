import type { Ingredient, MealPlanEntry, PantryItem, Recipe } from '../types'

export interface ShoppingItem {
  ingredientId: string
  name: string
  unit: string
  category: string
  needed: number
  pantryQty: number
  deficit: number
}

export interface ShoppingListSlice {
  selectShoppingItems: (state: {
    mealPlan: MealPlanEntry[]
    recipes: Recipe[]
    pantry: PantryItem[]
    ingredientsDb: Ingredient[]
  }) => ShoppingItem[]
}

function getWeekRange(date: Date): [Date, Date] {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return [monday, sunday]
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export const shoppingListSelectors: ShoppingListSlice = {
  selectShoppingItems({ mealPlan, recipes, pantry, ingredientsDb }) {
    const today = new Date()
    const [weekStart, weekEnd] = getWeekRange(today)
    const startStr = toDateStr(weekStart)
    const endStr = toDateStr(weekEnd)

    const weekEntries = mealPlan.filter(e => {
      return e.date >= startStr && e.date <= endStr && !e.cooked
    })

    const totals = new Map<string, number>()

    for (const entry of weekEntries) {
      const recipe = recipes.find(r => r.id === entry.recipeId)
      if (!recipe) continue
      const scale = recipe.servings > 0 ? entry.servings / recipe.servings : 1
      for (const ri of recipe.ingredients) {
        const prev = totals.get(ri.ingredientId) ?? 0
        totals.set(ri.ingredientId, prev + ri.quantity * scale)
      }
    }

    const pantryMap = new Map<string, number>()
    for (const item of pantry) {
      pantryMap.set(item.ingredientId, (pantryMap.get(item.ingredientId) ?? 0) + item.quantity)
    }

    const items: ShoppingItem[] = []
    for (const [ingredientId, needed] of totals) {
      const ingredient = ingredientsDb.find(i => i.id === ingredientId)
      if (!ingredient) continue
      const pantryQty = pantryMap.get(ingredientId) ?? 0
      const deficit = Math.max(0, needed - pantryQty)
      if (deficit > 0) {
        items.push({
          ingredientId,
          name: ingredient.name,
          unit: ingredient.default_unit,
          category: ingredient.category,
          needed,
          pantryQty,
          deficit,
        })
      }
    }

    return items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  },
}
