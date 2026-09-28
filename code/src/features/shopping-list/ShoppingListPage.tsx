import { useState } from 'react'
import { useStore } from '../../store'

const CATEGORY_EMOJI: Record<string, string> = {
  'Produce': '🥬',
  'Fish & Seafood': '🐟',
  'Meat': '🥩',
  'Dairy': '🥛',
  'Pantry & Dry Goods': '🫙',
  'Other': '📦',
}

export function ShoppingListPage() {
  const store = useStore()
  const items = store.selectShoppingItems({
    mealPlan: store.mealPlan,
    recipes: store.recipes,
    pantry: store.pantry,
    ingredientsDb: store.ingredientsDb,
  })

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [cleared, setCleared] = useState<Set<string>>(new Set())

  const visibleItems = items.filter(i => !cleared.has(i.ingredientId))
  const checkedCount = visibleItems.filter(i => checkedIds.has(i.ingredientId)).length

  function toggleCheck(ingredientId: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(ingredientId)) next.delete(ingredientId)
      else next.add(ingredientId)
      return next
    })
  }

  function clearChecked() {
    setCleared(prev => {
      const next = new Set(prev)
      checkedIds.forEach(id => next.add(id))
      return next
    })
    setCheckedIds(new Set())
  }

  // Group by category
  const grouped = new Map<string, typeof visibleItems>()
  for (const item of visibleItems) {
    const cat = item.category
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(item)
  }

  if (visibleItems.length === 0) {
    return (
      <>
        <div className="page-header">
          <span className="page-title">Shopping List</span>
        </div>
        <div className="page-body" style={{ overflow: 'auto' }}>
          <div className="empty-state">
            <span className="empty-state-emoji">🛒</span>
            <span className="empty-state-title">Nothing needed</span>
            <span className="empty-state-desc">
              {store.mealPlan.length === 0
                ? 'Plan some meals first to generate your shopping list.'
                : 'Your pantry covers this week\'s meals!'}
            </span>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <span className="page-title">Shopping List</span>
        <div className="shopping-progress" style={{ flex: 1, marginLeft: 16, maxWidth: 320 }}>
          <div className="progress-bar-wrap">
            <div
              className="progress-bar-fill"
              style={{ width: `${visibleItems.length > 0 ? (checkedCount / visibleItems.length) * 100 : 0}%` }}
            />
          </div>
          <span style={{ whiteSpace: 'nowrap', fontSize: 12, flexShrink: 0 }}>
            {checkedCount} / {visibleItems.length}
          </span>
          {checkedCount > 0 && (
            <button className="btn btn-ghost btn-xs" onClick={clearChecked} style={{ flexShrink: 0 }}>
              Clear checked
            </button>
          )}
        </div>
      </div>
      <div className="page-body" style={{ overflow: 'auto' }}>
        <div style={{ padding: '0 16px 32px', width: '100%', maxWidth: 600 }}>
          {Array.from(grouped.entries()).map(([category, catItems]) => (
            <div key={category} className="shopping-list-category">
              <div className="category-label">
                <span>{CATEGORY_EMOJI[category] ?? '📦'}</span>
                <span>{category}</span>
              </div>
              {catItems.map(item => {
                const checked = checkedIds.has(item.ingredientId)
                const displayQty = item.deficit % 1 === 0 ? item.deficit : parseFloat(item.deficit.toFixed(2))
                return (
                  <label
                    key={item.ingredientId}
                    className={`shopping-item${checked ? ' checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCheck(item.ingredientId)}
                      aria-label={item.name}
                      className="shopping-checkbox-input"
                    />
                    <div className={`shopping-checkbox${checked ? ' checked' : ''}`} aria-hidden="true">
                      {checked && <span style={{ color: 'white', fontSize: 11, fontWeight: 800 }}>✓</span>}
                    </div>
                    <span className="shopping-item-name">{item.name}</span>
                    <span className="shopping-item-qty">{displayQty} {item.unit}</span>
                    <span className="auto-badge">auto</span>
                  </label>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
