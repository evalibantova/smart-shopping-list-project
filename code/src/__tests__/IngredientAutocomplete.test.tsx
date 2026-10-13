import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { IngredientAutocomplete } from '../components/shared/IngredientAutocomplete'
import { ingredientsDbService } from '../services/ingredientsDbService'

describe('IngredientAutocomplete', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>

  beforeEach(() => {
    localStorage.clear()
    for (const name of ['Chicken breast', 'Chicken thigh', 'Chickpeas'])
      ingredientsDbService.create(name, 'g', 'Other')
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    localStorage.clear()
  })

  async function renderComponent(
    value: string,
    onChange = vi.fn(),
    onSelect = vi.fn(),
    typed = true,
  ) {
    await act(async () => {
      root.render(
        <IngredientAutocomplete
          value={value}
          onChange={onChange}
          onSelect={onSelect}
        />,
      )
    })
    if (typed) {
      // The dropdown opens only after the user types, so simulate a keystroke
      const input = container.querySelector('input') as HTMLInputElement
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      await act(async () => {
        setter.call(input, value + "x")
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    return { onChange, onSelect }
  }

  it('(a) input with 2 chars renders a dropdown element', async () => {
    await renderComponent('ch')
    const dropdown = container.querySelector('[data-testid="ingredient-dropdown"]')
    expect(dropdown).not.toBeNull()
  })

  it('pre-filled value does not open the dropdown until the user types', async () => {
    await renderComponent('chicken', vi.fn(), vi.fn(), false)
    expect(container.querySelector('[data-testid="ingredient-dropdown"]')).toBeNull()
  })

  it('(b) input with 1 char renders no dropdown', async () => {
    await renderComponent('c')
    const dropdown = container.querySelector('[data-testid="ingredient-dropdown"]')
    expect(dropdown).toBeNull()
  })

  it('(c) clicking a dropdown entry calls onSelect with the correct IngredientDbEntry', async () => {
    const onSelect = vi.fn()
    await renderComponent('chi', vi.fn(), onSelect)

    const dropdown = container.querySelector('[data-testid="ingredient-dropdown"]')
    expect(dropdown).not.toBeNull()

    const firstItem = dropdown!.querySelector('div') as HTMLElement
    await act(async () => {
      firstItem.click()
    })

    expect(onSelect).toHaveBeenCalledOnce()
    const entry = onSelect.mock.calls[0][0]
    expect(typeof entry.id).toBe('string')
    expect(entry.name.toLowerCase()).toContain('chi')
    expect(entry).toHaveProperty('default_unit')
    expect(entry).toHaveProperty('category')
  })

  it('(d) typing a no-match name renders a Create option', async () => {
    await renderComponent('Tahini')
    const dropdown = container.querySelector('[data-testid="ingredient-dropdown"]')
    expect(dropdown).not.toBeNull()
    expect(dropdown!.textContent).toContain('Create')
  })

  it('(d2) Create is offered next to partial matches', async () => {
    await renderComponent('Chick')
    const dropdown = container.querySelector('[data-testid="ingredient-dropdown"]')!
    expect(dropdown.textContent).toContain('Chicken breast')
    expect(dropdown.querySelector('[data-testid="ingredient-create"]')).not.toBeNull()
  })

  it('(d3) Create is not offered when the typed name matches an ingredient exactly', async () => {
    await renderComponent('chickpeas')
    const dropdown = container.querySelector('[data-testid="ingredient-dropdown"]')!
    expect(dropdown.textContent).toContain('Chickpeas')
    expect(dropdown.querySelector('[data-testid="ingredient-create"]')).toBeNull()
  })

  it('(e) clicking Create then selecting a unit calls onSelect with a new entry written to localStorage', async () => {
    const onSelect = vi.fn()
    await renderComponent('Tahini', vi.fn(), onSelect)

    const dropdown = container.querySelector('[data-testid="ingredient-dropdown"]')
    expect(dropdown).not.toBeNull()
    const createDiv = dropdown!.querySelector('div') as HTMLElement
    await act(async () => {
      createDiv.click()
    })

    const unitPicker = container.querySelector('[data-testid="unit-picker"]')
    expect(unitPicker).not.toBeNull()

    const tbspBtn = Array.from(unitPicker!.querySelectorAll('button')).find(
      (b) => b.textContent === 'tbsp',
    ) as HTMLElement
    expect(tbspBtn).not.toBeUndefined()
    await act(async () => {
      tbspBtn.click()
    })

    expect(onSelect).toHaveBeenCalledOnce()
    const entry = onSelect.mock.calls[0][0]
    expect(entry.name).toBe('Tahini')
    expect(entry.default_unit).toBe('tbsp')
    expect(typeof entry.id).toBe('string')

    const all = ingredientsDbService.getAll()
    expect(all.some((e) => e.name === 'Tahini')).toBe(true)
  })

  it('(f) Escape key closes dropdown without calling onSelect', async () => {
    const onSelect = vi.fn()
    const onChange = vi.fn()
    await renderComponent('chi', onChange, onSelect)

    expect(container.querySelector('[data-testid="ingredient-dropdown"]')).not.toBeNull()

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(container.querySelector('[data-testid="ingredient-dropdown"]')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('(g) mousedown outside closes dropdown without clearing input', async () => {
    const onSelect = vi.fn()
    const onChange = vi.fn()
    await renderComponent('chi', onChange, onSelect)

    expect(container.querySelector('[data-testid="ingredient-dropdown"]')).not.toBeNull()

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="ingredient-dropdown"]')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalledWith('')
  })

  it('(f2) Escape when both pickers are closed is a no-op — onChange not called', async () => {
    const onChange = vi.fn()
    const onSelect = vi.fn()
    await renderComponent('', onChange, onSelect, false)

    expect(container.querySelector('[data-testid="ingredient-dropdown"]')).toBeNull()

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('(h) Escape while unit picker is open closes picker without creating an entry', async () => {
    const onSelect = vi.fn()
    await renderComponent('Tahini', vi.fn(), onSelect)

    const dropdown = container.querySelector('[data-testid="ingredient-dropdown"]')
    const createDiv = dropdown!.querySelector('div') as HTMLElement
    await act(async () => {
      createDiv.click()
    })

    expect(container.querySelector('[data-testid="unit-picker"]')).not.toBeNull()
    const countBefore = ingredientsDbService.getAll().length

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(container.querySelector('[data-testid="unit-picker"]')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(ingredientsDbService.getAll().length).toBe(countBefore)
  })
})
