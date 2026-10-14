// code/src/__tests__/AddEditRecipeModalImport.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { ingredientsDbService } from '../services/ingredientsDbService'
import { useStore } from '../store'
import type { RecipeDraft } from '../services/recipeImport/mapToRecipe'

// Tell React this is an act() environment so act() calls do not warn
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('AddEditRecipeModal — import review mode', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>
  let flourId: string
  const onClose = vi.fn()

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
    localStorage.clear()
    onClose.mockReset()
    useStore.setState({ recipes: [], tags: [] })
    flourId = ingredientsDbService.create('Flour', 'g', 'Pantry').id
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

  function renderImport(d: RecipeDraft) {
    act(() => {
      root.render(<AddEditRecipeModal mode="import" draft={d} onClose={onClose} />)
    })
  }
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

  it('shows the banner, the title, and counts of unmatched and flagged rows', () => {
    renderImport(draft())
    const text = document.body.textContent ?? ''
    expect(text).toContain('Review imported recipe')
    expect(text).toContain('Imported from example.com')
    expect(text).toContain('1 ingredient needs matching')
    expect(text).toContain('From page: 2 g saffron')
  })

  it('writes nothing before Save, and Discard saves nothing', () => {
    renderImport(draft())
    expect(localStorage.getItem('slist_recipes')).toBeNull()
    act(() => button('Discard').click())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('slist_recipes')).toBeNull()
    expect(useStore.getState().recipes).toHaveLength(0)
  })

  it('asks before dropping unmatched ingredients, and Go back keeps everything unsaved', () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    expect(document.body.textContent).toContain('Save without 1 unmatched ingredient?')
    expect(localStorage.getItem('slist_recipes')).toBeNull()

    act(() => button('Go back').click())
    expect(document.body.textContent).not.toContain('Save without')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Save anyway saves the recipe with only the matched ingredient', () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    act(() => button('Save anyway').click())

    const saved = useStore.getState().recipes
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Pancakes')
    expect(saved[0].ingredients).toEqual([{ ingredientId: flourId, quantity: 200 }])
    expect(saved[0].notes).toContain('Zdroj: [example.com]')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('saves directly, with no confirmation, when every row is matched', () => {
    renderImport(draft({ rows: [draft().rows[0]] }))
    act(() => button('Save recipe').click())
    expect(document.body.textContent).not.toContain('Save without')
    expect(useStore.getState().recipes).toHaveLength(1)
  })

  it('editing a flagged quantity clears its flag', () => {
    renderImport(
      draft({
        rows: [{ ingredientId: flourId, ingredientName: 'Flour', quantity: 0, unit: 'g', flagged: true, sourceText: '2 cup flour' }],
      }),
    )
    expect(document.body.textContent).toContain('1 quantity to check')
    const qty = document.body.querySelector('input[aria-label="Quantity"]') as HTMLInputElement
    act(() => typeInto(qty, '250'))
    expect(document.body.textContent).not.toContain('quantity to check')
  })

  it('leaves normal add mode unchanged', () => {
    act(() => {
      root.render(<AddEditRecipeModal mode="add" onClose={onClose} />)
    })
    const text = document.body.textContent ?? ''
    expect(text).toContain('New Recipe')
    expect(text).not.toContain('Imported from')
    expect(button('Cancel')).toBeDefined()
    expect(button('Save')).toBeDefined()
  })
})
