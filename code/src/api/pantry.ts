import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PantryItem } from '../types/pantry'
import type { Recipe } from '../types/recipes'
import { applyPantryDeltas, type PantryDelta } from '../utils/pantryDeltas'
import { api } from './client'
import { failOptimistic, optimisticUpdate, reconcileWhenIdle, replaceById } from './optimistic'
import { queryKeys } from './queryKeys'

export const pantryQueryOptions = queryOptions({
  queryKey: queryKeys.pantry,
  queryFn: () => api.get<PantryItem[]>('/pantry'),
})

const NONE: PantryItem[] = []

/** The cached pantry. The AppShell gate guarantees it is loaded before any page renders. */
export function usePantry(): PantryItem[] {
  return useQuery(pantryQueryOptions).data ?? NONE
}

/** A new item with a client-side id, so the optimistic copy and the saved one are the same row. */
export function newPantryItem(data: { ingredientId: string; quantity: number; maxStock?: number }): PantryItem {
  return {
    id: crypto.randomUUID(),
    ingredientId: data.ingredientId,
    quantity: data.quantity,
    maxStock: data.maxStock ?? Math.max(1, data.quantity * 3),
  }
}

/** What cooking a recipe once takes out of the pantry. */
export function recipeDeltas(recipe: Pick<Recipe, 'ingredients'>): PantryDelta[] {
  return recipe.ingredients.map((ing) => ({ ingredientId: ing.ingredientId, delta: -ing.quantity }))
}

export interface PantryPatch {
  quantity?: number
  maxStock?: number
}

const KEYS = [queryKeys.pantry]

export function useAddPantryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: PantryItem) => api.post<PantryItem>('/pantry', item),
    onMutate: (item) => optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) => [...old, item]),
    onSuccess: (saved) => replaceById(qc, queryKeys.pantry, saved),
    onError: (err, _item, restore) => failOptimistic(qc, KEYS, restore, err),
    onSettled: () => reconcileWhenIdle(qc, KEYS),
    scope: { id: 'pantry' },
  })
}

export function useUpdatePantryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PantryPatch }) => api.put<PantryItem>(`/pantry/${id}`, patch),
    onMutate: ({ id, patch }) =>
      optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) =>
        old.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      ),
    onSuccess: (saved) => replaceById(qc, queryKeys.pantry, saved),
    onError: (err, _vars, restore) => failOptimistic(qc, KEYS, restore, err),
    onSettled: () => reconcileWhenIdle(qc, KEYS),
    scope: { id: 'pantry' },
  })
}

export function useDeletePantryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pantry/${id}`),
    onMutate: (id) => optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) => old.filter((i) => i.id !== id)),
    onError: (err, _id, restore) => failOptimistic(qc, KEYS, restore, err, 'delete'),
    onSettled: () => reconcileWhenIdle(qc, KEYS),
    scope: { id: 'pantry' },
  })
}

/** Quantity deltas keyed by ingredient (cooking, shopping). Mirrors the old `batchUpdatePantry` of the slice. */
export function useBatchPantry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deltas: PantryDelta[]) => api.put<PantryItem[]>('/pantry/batch', { deltas }),
    onMutate: (deltas) =>
      optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) => applyPantryDeltas(old, deltas)),
    onSuccess: (changed) => {
      const byId = new Map(changed.map((i) => [i.id, i]))
      qc.setQueryData<PantryItem[]>(queryKeys.pantry, (old) => old?.map((i) => byId.get(i.id) ?? i))
    },
    onError: (err, _deltas, restore) => failOptimistic(qc, KEYS, restore, err),
    onSettled: () => reconcileWhenIdle(qc, KEYS),
    scope: { id: 'pantry' },
  })
}
