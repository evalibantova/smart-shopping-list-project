import { useState, useEffect, useMemo, useRef } from 'react'
import { IngredientDbEntry } from '../../types/ingredients'
import { useCreateIngredient, useIngredients } from '../../api/ingredients'
import { messageForError } from '../../api/client'
import { searchIngredients } from '../../utils/ingredientSearch'

const CANONICAL_UNITS = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp'] as const

interface Props {
  value: string
  onChange: (v: string) => void
  onSelect: (entry: IngredientDbEntry) => void
  placeholder?: string
}

export function IngredientAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const ingredients = useIngredients()
  const createIngredient = useCreateIngredient()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const [createError, setCreateError] = useState('')
  // Dropdown opens only once the user has typed — not for a pre-filled value on mount
  const [typed, setTyped] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(
    () => (value.length >= 2 ? searchIngredients(ingredients, value) : []),
    [ingredients, value],
  )

  useEffect(() => {
    if (value.length >= 2) {
      setShowDropdown(typed)
      setShowUnitPicker(false)
    } else {
      setShowDropdown(false)
      setShowUnitPicker(false)
    }
    setCreateError('')
  }, [value, typed])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setShowUnitPicker(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showDropdown || showUnitPicker) {
          e.stopImmediatePropagation()
          setShowDropdown(false)
          setShowUnitPicker(false)
          onChange('')
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onChange, showDropdown, showUnitPicker])

  // Offer "Create" next to partial matches too, unless the typed name already exists exactly
  const typedName = value.trim().toLowerCase()
  const canCreate =
    typedName.length > 0 && !matches.some((m) => m.name.toLowerCase() === typedName)

  function handleSelect(entry: IngredientDbEntry) {
    onSelect(entry)
    setShowDropdown(false)
    setShowUnitPicker(false)
  }

  function handleCreate() {
    setShowDropdown(false)
    setCreateError('')
    setShowUnitPicker(true)
  }

  // The ingredient is saved on the server first; the row only gets it (with its server id) once that worked
  async function handleUnitSelect(unit: string) {
    setCreateError('')
    try {
      const entry = await createIngredient.mutateAsync({ name: value.trim(), default_unit: unit, category: 'Other' })
      onSelect(entry)
      setShowUnitPicker(false)
    } catch (err) {
      setCreateError(messageForError(err, 'ingredient'))
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="field"
        value={value}
        onChange={(e) => {
          setTyped(true)
          onChange(e.target.value)
        }}
        placeholder={placeholder}
      />

      {showDropdown && (
        <div
          data-testid="ingredient-dropdown"
          style={{
            position: 'absolute',
            zIndex: 100,
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-md)',
            maxHeight: '200px',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          {matches.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleSelect(entry)}
              style={{ padding: '8px 12px', cursor: 'pointer' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = ''
              }}
            >
              {entry.name}
            </div>
          ))}
          {canCreate && (
            <div
              data-testid="ingredient-create"
              onClick={handleCreate}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontStyle: 'italic',
                color: 'var(--text-mid)',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = ''
              }}
            >
              Create &ldquo;{value}&rdquo;
            </div>
          )}
        </div>
      )}

      {showUnitPicker && (
        <div
          data-testid="unit-picker"
          style={{
            position: 'absolute',
            zIndex: 100,
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-md)',
            padding: '12px',
            width: '100%',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
            Unit for &ldquo;{value.trim()}&rdquo;
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {CANONICAL_UNITS.map((unit) => (
              <button
                key={unit}
                type="button"
                disabled={createIngredient.isPending}
                onClick={() => handleUnitSelect(unit)}
                style={{
                  padding: '6px 12px',
                  cursor: createIngredient.isPending ? 'default' : 'pointer',
                  opacity: createIngredient.isPending ? 0.5 : 1,
                  border: 'none',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {unit}
              </button>
            ))}
          </div>
          {createIngredient.isPending && (
            <div
              data-testid="ingredient-saving"
              role="status"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: '2px solid var(--coral)',
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Saving…
            </div>
          )}
          {createError && (
            <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>
              {createError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
