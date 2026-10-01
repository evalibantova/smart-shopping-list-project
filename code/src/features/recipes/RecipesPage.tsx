import { useState, useEffect } from 'react'
import { Plus, ChevronLeft } from 'lucide-react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useRecipesStore } from '../../store/recipesStore'
import { useTagsStore } from '../../store/tagsStore'
import RecipeDetail from '../../components/shared/RecipeDetail/RecipeDetail'
import RecipeForm from './RecipeForm'
import TagChip from '../../components/ui/TagChip/TagChip'
import type { Recipe } from '../../types/recipe'

export default function RecipesPage() {
  const isMobile = useIsMobile()
  const recipes = useRecipesStore(s => s.recipes)
  const tags = useTagsStore(s => s.tags)

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editRecipe, setEditRecipe] = useState<Recipe | undefined>(undefined)

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase()
    if (!q) return true
    if (r.name.toLowerCase().includes(q)) return true
    return r.tagIds.some(tid => {
      const tag = tags.find(t => t.id === tid)
      return tag?.name.toLowerCase().includes(q)
    })
  })

  const selectedRecipe = recipes.find(r => r.id === selectedId) ?? null

  // Clear selection if the selected recipe was deleted
  useEffect(() => {
    if (selectedId && !recipes.some(r => r.id === selectedId)) {
      setSelectedId(null)
    }
  }, [recipes, selectedId])

  function openCreate() {
    setEditRecipe(undefined)
    setShowForm(true)
  }

  function openEdit(recipe: Recipe) {
    setEditRecipe(recipe)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditRecipe(undefined)
  }

  const listPanel = (
    <div
      data-testid="recipes-list-panel"
      style={{
        width: isMobile ? '100%' : '280px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: isMobile ? 'none' : '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '10px 12px' }}>
        <input
          className="form-input"
          data-testid="recipe-search"
          placeholder="Search recipes or tags…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div
            data-testid="recipes-empty-state"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              gap: '12px',
              color: 'var(--text-dim)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '48px' }}>🍳</span>
            <p style={{ margin: 0 }}>No recipes yet. Add your first recipe to get started!</p>
          </div>
        )}
        {filtered.map(recipe => {
          const recipeTags = recipe.tagIds
            .map(id => tags.find(t => t.id === id))
            .filter(Boolean) as import('../../types/recipe').Tag[]
          return (
            <button
              key={recipe.id}
              data-testid="recipe-row"
              type="button"
              onClick={() => setSelectedId(recipe.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                padding: '12px 16px',
                background: selectedId === recipe.id ? 'var(--coral-pale)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{recipe.emoji}</span>
                <span
                  style={{
                    flex: 1,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text)',
                  }}
                >
                  {recipe.name}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', flexShrink: 0 }}>
                  {recipe.servings} srv
                </span>
              </div>
              {recipeTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '28px' }}>
                  {recipeTags.map(tag => (
                    <TagChip key={tag.id} tag={tag} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  const detailContent = selectedRecipe ? (
    <RecipeDetail
      key={selectedId}
      recipe={selectedRecipe}
      onEdit={() => openEdit(selectedRecipe)}
    />
  ) : (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-dim)',
      }}
    >
      Select a recipe to view
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="page-header">
        <h1>Recipes</h1>
        <div className="page-header-controls">
          <button
            className="btn btn-primary btn-sm"
            data-testid="add-recipe-btn"
            type="button"
            onClick={openCreate}
          >
            <Plus size={14} strokeWidth={2} />
            Add recipe
          </button>
        </div>
      </header>

      <div className="page-body" style={{ flexDirection: 'row', overflow: 'hidden' }}>
        {!isMobile && (
          <>
            {listPanel}
            <div
              data-testid="recipes-detail-panel"
              style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            >
              {detailContent}
            </div>
          </>
        )}

        {isMobile && (
          <>
            {listPanel}
            <div
              data-testid="recipe-detail-overlay"
              data-open={selectedId !== null ? 'true' : undefined}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--surface)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                transform: selectedId ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.25s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  gap: '8px',
                }}
              >
                <button
                  className="rd-act"
                  data-testid="recipe-detail-back"
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Back to list"
                >
                  <ChevronLeft size={20} strokeWidth={2} />
                </button>
                <span style={{ fontWeight: 600 }}>{selectedRecipe?.name ?? ''}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {selectedRecipe && (
                  <RecipeDetail
                    key={selectedId}
                    recipe={selectedRecipe}
                    onEdit={() => openEdit(selectedRecipe)}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <RecipeForm recipe={editRecipe} onClose={closeForm} />
      )}
    </div>
  )
}
