import { timedFetch } from '../services/recipeImport/request'
import { ImportError } from '../services/recipeImport/types'

const BASE_PATH = '/api'
const TIMEOUT_MS = 15_000

/** A failed API call. `status` is 0 when no HTTP response arrived (network down, timeout, aborted). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(`API error ${status}: ${code}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface RequestOptions {
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

// Looked up at call time, so a test can stub the global fetch after this module was imported.
const defaultFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)

/** JSON request against `/api<path>`. Resolves with the parsed body (undefined for 204) or throws an ApiError. */
export async function request<T = void>(
  method: Method,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const init: RequestInit = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await timedFetch(opts.fetchImpl ?? defaultFetch, BASE_PATH + path, init, TIMEOUT_MS, opts.signal)
  } catch (err) {
    if (err instanceof ImportError) throw new ApiError(0, err.code)
    throw err
  }

  if (res.status === 204) return undefined as T

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const code = (data as { error?: unknown } | null)?.error
    throw new ApiError(res.status, typeof code === 'string' ? code : 'server_error')
  }
  if (data === null) throw new ApiError(res.status, 'bad_response')
  return data as T
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, body, opts),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PUT', path, body, opts),
  delete: <T = void>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),
}

/** What the failing write was, so a 409 can be explained. */
export type WriteKind = 'generic' | 'recipe' | 'tag' | 'ingredient' | 'delete'

/** The user-facing sentence for a failed write. */
export function messageForError(err: unknown, kind: WriteKind = 'generic'): string {
  if (kind === 'delete') return 'Could not delete — please try again.'
  if (err instanceof ApiError) {
    if (err.status === 409 && kind === 'recipe') {
      return 'Something this recipe uses no longer exists. Reload the page and try again.'
    }
    if (err.status === 409 && kind === 'tag') return 'A tag with that name already exists.'
    if (err.status === 409 && kind === 'ingredient') return 'An ingredient with that name already exists.'
    if (err.status === 422) {
      return 'The server rejected something you entered (empty, invalid or too large). Check it and try again.'
    }
  }
  return 'Could not save — please try again.'
}
