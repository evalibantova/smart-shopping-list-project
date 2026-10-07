import React, { useState, useEffect, useMemo } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../../store'
import { recipeService } from '../recipes/services/recipeService'
import {
  getWeekStart,
  toDateStr,
  getDayDates,
  formatWeekRange,
  isToday,
  DAYS,
} from './utils/calendarUtils'

const SLOTS = [
  { key: 'breakfast' as const, label: 'Breakfast' },
  { key: 'lunch' as const, label: 'Lunch' },
  { key: 'dinner' as const, label: 'Dinner' },
]

export default function MealPlannerPage() {
  const entries = useStore((s) => s.entries)
  const initMealPlan = useStore((s) => s.initMealPlan)

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))

  useEffect(() => {
    if (entries.length === 0) initMealPlan()
  }, [])

  const recipeMap = useMemo(() => {
    const all = recipeService.getAll()
    return new Map(all.map((r) => [r.id, r]))
  }, [])

  const dayDates = getDayDates(weekStart)
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(getWeekStart(new Date()))

  function goToPrev() {
    setWeekStart((d) => {
      const n = new Date(d)
      n.setDate(n.getDate() - 7)
      return n
    })
  }

  function goToNext() {
    setWeekStart((d) => {
      const n = new Date(d)
      n.setDate(n.getDate() + 7)
      return n
    })
  }

  function goToToday() {
    setWeekStart(getWeekStart(new Date()))
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Meal Planner</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={goToPrev}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-mid)',
              borderRadius: 'var(--radius)',
            }}
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              minWidth: '148px',
              textAlign: 'center',
              color: 'var(--text-mid)',
            }}
          >
            {formatWeekRange(weekStart)}
          </span>
          <button
            onClick={goToNext}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-mid)',
              borderRadius: 'var(--radius)',
            }}
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={goToToday}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--coral)',
              borderRadius: 'var(--radius)',
              opacity: isCurrentWeek ? 0.3 : 1,
            }}
            aria-label="Go to today"
          >
            <CalendarCheck size={16} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '26px repeat(7, minmax(110px, 1fr))',
            minWidth: '800px',
          }}
        >
          {/* Header row */}
          <div />
          {dayDates.map((d, i) => {
            const today = isToday(d)
            return (
              <div
                key={toDateStr(d)}
                style={{
                  textAlign: 'center',
                  padding: '8px 4px 6px',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: i === 0 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    color: today ? 'var(--coral)' : 'var(--text-dim)',
                  }}
                >
                  {DAYS[i]}
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 300,
                    lineHeight: '1.2',
                    marginTop: '2px',
                    color: today ? 'var(--coral)' : 'var(--text)',
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            )
          })}

          {/* Slot rows */}
          {SLOTS.map((slot) => (
            <React.Fragment key={slot.key}>
              <div
                key={slot.key + '-label'}
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  textTransform: 'uppercase',
                  fontSize: '9px',
                  letterSpacing: '1.5px',
                  color: 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderTop: '1px solid var(--border)',
                  width: '26px',
                }}
              >
                {slot.label}
              </div>
              {dayDates.map((d, i) => {
                const dateStr = toDateStr(d)
                const slotEntries = entries.filter(
                  (e) => e.date === dateStr && e.slot === slot.key
                )
                return (
                  <div
                    key={dateStr + slot.key}
                    style={{
                      minHeight: '100px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '4px',
                      borderTop: '1px solid var(--border)',
                      borderLeft: i === 0 ? '1px solid var(--border)' : undefined,
                    }}
                  >
                    {slotEntries.map((entry) => {
                      const recipe = recipeMap.get(entry.recipeId)
                      if (!recipe) return null
                      return (
                        <div
                          key={entry.id}
                          className="slot-item"
                          style={{
                            borderRadius: '4px',
                            padding: '4px 6px',
                            background: entry.cooked
                              ? 'color-mix(in srgb, var(--coral) 8%, transparent)'
                              : 'var(--surface2)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '6px',
                          }}
                        >
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'var(--surface3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              flexShrink: 0,
                            }}
                          >
                            {recipe.emoji}
                          </div>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              lineHeight: '1.3',
                            }}
                          >
                            {recipe.name}
                            {entry.cooked && (
                              <span style={{ color: 'var(--coral)' }}> ✓</span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                    <button
                      className="slot-add"
                      style={{
                        margin: slotEntries.length === 0 ? 'auto' : '0 auto 0 0',
                        background: 'none',
                        border: 'none',
                        fontSize: '20px',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      aria-label={`Add meal to ${slot.label} on ${dateStr}`}
                    >
                      +
                    </button>
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
