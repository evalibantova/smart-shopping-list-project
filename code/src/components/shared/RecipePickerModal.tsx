import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store'
import type { Recipe } from '../../types'

interface RecipePickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (recipe: Recipe) => void
}

export function RecipePickerModal({ open, onClose, onSelect }: RecipePickerModalProps) {
  const [query, setQuery] = useState('')
  const { recipes, tags } = useStore()

  const filtered = recipes.filter(r => {
    if (!query) return true
    const q = query.toLowerCase()
    if (r.name.toLowerCase().includes(q)) return true
    return r.tagNames.some(n => n.toLowerCase().includes(q))
  })

  function handleSelect(recipe: Recipe) {
    onSelect(recipe)
    setQuery('')
    onClose()
  }

  return (
    <Modal open={open} onClose={() => { setQuery(''); onClose() }} title="Pick a Recipe">
      <div style={{ marginBottom: 12 }}>
        <input
          className="form-input"
          placeholder="Search recipes or tags..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <div className="recipe-picker-list">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <span className="empty-state-emoji">{recipes.length === 0 ? '🍽️' : '🔍'}</span>
            <span className="empty-state-desc">
              {recipes.length === 0 ? 'No recipes yet. Add some first!' : 'No matches found.'}
            </span>
          </div>
        ) : filtered.map(r => {
          const recipeTags = r.tagNames.map(n => tags.find(t => t.name === n)).filter(Boolean)
          return (
            <div key={r.id} className="recipe-picker-item" onClick={() => handleSelect(r)}>
              <span style={{ fontSize: 20 }}>{r.emoji || '🍽️'}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                {recipeTags.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    {recipeTags.map(t => t && (
                      <span key={t.id} style={{ fontSize: 11, color: t.color, fontWeight: 700 }}>● {t.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
