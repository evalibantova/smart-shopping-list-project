import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IngredientDbEntry } from '../types/ingredients'
import { api } from './client'
import { queryKeys } from './queryKeys'

export const ingredientsQueryOptions = queryOptions({
  queryKey: queryKeys.ingredients,
  queryFn: () => api.get<IngredientDbEntry[]>('/ingredients'),
})

const NONE: IngredientDbEntry[] = []

/** The cached ingredient list. The AppShell gate guarantees it is loaded before any page renders. */
export function useIngredients(): IngredientDbEntry[] {
  return useQuery(ingredientsQueryOptions).data ?? NONE
}

export interface NewIngredient {
  name: string
  default_unit: string
  category: string
}

/** Awaited create: callers wait for the saved entry (with its server id) before using it. */
export function useCreateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewIngredient) => api.post<IngredientDbEntry>('/ingredients', input),
    onSuccess: (saved) => {
      qc.setQueryData<IngredientDbEntry[]>(queryKeys.ingredients, (old = []) => [...old, saved])
    },
    // A 409 means the name exists (our list is stale): refetch so the existing entry shows up.
    onError: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.ingredients })
    },
  })
}
