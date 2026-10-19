import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { IngredientAutocomplete } from '../components/shared/IngredientAutocomplete'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { IngredientDbEntry } from '../types/ingredients'

const SEED: IngredientDbEntry[] = ['Chicken breast', 'Chicken thigh', 'Chickpeas'].map((name, i) => ({
  id: `ing-${i}`,
  name,
  default_unit: 'g',
  category: 'Other',
}))

describe('IngredientAutocomplete', () => {
  let rendered: Rendered | undefined

  afterEach(() => {
    rendered?.unmount()
    rendered = undefined
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  async function renderComponent(
    value: string,
    { onChange = vi.fn(), onSelect = vi.fn(), typed = true }: { onChange?: ReturnType<typeof vi.fn>; onSelect?: ReturnType<typeof vi.fn>; typed?: boolean } = {},
  ) {
    rendered = renderWithClient(<IngredientAutocomplete value={value} onChange={onChange} onSelect={onSelect} />, {
      seed: { ingredients: SEED },
    })
    const container = rendered.container
    if (typed) {
      // The dropdown opens only after the user types, so simulate a keystroke
      const input = container.querySelector('input') as HTMLInputElement
      await act(async () => {
        typeInto(input, value + 'x')
      })
    }
    return { container, onChange, onSelect }
  }

  const dropdownOf = (c: HTMLElement) => c.querySelector('[data-testid="ingredient-dropdown"]')

  async function openUnitPicker(container: HTMLElement) {
    const createDiv = dropdownOf(container)!.querySelector('div') as HTMLElement
    await act(async () => {
      createDiv.click()
    })
    return container.querySelector('[data-testid="unit-picker"]')!
  }
  const unitButton = (picker: Element, unit: string) =>
    Array.from(picker.querySelectorAll('button')).find((b) => b.textContent === unit) as HTMLButtonElement

  it('(a) input with 2 chars renders a dropdown element', async () => {
    const { container } = await renderComponent('ch')
    expect(dropdownOf(container)).not.toBeNull()
  })

  it('pre-filled value does not open the dropdown until the user types', async () => {
    const { container } = await renderComponent('chicken', { typed: false })
    expect(dropdownOf(container)).toBeNull()
  })

  it('(b) input with 1 char renders no dropdown', async () => {
    const { container } = await renderComponent('c')
    expect(dropdownOf(container)).toBeNull()
  })

  it('(c) clicking a dropdown entry calls onSelect with the cached IngredientDbEntry', async () => {
    const onSelect = vi.fn()
    const { container } = await renderComponent('chi', { onSelect })
    const firstItem = dropdownOf(container)!.querySelector('div') as HTMLElement
    await act(async () => {
      firstItem.click()
    })
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0][0]).toEqual(SEED[0])
  })

  it('(d) typing a no-match name renders a Create option', async () => {
    const { container } = await renderComponent('Tahini')
    expect(dropdownOf(container)!.textContent).toContain('Create')
  })

  it('(d2) Create is offered next to partial matches', async () => {
    const { container } = await renderComponent('Chick')
    const dropdown = dropdownOf(container)!
    expect(dropdown.textContent).toContain('Chicken breast')
    expect(dropdown.querySelector('[data-testid="ingredient-create"]')).not.toBeNull()
  })

  it('(d3) Create is not offered when the typed name matches an ingredient exactly', async () => {
    const { container } = await renderComponent('chickpeas')
    const dropdown = dropdownOf(container)!
    expect(dropdown.textContent).toContain('Chickpeas')
    expect(dropdown.querySelector('[data-testid="ingredient-create"]')).toBeNull()
  })

  it('(e) Create then a unit POSTs the ingredient and calls onSelect with the saved entry', async () => {
    const server = installApi({ seed: { ingredients: SEED } })
    const onSelect = vi.fn()
    const onChange = vi.fn()
    const { container } = await renderComponent('Tahini', { onChange, onSelect })
    const picker = await openUnitPicker(container)
    onChange.mockClear() // drop the helper's simulated keystroke

    await act(async () => {
      unitButton(picker, 'tbsp').click()
    })
    await waitFor(() => expect(onSelect).toHaveBeenCalledOnce())

    // Clearing the input after creation would wipe the freshly selected ingredient
    expect(onChange).not.toHaveBeenCalled()
    expect(server.find('POST', '/api/ingredients')[0].body).toEqual({ name: 'Tahini', default_unit: 'tbsp', category: 'Other' })
    const entry = onSelect.mock.calls[0][0] as IngredientDbEntry
    expect(entry).toEqual({ id: 'srv-1', name: 'Tahini', default_unit: 'tbsp', category: 'Other' })
    expect(rendered!.client.getQueryData(queryKeys.ingredients)).toContainEqual(entry)
    expect(container.querySelector('[data-testid="unit-picker"]')).toBeNull()
  })

  it('(e2) shows a spinner and disables the units while the server saves, and selects nothing before it answers', async () => {
    const g = gate()
    installApi({
      seed: { ingredients: SEED },
      handler: async (call) => {
        if (call.method === 'POST') await g.wait
        return undefined
      },
    })
    const onSelect = vi.fn()
    const { container } = await renderComponent('Tahini', { onSelect })
    const picker = await openUnitPicker(container)
    await act(async () => {
      unitButton(picker, 'tbsp').click()
    })
    await waitFor(() => expect(container.querySelector('[data-testid="ingredient-saving"]')).not.toBeNull())
    expect(unitButton(picker, 'g').disabled).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()

    g.open()
    await waitFor(() => expect(onSelect).toHaveBeenCalledOnce())
    expect(container.querySelector('[data-testid="ingredient-saving"]')).toBeNull()
  })

  it('(e3) a 409 (name already exists) shows a message, keeps the picker open and selects nothing', async () => {
    installApi({
      seed: { ingredients: SEED },
      handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined),
    })
    const onSelect = vi.fn()
    const { container } = await renderComponent('Tahini', { onSelect })
    const picker = await openUnitPicker(container)
    await act(async () => {
      unitButton(picker, 'tbsp').click()
    })
    await waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('An ingredient with that name already exists.'))
    expect(onSelect).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="unit-picker"]')).not.toBeNull()
  })

  it('(f) Escape key closes dropdown without calling onSelect', async () => {
    const onSelect = vi.fn()
    const onChange = vi.fn()
    const { container } = await renderComponent('chi', { onChange, onSelect })
    expect(dropdownOf(container)).not.toBeNull()

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(dropdownOf(container)).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('(g) mousedown outside closes dropdown without clearing input', async () => {
    const onSelect = vi.fn()
    const onChange = vi.fn()
    const { container } = await renderComponent('chi', { onChange, onSelect })
    expect(dropdownOf(container)).not.toBeNull()

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(dropdownOf(container)).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalledWith('')
  })

  it('(f2) Escape when both pickers are closed is a no-op: onChange not called', async () => {
    const onChange = vi.fn()
    const onSelect = vi.fn()
    const { container } = await renderComponent('', { onChange, onSelect, typed: false })
    expect(dropdownOf(container)).toBeNull()

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('(h) Escape while the unit picker is open closes it without creating anything', async () => {
    const server = installApi({ seed: { ingredients: SEED } })
    const onSelect = vi.fn()
    const { container } = await renderComponent('Tahini', { onSelect })
    await openUnitPicker(container)

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(container.querySelector('[data-testid="unit-picker"]')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(server.calls).toHaveLength(0)
  })
})
