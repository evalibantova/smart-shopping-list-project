import { useState, useEffect } from 'react'
import { ChevronLeft, Plus, Search } from 'lucide-react'
import { useStore } from '../../store'
import { recipeService } from './services/recipeService'
import { Recipe } from '../../types/recipes'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { AddEditRecipeModal } from './AddEditRecipeModal'
import { AddToWeekModal } from '../meal-planner/AddToWeekModal'
import { getWeekStart } from '../meal-planner/utils/calendarUtils'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { TagChip } from '../../components/ui/TagChip'

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; recipe: Recipe }

export default function RecipesPage() {
  const recipes = useStore((s) => s.recipes)
  const tags = useStore((s) => s.tags)
  const selectedId = useStore((s) => s.selectedId)
  const selectRecipe = useStore((s) => s.selectRecipe)
  const removeRecipe = useStore((s) => s.removeRecipe)
  const initRecipes = useStore((s) => s.initRecipes)

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [addToWeekRecipeId, setAddToWeekRecipeId] = useState<string | null>(null)

  // Init recipes on mount if store is empty
  useEffect(() => {
    if (recipes.length === 0) {
      initRecipes()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter recipes by search
  const filtered = search.trim()
    ? recipes.filter((r) => {
        const q = search.toLowerCase()
        if (r.name.toLowerCase().includes(q)) return true
        const recipeTags = tags.filter((t) => r.tagIds.includes(t.id))
        return recipeTags.some((t) => t.name.toLowerCase().includes(q))
      })
    : recipes

  function handleSelectRecipe(id: string) {
    selectRecipe(id)
    setMobileDetailOpen(true)
  }

  function handleMobileBack() {
    setMobileDetailOpen(false)
  }

  function handleDelete() {
    if (!selectedId) return
    recipeService.delete(selectedId)
    removeRecipe(selectedId)
    setMobileDetailOpen(false)
  }

  function handleEdit() {
    const recipe = recipes.find((r) => r.id === selectedId)
    if (!recipe) return
    setModal({ type: 'edit', recipe })
  }

  const selectedRecipe = recipes.find((r) => r.id === selectedId)

  return (
    <div className="page page--fit">
      {/* Page header */}
      <div className="page-header">
        <h1>Recipes</h1>
        <Button
          intent="primary"
          size="sm"
          onClick={() => setModal({ type: 'add' })}
        >
          <Plus size={14} />
          Add recipe
        </Button>
      </div>

      {/* Page body: two-panel on desktop, stacked on mobile */}
      <div
        className="page-body"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {/* Left panel — recipe list */}
        <div
          className="recipe-list-panel"
          style={{
            width: 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes or tags…"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>

          {/* Recipe list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 16px',
                  gap: 8,
                  color: 'var(--text-dim)',
                }}
              >
                <span style={{ fontSize: 40 }}>📭</span>
                <span style={{ fontSize: 13, textAlign: 'center' }}>
                  {search.trim() ? 'No recipes match your search' : 'No recipes yet. Add your first!'}
                </span>
              </div>
            ) : (
              filtered.map((recipe) => {
                const recipeTags = tags.filter((t) => recipe.tagIds.includes(t.id))
                const isSelected = recipe.id === selectedId
                return (
                  <div
                    key={recipe.id}
                    onClick={() => handleSelectRecipe(recipe.id)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'var(--surface3)' : 'transparent',
                      transition: 'background 0.1s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20, lineHeight: 1 }}>{recipe.emoji || '🍽️'}</span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {recipe.name}
                      </span>
                    </div>
                    {recipeTags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, paddingLeft: 28 }}>
                        {recipeTags.map((tag) => (
                          <TagChip key={tag.id} name={tag.name} color={tag.color} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right panel — desktop only */}
        <div
          className="recipe-detail-panel"
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <RecipeDetail
            recipeId={selectedId}
            context="recipes"
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddToWeek={selectedId ? () => setAddToWeekRecipeId(selectedId) : undefined}
          />
        </div>

        {/* Mobile overlay — full-screen detail */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            transform: mobileDetailOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s ease',
          }}
          className="mobile-detail-overlay"
        >
          {/* Mobile header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 4px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <IconButton variant="default" onClick={handleMobileBack} aria-label="Back">
              <ChevronLeft size={20} />
            </IconButton>
            <span style={{ fontSize: 15, fontWeight: 700, marginLeft: 4 }}>
              {selectedRecipe?.name ?? 'Recipe'}
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            <RecipeDetail
              recipeId={selectedId}
              context="recipes"
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddToWeek={selectedId ? () => setAddToWeekRecipeId(selectedId) : undefined}
            />
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal.type === 'add' && (
        <AddEditRecipeModal mode="add" onClose={() => setModal({ type: 'none' })} />
      )}
      {modal.type === 'edit' && (
        <AddEditRecipeModal
          mode="edit"
          recipe={modal.recipe}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
      {addToWeekRecipeId && (() => {
        const recipe = recipes.find((r) => r.id === addToWeekRecipeId)
        return recipe ? (
          <AddToWeekModal
            recipeId={addToWeekRecipeId}
            defaultServings={recipe.servings}
            weekStart={getWeekStart(new Date())}
            onClose={() => setAddToWeekRecipeId(null)}
          />
        ) : null
      })()}
    </div>
  )
}
