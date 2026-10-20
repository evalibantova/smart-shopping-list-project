import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'
import { applyPantryDeltas, type PantryDelta } from '../utils/pantryDeltas'
import { api } from './client'
import { failOptimistic, optimisticUpdate, reconcileWhenIdle } from './optimistic'
import { queryKeys } from './queryKeys'

export interface SetCookedInput {
  /** The entry as it is now (its `cooked` flag is the state to go back to on failure). */
  entry: MealPlanEntry
  /** Pantry changes that go with the new state (see `buildCookDeltas`); empty = none. */
  deltas: PantryDelta[]
  /** The new state. */
  cooked: boolean
}

/**
 * Marks a planned meal cooked or not and moves the pantry with it. Both caches change at once; the server gets
 * the entry first and the pantry batch second. If the batch fails the entry is put back (best effort).
 */
export function useSetEntryCooked() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ entry, deltas, cooked }: SetCookedInput) => {
      await api.put<MealPlanEntry>(`/meal-plan/${entry.id}`, { cooked })
      if (deltas.length === 0) return
      try {
        await api.put<PantryItem[]>('/pantry/batch', { deltas })
      } catch (err) {
        try {
          await api.put<MealPlanEntry>(`/meal-plan/${entry.id}`, { cooked: !!entry.cooked })
        } catch {
          // best-effort reversal: the refetch after the rollback shows the server's truth
        }
        throw err
      }
    },
    onMutate: async ({ entry, deltas, cooked }) => {
      const restoreEntries = await optimisticUpdate<MealPlanEntry>(qc, queryKeys.mealPlan, (old) =>
        old.map((e) => (e.id === entry.id ? { ...e, cooked } : e)),
      )
      const restorePantry = await optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) =>
        applyPantryDeltas(old, deltas),
      )
      return () => {
        restoreEntries()
        restorePantry()
      }
    },
    onError: (err, _input, restore) => failOptimistic(qc, [queryKeys.mealPlan, queryKeys.pantry], restore, err),
    onSettled: () => reconcileWhenIdle(qc, [queryKeys.mealPlan, queryKeys.pantry]),
    scope: { id: 'meal-plan' },
  })
}
