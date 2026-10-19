import { describe, it, expect, afterEach, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { installApi } from '../test/fetchMock'
import { TAG_BREAKFAST } from '../test/fixtures'
import { makeTestClient, renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { Tag } from '../types/recipes'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('test helpers', () => {
  it('makeTestClient seeds all five lists and null seeds none', () => {
    const client = makeTestClient({ tags: [TAG_BREAKFAST] })
    expect(client.getQueryData(queryKeys.tags)).toEqual([TAG_BREAKFAST])
    expect(client.getQueryData(queryKeys.recipes)).toEqual([])
    expect(makeTestClient(null).getQueryData(queryKeys.tags)).toBeUndefined()
  })

  it('renderHookWithClient exposes the hook result, and installApi serves lists and echoes writes', async () => {
    const server = installApi({ seed: { tags: [TAG_BREAKFAST] } })
    const { result } = renderHookWithClient(
      () => useQuery({ queryKey: queryKeys.tags, queryFn: () => api.get<Tag[]>('/tags') }),
      { seed: null },
    )
    await waitFor(() => expect(result.current.data).toEqual([TAG_BREAKFAST]))
    expect(server.find('GET', '/api/tags')).toHaveLength(1)

    const created = await api.post<Tag>('/tags', { name: 'X', color: '#000000' })
    expect(created).toEqual({ id: 'srv-1', name: 'X', color: '#000000' })
    expect(server.find('POST', '/api/tags')[0].body).toEqual({ name: 'X', color: '#000000' })
  })
})
