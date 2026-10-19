import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import CookNowPage from '../features/cook-now'
import { queryKeys } from '../api/queryKeys'
import { installApi } from '../test/fetchMock'
import { FLOUR, MILK, PANCAKES, PANTRY_FLOUR, PANTRY_MILK, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, waitFor, type Rendered } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'

const SEED = {
  recipes: [PANCAKES],
  tags: [TAG_BREAKFAST],
  ingredients: [FLOUR, MILK],
  pantry: [PANTRY_FLOUR, { ...PANTRY_MILK, quantity: 500 }],
}

describe('CookNowPage', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  const text = () => document.body.textContent ?? ''

  it('lists the recipes the pantry can cover', () => {
    rendered = renderWithClient(<CookNowPage />, { seed: SEED })
    expect(text()).toContain('Pancakes')
  })

  it('Mark as cooked deducts the recipe from the pantry through the batch route and clears the selection', async () => {
    const server = installApi({ seed: SEED })
    rendered = renderWithClient(<CookNowPage />, { seed: SEED })
    const row = Array.from(document.body.querySelectorAll('span')).find((s) => s.textContent === 'Pancakes') as HTMLElement
    act(() => row.click())
    const cooked = document.body.querySelector('button[aria-label="Mark as cooked"]') as HTMLButtonElement
    act(() => cooked.click())
    await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({
      deltas: [
        { ingredientId: 'ing-flour', delta: -200 },
        { ingredientId: 'ing-milk', delta: -300 },
      ],
    })
    expect(rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry)?.map((p) => p.quantity)).toEqual([300, 200])
    expect(text()).toContain('Select a recipe to see details')
  })
})
