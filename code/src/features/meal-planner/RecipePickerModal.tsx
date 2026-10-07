import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search } from 'lucide-react'
import { useStore } from '../../store'
import { create } from './services/mealPlanService'
import type { MealPlanEntry } from '../../types/mealPlan'

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

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const filtered = query.trim()
    ? recipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
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

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '16px',
      }}
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-md)',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Add recipe to slot</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes..."
            autoFocus
            data-testid="recipe-picker-search"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, outline: 'none', color: 'var(--text)' }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
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
      </div>
    </div>,
    document.body
  )
}
