import { describe, it, expect, vi } from 'vitest'
import { assertHttpUrl, fetchPage } from '../services/recipeImport/fetchPage'
import type { ImportError } from '../services/recipeImport/types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as ImportError).code
  }
  return 'none'
}

describe('assertHttpUrl', () => {
  it('accepts http and https', () => {
    expect(() => assertHttpUrl('https://a.test/x')).not.toThrow()
    expect(() => assertHttpUrl(' http://a.test ')).not.toThrow()
  })

  it.each(['', 'not a url', 'ftp://a.test', 'javascript:alert(1)'])('rejects %j as bad_url', (url) => {
    try {
      assertHttpUrl(url)
      throw new Error('expected a throw')
    } catch (e) {
      expect((e as ImportError).code).toBe('bad_url')
    }
  })
})

describe('fetchPage', () => {
  it('calls the endpoint with the encoded URL and returns the page', async () => {
    const page = { source: 'jsonld', text: '{"name":"X"}' }
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(page))
    expect(await fetchPage('https://a.test/r?x=1&y=2', { fetchImpl })).toEqual(page)
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/fetch-recipe.php?url=' + encodeURIComponent('https://a.test/r?x=1&y=2'))
  })

  it.each([
    [400, 'bad_url'],
    [403, 'blocked_host'],
    [413, 'too_large'],
    [422, 'no_content'],
    [502, 'fetch_failed'],
  ])('maps endpoint error %i to %s', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: code }, status))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl }))).toBe(code)
  })

  it('treats an unknown error body, or a non-JSON failure, as fetch_failed', async () => {
    const odd = vi.fn().mockResolvedValue(jsonResponse({ error: 'weird' }, 500))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl: odd }))).toBe('fetch_failed')
    const html = vi.fn().mockResolvedValue(new Response('<html>500</html>', { status: 500 }))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl: html }))).toBe('fetch_failed')
  })

  it('rejects a malformed success body as fetch_failed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ nope: true }))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl }))).toBe('fetch_failed')
  })

  it('never calls the endpoint for a bad URL', async () => {
    const fetchImpl = vi.fn()
    expect(await codeOf(fetchPage('nope', { fetchImpl }))).toBe('bad_url')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps a network failure to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl }))).toBe('network')
  })
})
