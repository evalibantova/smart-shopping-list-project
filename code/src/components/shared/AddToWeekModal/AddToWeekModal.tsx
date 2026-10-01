import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { useMealPlanStore, type MealType } from '../../../store/mealPlanStore'
import type { Recipe } from '../../../types/recipe'

interface AddToWeekModalProps {
  recipe: Recipe
  onClose: () => void
}

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getWeekDays(): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = today.getDay() // 0=Sun
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDayLabel(date: Date, index: number): string {
  return `${DAY_NAMES_SHORT[index]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`
}

export default function AddToWeekModal({ recipe, onClose }: AddToWeekModalProps) {
  const weekDays = getWeekDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = toISO(today)

  const [selectedDate, setSelectedDate] = useState(todayISO)
  const [selectedSlot, setSelectedSlot] = useState<MealType>('breakfast')
  const [servings, setServings] = useState(recipe.servings)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleConfirm() {
    useMealPlanStore.getState().addMeal(
      selectedDate,
      selectedSlot,
      recipe.id,
      servings,
      recipe.name,
      recipe.emoji
    )
    onClose()
  }

  return createPortal(
    <div
      className="picker-modal-backdrop"
      data-testid="add-to-week-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="picker-modal-card"
        style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--charcoal)' }}>
          Add to Week
        </h2>

        {/* Day radio buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {weekDays.map((day, i) => {
            const iso = toISO(day)
            return (
              <label
                key={iso}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
                <input
                  type="radio"
                  name="add-to-week-day"
                  value={iso}
                  checked={selectedDate === iso}
                  onChange={() => setSelectedDate(iso)}
                  onClick={() => setSelectedDate(iso)}
                  data-testid="add-to-week-day-radio"
                />
                {formatDayLabel(day, i)}
              </label>
            )
          })}
        </div>

        {/* Slot select */}
        <div>
          <label className="form-label">Meal</label>
          <select
            data-testid="add-to-week-slot-select"
            value={selectedSlot}
            onChange={e => setSelectedSlot(e.target.value as MealType)}
            className="form-input"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </div>

        {/* Servings input */}
        <div>
          <label className="form-label">Servings</label>
          <input
            type="number"
            data-testid="add-to-week-servings"
            value={servings}
            min={1}
            onChange={e => setServings(Number(e.target.value))}
            className="form-input"
            style={{ width: '100px' }}
          />
        </div>

        {/* Confirm button */}
        <button
          data-testid="add-to-week-confirm"
          onClick={handleConfirm}
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start' }}
        >
          Confirm
        </button>
      </div>
    </div>,
    document.body
  )
}
