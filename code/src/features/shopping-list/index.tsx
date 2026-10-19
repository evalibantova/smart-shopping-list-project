import { useState, useMemo } from 'react'
import { useMealPlan } from '../../api/mealPlan'
import { useRecipes } from '../../api/recipes'
import { useIngredients } from '../../api/ingredients'
import { newPantryItem, useAddPantryItem, useBatchPantry, usePantry } from '../../api/pantry'
import { Button } from '../../components/ui/Button'
import { getWeekStart } from '../meal-planner/utils/calendarUtils'
import { computeShoppingList, CATEGORY_ORDER, type ShoppingItem } from './shoppingListSelector'

export default function ShoppingListPage() {
  const entries = useMealPlan()
  const recipes = useRecipes()
  const pantryItems = usePantry()
  const batchPantry = useBatchPantry()
  const addPantryItem = useAddPantryItem()

  // Snapshots of checked items — keyed by ingredientId, holds the item at check time.
  // Kept separate from allItems so that adding to pantry (which drops the item from allItems)
  // doesn't make the item disappear before "Clear checked" is tapped.
  const [checkedSnapshots, setCheckedSnapshots] = useState<Map<string, ShoppingItem>>(new Map())

  const weekStart = useMemo(() => getWeekStart(new Date()), [])
  const ingredientsDb = useIngredients()

  const allItems = useMemo(
    () => computeShoppingList(entries, recipes, ingredientsDb, weekStart, pantryItems),
    [entries, recipes, ingredientsDb, weekStart, pantryItems]
  )

  const checkedIds = useMemo(() => new Set(checkedSnapshots.keys()), [checkedSnapshots])

  // Visible = live unchecked items + checked snapshots
  const visibleItems = useMemo(() => {
    const result: ShoppingItem[] = []
    for (const item of allItems) {
      if (!checkedIds.has(item.ingredientId)) {
        result.push(item)
      }
    }
    for (const item of checkedSnapshots.values()) {
      result.push(item)
    }
    return result
  }, [allItems, checkedSnapshots, checkedIds])

  const totalCount = visibleItems.length
  const doneCount = checkedSnapshots.size

  function toggleChecked(item: ShoppingItem) {
    const { ingredientId, quantity } = item
    const isChecked = checkedSnapshots.has(ingredientId)

    const uncheck = () =>
      setCheckedSnapshots((prev) => {
        const m = new Map(prev)
        m.delete(ingredientId)
        return m
      })

    if (isChecked) {
      uncheck()
      // Best-effort pantry reversal: a failure rolls the pantry back and toasts (see useBatchPantry)
      batchPantry.mutate([{ ingredientId, delta: -quantity }])
    } else {
      setCheckedSnapshots((prev) => new Map([...prev, [ingredientId, item]]))
      const hasPantryEntry = pantryItems.some((p) => p.ingredientId === ingredientId)
      // Optimistic pantry write; when it fails the pantry rolls back (and toasts) and the item is un-checked again
      if (!hasPantryEntry) {
        addPantryItem.mutate(newPantryItem({ ingredientId, quantity }), { onError: uncheck })
      } else {
        batchPantry.mutate([{ ingredientId, delta: quantity }], { onError: uncheck })
      }
    }
  }

  function clearChecked() {
    setCheckedSnapshots(new Map())
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

  const isEmpty = allItems.length === 0 && checkedSnapshots.size === 0

  return (
    <div className="page">
      <div className="page-header">
        <h1>Shopping List</h1>
        {checkedSnapshots.size > 0 && (
          <Button
            intent="ghost"
            size="sm"
            data-testid="shopping-list-clear-checked"
            onClick={clearChecked}
            style={{ color: 'var(--coral)' }}
          >
            Clear checked
          </Button>
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
              No upcoming meals planned
            </span>
            <span style={{ fontSize: 13, textAlign: 'center' }}>
              Add recipes to the Meal Planner and your shopping list will appear here.
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
                  const checked = checkedSnapshots.has(item.ingredientId)
                  return (
                    <div
                      key={item.ingredientId}
                      data-testid="shopping-list-item"
                      onClick={() => toggleChecked(item)}
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
