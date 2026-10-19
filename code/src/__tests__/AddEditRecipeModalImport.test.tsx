// code/src/__tests__/AddEditRecipeModalImport.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { queryKeys } from '../api/queryKeys'
import { installApi } from '../test/fetchMock'
import { FLOUR } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { RecipeDraft } from '../services/recipeImport/mapToRecipe'
import type { Recipe } from '../types/recipes'

type SavedBody = { name: string; notes: string; ingredients: { ingredientId: string; quantity: number }[] }

describe('AddEditRecipeModal: import review mode', () => {
  const onClose = vi.fn()
  const flourId = FLOUR.id
  let rendered: Rendered
  let server: ReturnType<typeof installApi>
  const recipePosts = () => server.find('POST', '/api/recipes')
  const savedBody = () => recipePosts()[0].body as SavedBody

  function draft(over: Partial<RecipeDraft> = {}): RecipeDraft {
    return {
      name: 'Pancakes',
      servings: 4,
      notes: '1. Mix\n\nZdroj: [example.com](https://example.com/p)',
      sourceHost: 'example.com',
      rows: [
        { ingredientId: flourId, ingredientName: 'Flour', quantity: 200, unit: 'g', flagged: false, sourceText: '200 g flour' },
        { ingredientId: null, ingredientName: 'saffron', quantity: 2, unit: '', flagged: true, sourceText: '2 g saffron' },
      ],
      ...over,
    }
  }

  beforeEach(() => {
    onClose.mockReset()
    server = installApi({ seed: { ingredients: [FLOUR] } })
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  function renderImport(d: RecipeDraft) {
    rendered = renderWithClient(<AddEditRecipeModal mode="import" draft={d} onClose={onClose} />, {
      seed: { ingredients: [FLOUR] },
    })
  }
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const text = () => document.body.textContent ?? ''

  it('shows the banner, the title, and counts of unmatched and flagged rows', () => {
    renderImport(draft())
    expect(text()).toContain('Review imported recipe')
    expect(text()).toContain('Imported from example.com')
    expect(text()).toContain('1 ingredient needs matching')
    expect(text()).toContain('From page: 2 g saffron')
  })

  it('sends nothing before Save, and Discard saves nothing', () => {
    renderImport(draft())
    expect(server.calls).toHaveLength(0)
    act(() => button('Discard').click())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(server.calls).toHaveLength(0)
  })

  it('asks before dropping unmatched ingredients, and Go back keeps everything unsaved', () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient?')
    expect(server.calls).toHaveLength(0)

    act(() => button('Go back').click())
    expect(text()).not.toContain('Save without')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Save anyway saves the recipe with only the matched ingredient', async () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    await act(async () => button('Save anyway').click())

    await waitFor(() => expect(recipePosts()).toHaveLength(1))
    expect(savedBody().name).toBe('Pancakes')
    expect(savedBody().ingredients).toEqual([{ ingredientId: flourId, quantity: 200 }])
    expect(savedBody().notes).toContain('Zdroj: [example.com]')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(rendered.client.getQueryData<Recipe[]>(queryKeys.recipes)).toHaveLength(1)
  })

  it('saves directly, with no confirmation, when every row is matched', async () => {
    renderImport(draft({ rows: [draft().rows[0]] }))
    await act(async () => button('Save recipe').click())
    expect(text()).not.toContain('Save without')
    await waitFor(() => expect(recipePosts()).toHaveLength(1))
  })

  it('editing a flagged quantity clears its flag', () => {
    renderImport(
      draft({
        rows: [{ ingredientId: flourId, ingredientName: 'Flour', quantity: 0, unit: 'g', flagged: true, sourceText: '2 cup flour' }],
      }),
    )
    expect(text()).toContain('1 quantity to check')
    const qty = document.body.querySelector('input[aria-label="Quantity"]') as HTMLInputElement
    act(() => typeInto(qty, '250'))
    expect(text()).not.toContain('quantity to check')
  })

  const zeroRow = (over = {}) => ({
    ingredientId: flourId,
    ingredientName: 'Flour',
    quantity: 0,
    unit: 'g',
    flagged: true,
    sourceText: '2 cup flour',
    ...over,
  })
  const unboundRow = (name = 'saffron') => ({
    ingredientId: null,
    ingredientName: name,
    quantity: 2,
    unit: '',
    flagged: true,
    sourceText: `2 g ${name}`,
  })

  it('asks before saving a matched row at quantity 0, and does not save yet', async () => {
    renderImport(draft({ rows: [zeroRow()] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save 1 ingredient with quantity 0?')
    expect(recipePosts()).toHaveLength(0)
    await act(async () => button('Save anyway').click())
    await waitFor(() => expect(recipePosts()).toHaveLength(1))
    expect(savedBody().ingredients).toEqual([{ ingredientId: flourId, quantity: 0 }])
  })

  it('uses plural wording for the zero-quantity prompt', () => {
    renderImport(draft({ rows: [zeroRow(), zeroRow()] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save 2 ingredients with quantity 0?')
  })

  it('combines both kinds in one prompt', () => {
    renderImport(draft({ rows: [zeroRow(), unboundRow()] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient and with 1 at quantity 0?')
    expect(recipePosts()).toHaveLength(0)
  })

  it('drops the prompt, never showing "Save without 0", once the last issue is fixed', () => {
    renderImport(draft({ rows: [zeroRow()] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('with quantity 0?')
    const qty = document.body.querySelector('input[aria-label="Quantity"]') as HTMLInputElement
    act(() => typeInto(qty, '250'))
    expect(text()).not.toContain('Save without')
    expect(text()).not.toContain('quantity 0?')
    expect(button('Discard')).toBeDefined()
    expect(button('Save recipe')).toBeDefined()
  })

  it('removing the last unmatched row while the prompt is open never reads "Save without 0"', () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient?')
    const removes = document.body.querySelectorAll('button[aria-label="Remove ingredient"]')
    act(() => (removes[1] as HTMLButtonElement).click())
    expect(text()).not.toContain('Save without')
    expect(button('Save recipe')).toBeDefined()
  })

  it('selecting an ingredient for an unbound row clears its flag and the unmatched count', () => {
    renderImport(draft({ rows: [unboundRow('Flour')] }))
    expect(text()).toContain('1 ingredient needs matching')
    const ing = document.body.querySelector('input[placeholder="Ingredient…"]') as HTMLInputElement
    act(() => typeInto(ing, 'Flou'))
    const option = Array.from(document.body.querySelectorAll('[data-testid="ingredient-dropdown"] div')).find((d) =>
      d.textContent?.trim().startsWith('Flour'),
    ) as HTMLElement
    act(() => option.click())
    expect(text()).not.toContain('needs matching')
    expect(text()).not.toContain('From page:')
    expect(document.body.querySelector('.rf-flagged')).toBeNull()
  })

  it('uses plural wording in the banner', () => {
    renderImport(draft({ rows: [unboundRow('saffron'), unboundRow('cumin'), zeroRow(), zeroRow()] }))
    expect(text()).toContain('2 ingredients need matching')
    expect(text()).toContain('2 quantities to check')
  })

  it('leaves normal add mode unchanged', () => {
    rendered = renderWithClient(<AddEditRecipeModal mode="add" onClose={onClose} />, { seed: { ingredients: [FLOUR] } })
    expect(text()).toContain('New Recipe')
    expect(text()).not.toContain('Imported from')
    expect(button('Cancel')).toBeDefined()
    expect(button('Save')).toBeDefined()
  })
})
