import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { useDeleteRecipe, useRecipes, useSaveRecipe, type RecipeInput } from '../api/recipes'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, PANCAKES, TAG_BREAKFAST } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { Recipe } from '../types/recipes'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const DATA: RecipeInput = {
  emoji: '🥞',
  name: 'Pancakes v2',
  servings: 4,
  tagIds: [TAG_BREAKFAST.id],
  ingredients: [{ ingredientId: FLOUR.id, quantity: 250 }],
  notes: 'Better.',
}

describe('useRecipes', () => {
  it('returns the cached list, or fetches /api/recipes when empty', async () => {
    const cached = renderHookWithClient(() => useRecipes(), { seed: { recipes: [PANCAKES] } })
    expect(cached.result.current).toEqual([PANCAKES])

    installApi({ seed: { recipes: [PANCAKES] } })
    const fresh = renderHookWithClient(() => useRecipes(), { seed: null })
    await waitFor(() => expect(fresh.result.current).toEqual([PANCAKES]))
  })
})

describe('useSaveRecipe', () => {
  it('without an id it POSTs /api/recipes and appends the saved recipe', async () => {
    const server = installApi()
    const { result, client } = renderHookWithClient(() => useSaveRecipe(), { seed: { recipes: [PANCAKES] } })
    let saved: Recipe | undefined
    await act(async () => {
      saved = await result.current.mutateAsync({ data: DATA })
    })
    expect(server.find('POST', '/api/recipes')[0].body).toEqual(DATA)
    expect(saved).toMatchObject({ id: 'srv-1', name: 'Pancakes v2', createdAt: 1 })
    expect(client.getQueryData(queryKeys.recipes)).toEqual([PANCAKES, saved])
  })

  it('with an id it PUTs /api/recipes/<id> without createdAt and replaces the recipe in place', async () => {
    const server = installApi({ seed: { recipes: [PANCAKES] } })
    const { result, client } = renderHookWithClient(() => useSaveRecipe(), { seed: { recipes: [PANCAKES] } })
    await act(async () => {
      await result.current.mutateAsync({ id: PANCAKES.id, data: DATA })
    })
    const sent = server.find('PUT', `/api/recipes/${PANCAKES.id}`)[0].body as Record<string, unknown>
    expect(sent).toEqual(DATA)
    expect('createdAt' in sent).toBe(false)
    expect(client.getQueryData(queryKeys.recipes)).toEqual([{ ...PANCAKES, ...DATA }])
  })

  it('a 409 rejects with status 409 and leaves the cache as it was', async () => {
    installApi({ handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
    const { result, client } = renderHookWithClient(() => useSaveRecipe(), { seed: { recipes: [PANCAKES] } })
    await act(async () => {
      const outcome = await result.current.mutateAsync({ data: DATA }).catch((e: unknown) => e)
      expect(outcome).toMatchObject({ status: 409, code: 'conflict' })
    })
    expect(client.getQueryData(queryKeys.recipes)).toEqual([PANCAKES])
  })
})

describe('useDeleteRecipe', () => {
  it('DELETEs the recipe and drops it and its meal-plan entries from the cache', async () => {
    const server = installApi()
    const other = { ...ENTRY_PANCAKES, id: 'mp-2', recipeId: 'rec-other' }
    const { result, client } = renderHookWithClient(() => useDeleteRecipe(), {
      seed: { recipes: [PANCAKES], mealPlan: [ENTRY_PANCAKES, other] },
    })
    await act(async () => {
      await result.current.mutateAsync(PANCAKES.id)
    })
    expect(server.find('DELETE', `/api/recipes/${PANCAKES.id}`)).toHaveLength(1)
    expect(client.getQueryData(queryKeys.recipes)).toEqual([])
    expect(client.getQueryData(queryKeys.mealPlan)).toEqual([other])
  })

  it('a failed delete rejects and keeps everything', async () => {
    installApi({ handler: (call) => (call.method === 'DELETE' ? errorResponse(500, 'server_error') : undefined) })
    const { result, client } = renderHookWithClient(() => useDeleteRecipe(), {
      seed: { recipes: [PANCAKES], mealPlan: [ENTRY_PANCAKES] },
    })
    await act(async () => {
      const outcome = await result.current.mutateAsync(PANCAKES.id).catch((e: unknown) => e)
      expect(outcome).toMatchObject({ status: 500 })
    })
    expect(client.getQueryData(queryKeys.recipes)).toEqual([PANCAKES])
    expect(client.getQueryData(queryKeys.mealPlan)).toEqual([ENTRY_PANCAKES])
  })
})
