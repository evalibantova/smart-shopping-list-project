import { useState, useMemo } from 'react'
import { ChevronLeft, Link2, Plus, Search } from 'lucide-react'
import { useStore } from '../../store'
import { useToastStore } from '../../store/toastStore'
import { useRecipes, useDeleteRecipe } from '../../api/recipes'
import { useTags } from '../../api/tags'
import { usePantry, useBatchPantry, recipeDeltas } from '../../api/pantry'
import { messageForError } from '../../api/client'
import { Modal } from '../../components/ui/Modal'
import { Recipe, Tag } from '../../types/recipes'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { AddEditRecipeModal } from './AddEditRecipeModal'
import { AddToWeekModal } from '../../components/shared/AddToWeekModal'
import { getWeekStart } from '../../utils/calendar'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { TagChip } from '../../components/ui/TagChip'
import { computeAvailability } from '../cook-now/utils/cookNowUtils'
import { searchMatches } from '../../utils/search'
import { ImportRecipeModal } from './ImportRecipeModal'
import type { RecipeDraft } from '../../services/recipeImport/mapToRecipe'

export function filterRecipes(recipes: Recipe[], tags: Tag[], query: string): Recipe[] {
  return query.trim()
    ? recipes.filter((r) => {
        if (searchMatches(r.name, query)) return true
        const recipeTags = tags.filter((t) => r.tagIds.includes(t.id))
        return recipeTags.some((t) => searchMatches(t.name, query))
      })
    : recipes
}

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; recipe: Recipe }
  | { type: 'importUrl' }
  | { type: 'import'; draft: RecipeDraft }

export default function RecipesPage() {
  const recipes = useRecipes()
  const tags = useTags()
  const pantryItems = usePantry()
  const selectedId = useStore((s) => s.selectedId)
  const selectRecipe = useStore((s) => s.selectRecipe)
  const deleteRecipe = useDeleteRecipe()
  const batchPantry = useBatchPantry()

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [addToWeekRecipeId, setAddToWeekRecipeId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Filter recipes by search
  const sorted = useMemo(
    () => [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'sk', { sensitivity: 'base' })),
    [recipes],
  )
  const filtered = filterRecipes(sorted, tags, search)

  const recipesWithAvail = useMemo(
    () => filtered.map((recipe) => ({ recipe, avail: computeAvailability(recipe, { servings: recipe.servings }, pantryItems) })),
    [filtered, pantryItems]
  )

  const selectedIngredientAvailability = useMemo(() => {
    if (!selectedId) return undefined
    return recipesWithAvail.find((m) => m.recipe.id === selectedId)?.avail.ingredientAvailability
  }, [selectedId, recipesWithAvail])

  function handleSelectRecipe(id: string) {
    selectRecipe(id)
    setMobileDetailOpen(true)
  }

  function handleMobileBack() {
    setMobileDetailOpen(false)
  }

  // The trash icon only asks; the recipe is deleted (awaited) once the user confirms
  function handleDelete() {
    if (!selectedId) return
    setConfirmDeleteId(selectedId)
  }

  async function confirmDelete() {
    const id = confirmDeleteId
    if (!id) return
    try {
      await deleteRecipe.mutateAsync(id)
      if (useStore.getState().selectedId === id) selectRecipe(null)
      setMobileDetailOpen(false)
    } catch (err) {
      useToastStore.getState().show(messageForError(err, 'delete'))
    } finally {
      setConfirmDeleteId(null)
    }
  }

  // Optimistic: the pantry shows the deduction at once; a failure rolls it back and toasts (see useBatchPantry)
  function handleCooked() {
    if (!selectedId) return
    const recipe = recipes.find((r) => r.id === selectedId)
    if (!recipe) return
    const deltas = recipeDeltas(recipe)
    if (deltas.length > 0) batchPantry.mutate(deltas)
    selectRecipe(null)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            intent="secondary"
            size="sm"
            aria-label="Import recipe from URL"
            onClick={() => setModal({ type: 'importUrl' })}
          >
            <Link2 size={14} />
            <span className="hide-mobile">Import from URL</span>
          </Button>
          <Button
            intent="primary"
            size="sm"
            style={{ paddingInline: '1.25rem' }}
            onClick={() => setModal({ type: 'add' })}
          >
            <Plus size={14} />
            Add recipe
          </Button>
        </div>
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
            <div className="field-search">
              <Search size={14} />
              <input
                type="text"
                className="field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipes or tags…"
                aria-label="Search recipes or tags"
              />
            </div>
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
              recipesWithAvail.map(({ recipe, avail }) => {
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
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                    <div style={{ flexShrink: 0, minWidth: 20, textAlign: 'right' }}>
                      {avail.tier === 'ready' ? (
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)' }} />
                      ) : avail.missingCount > 0 ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: avail.tier === 'almost' ? 'var(--amber)' : 'var(--text-dim)' }}>
                          {avail.missingCount}
                        </span>
                      ) : null}
                    </div>
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
            ingredientAvailability={selectedIngredientAvailability}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddToWeek={selectedId ? () => setAddToWeekRecipeId(selectedId) : undefined}
            onCooked={selectedId ? handleCooked : undefined}
          />
        </div>

        {/* Mobile overlay — full-screen detail */}
        <div
          aria-hidden={!mobileDetailOpen}
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
              ingredientAvailability={selectedIngredientAvailability}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddToWeek={selectedId ? () => setAddToWeekRecipeId(selectedId) : undefined}
              onCooked={selectedId ? handleCooked : undefined}
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
      {modal.type === 'importUrl' && (
        <ImportRecipeModal
          onClose={() => setModal({ type: 'none' })}
          onImported={(draft) => setModal({ type: 'import', draft })}
        />
      )}
      {modal.type === 'import' && (
        <AddEditRecipeModal mode="import" draft={modal.draft} onClose={() => setModal({ type: 'none' })} />
      )}
      {confirmDeleteId && (
        <Modal
          isOpen
          onClose={() => setConfirmDeleteId(null)}
          title="Delete recipe"
          footer={
            <>
              <Button intent="ghost" size="sm" type="button" onClick={() => setConfirmDeleteId(null)} disabled={deleteRecipe.isPending}>
                Cancel
              </Button>
              <Button intent="danger" size="sm" type="button" onClick={confirmDelete} disabled={deleteRecipe.isPending}>
                {deleteRecipe.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: 'var(--text)' }}>
            Delete &ldquo;{recipes.find((r) => r.id === confirmDeleteId)?.name ?? 'this recipe'}&rdquo;? Meals planned
            with this recipe are removed from the meal plan too.
          </p>
        </Modal>
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
