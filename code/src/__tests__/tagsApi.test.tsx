import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { useCreateTag, useTags } from '../api/tags'
import { ApiError } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, installApi } from '../test/fetchMock'
import { TAG_BREAKFAST } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { Tag } from '../types/recipes'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('useTags', () => {
  it('returns the cached list', () => {
    const { result } = renderHookWithClient(() => useTags(), { seed: { tags: [TAG_BREAKFAST] } })
    expect(result.current).toEqual([TAG_BREAKFAST])
  })

  it('fetches /api/tags when nothing is cached', async () => {
    installApi({ seed: { tags: [TAG_BREAKFAST] } })
    const { result } = renderHookWithClient(() => useTags(), { seed: null })
    await waitFor(() => expect(result.current).toEqual([TAG_BREAKFAST]))
  })
})

describe('useCreateTag', () => {
  it('posts the tag, returns the saved one and appends it to the cache', async () => {
    const server = installApi()
    const { result, client } = renderHookWithClient(() => useCreateTag(), { seed: { tags: [TAG_BREAKFAST] } })
    let saved: Tag | undefined
    await act(async () => {
      saved = await result.current.mutateAsync({ name: 'Soup', color: '#26A69A' })
    })
    expect(server.find('POST', '/api/tags')[0].body).toEqual({ name: 'Soup', color: '#26A69A' })
    expect(saved).toEqual({ id: 'srv-1', name: 'Soup', color: '#26A69A' })
    expect(client.getQueryData(queryKeys.tags)).toEqual([TAG_BREAKFAST, saved])
  })

  it('a 409 (name exists) rejects with an ApiError and leaves the cache as it was', async () => {
    installApi({ handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
    const { result, client } = renderHookWithClient(() => useCreateTag(), { seed: { tags: [TAG_BREAKFAST] } })
    await act(async () => {
      const outcome = await result.current.mutateAsync({ name: 'Breakfast', color: '#000000' }).catch((e: unknown) => e)
      expect(outcome).toBeInstanceOf(ApiError)
      expect(outcome).toMatchObject({ status: 409 })
    })
    expect(client.getQueryData(queryKeys.tags)).toEqual([TAG_BREAKFAST])
  })
})
