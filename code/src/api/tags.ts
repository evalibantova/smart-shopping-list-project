import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tag } from '../types/recipes'
import { api } from './client'
import { queryKeys } from './queryKeys'

export const tagsQueryOptions = queryOptions({
  queryKey: queryKeys.tags,
  queryFn: () => api.get<Tag[]>('/tags'),
})

const NONE: Tag[] = []

/** The cached tag list. The AppShell gate guarantees it is loaded before any page renders. */
export function useTags(): Tag[] {
  return useQuery(tagsQueryOptions).data ?? NONE
}

export interface NewTag {
  name: string
  color: string
}

/** Awaited create: callers wait for the saved tag (with its server id). */
export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTag) => api.post<Tag>('/tags', input),
    onSuccess: (saved) => {
      qc.setQueryData<Tag[]>(queryKeys.tags, (old = []) => [...old, saved])
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tags })
    },
  })
}
