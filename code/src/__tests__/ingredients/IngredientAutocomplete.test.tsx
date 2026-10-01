import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useIngredientsStore } from '../../store/ingredientsStore'
import IngredientAutocomplete from '../../components/ui/IngredientAutocomplete/IngredientAutocomplete'
import type { Ingredient } from '../../types/ingredient'

function resetStore() {
  useIngredientsStore.setState({ ingredientsDb: [] })
  localStorage.clear()
}

interface RenderProps {
  name?: string
  ingredientId?: string | null
  unit?: string
  onSelect?: (ing: Ingredient) => void
  onChange?: (name: string) => void
  onCreateNew?: (name: string, unit: string) => void
}

function renderAutocomplete({
  name = '',
  ingredientId = null,
  unit = '',
  onSelect = vi.fn(),
  onChange = vi.fn(),
  onCreateNew = vi.fn(),
}: RenderProps = {}) {
  return render(
    <IngredientAutocomplete
      name={name}
      ingredientId={ingredientId}
      unit={unit}
      onSelect={onSelect}
      onChange={onChange}
      onCreateNew={onCreateNew}
    />
  )
}

beforeEach(() => {
  resetStore()
  useIngredientsStore.getState().seedIngredients()
  cleanup()
})

describe('AC3 — Autocomplete filters on input', () => {
  it('shows no dropdown when input is empty', () => {
    renderAutocomplete({ name: '' })
    expect(screen.queryByTestId('autocomplete-dropdown')).not.toBeInTheDocument()
  })

  it('shows dropdown with filtered results when name prop contains text', () => {
    renderAutocomplete({ name: 'oni' })
    expect(screen.getByTestId('autocomplete-dropdown')).toBeInTheDocument()
  })

  it('dropdown includes Onion when typing "oni"', async () => {
    const user = userEvent.setup()
    let currentName = ''
    const onChange = vi.fn((v: string) => { currentName = v })
    const { rerender } = renderAutocomplete({ name: '', onChange })
    const input = screen.getByTestId('ingredient-name-input')
    // Simulate controlled input by typing and re-rendering with updated name
    await user.type(input, 'oni')
    rerender(
      <IngredientAutocomplete
        name="oni"
        ingredientId={null}
        unit=""
        onSelect={vi.fn()}
        onChange={onChange}
        onCreateNew={vi.fn()}
      />
    )
    expect(screen.getByTestId('autocomplete-dropdown')).toBeInTheDocument()
    expect(screen.getByText('Onion')).toBeInTheDocument()
    void currentName
  })

  it('filtering is case-insensitive', () => {
    renderAutocomplete({ name: 'ONION' })
    expect(screen.getByTestId('autocomplete-dropdown')).toBeInTheDocument()
    expect(screen.getByText('Onion')).toBeInTheDocument()
  })

  it('shows at most 8 suggestions', () => {
    renderAutocomplete({ name: 'a' })
    const options = screen.getAllByRole('option')
    expect(options.length).toBeLessThanOrEqual(8)
  })

  it('shows no dropdown when name is empty string', () => {
    renderAutocomplete({ name: '' })
    expect(screen.queryByTestId('autocomplete-dropdown')).not.toBeInTheDocument()
  })
})

describe('AC4 — Canonical binding on selection', () => {
  it('calls onSelect with ingredient data when option is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderAutocomplete({ name: 'Onion', ingredientId: null, unit: '', onSelect })
    const option = screen.getByText('Onion')
    await user.click(option)
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Onion', id: expect.any(String), defaultUnit: expect.any(String) })
    )
  })

  it('passes the ingredient defaultUnit to onSelect', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderAutocomplete({ name: 'Onion', ingredientId: null, unit: '', onSelect })
    await user.click(screen.getByText('Onion'))
    const called = onSelect.mock.calls[0][0] as Ingredient
    expect(called.defaultUnit).toBeTruthy()
  })
})

describe('AC5 — Unit read-only after binding', () => {
  it('shows unit as read-only text when ingredientId is set', () => {
    renderAutocomplete({ name: 'Onion', ingredientId: 'ing_001', unit: 'pcs' })
    const unitDisplay = screen.getByTestId('unit-display')
    expect(unitDisplay).toBeInTheDocument()
    expect(unitDisplay).toHaveTextContent('pcs')
  })

  it('does not render an editable unit input when ingredientId is set', () => {
    renderAutocomplete({ name: 'Onion', ingredientId: 'ing_001', unit: 'pcs' })
    expect(screen.queryByTestId('new-ingredient-unit-select')).not.toBeInTheDocument()
  })

  it('does not show unit display when ingredientId is null', () => {
    renderAutocomplete({ name: '', ingredientId: null, unit: '' })
    expect(screen.queryByTestId('unit-display')).not.toBeInTheDocument()
  })
})

describe('AC6 — Create new ingredient when no match', () => {
  it('shows create option when typed text has no match', () => {
    renderAutocomplete({ name: 'Quinoa XYZ Unique' })
    expect(screen.getByTestId('create-new-option')).toBeInTheDocument()
  })

  it('does not show create option when input is empty', () => {
    renderAutocomplete({ name: '' })
    expect(screen.queryByTestId('create-new-option')).not.toBeInTheDocument()
  })

  it('does not show create option when a match exists', () => {
    renderAutocomplete({ name: 'Onion' })
    expect(screen.queryByTestId('create-new-option')).not.toBeInTheDocument()
  })

  it('shows unit selector after clicking create-new-option', async () => {
    const user = userEvent.setup()
    renderAutocomplete({ name: 'Quinoa XYZ Unique' })
    await user.click(screen.getByTestId('create-new-option'))
    expect(screen.getByTestId('new-ingredient-unit-select')).toBeInTheDocument()
  })

  it('calls onCreateNew with name and selected unit after confirming', async () => {
    const user = userEvent.setup()
    const onCreateNew = vi.fn()
    renderAutocomplete({ name: 'Quinoa XYZ Unique', onCreateNew })
    await user.click(screen.getByTestId('create-new-option'))
    await user.selectOptions(screen.getByTestId('new-ingredient-unit-select'), 'g')
    await user.click(screen.getByTestId('confirm-create-new'))
    expect(onCreateNew).toHaveBeenCalledWith('Quinoa XYZ Unique', 'g')
  })
})

describe('AC7 — No freeform bypass: aria-invalid signals unbound rows', () => {
  it('marks input aria-invalid when text is non-empty but no ingredientId is bound', () => {
    renderAutocomplete({ name: 'Quinoa XYZ Unique', ingredientId: null, unit: '' })
    const input = screen.getByTestId('ingredient-name-input')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('input is not aria-invalid when ingredientId is bound', () => {
    renderAutocomplete({ name: 'Onion', ingredientId: 'ing_001', unit: 'pcs' })
    const input = screen.getByTestId('ingredient-name-input')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('input is not aria-invalid when name is empty', () => {
    renderAutocomplete({ name: '', ingredientId: null, unit: '' })
    const input = screen.getByTestId('ingredient-name-input')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })
})

describe('AC8 — Newly created ingredient appears in autocomplete', () => {
  it('ingredient added directly to store appears in dropdown suggestions', () => {
    useIngredientsStore.getState().addIngredient('Quinoa', 'g', 'Pantry & Dry Goods')
    renderAutocomplete({ name: 'Quinoa', ingredientId: null, unit: '' })
    expect(screen.getByTestId('autocomplete-dropdown')).toBeInTheDocument()
    expect(screen.getByText('Quinoa')).toBeInTheDocument()
  })

  it('full round-trip: after onCreateNew fires and parent adds to store, ingredient appears in suggestions', async () => {
    const user = userEvent.setup()
    const addIngredient = useIngredientsStore.getState().addIngredient
    let boundId: string | null = null
    let boundUnit = ''

    // onCreateNew simulates what the parent form would do
    const onCreateNew = vi.fn((newName: string, newUnit: string) => {
      const created = addIngredient(newName, newUnit, 'Other')
      boundId = created.id
      boundUnit = created.defaultUnit
    })

    const { rerender } = renderAutocomplete({
      name: 'Quinoa XYZ Unique',
      ingredientId: null,
      unit: '',
      onCreateNew,
    })

    await user.click(screen.getByTestId('create-new-option'))
    await user.selectOptions(screen.getByTestId('new-ingredient-unit-select'), 'g')
    await user.click(screen.getByTestId('confirm-create-new'))

    expect(onCreateNew).toHaveBeenCalledWith('Quinoa XYZ Unique', 'g')

    // Simulate parent binding the new ingredient (clears input + sets id)
    rerender(
      <IngredientAutocomplete
        name="Quinoa XYZ Unique"
        ingredientId={boundId}
        unit={boundUnit}
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onCreateNew={onCreateNew}
      />
    )

    // Now the ingredient is bound — unit display should appear
    expect(screen.getByTestId('unit-display')).toBeInTheDocument()

    // Searching for it again (unbound) should find it in the store
    rerender(
      <IngredientAutocomplete
        name="Quinoa XYZ Unique"
        ingredientId={null}
        unit=""
        onSelect={vi.fn()}
        onChange={vi.fn()}
        onCreateNew={onCreateNew}
      />
    )
    expect(screen.getByTestId('autocomplete-dropdown')).toBeInTheDocument()
    expect(screen.getByText('Quinoa XYZ Unique')).toBeInTheDocument()
  })
})
