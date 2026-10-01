import { createPortal } from 'react-dom'
import { useRef, useEffect, useState } from 'react'
import { useRecipesStore } from '../../../store/recipesStore'
import type { Recipe } from '../../../types/recipe'

interface RecipePickerProps {
  onSelect: (recipe: Recipe) => void
  onClose: () => void
}

export default function RecipePicker({ onSelect, onClose }: RecipePickerProps) {
  const recipes = useRecipesStore(s => s.recipes)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div
      className="picker-modal-backdrop"
      data-testid="recipe-picker-modal"
      onKeyDown={handleKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="picker-modal-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          ref={searchRef}
          data-testid="recipe-picker-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="form-input"
        />
        {filtered.length === 0 ? (
          <div
            data-testid="recipe-picker-empty-state"
            style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '14px' }}
          >
            {recipes.length === 0
              ? 'No recipes yet. Add some recipes first.'
              : `No recipes match "${search}".`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
            {filtered.map(r => (
              <div
                key={r.id}
                data-testid="recipe-picker-item"
                onClick={() => onSelect(r)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(r) }}
                role="button"
                tabIndex={0}
                style={{
                  cursor: 'pointer',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{r.emoji}</span>
                <span style={{ fontWeight: 500, flex: 1, color: 'var(--text)' }}>{r.name}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{r.servings} servings</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
