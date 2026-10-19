import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { useAddMealEntry, newMealEntry } from '../../api/mealPlan'
import { getDayDates, toDateStr, DAYS } from '../../features/meal-planner/utils/calendarUtils'
import type { MealPlanEntry } from '../../types/mealPlan'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SLOT_OPTIONS: { value: MealPlanEntry['slot']; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
]

interface Props {
  recipeId: string
  defaultServings: number
  weekStart: Date
  onClose: () => void
  onAfterConfirm?: () => void
}

export function AddToWeekModal({ recipeId, defaultServings, weekStart, onClose, onAfterConfirm }: Props) {
  const addEntry = useAddMealEntry()
  const dayDates = getDayDates(weekStart)

  const todayStr = toDateStr(new Date())
  const todayInWeek = dayDates.find((d) => toDateStr(d) === todayStr)
  const [selectedDate, setSelectedDate] = useState(todayInWeek ? todayStr : toDateStr(dayDates[0]))
  const [selectedSlot, setSelectedSlot] = useState<MealPlanEntry['slot']>('lunch')
  const [servings, setServings] = useState(defaultServings)

  // Optimistic: the entry shows in the planner at once; a failed save removes it again and toasts
  function handleConfirm() {
    addEntry.mutate(newMealEntry({ date: selectedDate, slot: selectedSlot, recipeId, servings }))
    onClose()
    onAfterConfirm?.()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add to Week"
      footer={
        <Button intent="coral" data-testid="add-to-week-confirm" onClick={handleConfirm}>
          Add to Meal Plan
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} data-testid="add-to-week-modal">
        {/* Day selection */}
        <div>
          <div className="form-label" style={{ marginBottom: 8 }}>Day</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dayDates.map((d, i) => {
              const dateStr = toDateStr(d)
              const label = `${DAYS[i]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
              return (
                <label key={dateStr} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="radio"
                    name="add-to-week-day"
                    data-testid="add-to-week-day-radio"
                    value={dateStr}
                    checked={selectedDate === dateStr}
                    onChange={() => setSelectedDate(dateStr)}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </div>

        {/* Slot selection */}
        <div>
          <label className="form-label" htmlFor="add-to-week-slot" style={{ marginBottom: 4 }}>
            Meal
          </label>
          <select
            id="add-to-week-slot"
            className="field"
            data-testid="add-to-week-slot-select"
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value as MealPlanEntry['slot'])}
          >
            {SLOT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Servings */}
        <div>
          <label className="form-label" htmlFor="add-to-week-servings" style={{ marginBottom: 4 }}>
            Servings
          </label>
          <input
            id="add-to-week-servings"
            className="field"
            type="number"
            data-testid="add-to-week-servings"
            min={1}
            value={servings}
            onChange={(e) => setServings(Math.max(1, Math.round(Number(e.target.value))))}
          />
        </div>
      </div>
    </Modal>
  )
}
