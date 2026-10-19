import type { IngredientDbEntry } from '../types/ingredients'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'
import type { Recipe, Tag } from '../types/recipes'

export const FLOUR: IngredientDbEntry = { id: 'ing-flour', name: 'Flour', default_unit: 'g', category: 'Pantry & Dry Goods' }
export const MILK: IngredientDbEntry = { id: 'ing-milk', name: 'Milk', default_unit: 'ml', category: 'Dairy' }

export const TAG_BREAKFAST: Tag = { id: 'tag-breakfast', name: 'Breakfast', color: '#F5A623' }

export const PANCAKES: Recipe = {
  id: 'rec-pancakes',
  emoji: '🥞',
  name: 'Pancakes',
  servings: 2,
  tagIds: [TAG_BREAKFAST.id],
  ingredients: [
    { ingredientId: FLOUR.id, quantity: 200 },
    { ingredientId: MILK.id, quantity: 300 },
  ],
  notes: 'Mix and fry.',
  createdAt: 1000,
}

export const PANTRY_FLOUR: PantryItem = { id: 'pan-flour', ingredientId: FLOUR.id, quantity: 500, maxStock: 1000 }
export const PANTRY_MILK: PantryItem = { id: 'pan-milk', ingredientId: MILK.id, quantity: 100, maxStock: 1000 }

export const ENTRY_PANCAKES: MealPlanEntry = {
  id: 'mp-1',
  date: '2026-10-19',
  slot: 'lunch',
  recipeId: PANCAKES.id,
  servings: 4,
}
