import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { useSetEntryCooked } from '../api/cooking'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi, jsonResponse } from '../test/fetchMock'
import { ENTRY_PANCAKES, PANTRY_FLOUR, PANTRY_MILK } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const SEED = { mealPlan: [ENTRY_PANCAKES], pantry: [PANTRY_FLOUR, PANTRY_MILK] }
const DELTAS = [{ ingredientId: 'ing-flour', delta: -200 }]
const order = (calls: { method: string; path: string }[]) => calls.map((c) => `${c.method} ${c.path}`)
const entries = (c: QueryClient) => c.getQueryData<MealPlanEntry[]>(queryKeys.mealPlan) ?? []
const pantry = (c: QueryClient) => c.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []

describe('useSetEntryCooked', () => {
  it('marks the entry and deducts the pantry at once, then sends the entry first and the batch second', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.path === '/api/meal-plan/mp-1') await g.wait
        if (call.path === '/api/pantry/batch') return jsonResponse([{ ...PANTRY_FLOUR, quantity: 300 }])
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useSetEntryCooked(), { seed: SEED })
    act(() => {
      result.current.mutate({ entry: ENTRY_PANCAKES, deltas: DELTAS, cooked: true })
    })
    await waitFor(() => expect(entries(client)[0].cooked).toBe(true))
    expect(pantry(client)[0].quantity).toBe(300)
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(order(server.calls)).toEqual(['PUT /api/meal-plan/mp-1', 'PUT /api/pantry/batch'])
    expect(server.calls[0].body).toEqual({ cooked: true })
    expect(server.calls[1].body).toEqual({ deltas: DELTAS })
  })

  it('skips the batch when there is nothing to deduct', async () => {
    const server = installApi({ seed: SEED })
    const { result } = renderHookWithClient(() => useSetEntryCooked(), { seed: SEED })
    act(() => {
      result.current.mutate({ entry: ENTRY_PANCAKES, deltas: [], cooked: true })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(order(server.calls)).toEqual(['PUT /api/meal-plan/mp-1'])
  })

  it('un-cooking sends the reverse deltas it was given', async () => {
    const cookedEntry = { ...ENTRY_PANCAKES, cooked: true }
    const seed = { mealPlan: [cookedEntry], pantry: [PANTRY_FLOUR] }
    const server = installApi({ seed })
    const { result, client } = renderHookWithClient(() => useSetEntryCooked(), { seed })
    act(() => {
      result.current.mutate({ entry: cookedEntry, deltas: [{ ingredientId: 'ing-flour', delta: 200 }], cooked: false })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('PUT', '/api/meal-plan/mp-1')[0].body).toEqual({ cooked: false })
    expect(entries(client)[0].cooked).toBe(false)
  })

  it('when the batch fails it sets the entry back on the server, restores both caches and toasts', async () => {
    const server = installApi({
      seed: SEED,
      handler: (call) => (call.path === '/api/pantry/batch' ? errorResponse(500, 'server_error') : undefined),
    })
    const { result, client } = renderHookWithClient(() => useSetEntryCooked(), { seed: SEED })
    act(() => {
      result.current.mutate({ entry: ENTRY_PANCAKES, deltas: DELTAS, cooked: true })
    })
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(order(server.calls)).toEqual(['PUT /api/meal-plan/mp-1', 'PUT /api/pantry/batch', 'PUT /api/meal-plan/mp-1'])
    expect(server.calls[2].body).toEqual({ cooked: false })
    expect(entries(client)).toEqual([ENTRY_PANCAKES])
    expect(pantry(client)).toEqual(SEED.pantry)
  })

  it('when the entry update fails the batch is never sent', async () => {
    const server = installApi({
      seed: SEED,
      handler: (call) => (call.path === '/api/meal-plan/mp-1' ? errorResponse(404, 'not_found') : undefined),
    })
    const { result, client } = renderHookWithClient(() => useSetEntryCooked(), { seed: SEED })
    act(() => {
      result.current.mutate({ entry: ENTRY_PANCAKES, deltas: DELTAS, cooked: true })
    })
    await waitFor(() => expect(useToastStore.getState().message).not.toBe(''))
    expect(order(server.calls)).toEqual(['PUT /api/meal-plan/mp-1'])
    expect(entries(client)).toEqual([ENTRY_PANCAKES])
    expect(pantry(client)).toEqual(SEED.pantry)
  })
})
