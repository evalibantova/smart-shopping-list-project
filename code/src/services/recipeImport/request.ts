// code/src/services/recipeImport/request.ts
import { ImportError } from './types'

/**
 * fetch() with a timeout and an optional user abort signal.
 * The timeout covers the wait for response headers only.
 */
export async function timedFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  userSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  if (userSignal?.aborted) controller.abort()
  userSignal?.addEventListener('abort', onAbort, { once: true })

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } catch {
    if (userSignal?.aborted) throw new ImportError('aborted')
    if (timedOut) throw new ImportError('timeout')
    throw new ImportError('network')
  } finally {
    clearTimeout(timer)
    userSignal?.removeEventListener('abort', onAbort)
  }
}
