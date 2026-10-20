import { vi } from 'vitest'
import type { PantryItem } from '../types/pantry'
import { applyPantryDeltas, type PantryDelta } from '../utils/pantryDeltas'
import type { Seed } from './seed'

export interface RecordedCall {
  method: string
  /** The URL as requested, e.g. `/api/pantry/batch`. */
  path: string
  /** The parsed JSON request body, or undefined. */
  body: unknown
}

export type Handler = (call: RecordedCall) => Response | undefined | Promise<Response | undefined>

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
  // The lists are copied and kept up to date by the default write handlers, so a refetch after a write
  // (the hooks reconcile with the server) sees what the write did, like the real API.
  const lists: Record<keyof Seed, { id: string }[]> = {
    recipes: [...(opts.seed?.recipes ?? [])],
    tags: [...(opts.seed?.tags ?? [])],
    ingredients: [...(opts.seed?.ingredients ?? [])],
    pantry: [...(opts.seed?.pantry ?? [])],
    mealPlan: [...(opts.seed?.mealPlan ?? [])],
  }
  const known = () => Object.values(lists).flat()
  const listFor = (path: string) => LIST_PATHS[path.split('/').slice(0, 3).join('/')]
  let n = 0
  const fetchStub = installFetch(async (call) => {
    const custom = await opts.handler?.(call)
    if (custom) return custom
    const id = call.path.split('/').pop() ?? ''
    const body = (call.body ?? {}) as object
    if (call.method === 'GET') {
      const key = LIST_PATHS[call.path]
      return jsonResponse(key ? lists[key] : [])
    }
    const key = listFor(call.path)
    if (call.method === 'POST') {
      const createdAt = call.path === '/api/recipes' ? { createdAt: 1 } : {}
      const created = { id: `srv-${++n}`, ...createdAt, ...body }
      if (key) lists[key].push(created)
      return jsonResponse(created, 201)
    }
    if (call.method === 'PUT') {
      if (call.path === '/api/pantry/batch') {
        const before = lists.pantry as PantryItem[]
        const after = applyPantryDeltas(before, (body as { deltas: PantryDelta[] }).deltas ?? [])
        lists.pantry = after
        return jsonResponse(after.filter((item, i) => item !== before[i]))
      }
      const saved = { ...known().find((k) => k.id === id), id, ...body }
      if (key) lists[key] = lists[key].map((k) => (k.id === id ? saved : k))
      return jsonResponse(saved)
    }
    if (key) lists[key] = lists[key].filter((k) => k.id !== id)
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
