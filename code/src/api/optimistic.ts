import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { useToastStore } from '../store/toastStore'
import { messageForError, type WriteKind } from './client'

/**
 * Cancels in-flight fetches of a cached list (they would overwrite the edit), applies `update` to it and
 * returns a function that puts the previous list back. Use it as the `onMutate` of an optimistic mutation.
 */
export async function optimisticUpdate<T>(
  qc: QueryClient,
  key: QueryKey,
  update: (old: T[]) => T[],
): Promise<() => void> {
  await qc.cancelQueries({ queryKey: key })
  const snapshot = qc.getQueryData<T[]>(key)
  qc.setQueryData<T[]>(key, (old) => update(old ?? []))
  return () => {
    qc.setQueryData<T[]>(key, snapshot)
  }
}

/** The `onError` of an optimistic mutation: roll back, refetch the truth, tell the user. */
export function failOptimistic(
  qc: QueryClient,
  keys: QueryKey[],
  restore: (() => void) | undefined,
  err: unknown,
  kind: WriteKind = 'generic',
): void {
  restore?.()
  for (const queryKey of keys) void qc.invalidateQueries({ queryKey })
  useToastStore.getState().show(messageForError(err, kind))
}

/** Swaps the server's version of an item into a cached list (matched by id). */
export function replaceById<T extends { id: string }>(qc: QueryClient, key: QueryKey, saved: T): void {
  qc.setQueryData<T[]>(key, (old) => old?.map((x) => (x.id === saved.id ? saved : x)))
}

/**
 * The `onSettled` of an optimistic mutation: re-sync the lists with the server, but only when this is the last
 * pending write. Inside `onSettled` the mutation itself still counts as pending (so `1` means "only me"); an
 * earlier refetch would overwrite the optimistic state of the writes still in flight.
 */
export function reconcileWhenIdle(qc: QueryClient, keys: QueryKey[]): void {
  if (qc.isMutating() > 1) return
  for (const queryKey of keys) void qc.invalidateQueries({ queryKey })
}
