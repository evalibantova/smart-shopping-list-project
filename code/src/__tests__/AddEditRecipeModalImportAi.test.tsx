import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { installApi } from '../test/fetchMock'
import { FLOUR } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { DraftRow, RecipeDraft } from '../services/recipeImport/mapToRecipe'
import type { Tag } from '../types/recipes'

type SavedBody = { ingredients: { ingredientId: string; quantity: number }[]; tagIds: string[] }

const TAG_SOUP: Tag = { id: 'tag-soup', name: 'Polievka', color: '#26A69A' }

describe('AddEditRecipeModal: import review with AI proposals', () => {
  const onClose = vi.fn()
  const flourId = FLOUR.id
  let rendered: Rendered
  let server: ReturnType<typeof installApi>

  const cabbage: DraftRow = {
    ingredientId: null,
    ingredientName: 'čínska kapusta',
    quantity: 300,
    unit: 'g',
    flagged: true,
    estimated: true,
    matchedBy: 'ai',
    sourceText: '1/3 čínskej kapusty',
    newIngredient: { name: 'čínska kapusta', default_unit: 'g', category: 'Produce' },
  }
  const flour = (): DraftRow => ({
    ingredientId: flourId,
    ingredientName: 'Flour',
    quantity: 100,
    unit: 'g',
    flagged: false,
    estimated: false,
    matchedBy: 'ai',
    sourceText: '100 g múky',
    newIngredient: null,
  })
  const draft = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
    name: 'Rezance',
    servings: 2,
    notes: '',
    sourceHost: 'example.com',
    rows: [cabbage, flour()],
    tagIds: [TAG_SOUP.id],
    newTags: ['krevety'],
    ...over,
  })

  beforeEach(() => {
    onClose.mockReset()
    server = installApi({ seed: { ingredients: [FLOUR], tags: [TAG_SOUP] } })
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  function renderDraft(d: RecipeDraft) {
    rendered = renderWithClient(<AddEditRecipeModal mode="import" draft={d} onClose={onClose} />, {
      seed: { ingredients: [FLOUR], tags: [TAG_SOUP] },
    })
  }
  const text = () => document.body.textContent ?? ''
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const posts = (path: string) => server.find('POST', path)
  const recipeBody = () => posts('/api/recipes')[0].body as SavedBody

  it('shows the hints and banner counts for new, AI-matched and estimated rows', () => {
    renderDraft(draft())
    expect(text()).toContain('New ingredient (g) · ≈ estimated · From page: 1/3 čínskej kapusty')
    expect(text()).toContain('Matched by AI · From page: 100 g múky')
    expect(text()).toContain('1 new ingredient will be created')
    expect(text()).toContain('1 quantity estimated')
  })

  it('creates nothing before Save, and Discard creates nothing', () => {
    renderDraft(draft())
    act(() => button('Discard').click())
    expect(server.calls).toHaveLength(0)
  })

  it('Save creates the new ingredient and the new tag first, then the recipe bound to their server ids', async () => {
    renderDraft(draft())
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(posts('/api/recipes')).toHaveLength(1))
    expect(text()).not.toContain('Save without')

    // The recipe is only sent once everything it points at exists
    expect(server.calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([
      '/api/ingredients',
      '/api/tags',
      '/api/recipes',
    ])
    expect(posts('/api/ingredients')[0].body).toEqual({ name: 'čínska kapusta', default_unit: 'g', category: 'Produce' })
    expect(posts('/api/tags')[0].body).toEqual({ name: 'krevety', color: '#9E9E9E' })
    expect(recipeBody().ingredients).toEqual([
      { ingredientId: 'srv-1', quantity: 300 },
      { ingredientId: flourId, quantity: 100 },
    ])
    expect(recipeBody().tagIds).toEqual([TAG_SOUP.id, 'srv-2'])
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('a deselected new tag is not created', async () => {
    renderDraft(draft())
    // the chip's text may sit in a nested element: take the deepest match, the click bubbles to the chip
    const chip = Array.from(document.body.querySelectorAll('*'))
      .filter((el) => el.textContent?.trim() === 'krevety (new)')
      .pop() as HTMLElement
    act(() => chip.click())
    expect(text()).not.toContain('krevety (new)')
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(posts('/api/recipes')).toHaveLength(1))
    expect(posts('/api/tags')).toHaveLength(0)
    expect(recipeBody().tagIds).toEqual([TAG_SOUP.id])
  })

  it('creates a new ingredient once when two rows propose it', async () => {
    renderDraft(draft({ rows: [cabbage, { ...cabbage, ingredientName: 'Čínska kapusta ' }] }))
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(posts('/api/recipes')).toHaveLength(1))
    expect(posts('/api/ingredients')).toHaveLength(1)
    const [first, second] = recipeBody().ingredients
    expect(first.ingredientId).toBe(second.ingredientId)
  })

  it('editing the estimated quantity clears the estimate hint', () => {
    renderDraft(draft())
    const qty = document.body.querySelector('input[aria-label="Quantity"]') as HTMLInputElement
    act(() => typeInto(qty, '250'))
    expect(text()).not.toContain('≈ estimated')
    expect(text()).not.toContain('quantity estimated')
  })

  it('typing in the name of a new-ingredient row cancels the creation', () => {
    renderDraft(draft())
    const nameInput = document.body.querySelector('.rf-ing-row input:not([type="number"])') as HTMLInputElement
    act(() => typeInto(nameInput, 'kapusta pekinská'))
    expect(text()).not.toContain('will be created')
    expect(text()).not.toContain('New ingredient (g)')
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient?')
    expect(server.calls).toHaveLength(0)
  })

  it('a new ingredient with quantity 0 asks before saving', () => {
    renderDraft(draft({ rows: [{ ...cabbage, quantity: 0, estimated: false }] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save 1 ingredient with quantity 0?')
    expect(server.calls).toHaveLength(0)
  })

  it('typing over an AI-matched row drops the "Matched by AI" label', () => {
    renderDraft(draft())
    const nameInputs = document.body.querySelectorAll<HTMLInputElement>('.rf-ing-row input:not([type="number"])')
    act(() => typeInto(nameInputs[1], 'Fl'))
    expect(text()).not.toContain('Matched by AI')
  })

  it('a proposal with an invalid unit is an ordinary unmatched row and is never created', async () => {
    const bad: DraftRow = {
      ...cabbage,
      estimated: false,
      newIngredient: { name: 'čínska kapusta', default_unit: 'cup' as never, category: 'Produce' },
    }
    renderDraft(draft({ rows: [bad, flour()] }))
    expect(text()).toContain('1 ingredient needs matching')
    expect(text()).not.toContain('will be created')
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient?')
    expect(server.calls).toHaveLength(0)
    await act(async () => button('Save anyway').click())
    await waitFor(() => expect(posts('/api/recipes')).toHaveLength(1))
    expect(posts('/api/ingredients')).toHaveLength(0)
    expect(recipeBody().ingredients).toEqual([{ ingredientId: flourId, quantity: 100 }])
  })
})
