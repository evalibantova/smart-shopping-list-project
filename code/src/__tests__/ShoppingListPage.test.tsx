import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import ShoppingListPage from '../features/shopping-list'
import { toDateStr } from '../features/meal-planner/utils/calendarUtils'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, MILK, PANCAKES } from '../test/fixtures'
import { renderWithClient, waitFor, type Rendered } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'

// Two servings of the two-serving pancakes: 200 g flour and 300 ml milk, nothing in the pantry
const SEED = {
  recipes: [PANCAKES],
  ingredients: [FLOUR, MILK],
  mealPlan: [{ ...ENTRY_PANCAKES, date: toDateStr(new Date()), servings: 2 }],
  pantry: [] as PantryItem[],
}

describe('ShoppingListPage', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useToastStore.setState({ message: '' })
  })

  const text = () => document.body.textContent ?? ''
  const pantry = () => rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []
  const item = (name: string) =>
    Array.from(document.body.querySelectorAll('[data-testid="shopping-list-item"]')).find((el) =>
      el.textContent?.includes(name),
    ) as HTMLElement
  const progress = () => document.body.querySelector('[data-testid="shopping-list-progress"]')?.textContent ?? ''

  it('lists what is missing for the planned meals', () => {
    rendered = renderWithClient(<ShoppingListPage />, { seed: SEED })
    expect(text()).toContain('Flour')
    expect(text()).toContain('200 g')
    expect(text()).toContain('Milk')
    expect(text()).toContain('300 ml')
    expect(progress()).toContain('0 / 2 checked')
  })

  it('checking an item not in the pantry creates the pantry item (client id) and keeps the row visible', async () => {
    const server = installApi({ seed: SEED })
    rendered = renderWithClient(<ShoppingListPage />, { seed: SEED })
    act(() => item('Flour').click())
    expect(progress()).toContain('1 / 2 checked')
    await waitFor(() => expect(server.find('POST', '/api/pantry')).toHaveLength(1))
    expect(pantry()).toHaveLength(1)
    expect(server.find('POST', '/api/pantry')[0].body).toEqual({
      id: expect.any(String),
      ingredientId: 'ing-flour',
      quantity: 200,
      maxStock: 600,
    })
    expect(progress()).toContain('1 / 2 checked')
  })

  it('un-checking takes the quantity out of the pantry again through the batch route', async () => {
    const server = installApi({ seed: SEED })
    rendered = renderWithClient(<ShoppingListPage />, { seed: SEED })
    act(() => item('Flour').click())
    await waitFor(() => expect(server.find('POST', '/api/pantry')).toHaveLength(1))
    act(() => item('Flour').click())
    await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({ deltas: [{ ingredientId: 'ing-flour', delta: -200 }] })
    await waitFor(() => expect(progress()).toContain('0 / 2 checked'))
  })

  it('a failed pantry write un-checks the item again and toasts', async () => {
    installApi({ seed: SEED, handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
    rendered = renderWithClient(<ShoppingListPage />, { seed: SEED })
    act(() => item('Flour').click())
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    await waitFor(() => expect(progress()).toContain('0 / 2 checked'))
    expect(pantry()).toEqual([])
  })
})
