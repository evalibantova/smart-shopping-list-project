import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store'
import { create } from '../../features/meal-planner/services/mealPlanService'
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
  const addEntry = useStore((s) => s.addEntry)
  const dayDates = getDayDates(weekStart)

  const todayStr = toDateStr(new Date())
  const todayInWeek = dayDates.find((d) => toDateStr(d) === todayStr)
  const [selectedDate, setSelectedDate] = useState(todayInWeek ? todayStr : toDateStr(dayDates[0]))
  const [selectedSlot, setSelectedSlot] = useState<MealPlanEntry['slot']>('lunch')
  const [servings, setServings] = useState(defaultServings)

  function handleConfirm() {
    const entry: MealPlanEntry = {
      id: crypto.randomUUID(),
      date: selectedDate,
      slot: selectedSlot,
      recipeId,
      servings,
    }
    addEntry(entry)
    create(entry)
    onClose()
    onAfterConfirm?.()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add to Week"
      footer={
        <button
          data-testid="add-to-week-confirm"
          onClick={handleConfirm}
          style={{ padding: '8px 20px', background: 'var(--charcoal)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Add to Meal Plan
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} data-testid="add-to-week-modal">
        {/* Day selection */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Day</div>
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
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Meal
          </label>
          <select
            data-testid="add-to-week-slot-select"
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value as MealPlanEntry['slot'])}
            style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid var(--border-mid)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }}
          >
            {SLOT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Servings */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Servings
          </label>
          <input
            type="number"
            data-testid="add-to-week-servings"
            min={1}
            value={servings}
            onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
            style={{ width: '100%', padding: '8px 10px', fontSize: 14, border: '1px solid var(--border-mid)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)' }}
          />
        </div>
      </div>
    </Modal>
  )
}
