import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { newMealEntry, useAddMealEntry, useMealPlan, useRemoveMealEntry, useUpdateMealEntry } from '../api/mealPlan'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { MealPlanEntry } from '../types/mealPlan'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const cached = (client: QueryClient) => client.getQueryData<MealPlanEntry[]>(queryKeys.mealPlan) ?? []

describe('useMealPlan and newMealEntry', () => {
  it('useMealPlan returns the cached list', () => {
    const { result } = renderHookWithClient(() => useMealPlan(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    expect(result.current).toEqual([ENTRY_PANCAKES])
  })

  it('newMealEntry makes a client uuid and leaves cooked unset', () => {
    const entry = newMealEntry({ date: '2026-10-20', slot: 'dinner', recipeId: 'r', servings: 3 })
    expect(entry).toMatchObject({ date: '2026-10-20', slot: 'dinner', recipeId: 'r', servings: 3 })
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/)
    expect('cooked' in entry).toBe(false)
  })
})

describe('useAddMealEntry', () => {
  it('shows the entry at once and POSTs it with its client id', async () => {
    const g = gate()
    const server = installApi({
      handler: async (call) => {
        if (call.method === 'POST') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useAddMealEntry(), { seed: { mealPlan: [] } })
    const entry = newMealEntry({ date: '2026-10-20', slot: 'lunch', recipeId: 'rec-pancakes', servings: 2 })
    act(() => {
      result.current.mutate(entry)
    })
    await waitFor(() => expect(cached(client)).toEqual([entry]))
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('POST', '/api/meal-plan')[0].body).toEqual(entry)
  })

  it('removes the entry again and toasts when the recipe no longer exists (409)', async () => {
    const g = gate()
    installApi({
      handler: async (call) => {
        if (call.method !== 'POST') return undefined
        await g.wait
        return errorResponse(409, 'conflict')
      },
    })
    const { result, client } = renderHookWithClient(() => useAddMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    const entry = newMealEntry({ date: '2026-10-20', slot: 'lunch', recipeId: 'gone', servings: 2 })
    act(() => {
      result.current.mutate(entry)
    })
    await waitFor(() => expect(cached(client)).toHaveLength(2))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(cached(client)).toEqual([ENTRY_PANCAKES])
  })
})

describe('useUpdateMealEntry (moves)', () => {
  it('moves an entry optimistically and PUTs only the patch', async () => {
    const g = gate()
    const server = installApi({
      seed: { mealPlan: [ENTRY_PANCAKES] },
      handler: async (call) => {
        if (call.method === 'PUT') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useUpdateMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    act(() => {
      result.current.mutate({ id: 'mp-1', patch: { date: '2026-10-21', slot: 'dinner' } })
    })
    await waitFor(() => expect(cached(client)[0]).toMatchObject({ date: '2026-10-21', slot: 'dinner' }))
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('PUT', '/api/meal-plan/mp-1')[0].body).toEqual({ date: '2026-10-21', slot: 'dinner' })
  })

  it('moves it back and toasts on failure', async () => {
    const g = gate()
    installApi({
      handler: async (call) => {
        if (call.method !== 'PUT') return undefined
        await g.wait
        return errorResponse(500, 'server_error')
      },
    })
    const { result, client } = renderHookWithClient(() => useUpdateMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    act(() => {
      result.current.mutate({ id: 'mp-1', patch: { date: '2026-10-21' } })
    })
    await waitFor(() => expect(cached(client)[0].date).toBe('2026-10-21'))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).not.toBe(''))
    expect(cached(client)).toEqual([ENTRY_PANCAKES])
  })
})

describe('useRemoveMealEntry', () => {
  it('removes the entry at once and DELETEs it', async () => {
    const server = installApi()
    const { result, client } = renderHookWithClient(() => useRemoveMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    act(() => {
      result.current.mutate('mp-1')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(cached(client)).toEqual([])
    expect(server.find('DELETE', '/api/meal-plan/mp-1')).toHaveLength(1)
  })

  it('brings the entry back and toasts "Could not delete" on failure', async () => {
    installApi({ handler: (call) => (call.method === 'DELETE' ? errorResponse(500, 'server_error') : undefined) })
    const { result, client } = renderHookWithClient(() => useRemoveMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    act(() => {
      result.current.mutate('mp-1')
    })
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not delete — please try again.'))
    expect(cached(client)).toEqual([ENTRY_PANCAKES])
  })
})
