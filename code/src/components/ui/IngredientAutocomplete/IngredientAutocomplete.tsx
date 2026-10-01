import { useState, useEffect } from 'react'
import { useIngredientsStore } from '../../../store/ingredientsStore'
import { INGREDIENT_UNITS } from '../../../types/ingredient'
import type { Ingredient, IngredientUnit } from '../../../types/ingredient'

const MAX_SUGGESTIONS = 8

interface Props {
  name: string
  ingredientId: string | null
  unit: string
  onChange: (name: string) => void
  onSelect: (ingredient: Ingredient) => void
  onCreateNew: (name: string, unit: string) => void
}

export default function IngredientAutocomplete({
  name,
  ingredientId,
  unit,
  onChange,
  onSelect,
  onCreateNew,
}: Props) {
  const ingredientsDb = useIngredientsStore(s => s.ingredientsDb)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newUnit, setNewUnit] = useState<IngredientUnit>('g')
  // dismissed becomes true when the user explicitly closes the dropdown (blur/Escape);
  // it resets whenever name changes so re-typing reopens the dropdown.
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
    if (name === '') setCreatingNew(false)
  }, [name])

  const isUnbound = name.length > 0 && ingredientId === null

  const allMatches = name.length === 0
    ? []
    : ingredientsDb.filter(i => i.name.toLowerCase().includes(name.toLowerCase()))

  const suggestions = allMatches.slice(0, MAX_SUGGESTIONS)

  // Check full DB for exact match (not just visible suggestions) to avoid
  // showing "Create" for an ingredient that exists beyond the 8-result cap.
  const hasMatch = allMatches.some(
    i => i.name.toLowerCase() === name.toLowerCase()
  )
  const showCreate = name.length > 0 && !hasMatch && !creatingNew
  const showDropdown =
    (suggestions.length > 0 || showCreate) && ingredientId === null && !creatingNew && !dismissed

  // Invalid when the user blurred (dismissed) with text that isn't bound to an ingredient.
  const isInvalid = isUnbound && !creatingNew && dismissed

  function handleSelect(ingredient: Ingredient) {
    setCreatingNew(false)
    setDismissed(true)
    onSelect(ingredient)
  }

  function handleCreateClick() {
    setCreatingNew(true)
  }

  function handleConfirmCreate() {
    setCreatingNew(false)
    onCreateNew(name, newUnit)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCreatingNew(false)
    onChange(e.target.value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') setDismissed(true)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        data-testid="ingredient-name-input"
        type="text"
        value={name}
        onChange={handleInputChange}
        onBlur={() => setDismissed(true)}
        onKeyDown={handleKeyDown}
        readOnly={ingredientId !== null}
        aria-invalid={isInvalid ? 'true' : undefined}
        className="form-input"
        placeholder="Ingredient name"
        autoComplete="off"
      />

      {ingredientId !== null && (
        <span data-testid="unit-display">{unit}</span>
      )}

      {showDropdown && (
        <ul
          data-testid="autocomplete-dropdown"
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            boxShadow: 'var(--shadow)',
            zIndex: 100,
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {suggestions.map(ing => (
            <li
              key={ing.id}
              role="option"
              aria-selected="false"
              style={{ padding: '8px 12px', cursor: 'pointer' }}
              onMouseDown={() => handleSelect(ing)}
            >
              {ing.name}
            </li>
          ))}

          {showCreate && (
            <li
              data-testid="create-new-option"
              style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--coral)' }}
              onMouseDown={handleCreateClick}
            >
              Create &ldquo;{name}&rdquo;
            </li>
          )}
        </ul>
      )}

      {creatingNew && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <select
            data-testid="new-ingredient-unit-select"
            value={newUnit}
            onChange={e => setNewUnit(e.target.value as IngredientUnit)}
            className="form-input"
          >
            {INGREDIENT_UNITS.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <button
            data-testid="confirm-create-new"
            type="button"
            className="btn btn-coral btn-sm"
            onClick={handleConfirmCreate}
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
