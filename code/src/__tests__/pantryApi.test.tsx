import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import {
  newPantryItem,
  recipeDeltas,
  useAddPantryItem,
  useDeletePantryItem,
  usePantry,
  useUpdatePantryItem,
} from '../api/pantry'
import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { PANCAKES, PANTRY_FLOUR, PANTRY_MILK } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const cached = (client: QueryClient) => client.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []

describe('usePantry, newPantryItem, recipeDeltas', () => {
  it('usePantry returns the cached list', () => {
    const { result } = renderHookWithClient(() => usePantry(), { seed: { pantry: [PANTRY_FLOUR] } })
    expect(result.current).toEqual([PANTRY_FLOUR])
  })

  it('newPantryItem makes a client id and defaults maxStock to max(1, 3 x quantity)', () => {
    const a = newPantryItem({ ingredientId: 'i', quantity: 2 })
    expect(a).toMatchObject({ ingredientId: 'i', quantity: 2, maxStock: 6 })
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(newPantryItem({ ingredientId: 'i', quantity: 0.1 }).maxStock).toBe(1)
    expect(newPantryItem({ ingredientId: 'i', quantity: 2, maxStock: 10 }).maxStock).toBe(10)
  })

  it('recipeDeltas deducts every ingredient quantity', () => {
    expect(recipeDeltas(PANCAKES)).toEqual([
      { ingredientId: 'ing-flour', delta: -200 },
      { ingredientId: 'ing-milk', delta: -300 },
    ])
  })
})

describe('useAddPantryItem', () => {
  it('shows the item at once and keeps the id it sent', async () => {
    const g = gate()
    const server = installApi({
      handler: async (call) => {
        if (call.method === 'POST') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useAddPantryItem(), { seed: { pantry: [PANTRY_FLOUR] } })
    const item = newPantryItem({ ingredientId: 'ing-sugar', quantity: 2 })
    act(() => {
      result.current.mutate(item)
    })
    await waitFor(() => expect(cached(client)).toEqual([PANTRY_FLOUR, item]))
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('POST', '/api/pantry')[0].body).toEqual(item)
    expect(cached(client)).toEqual([PANTRY_FLOUR, item])
  })

  it('rolls back and toasts when the server answers 409', async () => {
    const g = gate()
    installApi({
      handler: async (call) => {
        if (call.method !== 'POST') return undefined
        await g.wait
        return errorResponse(409, 'conflict')
      },
    })
    const { result, client } = renderHookWithClient(() => useAddPantryItem(), { seed: { pantry: [PANTRY_FLOUR] } })
    const item = newPantryItem({ ingredientId: 'ing-flour', quantity: 2 })
    act(() => {
      result.current.mutate(item)
    })
    await waitFor(() => expect(cached(client)).toHaveLength(2))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(cached(client)).toEqual([PANTRY_FLOUR])
  })
})

describe('useUpdatePantryItem', () => {
  const SEED = { pantry: [PANTRY_FLOUR, PANTRY_MILK] }

  it('applies the patch at once, then keeps the server answer', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method === 'PUT') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useUpdatePantryItem(), { seed: SEED })
    act(() => {
      result.current.mutate({ id: 'pan-flour', patch: { quantity: 250 } })
    })
    await waitFor(() => expect(cached(client)[0].quantity).toBe(250))
    expect(result.current.isPending).toBe(true)
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('PUT', '/api/pantry/pan-flour')[0].body).toEqual({ quantity: 250 })
    expect(cached(client)[0]).toEqual({ ...PANTRY_FLOUR, quantity: 250 })
  })

  it('restores the old quantity and toasts on failure', async () => {
    const g = gate()
    installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method !== 'PUT') return undefined
        await g.wait
        return errorResponse(500, 'server_error')
      },
    })
    const { result, client } = renderHookWithClient(() => useUpdatePantryItem(), { seed: SEED })
    act(() => {
      result.current.mutate({ id: 'pan-flour', patch: { quantity: 250, maxStock: 2000 } })
    })
    await waitFor(() => expect(cached(client)[0]).toMatchObject({ quantity: 250, maxStock: 2000 }))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).not.toBe(''))
    expect(cached(client)).toEqual(SEED.pantry)
  })
})

describe('useDeletePantryItem', () => {
  const SEED = { pantry: [PANTRY_FLOUR, PANTRY_MILK] }

  it('removes the item at once and DELETEs it', async () => {
    const g = gate()
    const server = installApi({
      handler: async (call) => {
        if (call.method === 'DELETE') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useDeletePantryItem(), { seed: SEED })
    act(() => {
      result.current.mutate('pan-flour')
    })
    await waitFor(() => expect(cached(client)).toEqual([PANTRY_MILK]))
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('DELETE', '/api/pantry/pan-flour')).toHaveLength(1)
  })

  it('puts the item back and toasts "Could not delete" on failure', async () => {
    const g = gate()
    installApi({
      handler: async (call) => {
        if (call.method !== 'DELETE') return undefined
        await g.wait
        return errorResponse(500, 'server_error')
      },
    })
    const { result, client } = renderHookWithClient(() => useDeletePantryItem(), { seed: SEED })
    act(() => {
      result.current.mutate('pan-flour')
    })
    await waitFor(() => expect(cached(client)).toHaveLength(1))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not delete — please try again.'))
    expect(cached(client)).toEqual(SEED.pantry)
  })
})
