import { QueryClient } from '@tanstack/react-query'

/** The app's client. Lists stay fresh for a minute; later refetches are silent (the AppShell gate only reacts to the first load). */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
      mutations: { retry: false },
    },
  })
}
