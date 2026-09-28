import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useStore } from '../../store'
import type { Recipe } from '../../types'

interface AddToWeekModalProps {
  open: boolean
  onClose: () => void
  recipe: Recipe | null
}

const SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
] as const

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function getWeekDays(): Date[] {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function AddToWeekModal({ open, onClose, recipe }: AddToWeekModalProps) {
  const weekDays = getWeekDays()
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()))
  const [slot, setSlot] = useState<'breakfast' | 'lunch' | 'dinner'>('dinner')
  const [servings, setServings] = useState(recipe?.servings ?? 2)
  const { addMealPlanEntry, showToast } = useStore()

  const todayStr = toDateStr(new Date())

  function handleConfirm() {
    if (!recipe) return
    addMealPlanEntry({ date: selectedDate, slot, recipeId: recipe.id, servings, cooked: false })
    showToast(`${recipe.name} added to ${DAYS[weekDays.findIndex(d => toDateStr(d) === selectedDate)]} ${slot}`)
    onClose()
  }

  if (!recipe) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to Week"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-coral btn-sm" onClick={handleConfirm}>Confirm</button>
        </>
      }
    >
      <div style={{ paddingTop: 12 }}>
        <div style={{ marginBottom: 4, color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Day</div>
        <div className="day-radio-grid">
          {weekDays.map((d, i) => {
            const ds = toDateStr(d)
            const isToday = ds === todayStr
            return (
              <label key={ds} className={`day-radio-label${selectedDate === ds ? ' selected' : ''}`}>
                <input type="radio" name="day" value={ds} checked={selectedDate === ds} onChange={() => setSelectedDate(ds)} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {DAYS[i]}{isToday ? ' ★' : ''}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{d.getDate()}</span>
              </label>
            )
          })}
        </div>

        <div style={{ marginBottom: 4, color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Meal</div>
        <div className="slot-radio-group" style={{ marginBottom: 16 }}>
          {SLOTS.map(s => (
            <button
              key={s.key}
              className={`slot-radio-btn${slot === s.key ? ' selected' : ''}`}
              onClick={() => setSlot(s.key)}
            >{s.label}</button>
          ))}
        </div>

        <div style={{ marginBottom: 4, color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Servings</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="servings-scaler" style={{ marginBottom: 0 }}>
            <button onClick={() => setServings(Math.max(1, servings - 1))}>−</button>
            <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{servings}</span>
            <button onClick={() => setServings(servings + 1)}>+</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
