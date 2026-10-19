import type { IngredientDbEntry } from '../types/ingredients'
import { searchMatches } from './search'

/** Synchronous search over an already loaded ingredient list (replaces the old localStorage search). */
export function searchIngredients(list: IngredientDbEntry[], query: string): IngredientDbEntry[] {
  if (query.trim().length < 2) return []
  return list.filter((e) => searchMatches(e.name, query))
}
