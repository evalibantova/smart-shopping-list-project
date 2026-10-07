import { useState, useEffect, useRef } from 'react'
import { IngredientDbEntry } from '../../types/ingredients'
import { ingredientsDbService } from '../../services/ingredientsDbService'

const CANONICAL_UNITS = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp'] as const

interface Props {
  value: string
  onChange: (v: string) => void
  onSelect: (entry: IngredientDbEntry) => void
  placeholder?: string
}

export function IngredientAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const [matches, setMatches] = useState<IngredientDbEntry[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.length >= 2) {
      setMatches(ingredientsDbService.search(value))
      setShowDropdown(true)
      setShowUnitPicker(false)
    } else {
      setMatches([])
      setShowDropdown(false)
      setShowUnitPicker(false)
    }
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setShowUnitPicker(false)
        onChange('')
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowDropdown(false)
        setShowUnitPicker(false)
        onChange('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onChange])

  function handleSelect(entry: IngredientDbEntry) {
    onSelect(entry)
    setShowDropdown(false)
    setShowUnitPicker(false)
  }

  function handleCreate() {
    setShowDropdown(false)
    setShowUnitPicker(true)
  }

  function handleUnitSelect(unit: string) {
    const newEntry = ingredientsDbService.create(value.trim(), unit, 'Other')
    onSelect(newEntry)
    setShowUnitPicker(false)
    onChange('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
          {matches.length === 0 && (
            <div
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {CANONICAL_UNITS.map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => handleUnitSelect(unit)}
                style={{
                  padding: '4px 10px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-mid)',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                }}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
