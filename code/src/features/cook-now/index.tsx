import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { FilterTabs } from '../../components/ui/FilterTabs'
import { Button } from '../../components/ui/Button'
import { SavingIndicator } from '../../components/ui/SavingIndicator'
import { Toast } from '../../components/ui/Toast'
import { AddToWeekModal } from '../../components/shared/AddToWeekModal'
import { AddEditRecipeModal } from '../recipes/AddEditRecipeModal'
import { buildCookDeltas } from '../meal-planner/MealPlanOverlay'
import { toDateStr, getWeekStart } from '../meal-planner/utils/calendarUtils'
import { computeAvailability } from './utils/cookNowUtils'
import { update } from '../meal-planner/services/mealPlanService'
import type { MealPlanEntry } from '../../types/mealPlan'

const FILTER_TABS = ['All', 'Ready', 'Almost'] as const
type Filter = 'All' | 'Ready' | 'Almost'

const SLOT_ORDER: MealPlanEntry['slot'][] = ['breakfast', 'lunch', 'dinner']

export default function CookNowPage() {
  const entries = useStore((s) => s.entries)
  const recipes = useStore((s) => s.recipes)
  const pantryItems = useStore((s) => s.pantryItems)
  const initMealPlan = useStore((s) => s.initMealPlan)
  const initPantry = useStore((s) => s.initPantry)
  const updateEntry = useStore((s) => s.updateEntry)
  const batchUpdatePantry = useStore((s) => s.batchUpdatePantry)

  const [filter, setFilter] = useState<Filter>('All')
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [isCooking, setIsCooking] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [addToWeekOpen, setAddToWeekOpen] = useState(false)

  useEffect(() => {
    initMealPlan()
    initPantry()
  }, [])

  const today = toDateStr(new Date())
  const weekStart = getWeekStart(new Date())

  // Build today's meals with availability
  const todayMeals = entries
    .filter((e) => e.date === today)
    .map((entry) => {
      const recipe = recipes.find((r) => r.id === entry.recipeId)
      if (!recipe) return null
      const avail = computeAvailability(recipe, entry, pantryItems)
      return { entry, recipe, avail }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => SLOT_ORDER.indexOf(a.entry.slot) - SLOT_ORDER.indexOf(b.entry.slot))

  // Apply filter
  const filteredMeals = todayMeals.filter((m) => {
    if (filter === 'All') return true
    if (filter === 'Ready') return m.avail.tier === 'ready'
    if (filter === 'Almost') return m.avail.tier === 'almost'
    return true
  })

  // Find the open overlay entry and recipe
  const openMeal = openEntryId ? todayMeals.find((m) => m.entry.id === openEntryId) : null

  // Close overlay on Escape
  useEffect(() => {
    if (!openEntryId) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !editOpen && !addToWeekOpen) setOpenEntryId(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [openEntryId, editOpen, addToWeekOpen])

  async function handleToggleCooked() {
    if (!openMeal || isCooking) return
    const { entry, recipe } = openMeal
    const prev = !!entry.cooked
    const newCooked = !prev
    setIsCooking(true)

    const deltas = buildCookDeltas(recipe, entry, newCooked)

    updateEntry(entry.id, { cooked: newCooked })

    try {
      batchUpdatePantry(deltas)
    } catch {
      updateEntry(entry.id, { cooked: prev })
      setToastMsg('Could not save — please try again.')
      setIsCooking(false)
      return
    }

    try {
      await update(entry.id, { cooked: newCooked })
    } catch {
      try {
        batchUpdatePantry(deltas.map((d) => ({ ...d, delta: -d.delta })))
      } catch {
        /* best-effort reversal */
      }
      updateEntry(entry.id, { cooked: prev })
      setToastMsg('Could not save — please try again.')
    } finally {
      setIsCooking(false)
    }
  }

  return (
    <div className="page">
      {/* Page header */}
      <div
        className="page-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <h1>Cook Now</h1>
        <FilterTabs
          tabs={FILTER_TABS}
          active={filter}
          onChange={(tab) => setFilter(tab as Filter)}
        />
      </div>

      {/* Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* No meals today */}
        {todayMeals.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '48px 16px',
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ fontSize: 48 }}>🥘</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>No meals planned for today</span>
          </div>
        )}

        {/* Per-filter empty state (today has meals but filter yields nothing) */}
        {todayMeals.length > 0 && filteredMeals.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '48px 16px',
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ fontSize: 48 }}>{filter === 'Ready' ? '✅' : '⏳'}</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {filter === 'Ready' ? 'No meals ready right now' : 'No almost-ready meals'}
            </span>
          </div>
        )}

        {/* Meal cards */}
        {filteredMeals.map(({ entry, recipe, avail }) => {
          const { tier, missingCount } = avail
          const cardStyle: React.CSSProperties = {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 'var(--radius)',
            boxShadow:
              tier === 'ready'
                ? '0 0 0 2px var(--coral)'
                : tier === 'almost'
                  ? '0 0 0 2px var(--amber)'
                  : 'var(--shadow-sm)',
            background: 'var(--surface)',
            opacity: tier === 'far' ? 0.45 : 1,
          }

          return (
            <div key={entry.id} data-testid={`cook-now-card-${entry.id}`} style={cardStyle}>
              {/* Emoji badge */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {recipe.emoji || '🍽️'}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {recipe.name}
                </div>

                {/* Availability badge */}
                <div style={{ marginTop: 4 }}>
                  {tier === 'ready' && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--coral)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 8 }}>●</span> Ready
                    </span>
                  )}
                  {tier === 'almost' && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--amber)',
                      }}
                    >
                      {missingCount} missing
                    </span>
                  )}
                  {tier === 'far' && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--red)',
                      }}
                    >
                      {missingCount} missing
                    </span>
                  )}
                </div>
              </div>

              {/* Action button */}
              {tier === 'ready' && (
                <Button intent="primary" size="sm" onClick={() => setOpenEntryId(entry.id)}>
                  Cook it
                </Button>
              )}
              {tier === 'almost' && (
                <Button intent="amber" size="sm" onClick={() => setOpenEntryId(entry.id)}>
                  Cook anyway
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Overlay */}
      {openMeal &&
        createPortal(
          <div style={{ position: 'relative' }}>
            <div
              data-testid="cook-now-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpenEntryId(null)
              }}
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
                  recipeId={openMeal.entry.recipeId}
                  context="cook-now"
                  ingredientAvailability={openMeal.avail.ingredientAvailability}
                  onEdit={() => setEditOpen(true)}
                  onAddToWeek={() => setAddToWeekOpen(true)}
                  onCooked={handleToggleCooked}
                  isCooked={!!openMeal.entry.cooked}
                  isCooking={isCooking}
                />
              </div>
            </div>

            <SavingIndicator visible={isCooking} />
            {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg('')} />}

            {editOpen && openMeal.recipe && (
              <AddEditRecipeModal
                mode="edit"
                recipe={openMeal.recipe}
                onClose={() => setEditOpen(false)}
              />
            )}

            {addToWeekOpen && (
              <AddToWeekModal
                recipeId={openMeal.entry.recipeId}
                defaultServings={openMeal.entry.servings}
                weekStart={weekStart}
                onClose={() => setAddToWeekOpen(false)}
              />
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
