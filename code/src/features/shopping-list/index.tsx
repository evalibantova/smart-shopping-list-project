import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../../store'
import { ingredientsDbService } from '../../services/ingredientsDbService'
import { getWeekStart } from '../meal-planner/utils/calendarUtils'
import { computeShoppingList, CATEGORY_ORDER } from './shoppingListSelector'

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

export default function ShoppingListPage() {
  const entries = useStore((s) => s.entries)
  const recipes = useStore((s) => s.recipes)

  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => loadSet('slist_checked'))
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => loadSet('slist_cleared'))

  useEffect(() => {
    localStorage.setItem('slist_checked', JSON.stringify([...checkedIds]))
  }, [checkedIds])

  useEffect(() => {
    localStorage.setItem('slist_cleared', JSON.stringify([...clearedIds]))
  }, [clearedIds])

  const weekStart = useMemo(() => getWeekStart(new Date()), [])
  const ingredientsDb = useMemo(() => ingredientsDbService.getAll(), [])

  const allItems = useMemo(
    () => computeShoppingList(entries, recipes, ingredientsDb, weekStart),
    [entries, recipes, ingredientsDb, weekStart]
  )

  const allItemIds = useMemo(
    () => new Set(allItems.map((i) => i.ingredientId)),
    [allItems]
  )

  // Reconcile against current allItems so stale IDs don't corrupt progress math
  const effectiveCheckedIds = useMemo(
    () => new Set([...checkedIds].filter((id) => allItemIds.has(id))),
    [checkedIds, allItemIds]
  )
  const effectiveClearedIds = useMemo(
    () => new Set([...clearedIds].filter((id) => allItemIds.has(id))),
    [clearedIds, allItemIds]
  )

  const visibleItems = useMemo(
    () => allItems.filter((item) => !effectiveClearedIds.has(item.ingredientId)),
    [allItems, effectiveClearedIds]
  )

  const totalCount = allItems.length
  const doneCount = effectiveCheckedIds.size + effectiveClearedIds.size

  function toggleChecked(ingredientId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(ingredientId)) {
        next.delete(ingredientId)
      } else {
        next.add(ingredientId)
      }
      return next
    })
  }

  function clearChecked() {
    setClearedIds((prev) => new Set([...prev, ...effectiveCheckedIds]))
    setCheckedIds(new Set())
  }

  const knownCategoryKeys = useMemo(() => new Set(CATEGORY_ORDER.map((c) => c.key)), [])

  const groupedItems = useMemo(() => {
    const byCategory = new Map<string, typeof visibleItems>()
    for (const item of visibleItems) {
      const cat = knownCategoryKeys.has(item.category) ? item.category : 'Other'
      const list = byCategory.get(cat) ?? []
      list.push(item)
      byCategory.set(cat, list)
    }
    return CATEGORY_ORDER
      .map((cat) => ({ ...cat, items: byCategory.get(cat.key) ?? [] }))
      .filter((g) => g.items.length > 0)
  }, [visibleItems, knownCategoryKeys])

  const isEmpty = allItems.length === 0

  return (
    <div className="page">
      <div className="page-header">
        <h1>Shopping List</h1>
        {effectiveCheckedIds.size > 0 && (
          <button
            data-testid="shopping-list-clear-checked"
            onClick={clearChecked}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--coral)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Clear checked
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isEmpty ? (
          <div
            data-testid="shopping-list-empty"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '64px 24px',
              gap: 12,
              color: 'var(--text-dim)',
              height: '100%',
            }}
          >
            <span style={{ fontSize: 48 }}>🛒</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-mid)', textAlign: 'center' }}>
              Nothing planned this week
            </span>
            <span style={{ fontSize: 13, textAlign: 'center' }}>
              Add some recipes to the Meal Planner and your shopping list will appear here.
            </span>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div
              data-testid="shopping-list-progress"
              style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)' }}>
                  {doneCount} / {totalCount} checked
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%`,
                    background: 'var(--coral)',
                    borderRadius: 2,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>

            {/* Category groups */}
            {groupedItems.map((group) => (
              <div key={group.key}>
                <div
                  data-testid="shopping-list-category-header"
                  style={{
                    padding: '10px 16px 6px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{group.emoji}</span>
                  <span>{group.key}</span>
                </div>
                {group.items.map((item) => {
                  const checked = effectiveCheckedIds.has(item.ingredientId)
                  return (
                    <div
                      key={item.ingredientId}
                      data-testid="shopping-list-item"
                      onClick={() => toggleChecked(item.ingredientId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        opacity: checked ? 0.5 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        data-testid="shopping-list-item-checkbox"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          border: checked ? 'none' : '2px solid var(--border-mid)',
                          background: checked ? 'var(--coral)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'background 0.15s, border 0.15s',
                        }}
                      >
                        {checked && (
                          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                            <path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Name */}
                      <span
                        style={{
                          flex: 1,
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'var(--text)',
                          textDecoration: checked ? 'line-through' : 'none',
                        }}
                      >
                        {item.name}
                      </span>

                      {/* Quantity + auto badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-mid)', fontWeight: 600 }}>
                          {item.quantity} {item.unit}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            color: 'var(--coral)',
                            background: 'color-mix(in srgb, var(--coral) 10%, transparent)',
                            padding: '2px 5px',
                            borderRadius: 3,
                          }}
                        >
                          auto
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
