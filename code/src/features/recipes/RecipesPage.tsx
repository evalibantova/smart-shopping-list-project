import { useState } from 'react'
import { Plus, ChevronLeft } from 'lucide-react'
import { useStore } from '../../store'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { RecipeFormModal } from './RecipeFormModal'
import { AddToWeekModal } from '../../components/shared/AddToWeekModal'
import { TagChip } from '../../components/ui/TagChip'
import type { Recipe } from '../../types'

export function RecipesPage() {
  const { recipes, tags } = useStore()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | undefined>()
  const [showAddToWeek, setShowAddToWeek] = useState(false)
  const [addToWeekRecipe, setAddToWeekRecipe] = useState<Recipe | null>(null)

  const filtered = recipes.filter(r => {
    if (!query) return true
    const q = query.toLowerCase()
    return r.name.toLowerCase().includes(q) || r.tagNames.some(t => t.toLowerCase().includes(q))
  })

  const selectedRecipe = recipes.find(r => r.id === selectedId)

  function handleEdit() {
    setEditingRecipe(selectedRecipe)
    setShowForm(true)
  }

  function handleAddToWeek() {
    setAddToWeekRecipe(selectedRecipe ?? null)
    setShowAddToWeek(true)
  }

  function handleAddNew() {
    setEditingRecipe(undefined)
    setShowForm(true)
  }

  return (
    <>
      <div className="page-header">
        <span className="page-title">Recipes</span>
        <button className="btn btn-primary btn-sm" onClick={handleAddNew}>
          <Plus size={14} /> Add recipe
        </button>
      </div>
      <div className="page-body" style={{ position: 'relative' }}>
        {/* List panel */}
        <div className="recipe-list-panel">
          <div className="recipe-list-search">
            <input
              className="form-input"
              placeholder="Search recipes..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="recipe-list-items">
            {filtered.length === 0 && (
              <div className="empty-state" style={{ padding: '40px 16px' }}>
                <span className="empty-state-emoji">🍽️</span>
                <span className="empty-state-title">{recipes.length === 0 ? 'No recipes yet' : 'No matches'}</span>
                <span className="empty-state-desc">
                  {recipes.length === 0 ? 'Add your first recipe to get started.' : 'Try a different search.'}
                </span>
              </div>
            )}
            {filtered.map(r => {
              const recipeTags = r.tagNames.map(n => tags.find(t => t.name === n)).filter(Boolean) as {id:string;name:string;color:string}[]
              return (
                <div
                  key={r.id}
                  className={`recipe-row${selectedId === r.id ? ' selected' : ''}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <span className="recipe-row-emoji">{r.emoji || '🍽️'}</span>
                  <div className="recipe-row-info">
                    <div className="recipe-row-name">{r.name}</div>
                    <div className="recipe-row-meta">
                      <span>{r.servings} servings</span>
                      {recipeTags.map(t => <TagChip key={t.id} name={t.name} color={t.color} />)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Single detail pane — flex panel on desktop, slide-in overlay on mobile */}
        <div className={`recipe-detail-pane${selectedId ? ' has-selection' : ''}`}>
          <div className="recipe-detail-pane-back">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedId(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          </div>
          {selectedRecipe ? (
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              <RecipeDetail
                key={selectedRecipe.id}
                recipe={selectedRecipe}
                context="recipes"
                onEdit={handleEdit}
                onAddToWeek={handleAddToWeek}
              />
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state-emoji">👈</span>
              <span className="empty-state-title">Select a recipe</span>
              <span className="empty-state-desc">Pick a recipe from the list to see details.</span>
            </div>
          )}
        </div>
      </div>

      <RecipeFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingRecipe(undefined) }}
        recipe={editingRecipe}
      />
      <AddToWeekModal
        open={showAddToWeek}
        onClose={() => setShowAddToWeek(false)}
        recipe={addToWeekRecipe}
      />
    </>
  )
}
