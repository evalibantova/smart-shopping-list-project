import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import type { IngredientDbEntry } from '../types/ingredients'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'
import type { Recipe, Tag } from '../types/recipes'

/** The five server lists, as a test wants them to look. */
export interface Seed {
  recipes?: Recipe[]
  tags?: Tag[]
  ingredients?: IngredientDbEntry[]
  pantry?: PantryItem[]
  mealPlan?: MealPlanEntry[]
}

/** Writes all five lists into the cache (missing ones become empty), as if the AppShell gate had loaded them. */
export function seedClient(client: QueryClient, seed: Seed): void {
  client.setQueryData(queryKeys.recipes, seed.recipes ?? [])
  client.setQueryData(queryKeys.tags, seed.tags ?? [])
  client.setQueryData(queryKeys.ingredients, seed.ingredients ?? [])
  client.setQueryData(queryKeys.pantry, seed.pantry ?? [])
  client.setQueryData(queryKeys.mealPlan, seed.mealPlan ?? [])
}
