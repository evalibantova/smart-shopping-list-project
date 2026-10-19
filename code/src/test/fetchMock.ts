import { vi } from 'vitest'
import type { Seed } from './seed'

export interface RecordedCall {
  method: string
  /** The URL as requested, e.g. `/api/pantry/batch`. */
  path: string
  /** The parsed JSON request body, or undefined. */
  body: unknown
}

export type Handler = (call: RecordedCall) => Response | Promise<Response> | undefined | Promise<undefined>

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function emptyResponse(status = 204): Response {
  return new Response(null, { status })
}

export function errorResponse(status: number, code: string): Response {
  return jsonResponse({ error: code }, status)
}

/** Replaces the global fetch with a recording stub. Call `vi.unstubAllGlobals()` in afterEach. */
export function installFetch(handler: (call: RecordedCall) => Response | Promise<Response>) {
  const calls: RecordedCall[] = []
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: RecordedCall = {
      method: init?.method ?? 'GET',
      path: String(input),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    return handler(call)
  })
  vi.stubGlobal('fetch', impl)
  return { calls, impl }
}

const LIST_PATHS: Record<string, keyof Seed> = {
  '/api/recipes': 'recipes',
  '/api/tags': 'tags',
  '/api/ingredients': 'ingredients',
  '/api/pantry': 'pantry',
  '/api/meal-plan': 'mealPlan',
}

/**
 * A fake API. `handler` may answer a call itself (return a Response) or return undefined to get the default:
 * GET lists come from `seed`, POST echoes the body with an id `srv-<n>` (a client-supplied id wins),
 * PUT merges the body into the seeded object with that id (the batch route answers `[]`), DELETE is 204.
 */
export function installApi(opts: { seed?: Seed; handler?: Handler } = {}) {
  const seed = opts.seed ?? {}
  const known: { id: string }[] = [
    ...(seed.recipes ?? []),
    ...(seed.tags ?? []),
    ...(seed.ingredients ?? []),
    ...(seed.pantry ?? []),
    ...(seed.mealPlan ?? []),
  ]
  let n = 0
  const fetchStub = installFetch(async (call) => {
    const custom = await opts.handler?.(call)
    if (custom) return custom
    const id = call.path.split('/').pop() ?? ''
    const body = (call.body ?? {}) as object
    if (call.method === 'GET') {
      const key = LIST_PATHS[call.path]
      return jsonResponse(key ? (seed[key] ?? []) : [])
    }
    if (call.method === 'POST') {
      const createdAt = call.path === '/api/recipes' ? { createdAt: 1 } : {}
      return jsonResponse({ id: `srv-${++n}`, ...createdAt, ...body }, 201)
    }
    if (call.method === 'PUT') {
      if (call.path === '/api/pantry/batch') return jsonResponse([])
      return jsonResponse({ ...known.find((k) => k.id === id), id, ...body })
    }
    return emptyResponse()
  })
  return {
    ...fetchStub,
    /** The recorded calls with this method and path. */
    find: (method: string, path: string) => fetchStub.calls.filter((c) => c.method === method && c.path === path),
  }
}

/** A promise a handler can await, released by the test with `open()` (to observe optimistic state mid-flight). */
export function gate(): { wait: Promise<void>; open: () => void } {
  let open!: () => void
  const wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return { wait, open }
}
