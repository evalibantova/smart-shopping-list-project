import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import RecipesPage from '../features/recipes'
import { useStore } from '../store'
import { useToastStore } from '../store/toastStore'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, MILK, PANCAKES, PANTRY_FLOUR, PANTRY_MILK, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, waitFor, type Rendered } from '../test/renderWithClient'
import type { Recipe } from '../types/recipes'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'

const SEED = {
  recipes: [PANCAKES],
  tags: [TAG_BREAKFAST],
  ingredients: [FLOUR, MILK],
  pantry: [PANTRY_FLOUR, PANTRY_MILK],
  mealPlan: [ENTRY_PANCAKES],
}

describe('RecipesPage', () => {
  let rendered: Rendered

  beforeEach(() => {
    useStore.setState({ selectedId: PANCAKES.id })
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useStore.setState({ selectedId: null })
    useToastStore.setState({ message: '' })
  })

  function renderPage() {
    rendered = renderWithClient(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
      { seed: SEED },
    )
  }
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  // The detail panel is rendered twice (desktop panel and mobile overlay): the first one is enough
  const detailButton = (aria: string) => document.body.querySelector(`button[aria-label="${aria}"]`) as HTMLButtonElement

  it('lists the cached recipes', () => {
    renderPage()
    expect(document.body.textContent).toContain('Pancakes')
  })

  it('the trash icon only asks, and says planned meals are removed too', () => {
    const server = installApi({ seed: SEED })
    renderPage()
    act(() => detailButton('Delete recipe').click())
    expect(document.body.textContent).toContain('Meals planned with this recipe are removed from the meal plan too.')
    expect(server.calls).toHaveLength(0)
    act(() => button('Cancel').click())
    expect(document.body.textContent).not.toContain('removed from the meal plan too')
    expect(server.calls).toHaveLength(0)
  })

  it('confirming deletes on the server, drops the recipe and its planned meals, and clears the selection', async () => {
    const server = installApi({ seed: SEED })
    renderPage()
    act(() => detailButton('Delete recipe').click())
    await act(async () => button('Delete').click())
    await waitFor(() => expect(server.find('DELETE', '/api/recipes/rec-pancakes')).toHaveLength(1))
    await waitFor(() => expect(rendered.client.getQueryData<Recipe[]>(queryKeys.recipes)).toEqual([]))
    expect(rendered.client.getQueryData<MealPlanEntry[]>(queryKeys.mealPlan)).toEqual([])
    expect(useStore.getState().selectedId).toBeNull()
    expect(document.body.textContent).not.toContain('removed from the meal plan too')
  })

  it('a failed delete keeps the recipe and toasts', async () => {
    installApi({
      seed: SEED,
      handler: (call) => (call.method === 'DELETE' ? errorResponse(500, 'server_error') : undefined),
    })
    renderPage()
    act(() => detailButton('Delete recipe').click())
    await act(async () => button('Delete').click())
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not delete — please try again.'))
    expect(rendered.client.getQueryData<Recipe[]>(queryKeys.recipes)).toEqual([PANCAKES])
    expect(useStore.getState().selectedId).toBe(PANCAKES.id)
  })

  it('Mark as cooked deducts the recipe from the pantry through the batch route', async () => {
    const server = installApi({ seed: SEED })
    renderPage()
    act(() => detailButton('Mark as cooked').click())
    await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({
      deltas: [
        { ingredientId: 'ing-flour', delta: -200 },
        { ingredientId: 'ing-milk', delta: -300 },
      ],
    })
    const pantry = rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry)!
    expect(pantry.map((p) => p.quantity)).toEqual([300, 0])
    expect(useStore.getState().selectedId).toBeNull()
  })
})
