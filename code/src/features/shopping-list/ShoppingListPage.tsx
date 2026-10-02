import { useState, useMemo } from 'react'
import { useMealPlanStore } from '../../store/mealPlanStore'
import { useRecipesStore } from '../../store/recipesStore'
import { useIngredientsStore } from '../../store/ingredientsStore'
import type { IngredientCategory } from '../../types/ingredient'
import './shopping-list.css'

// ── Category config ────────────────────────────────────────────────────────

const CATEGORY_ORDER: IngredientCategory[] = [
  'Produce',
  'Meat',
  'Fish & Seafood',
  'Dairy',
  'Pantry & Dry Goods',
  'Other',
]

const CATEGORY_EMOJI: Record<IngredientCategory, string> = {
  'Produce': '🥬',
  'Meat': '🥩',
  'Fish & Seafood': '🐟',
  'Dairy': '🥛',
  'Pantry & Dry Goods': '🫙',
  'Other': '📦',
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ShoppingItem {
  ingredientId: string
  name: string
  quantity: number
  unit: string
  category: IngredientCategory
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ShoppingListPage() {
  const slots = useMealPlanStore(s => s.slots)
  const recipes = useRecipesStore(s => s.recipes)
  const ingredientsDb = useIngredientsStore(s => s.ingredientsDb)

  const [checked, setChecked] = useState<Set<string>>(new Set())

  // ── Derive shopping list ─────────────────────────────────────────────────

  const shoppingItems = useMemo<ShoppingItem[]>(() => {
    // Build lookup maps
    const recipeMap = new Map(recipes.map(r => [r.id, r]))
    const ingredientMap = new Map(ingredientsDb.map(i => [i.id, i]))

    // Aggregate quantities by ingredientId (only uncooked meals)
    const totals = new Map<string, number>()

    for (const meals of Object.values(slots)) {
      for (const meal of meals) {
        if (meal.cooked) continue
        const recipe = recipeMap.get(meal.recipeId)
        if (!recipe) continue

        for (const ri of recipe.ingredients) {
          if (!recipe.servings) continue
          const scaledQty = (ri.quantity / recipe.servings) * meal.servings
          totals.set(ri.ingredientId, (totals.get(ri.ingredientId) ?? 0) + scaledQty)
        }
      }
    }

    // Build ShoppingItem array
    const items: ShoppingItem[] = []
    for (const [ingredientId, quantity] of totals.entries()) {
      const ingredient = ingredientMap.get(ingredientId)
      if (!ingredient) continue
      items.push({
        ingredientId,
        name: ingredient.name,
        quantity,
        unit: ingredient.defaultUnit,
        category: ingredient.category,
      })
    }

    return items
  }, [slots, recipes, ingredientsDb])

  // ── Group by category ────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const map = new Map<IngredientCategory, ShoppingItem[]>()
    for (const item of shoppingItems) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    // Sort items within each category alphabetically
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return map
  }, [shoppingItems])

  // ── Active categories in fixed order ─────────────────────────────────────

  const activeCategories = CATEGORY_ORDER.filter(cat => grouped.has(cat))

  // ── Progress ─────────────────────────────────────────────────────────────

  const totalCount = shoppingItems.length
  const checkedCount = shoppingItems.filter(item => checked.has(item.ingredientId)).length
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  // ── Handlers ─────────────────────────────────────────────────────────────

  function toggleItem(ingredientId: string) {
    setChecked(prev => {
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
    setChecked(new Set())
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  const isEmpty = totalCount === 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page sl-page" data-testid="shopping-list-page">
      {/* Header */}
      <header className="page-header sl-header">
        <h1 className="sl-title">Shopping List</h1>

        <div className="page-header-controls sl-header-right">
          {!isEmpty && (
            <>
              {/* Progress */}
              <div className="sl-progress-wrap" data-testid="shopping-list-progress">
                <span className="sl-progress-label">
                  {checkedCount} / {totalCount} checked
                </span>
                <div className="sl-progress-bar">
                  <div
                    className="sl-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Clear button */}
              {checkedCount > 0 && (
                <button
                  className="btn btn-ghost btn-sm sl-clear-btn"
                  data-testid="shopping-list-clear-btn"
                  onClick={clearChecked}
                >
                  Clear checked
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="page-body sl-body">
        {isEmpty ? (
          /* Empty state */
          <div className="sl-empty" data-testid="shopping-list-empty">
            <span className="sl-empty-icon">🛒</span>
            <p className="sl-empty-msg">Nothing needed — plan some meals first.</p>
          </div>
        ) : (
          /* Category groups */
          <ul className="sl-list">
            {activeCategories.map(cat => {
              const items = grouped.get(cat)!
              return (
                <li key={cat} className="sl-category-section">
                  <h2
                    className="sl-category-heading"
                    data-testid="shopping-list-category"
                  >
                    {CATEGORY_EMOJI[cat]} {cat}
                  </h2>
                  <ul className="sl-category-items">
                    {items
                      .slice()
                      .sort((a, b) => {
                        const aChecked = checked.has(a.ingredientId) ? 1 : 0
                        const bChecked = checked.has(b.ingredientId) ? 1 : 0
                        if (aChecked !== bChecked) return aChecked - bChecked
                        return a.name.localeCompare(b.name)
                      })
                    .map(item => {
                      const isChecked = checked.has(item.ingredientId)
                      return (
                        <li
                          key={item.ingredientId}
                          className="sl-item"
                          data-testid="shopping-list-item"
                          data-checked={String(isChecked)}
                        >
                          <input
                            type="checkbox"
                            className="sl-checkbox"
                            data-testid="shopping-list-checkbox"
                            checked={isChecked}
                            onChange={() => toggleItem(item.ingredientId)}
                          />
                          <span
                            className="sl-item-name"
                            data-testid="shopping-list-item-name"
                          >
                            {item.name}
                          </span>
                          <span className="sl-item-qty">
                            {Math.round(item.quantity * 100) / 100} {item.unit}
                          </span>
                          <span
                            className="sl-auto-badge"
                            data-testid="shopping-list-auto-badge"
                          >
                            auto
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
