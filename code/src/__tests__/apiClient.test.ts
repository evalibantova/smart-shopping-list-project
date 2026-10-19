import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiError, api, messageForError, request } from '../api/client'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('request', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('GETs /api<path> and parses the JSON body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json([{ id: 'a' }]))
    expect(await request('GET', '/ingredients', undefined, { fetchImpl })).toEqual([{ id: 'a' }])
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/ingredients')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
  })

  it('sends a JSON body with a JSON content type', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ id: 'x' }, 201))
    await request('POST', '/tags', { name: 'Soup', color: '#fff' }, { fetchImpl })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"name":"Soup","color":"#fff"}')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('returns undefined for a 204 answer', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    expect(await request('DELETE', '/recipes/r1', undefined, { fetchImpl })).toBeUndefined()
  })

  it.each([
    [409, 'conflict'],
    [422, 'invalid'],
    [404, 'not_found'],
    [500, 'server_error'],
  ])('maps a %i answer with {error:"%s"} to an ApiError', async (status, code) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ error: code }, status))
    await expect(request('GET', '/x', undefined, { fetchImpl })).rejects.toMatchObject({ status, code })
  })

  it('falls back to server_error when the error body is not JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }))
    const err = await request('GET', '/x', undefined, { fetchImpl }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 502, code: 'server_error' })
  })

  it('treats a successful answer that is not JSON as bad_response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('hello', { status: 200 }))
    await expect(request('GET', '/x', undefined, { fetchImpl })).rejects.toMatchObject({ status: 200, code: 'bad_response' })
  })

  it('turns a network failure into ApiError(0, "network")', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(request('GET', '/x', undefined, { fetchImpl })).rejects.toMatchObject({ status: 0, code: 'network' })
  })

  it('turns a timeout into ApiError(0, "timeout")', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const outcome = expect(request('GET', '/x', undefined, { fetchImpl })).rejects.toMatchObject({ status: 0, code: 'timeout' })
    await vi.advanceTimersByTimeAsync(15_000)
    await outcome
  })
})

describe('api helpers', () => {
  it('use the right verb and body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json({ ok: true }))
    await api.get('/a', { fetchImpl })
    await api.post('/b', { n: 1 }, { fetchImpl })
    await api.put('/c', { n: 2 }, { fetchImpl })
    await api.delete('/d', { fetchImpl })
    expect(fetchImpl.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      'GET /api/a',
      'POST /api/b',
      'PUT /api/c',
      'DELETE /api/d',
    ])
    expect(fetchImpl.mock.calls[1][1]?.body).toBe('{"n":1}')
    expect(fetchImpl.mock.calls[2][1]?.body).toBe('{"n":2}')
  })
})

describe('messageForError', () => {
  it('409 on a recipe save means something it references is gone', () => {
    expect(messageForError(new ApiError(409, 'conflict'), 'recipe')).toBe(
      'Something this recipe uses no longer exists. Reload the page and try again.',
    )
  })
  it('409 on tag and ingredient creation means the name exists', () => {
    expect(messageForError(new ApiError(409, 'conflict'), 'tag')).toBe('A tag with that name already exists.')
    expect(messageForError(new ApiError(409, 'conflict'), 'ingredient')).toBe('An ingredient with that name already exists.')
  })
  it('422 is a validation message', () => {
    expect(messageForError(new ApiError(422, 'invalid'), 'recipe')).toContain('rejected')
  })
  it('a network failure or anything else is the generic save error', () => {
    expect(messageForError(new ApiError(0, 'network'), 'recipe')).toBe('Could not save — please try again.')
    expect(messageForError(new Error('boom'))).toBe('Could not save — please try again.')
    expect(messageForError(new ApiError(409, 'conflict'))).toBe('Could not save — please try again.')
  })
  it('a delete has its own wording', () => {
    expect(messageForError(new ApiError(500, 'server_error'), 'delete')).toBe('Could not delete — please try again.')
  })
})
