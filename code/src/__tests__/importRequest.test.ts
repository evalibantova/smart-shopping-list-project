// code/src/__tests__/importRequest.test.ts
import { describe, it, expect, vi } from 'vitest'
import { timedFetch } from '../services/recipeImport/request'
import type { ImportError } from '../services/recipeImport/types'

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as ImportError).code
  }
  return 'none'
}

// A fetch that only settles when its signal aborts
const hangingFetch = ((_url: string, init: RequestInit) =>
  new Promise((_resolve, reject) => {
    // Like real fetch, reject at once when the signal is already aborted
    if (init.signal!.aborted) reject(new DOMException('aborted', 'AbortError'))
    init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })) as unknown as typeof fetch

describe('timedFetch', () => {
  it('returns the response when fetch succeeds', async () => {
    const res = new Response('ok')
    const fetchImpl = vi.fn().mockResolvedValue(res)
    await expect(timedFetch(fetchImpl, 'https://x.test', {}, 1000)).resolves.toBe(res)
  })

  it('maps a rejected fetch to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await codeOf(timedFetch(fetchImpl, 'https://x.test', {}, 1000))).toBe('network')
  })

  it('maps its own timeout to timeout', async () => {
    expect(await codeOf(timedFetch(hangingFetch, 'https://x.test', {}, 5))).toBe('timeout')
  })

  it('maps a user abort to aborted', async () => {
    const controller = new AbortController()
    const p = timedFetch(hangingFetch, 'https://x.test', {}, 1000, controller.signal)
    controller.abort()
    expect(await codeOf(p)).toBe('aborted')
  })

  it('maps an already-aborted user signal to aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await codeOf(timedFetch(hangingFetch, 'https://x.test', {}, 1000, controller.signal))).toBe('aborted')
  })
})
