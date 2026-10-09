import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { remove, update } from './services/mealPlanService'
import { AddToWeekModal } from '../../components/shared/AddToWeekModal'
import { AddEditRecipeModal } from '../recipes/AddEditRecipeModal'
import { SavingIndicator } from '../../components/ui/SavingIndicator'
import { Toast } from '../../components/ui/Toast'

interface Props {
  entryId: string
  weekStart: Date
  onClose: () => void
}

export function MealPlanOverlay({ entryId, weekStart, onClose }: Props) {
  const entry = useStore((s) => s.entries.find((e) => e.id === entryId))
  const recipes = useStore((s) => s.recipes)
  const removeEntry = useStore((s) => s.removeEntry)
  const updateEntry = useStore((s) => s.updateEntry)
  const [editOpen, setEditOpen] = useState(false)
  const [addToWeekOpen, setAddToWeekOpen] = useState(false)
  const [isCooking, setIsCooking] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !editOpen && !addToWeekOpen) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, editOpen, addToWeekOpen])

  // Close overlay if entry is removed from the store elsewhere
  useEffect(() => {
    if (!entry) onClose()
  }, [entry, onClose])

  const recipe = recipes.find((r) => r.id === entry?.recipeId)

  function handleRemove() {
    if (!entry) return
    removeEntry(entry.id)
    remove(entry.id)
    onClose()
  }

  async function handleToggleCooked() {
    if (!entry || isCooking) return
    const prev = !!entry.cooked
    setIsCooking(true)
    updateEntry(entry.id, { cooked: !prev })
    try {
      await update(entry.id, { cooked: !prev })
    } catch {
      updateEntry(entry.id, { cooked: prev })
      setToastMsg('Could not save — please try again.')
    } finally {
      setIsCooking(false)
    }
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
            isCooking={isCooking}
          />
        </div>
      </div>

      <SavingIndicator visible={isCooking} />
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg('')} />}

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
