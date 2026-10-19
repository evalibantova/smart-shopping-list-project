import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { useCreateIngredient, useIngredients } from '../api/ingredients'
import { ApiError } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, installApi } from '../test/fetchMock'
import { FLOUR, MILK } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { IngredientDbEntry } from '../types/ingredients'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('useIngredients', () => {
  it('returns the cached list', () => {
    const { result } = renderHookWithClient(() => useIngredients(), { seed: { ingredients: [FLOUR, MILK] } })
    expect(result.current).toEqual([FLOUR, MILK])
  })

  it('fetches /api/ingredients when nothing is cached, and is [] until then', async () => {
    const server = installApi({ seed: { ingredients: [FLOUR] } })
    const { result } = renderHookWithClient(() => useIngredients(), { seed: null })
    expect(result.current).toEqual([])
    await waitFor(() => expect(result.current).toEqual([FLOUR]))
    expect(server.find('GET', '/api/ingredients')).toHaveLength(1)
  })
})

describe('useCreateIngredient', () => {
  const input = { name: 'Tahini', default_unit: 'tbsp', category: 'Other' }

  it('posts the entry, returns the saved one and appends it to the cache', async () => {
    const server = installApi({ seed: { ingredients: [FLOUR] } })
    const { result, client } = renderHookWithClient(() => useCreateIngredient(), { seed: { ingredients: [FLOUR] } })
    let saved: IngredientDbEntry | undefined
    await act(async () => {
      saved = await result.current.mutateAsync(input)
    })
    expect(server.find('POST', '/api/ingredients')[0].body).toEqual(input)
    expect(saved).toEqual({ id: 'srv-1', ...input })
    expect(client.getQueryData(queryKeys.ingredients)).toEqual([FLOUR, saved])
  })

  it('a 409 rejects with an ApiError and leaves the cache as it was', async () => {
    installApi({ handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
    const { result, client } = renderHookWithClient(() => useCreateIngredient(), { seed: { ingredients: [FLOUR] } })
    await act(async () => {
      const outcome = await result.current.mutateAsync(input).catch((e: unknown) => e)
      expect(outcome).toBeInstanceOf(ApiError)
      expect(outcome).toMatchObject({ status: 409, code: 'conflict' })
    })
    expect(client.getQueryData(queryKeys.ingredients)).toEqual([FLOUR])
  })
})
