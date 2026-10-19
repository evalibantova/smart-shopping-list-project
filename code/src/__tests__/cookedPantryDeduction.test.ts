import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { applyPantryDeltas } from '../utils/pantryDeltas'
import { useBatchPantry } from '../api/pantry'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { buildCookDeltas } from '../features/meal-planner/MealPlanOverlay'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'
import type { Recipe } from '../types/recipes'
import type { MealPlanEntry } from '../types/mealPlan'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const item = (id: string, ingredientId: string, quantity: number): PantryItem => ({
  id,
  ingredientId,
  quantity,
  maxStock: quantity * 3,
})

describe('applyPantryDeltas', () => {
  it('(a) deducts a matched ingredient: qty=3, delta=-1.5 -> 1.5', () => {
    const result = applyPantryDeltas([item('p1', 'ing-1', 3)], [{ ingredientId: 'ing-1', delta: -1.5 }])
    expect(result[0].quantity).toBe(1.5)
  })

  it('(b) floors at 0: qty=1, delta=-3 -> 0', () => {
    const result = applyPantryDeltas([item('p1', 'ing-2', 1)], [{ ingredientId: 'ing-2', delta: -3 }])
    expect(result[0].quantity).toBe(0)
  })

  it('(c) skips an unknown ingredientId silently; other items keep their identity', () => {
    const items = [item('p1', 'ing-3', 5)]
    const result = applyPantryDeltas(items, [{ ingredientId: 'unknown-ing', delta: -2 }])
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(items[0])
    expect(result[0].quantity).toBe(5)
  })

  it('(e) a reverse delta adds back: qty=1.5, delta=+1.5 -> 3', () => {
    const result = applyPantryDeltas([item('p1', 'ing-6', 1.5)], [{ ingredientId: 'ing-6', delta: 1.5 }])
    expect(result[0].quantity).toBe(3)
  })

  it('(f) two deltas for the same ingredient apply one after the other, clamping at each step (like the server)', () => {
    const items = [item('p1', 'ing-7', 5)]
    expect(applyPantryDeltas(items, [{ ingredientId: 'ing-7', delta: -3 }, { ingredientId: 'ing-7', delta: -3 }])[0].quantity).toBe(0)
    expect(applyPantryDeltas(items, [{ ingredientId: 'ing-7', delta: -3 }, { ingredientId: 'ing-7', delta: 1 }])[0].quantity).toBe(3)
  })

  it('(g) does not mutate its input', () => {
    const items = [item('p1', 'ing-8', 5)]
    applyPantryDeltas(items, [{ ingredientId: 'ing-8', delta: -2 }])
    expect(items[0].quantity).toBe(5)
  })
})

describe('useBatchPantry', () => {
  const SEED = { pantry: [item('p4', 'ing-4', 5), item('p5', 'ing-5', 5)] }
  const DELTAS = [
    { ingredientId: 'ing-4', delta: -2 },
    { ingredientId: 'ing-5', delta: -2 },
  ]

  it('applies the deductions at once, sends PUT /api/pantry/batch and keeps the server answer', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.path !== '/api/pantry/batch') return undefined
        await g.wait
        return new Response(JSON.stringify([item('p4', 'ing-4', 3), item('p5', 'ing-5', 3)]), { status: 200 })
      },
    })
    const { result, client } = renderHookWithClient(() => useBatchPantry(), { seed: SEED })
    act(() => {
      result.current.mutate(DELTAS)
    })
    await waitFor(() =>
      expect((client.getQueryData(queryKeys.pantry) as PantryItem[]).map((i) => i.quantity)).toEqual([3, 3]),
    )
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({ deltas: DELTAS })
  })

  it('(d) rollback on failure: restores every matched item and toasts when the server rejects the batch', async () => {
    const g = gate()
    installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.path !== '/api/pantry/batch') return undefined
        await g.wait
        return errorResponse(500, 'server_error')
      },
    })
    const { result, client } = renderHookWithClient(() => useBatchPantry(), { seed: SEED })
    act(() => {
      result.current.mutate(DELTAS)
    })
    await waitFor(() =>
      expect((client.getQueryData(queryKeys.pantry) as PantryItem[]).map((i) => i.quantity)).toEqual([3, 3]),
    )
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(client.getQueryData(queryKeys.pantry)).toEqual(SEED.pantry)
  })
})

describe('buildCookDeltas', () => {
  const baseRecipe: Recipe = {
    id: 'r1',
    emoji: '🍝',
    name: 'Test Recipe',
    servings: 2,
    tagIds: [],
    ingredients: [{ ingredientId: 'ing-a', quantity: 3 }],
    notes: '',
    createdAt: 0,
  }

  const baseEntry: Pick<MealPlanEntry, 'servings'> = { servings: 4 }

  it('(a) scale formula: entry.servings=4, recipe.servings=2, quantity=3, cooking → delta=-6', () => {
    const result = buildCookDeltas(baseRecipe, baseEntry, true)
    expect(result).toHaveLength(1)
    expect(result[0].ingredientId).toBe('ing-a')
    expect(result[0].delta).toBe(-6)
  })

  it('(b) direction: same inputs, newCooked=false → delta=+6', () => {
    const result = buildCookDeltas(baseRecipe, baseEntry, false)
    expect(result[0].delta).toBe(6)
  })

  it('(c) zero-servings guard: recipe.servings=0 → scale=1, delta=-3 for quantity=3', () => {
    const zeroServingsRecipe: Recipe = { ...baseRecipe, servings: 0 }
    const result = buildCookDeltas(zeroServingsRecipe, { servings: 4 }, true)
    expect(result[0].delta).toBe(-3)
  })

  it('(d) recipe with no ingredients → returns []', () => {
    const emptyRecipe: Recipe = { ...baseRecipe, ingredients: [] }
    const result = buildCookDeltas(emptyRecipe, baseEntry, true)
    expect(result).toHaveLength(0)
  })
})
