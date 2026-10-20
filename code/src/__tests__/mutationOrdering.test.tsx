import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import {
  newMealEntry,
  useAddMealEntry,
  useMealPlan,
  useRemoveMealEntry,
  useUpdateMealEntry,
} from '../api/mealPlan'
import {
  newPantryItem,
  useAddPantryItem,
  useBatchPantry,
  useDeletePantryItem,
  usePantry,
  useUpdatePantryItem,
} from '../api/pantry'
import { useSetEntryCooked } from '../api/cooking'
import { useToastStore } from '../store/toastStore'
import { gate, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, PANTRY_FLOUR, PANTRY_MILK } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const SEED = { pantry: [PANTRY_FLOUR, PANTRY_MILK], mealPlan: [ENTRY_PANCAKES] }

/** Mounts the lists (active observers, so an invalidation refetches) and all the optimistic mutations. */
function mountAll() {
  return renderHookWithClient(
    () => ({
      pantry: usePantry(),
      plan: useMealPlan(),
      addPantry: useAddPantryItem(),
      updatePantry: useUpdatePantryItem(),
      deletePantry: useDeletePantryItem(),
      batch: useBatchPantry(),
      addEntry: useAddMealEntry(),
      updateEntry: useUpdateMealEntry(),
      removeEntry: useRemoveMealEntry(),
      cook: useSetEntryCooked(),
    }),
    { seed: SEED },
  )
}

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 50)) })

describe('reconciling after optimistic writes', () => {
  it('refetches the list exactly once after a lone successful delete', async () => {
    const server = installApi({ seed: SEED })
    const { result } = mountAll()
    act(() => {
      result.current.deletePantry.mutate('pan-flour')
    })
    await waitFor(() => expect(result.current.deletePantry.isSuccess).toBe(true))
    await waitFor(() => expect(server.find('GET', '/api/pantry')).toHaveLength(1))
    await tick()
    expect(server.find('GET', '/api/pantry')).toHaveLength(1)
  })

  it('with two overlapping writes the refetch comes once, after both settled', async () => {
    const g1 = gate()
    const g2 = gate()
    const gates = [g1, g2]
    let n = 0
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method === 'DELETE') await gates[n++].wait
        return undefined
      },
    })
    const { result } = mountAll()
    act(() => {
      result.current.deletePantry.mutate('pan-flour')
      result.current.deletePantry.mutate('pan-milk')
    })
    g1.open()
    await tick()
    expect(server.find('GET', '/api/pantry')).toHaveLength(0)
    g2.open()
    await waitFor(() => expect(server.find('GET', '/api/pantry')).toHaveLength(1))
    await tick()
    expect(server.find('GET', '/api/pantry')).toHaveLength(1)
  })

  it('a successful meal-plan write refetches the meal plan once', async () => {
    const server = installApi({ seed: SEED })
    const { result } = mountAll()
    act(() => {
      result.current.updateEntry.mutate({ id: ENTRY_PANCAKES.id, patch: { date: '2030-01-01' } })
    })
    await waitFor(() => expect(server.find('GET', '/api/meal-plan')).toHaveLength(1))
    await tick()
    expect(server.find('GET', '/api/meal-plan')).toHaveLength(1)
  })

  it('a successful set-cooked refetches both lists once', async () => {
    const server = installApi({ seed: SEED })
    const { result } = mountAll()
    act(() => {
      result.current.cook.mutate({
        entry: ENTRY_PANCAKES,
        cooked: true,
        deltas: [{ ingredientId: PANTRY_FLOUR.ingredientId, delta: -10 }],
      })
    })
    await waitFor(() => expect(server.find('GET', '/api/meal-plan')).toHaveLength(1))
    await waitFor(() => expect(server.find('GET', '/api/pantry')).toHaveLength(1))
    await tick()
    expect(server.find('GET', '/api/meal-plan')).toHaveLength(1)
    expect(server.find('GET', '/api/pantry')).toHaveLength(1)
  })
})

describe('serialized writes per scope', () => {
  it('a pantry update waits for the add whose POST is still pending', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method === 'POST') await g.wait
        return undefined
      },
    })
    const { result } = mountAll()
    const item = newPantryItem({ ingredientId: 'ing-sugar', quantity: 2 })
    act(() => {
      result.current.addPantry.mutate(item)
      result.current.updatePantry.mutate({ id: item.id, patch: { quantity: 5 } })
      result.current.batch.mutate([{ ingredientId: 'ing-sugar', delta: -1 }])
    })
    await tick()
    expect(server.find('POST', '/api/pantry')).toHaveLength(1)
    expect(server.find('PUT', `/api/pantry/${item.id}`)).toHaveLength(0)
    expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(0)
    g.open()
    await waitFor(() => expect(server.find('PUT', `/api/pantry/${item.id}`)).toHaveLength(1))
    await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
  })

  it('a meal-plan update waits for the add whose POST is still pending', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method === 'POST') await g.wait
        return undefined
      },
    })
    const { result } = mountAll()
    const entry = newMealEntry({ recipeId: ENTRY_PANCAKES.recipeId, date: '2030-01-01', slot: 'dinner', servings: 2 })
    act(() => {
      result.current.addEntry.mutate(entry)
      result.current.updateEntry.mutate({ id: entry.id, patch: { date: '2030-01-02' } })
    })
    await tick()
    expect(server.find('PUT', `/api/meal-plan/${entry.id}`)).toHaveLength(0)
    g.open()
    await waitFor(() => expect(server.find('PUT', `/api/meal-plan/${entry.id}`)).toHaveLength(1))
  })

  it('writes of different scopes do not block each other', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method === 'POST' && call.path === '/api/pantry') await g.wait
        return undefined
      },
    })
    const { result } = mountAll()
    const item = newPantryItem({ ingredientId: 'ing-sugar', quantity: 2 })
    act(() => {
      result.current.addPantry.mutate(item)
      result.current.updateEntry.mutate({ id: ENTRY_PANCAKES.id, patch: { date: '2030-01-03' } })
    })
    await waitFor(() => expect(server.find('PUT', `/api/meal-plan/${ENTRY_PANCAKES.id}`)).toHaveLength(1))
    expect(result.current.addPantry.isPending).toBe(true)
    g.open()
    await waitFor(() => expect(result.current.addPantry.isSuccess).toBe(true))
  })
})
