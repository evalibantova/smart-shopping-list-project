import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
import { useStore } from '../../store'
import { RecipePickerModal } from '../../components/shared/RecipePickerModal'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { Modal } from '../../components/ui/Modal'
import { AddToWeekModal } from '../../components/shared/AddToWeekModal'
import type { MealPlanEntry, Recipe } from '../../types'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const SLOTS = ['breakfast', 'lunch', 'dinner'] as const

function getWeekStart(offset = 0): Date {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const startDay = monday.getDate()
  const endDay = sunday.getDate()
  const month = MONTHS[sunday.getMonth()]
  const year = sunday.getFullYear()
  return `${startDay} – ${endDay} ${month} ${year}`
}

export function MealPlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<{ date: string; slot: typeof SLOTS[number] } | null>(null)
  const [detailEntry, setDetailEntry] = useState<MealPlanEntry | null>(null)
  const [addToWeekRecipe, setAddToWeekRecipe] = useState<Recipe | null>(null)
  const [showAddToWeek, setShowAddToWeek] = useState(false)
  const { mealPlan, recipes, addMealPlanEntry, deleteMealPlanEntry, showToast } = useStore()

  const monday = getWeekStart(weekOffset)
  const weekDays = getWeekDays(monday)
  const todayStr = toDateStr(new Date())
  const isCurrentWeek = weekOffset === 0

  const detailRecipe = detailEntry ? recipes.find(r => r.id === detailEntry.recipeId) : null

  function openPicker(date: string, slot: typeof SLOTS[number]) {
    setPickerSlot({ date, slot })
  }

  function handlePickRecipe(recipe: Recipe) {
    if (!pickerSlot) return
    addMealPlanEntry({ date: pickerSlot.date, slot: pickerSlot.slot, recipeId: recipe.id, servings: recipe.servings, cooked: false })
    showToast(`${recipe.name} added`)
    setPickerSlot(null)
  }

  function handleRemoveFromPlan() {
    if (!detailEntry) return
    deleteMealPlanEntry(detailEntry.id)
    showToast('Removed from plan')
    setDetailEntry(null)
  }

  return (
    <>
      <div className="page-header">
        <span className="page-title">Meal Planner</span>
        <div className="week-nav">
          <button className="week-nav-btn" onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft size={18} />
          </button>
          <span className="week-nav-label">{formatWeekRange(monday)}</span>
          <button className="week-nav-btn" onClick={() => setWeekOffset(o => o + 1)}>
            <ChevronRight size={18} />
          </button>
          <button
            className={`week-nav-btn${isCurrentWeek ? ' dimmed' : ''}`}
            onClick={() => setWeekOffset(0)}
            title="Jump to current week"
          >
            <CalendarCheck size={18} />
          </button>
        </div>
      </div>

      <div className="page-body" style={{ flexDirection: 'column', overflow: 'hidden' }}>
        <div className="calendar-grid" style={{ flex: 1, overflow: 'auto' }}>
          {/* Header row */}
          <div style={{ gridColumn: 1, gridRow: 1, background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }} />
          {weekDays.map((d, i) => {
            const ds = toDateStr(d)
            const isToday = ds === todayStr
            return (
              <div key={ds} className={`col-header${isToday ? ' today' : ''}`} style={{ gridColumn: i + 2, gridRow: 1 }}>
                <span className="col-header-day">{DAY_NAMES[i]}</span>
                <span className="col-header-date">{d.getDate()}</span>
              </div>
            )
          })}

          {/* Slot rows */}
          {SLOTS.map((slot, slotIdx) => (
            <>
              <div key={`label-${slot}`} className="col-label-cell" style={{ gridColumn: 1, gridRow: slotIdx + 2 }}>
                <span className="col-label">{slot}</span>
              </div>
              {weekDays.map((d, dayIdx) => {
                const ds = toDateStr(d)
                const slotEntries = mealPlan.filter(e => e.date === ds && e.slot === slot)
                return (
                  <div
                    key={`${ds}-${slot}`}
                    className="meal-slot-cell"
                    style={{ gridColumn: dayIdx + 2, gridRow: slotIdx + 2 }}
                    onClick={() => { if (slotEntries.length === 0) openPicker(ds, slot) }}
                  >
                    {slotEntries.length === 0 && (
                      <div className="meal-slot-empty">+</div>
                    )}
                    {slotEntries.map(entry => {
                      const recipe = recipes.find(r => r.id === entry.recipeId)
                      if (!recipe) return null
                      return (
                        <div
                          key={entry.id}
                          className={`slot-item${entry.cooked ? ' cooked' : ''}`}
                          onClick={e => { e.stopPropagation(); setDetailEntry(entry) }}
                        >
                          <div className="slot-icon-badge">{recipe.emoji || '🍽️'}</div>
                          <div className="slot-name">
                            {recipe.name}
                            {entry.cooked && <span className="slot-cooked-mark"> ✓</span>}
                          </div>
                        </div>
                      )
                    })}
                    {slotEntries.length > 0 && (
                      <div className="slot-add-btn" onClick={e => { e.stopPropagation(); openPicker(ds, slot) }}>+</div>
                    )}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* Recipe picker */}
      <RecipePickerModal
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        onSelect={handlePickRecipe}
      />

      {/* Entry detail modal */}
      <Modal
        open={detailEntry !== null}
        onClose={() => setDetailEntry(null)}
      >
        {detailEntry && detailRecipe && (
          <RecipeDetail
            recipe={detailRecipe}
            context="meal-planner"
            mealPlanEntry={detailEntry}
            onEdit={() => {}}
            onAddToWeek={() => { setAddToWeekRecipe(detailRecipe); setShowAddToWeek(true) }}
            onRemoveFromPlan={handleRemoveFromPlan}
          />
        )}
      </Modal>

      <AddToWeekModal
        open={showAddToWeek}
        onClose={() => setShowAddToWeek(false)}
        recipe={addToWeekRecipe}
      />
    </>
  )
}
