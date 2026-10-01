import { useState } from 'react'
import { useIngredientsStore } from '../../../store/ingredientsStore'
import type { Ingredient, IngredientUnit } from '../../../types/ingredient'

const VALID_UNITS: IngredientUnit[] = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp']
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

  const isUnbound = name.length > 0 && ingredientId === null
  const isInvalid = isUnbound && !creatingNew

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
    (suggestions.length > 0 || showCreate) && ingredientId === null && !creatingNew

  function handleSelect(ingredient: Ingredient) {
    setCreatingNew(false)
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

  return (
    <div style={{ position: 'relative' }}>
      <input
        data-testid="ingredient-name-input"
        type="text"
        value={name}
        onChange={handleInputChange}
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
            {VALID_UNITS.map(u => (
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
