import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MealPlanEntry } from '../types/mealPlan'
import { api } from './client'
import { failOptimistic, optimisticUpdate, replaceById } from './optimistic'
import { queryKeys } from './queryKeys'

export const mealPlanQueryOptions = queryOptions({
  queryKey: queryKeys.mealPlan,
  queryFn: () => api.get<MealPlanEntry[]>('/meal-plan'),
})

const NONE: MealPlanEntry[] = []

/** The cached meal plan. The AppShell gate guarantees it is loaded before any page renders. */
export function useMealPlan(): MealPlanEntry[] {
  return useQuery(mealPlanQueryOptions).data ?? NONE
}

export type MealPlanPatch = Partial<Omit<MealPlanEntry, 'id'>>

/** A new entry with a client-side id, so the optimistic copy and the saved one are the same row. */
export function newMealEntry(data: Omit<MealPlanEntry, 'id' | 'cooked'>): MealPlanEntry {
  return { id: crypto.randomUUID(), ...data }
}

const KEYS = [queryKeys.mealPlan]

export function useAddMealEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entry: MealPlanEntry) => api.post<MealPlanEntry>('/meal-plan', entry),
    onMutate: (entry) => optimisticUpdate<MealPlanEntry>(qc, queryKeys.mealPlan, (old) => [...old, entry]),
    onSuccess: (saved) => replaceById(qc, queryKeys.mealPlan, saved),
    onError: (err, _entry, restore) => failOptimistic(qc, KEYS, restore, err),
  })
}

/** Patch an entry, for example move it to another day or slot. */
export function useUpdateMealEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MealPlanPatch }) =>
      api.put<MealPlanEntry>(`/meal-plan/${id}`, patch),
    onMutate: ({ id, patch }) =>
      optimisticUpdate<MealPlanEntry>(qc, queryKeys.mealPlan, (old) =>
        old.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      ),
    onSuccess: (saved) => replaceById(qc, queryKeys.mealPlan, saved),
    onError: (err, _vars, restore) => failOptimistic(qc, KEYS, restore, err),
  })
}

export function useRemoveMealEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/meal-plan/${id}`),
    onMutate: (id) => optimisticUpdate<MealPlanEntry>(qc, queryKeys.mealPlan, (old) => old.filter((e) => e.id !== id)),
    onError: (err, _id, restore) => failOptimistic(qc, KEYS, restore, err, 'delete'),
  })
}
