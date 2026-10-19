import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MealPlanEntry } from '../types/mealPlan'
import type { Recipe } from '../types/recipes'
import { api } from './client'
import { queryKeys } from './queryKeys'

export type RecipeInput = Omit<Recipe, 'id' | 'createdAt'>

export const recipesQueryOptions = queryOptions({
  queryKey: queryKeys.recipes,
  queryFn: () => api.get<Recipe[]>('/recipes'),
})

const NONE: Recipe[] = []

/** The cached recipe list. The AppShell gate guarantees it is loaded before any page renders. */
export function useRecipes(): Recipe[] {
  return useQuery(recipesQueryOptions).data ?? NONE
}

/** Awaited save. No `id` creates (POST), an `id` updates (PUT; the server keeps createdAt). */
export function useSaveRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: RecipeInput }) =>
      id ? api.put<Recipe>(`/recipes/${id}`, data) : api.post<Recipe>('/recipes', data),
    onSuccess: (saved) => {
      qc.setQueryData<Recipe[]>(queryKeys.recipes, (old = []) =>
        old.some((r) => r.id === saved.id) ? old.map((r) => (r.id === saved.id ? saved : r)) : [...old, saved],
      )
    },
    // A 409 means something the recipe references is gone: resync everything it can reference.
    onError: () => {
      for (const queryKey of [queryKeys.recipes, queryKeys.tags, queryKeys.ingredients]) {
        void qc.invalidateQueries({ queryKey })
      }
    },
  })
}

/** Awaited delete. The server removes the recipe's meal-plan entries too, so the cache drops them as well. */
export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: (_void, id) => {
      qc.setQueryData<Recipe[]>(queryKeys.recipes, (old) => old?.filter((r) => r.id !== id))
      qc.setQueryData<MealPlanEntry[]>(queryKeys.mealPlan, (old) => old?.filter((e) => e.recipeId !== id))
    },
  })
}
