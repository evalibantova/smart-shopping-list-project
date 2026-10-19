import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMealPlan, useRemoveMealEntry } from '../../api/mealPlan'
import { useRecipes } from '../../api/recipes'
import { usePantry } from '../../api/pantry'
import { useSetEntryCooked } from '../../api/cooking'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { computeAvailability } from '../cook-now/utils/cookNowUtils'
import { AddToWeekModal } from '../../components/shared/AddToWeekModal'
import { AddEditRecipeModal } from '../recipes/AddEditRecipeModal'
import type { Recipe } from '../../types/recipes'
import type { MealPlanEntry } from '../../types/mealPlan'

export function buildCookDeltas(
  recipe: Recipe,
  entry: Pick<MealPlanEntry, 'servings'>,
  newCooked: boolean
): { ingredientId: string; delta: number }[] {
  const scale = recipe.servings > 0 ? entry.servings / recipe.servings : 1
  return recipe.ingredients.map((ing) => ({
    ingredientId: ing.ingredientId,
    delta: newCooked ? -(ing.quantity * scale) : ing.quantity * scale,
  }))
}

interface Props {
  entryId: string
  weekStart: Date
  onClose: () => void
}

export function MealPlanOverlay({ entryId, weekStart, onClose }: Props) {
  const entries = useMealPlan()
  const entry = entries.find((e) => e.id === entryId)
  const recipes = useRecipes()
  const pantryItems = usePantry()
  const removeEntry = useRemoveMealEntry()
  const setCooked = useSetEntryCooked()
  const [editOpen, setEditOpen] = useState(false)
  const [addToWeekOpen, setAddToWeekOpen] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !editOpen && !addToWeekOpen) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, editOpen, addToWeekOpen])

  // Close overlay if entry is removed from the plan elsewhere
  useEffect(() => {
    if (!entry) onClose()
  }, [entry, onClose])

  const recipe = recipes.find((r) => r.id === entry?.recipeId)
  const avail = recipe && entry
    ? computeAvailability(recipe, { servings: entry.servings }, pantryItems)
    : null

  // Optimistic: gone from the plan at once; a failed delete brings it back and toasts
  function handleRemove() {
    if (!entry) return
    removeEntry.mutate(entry.id)
    onClose()
  }

  // Optimistic: the entry and the pantry change at once; a failed save rolls both back and toasts
  function handleToggleCooked() {
    if (!entry || setCooked.isPending) return
    const cooked = !entry.cooked
    const deltas = recipe ? buildCookDeltas(recipe, entry, cooked) : []
    setCooked.mutate({ entry, deltas, cooked })
  }

  return createPortal(
    <div style={{ position: 'relative' }}>
      <div
        data-testid="meal-plan-overlay"
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
          style={{
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-md)',
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 'var(--radius)',
          }}
        >
          <RecipeDetail
            recipeId={entry?.recipeId ?? null}
            context="meal-planner"
            onEdit={() => setEditOpen(true)}
            onAddToWeek={() => setAddToWeekOpen(true)}
            onRemoveFromPlan={handleRemove}
            onCooked={handleToggleCooked}
            isCooked={!!entry?.cooked}
            isCooking={setCooked.isPending}
            ingredientAvailability={avail?.ingredientAvailability}
          />
        </div>
      </div>

      {editOpen && recipe && (
        <AddEditRecipeModal
          mode="edit"
          recipe={recipe}
          onClose={() => setEditOpen(false)}
        />
      )}

      {addToWeekOpen && entry && (
        <AddToWeekModal
          recipeId={entry.recipeId}
          defaultServings={entry.servings}
          weekStart={weekStart}
          onClose={() => setAddToWeekOpen(false)}
        />
      )}
    </div>,
    document.body
  )
}
