import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
import { useMealPlanStore, type MealType } from '../../store/mealPlanStore'
import './meal-planner.css'

// ── Date helpers ───────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']
const MEAL_LABELS: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

/** Returns Monday of the week that contains `date` (week starts Mon). */
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun,1=Mon,...,6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/** Adds `days` days to a date (returns a new Date). */
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Returns `YYYY-MM-DD` for a Date. */
function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns `D – D Mon YYYY` or `D Mon – D Mon YYYY` for cross-month ranges. */
function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  const startDay = monday.getDate()
  const endDay = sunday.getDate()
  const endMonth = MONTHS[sunday.getMonth()]
  const endYear = sunday.getFullYear()

  if (monday.getMonth() === sunday.getMonth()) {
    return `${startDay} – ${endDay} ${endMonth} ${endYear}`
  }
  // Cross-month: show both months
  const startMonth = MONTHS[monday.getMonth()]
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MealPlannerPage() {
  const slots = useMealPlanStore(s => s.slots)
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = toISO(today)

  // Compute Monday of the displayed week
  const baseMonday = getMondayOf(today)
  const displayMonday = addDays(baseMonday, weekOffset * 7)

  // 7 day dates for the displayed week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(displayMonday, i))

  const isCurrentWeek = weekOffset === 0
  const weekLabel = formatWeekRange(displayMonday)

  return (
    <div className="page">
      {/* ── Page Header ── */}
      <header className="page-header" data-testid="page-header">
        <h1 className="meal-planner-title" data-testid="page-title">Meal Planner</h1>

        <div className="page-header-controls week-nav" data-testid="week-nav">
          <button
            className="week-nav-btn"
            data-testid="nav-prev"
            aria-label="Previous week"
            onClick={() => setWeekOffset(o => o - 1)}
          >
            <ChevronLeft size={16} />
          </button>

          <span className="week-label" data-testid="week-label">{weekLabel}</span>

          <button
            className="week-nav-btn"
            data-testid="nav-next"
            aria-label="Next week"
            onClick={() => setWeekOffset(o => o + 1)}
          >
            <ChevronRight size={16} />
          </button>

          <button
            className="today-btn"
            data-testid="nav-today"
            data-dimmed={String(isCurrentWeek)}
            aria-label="Go to today"
            onClick={() => setWeekOffset(0)}
          >
            <CalendarCheck size={16} />
          </button>
        </div>
      </header>

      {/* ── Calendar Grid ── */}
      <div className="planner-grid-wrapper" data-testid="planner-grid-wrapper" data-scroll="true">
        <div className="planner-grid">
          {/* ── Header row: empty label cell + 7 day headers ── */}
          <div className="day-header-spacer" />
          {weekDays.map((day, i) => {
            const iso = toISO(day)
            const isToday = iso === todayISO
            return (
              <div
                key={iso}
                className="day-header"
                data-testid="day-header"
                data-today={String(isToday)}
              >
                <span className="day-name" data-testid="day-name">{DAY_NAMES[i]}</span>
                <span className="day-date">{day.getDate()}</span>
              </div>
            )
          })}

          {/* ── 3 meal rows ── */}
          {MEAL_TYPES.map(meal => (
            <div key={meal} className="planner-row-group">
              {/* Row label cell */}
              <div className="meal-label-cell">
                <span className="meal-label">{MEAL_LABELS[meal]}</span>
              </div>

              {/* 7 slot cells */}
              {weekDays.map(day => {
                const iso = toISO(day)
                const key = `${iso}-${meal}`
                const meals = slots[key] ?? []

                return (
                  <div
                    key={key}
                    className="meal-slot"
                    data-testid="meal-slot"
                    data-slot={key}
                  >
                    {meals.length === 0 ? (
                      <button
                        className="slot-add"
                        data-testid="slot-add"
                        aria-label={`Add meal to ${MEAL_LABELS[meal]} on ${iso}`}
                      >
                        +
                      </button>
                    ) : (
                      <>
                        {meals.map(m => (
                          <div
                            key={m.id}
                            className={`slot-item${m.cooked ? ' cooked' : ''}`}
                            data-testid="slot-item"
                          >
                            <div
                              className="slot-emoji-badge"
                              data-testid="slot-emoji-badge"
                              aria-hidden="true"
                            >
                              {m.recipeEmoji}
                            </div>
                            <span className="slot-name">
                              {m.recipeName}
                              {m.cooked && (
                                <span className="cooked-check" data-testid="cooked-check"> ✓</span>
                              )}
                            </span>
                          </div>
                        ))}
                        <button
                          className="slot-add-more"
                          data-testid="slot-add"
                          aria-label={`Add another meal to ${MEAL_LABELS[meal]} on ${iso}`}
                        >
                          +
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
