import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { ingredientsDbService } from '../services/ingredientsDbService'
import { tagService } from '../features/recipes/services/tagService'
import { useStore } from '../store'
import type { DraftRow, RecipeDraft } from '../services/recipeImport/mapToRecipe'

// React testing needs this flag to run act() without warnings
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('AddEditRecipeModal: import review with AI proposals', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>
  let flourId: string
  let soupTagId: string
  const onClose = vi.fn()

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
    tagIds: [soupTagId],
    newTags: ['krevety'],
    ...over,
  })

  beforeEach(() => {
    localStorage.clear()
    onClose.mockReset()
    useStore.setState({ recipes: [], tags: [] })
    flourId = ingredientsDbService.create('Flour', 'g', 'Pantry & Dry Goods').id
    soupTagId = tagService.create('Polievka', '#26A69A').id
    useStore.setState({ tags: tagService.getAll() })
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ''
  })

  function renderDraft(d: RecipeDraft) {
    act(() => {
      root.render(<AddEditRecipeModal mode="import" draft={d} onClose={onClose} />)
    })
  }
  const text = () => document.body.textContent ?? ''
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const dbNames = () => ingredientsDbService.getAll().map((e) => e.name)

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
    expect(dbNames()).toEqual(['Flour'])
    expect(tagService.getAll().map((t) => t.name)).toEqual(['Polievka'])
    expect(localStorage.getItem('slist_recipes')).toBeNull()
  })

  it('Save creates the new ingredient and the new tag, and binds the recipe to them', () => {
    renderDraft(draft())
    act(() => button('Save recipe').click())
    expect(text()).not.toContain('Save without')

    const created = ingredientsDbService.getAll().find((e) => e.name === 'čínska kapusta')!
    expect(created).toMatchObject({ default_unit: 'g', category: 'Produce' })
    const newTag = tagService.getAll().find((t) => t.name === 'krevety')!
    expect(newTag.color).toBe('#9E9E9E')

    const saved = useStore.getState().recipes[0]
    expect(saved.ingredients).toEqual([
      { ingredientId: created.id, quantity: 300 },
      { ingredientId: flourId, quantity: 100 },
    ])
    expect(saved.tagIds).toEqual([soupTagId, newTag.id])
    expect(useStore.getState().tags.map((t) => t.name)).toContain('krevety')
  })

  it('a deselected new tag is not created', () => {
    renderDraft(draft())
    // the chip's text may sit in a nested element: take the deepest match, the click bubbles to the chip
    const chip = Array.from(document.body.querySelectorAll('*'))
      .filter((el) => el.textContent?.trim() === 'krevety (new)')
      .pop() as HTMLElement
    act(() => chip.click())
    expect(text()).not.toContain('krevety (new)')
    act(() => button('Save recipe').click())
    expect(tagService.getAll().map((t) => t.name)).toEqual(['Polievka'])
  })

  it('creates a new ingredient once when two rows propose it', () => {
    renderDraft(draft({ rows: [cabbage, { ...cabbage, ingredientName: 'Čínska kapusta ' }] }))
    act(() => button('Save recipe').click())
    expect(dbNames().filter((n) => n.toLowerCase().startsWith('čínska'))).toHaveLength(1)
    const saved = useStore.getState().recipes[0]
    expect(saved.ingredients[0].ingredientId).toBe(saved.ingredients[1].ingredientId)
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
    expect(dbNames()).toEqual(['Flour'])
  })

  it('a new ingredient with quantity 0 asks before saving', () => {
    renderDraft(draft({ rows: [{ ...cabbage, quantity: 0, estimated: false }] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save 1 ingredient with quantity 0?')
    expect(dbNames()).toEqual(['Flour'])
  })
  it('typing over an AI-matched row drops the "Matched by AI" label', () => {
    renderDraft(draft())
    const nameInputs = document.body.querySelectorAll<HTMLInputElement>('.rf-ing-row input:not([type="number"])')
    act(() => typeInto(nameInputs[1], 'Fl'))
    expect(text()).not.toContain('Matched by AI')
  })

  it('a proposal with an invalid unit is an ordinary unmatched row and is never created', () => {
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
    expect(dbNames()).toEqual(['Flour'])
    act(() => button('Save anyway').click())
    expect(dbNames()).toEqual(['Flour'])
    expect(useStore.getState().recipes[0].ingredients).toEqual([{ ingredientId: flourId, quantity: 100 }])
  })
})
