import { useState } from 'react'
import { Search } from 'lucide-react'
import { useStore } from '../../store'
import { Modal } from '../../components/ui/Modal'
import { create } from './services/mealPlanService'
import type { MealPlanEntry } from '../../types/mealPlan'
import { searchMatches } from '../../utils/search'

interface Props {
  date: string
  slot: 'breakfast' | 'lunch' | 'dinner'
  onClose: () => void
}

export function RecipePickerModal({ date, slot, onClose }: Props) {
  const recipes = useStore((s) => s.recipes)
  const tags = useStore((s) => s.tags)
  const addEntry = useStore((s) => s.addEntry)
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? recipes.filter((r) => {
        if (searchMatches(r.name, query)) return true
        const recipeTags = tags.filter((t) => r.tagIds.includes(t.id))
        return recipeTags.some((t) => searchMatches(t.name, query))
      })
    : recipes

  function handleSelect(recipe: (typeof recipes)[0]) {
    const entry: MealPlanEntry = {
      id: crypto.randomUUID(),
      date,
      slot,
      recipeId: recipe.id,
      servings: recipe.servings,
    }
    addEntry(entry)
    create(entry)
    onClose()
  }

  return (
    <Modal isOpen onClose={onClose} title="Add recipe to slot" flush>
        {/* Search */}
        <div style={{ padding: '0 16px 10px', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div className="field-search">
            <Search size={14} />
            <input
              type="text"
              className="field"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes..."
              aria-label="Search recipes"
              autoFocus
              data-testid="recipe-picker-search"
            />
          </div>
        </div>

        {/* List */}
        <div>
          {filtered.length === 0 ? (
            <div
              data-testid="recipe-picker-empty-state"
              style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}
            >
              {recipes.length === 0
                ? 'No recipes yet. Add one from the Recipes page.'
                : `No recipes match "${query}".`}
            </div>
          ) : (
            filtered.map((recipe) => {
              const recipeTags = tags.filter((t) => recipe.tagIds.includes(t.id))
              return (
                <button
                  key={recipe.id}
                  data-testid="recipe-picker-item"
                  onClick={() => handleSelect(recipe)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}
                  >
                    {recipe.emoji || '🍽️'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{recipe.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                      {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
                      {recipeTags.length > 0 && ` · ${recipeTags.map((t) => t.name).join(' · ')}`}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
    </Modal>
  )
}
