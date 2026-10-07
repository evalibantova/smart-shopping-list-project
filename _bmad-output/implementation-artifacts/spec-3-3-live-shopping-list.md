---
title: '3.3 Live Shopping List'
type: 'feature'
created: '2026-10-07'
status: 'done'
review_loop_iteration: 1
followup_review_recommended: false
baseline_commit: '3240052'
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The shopping list page is a stub. Users who have planned meals for the week need to see what ingredients to buy, aggregated and grouped — without any manual entry.

**Approach:** Compute the shopping list on every render as a pure derivation from Zustand store (`entries`, `recipes`) + `ingredientsDbService.getAll()`. No new persistence needed. Local component state tracks checked and cleared items. Items stay visible with strikethrough when checked; "Clear checked" dismisses them from the visible list. Progress bar shows (checked + cleared) / total.

## Boundaries & Constraints

**Always:**
- Shopping list is NEVER stored — computed on every render, no localStorage writes
- Pantry subtraction = zero (no pantry in scope); deficit = full quantity
- Selector function is pure and exported for unit testing
- Entries are filtered to the current week (`getWeekStart(new Date())`) and `!entry.cooked`
- Quantities rounded to 2 decimal places
- `data-testid` attributes as specified in ACs

**Never:**
- Do not write shopping list data to localStorage
- Do not add new Zustand slice
- Do not modify `mealPlannerSlice` or `recipesSlice`

</intent-contract>

---

## Data Model

### ShoppingItem (not persisted)
```ts
interface ShoppingItem {
  ingredientId: string
  name: string
  quantity: number
  unit: string
  category: string
}
```

### Selector: computeShoppingList()
Pure function, exported from `features/shopping-list/shoppingListSelector.ts`:
```ts
computeShoppingList(
  entries: MealPlanEntry[],
  recipes: Recipe[],
  ingredientsDb: IngredientDbEntry[],
  weekStart: Date
): ShoppingItem[]
```

Logic:
1. Build `weekDateSet`: Set of YYYY-MM-DD strings for Mon-Sun of `weekStart`
2. Build `recipeMap: Map<id, Recipe>` and `ingMap: Map<id, IngredientDbEntry>`
3. For each `entry` where `weekDateSet.has(entry.date) && !entry.cooked`:
   - Find recipe; compute `scale = entry.servings / recipe.servings` (guard divide-by-zero → scale = 1)
   - For each `ing` in `recipe.ingredients`: accumulate `totals.get(ing.ingredientId) + ing.quantity * scale`
4. Map totals to `ShoppingItem[]` (skip entries where ingredient not in `ingMap`)
5. Round quantity to 2dp

---

## File Map

| File | Action |
|---|---|
| `src/features/shopping-list/shoppingListSelector.ts` | CREATE — pure selector |
| `src/features/shopping-list/index.tsx` | UPDATE — full page implementation |
| `src/__tests__/shoppingListSelector.test.ts` | CREATE — 7 unit tests |

---

## Acceptance Criteria

### AC1 — Empty state
When no meal plan entries exist for the current week, show empty state with `data-testid="shopping-list-empty"` and message "Nothing planned this week — add some recipes to the Meal Planner."

### AC2 — Aggregated items
Items are aggregated by canonical ingredient ID. Two entries with the same recipe and ingredient → quantities summed.

### AC3 — Category grouping
Items grouped under category headers in order: Produce → Fish & Seafood → Meat → Dairy → Pantry & Dry Goods → Other. Category header: `data-testid="shopping-list-category-header"`.

### AC4 — Item row
Each item: checkbox (`data-testid="shopping-list-item-checkbox"`) + name + quantity + unit + "auto" badge. Row: `data-testid="shopping-list-item"`.

### AC5 — Check off
Checking an item marks it with strikethrough; item stays visible. Unchecking reverses it.

### AC6 — Progress bar
`data-testid="shopping-list-progress"` shows `{checked + cleared} / {total}` checked. Coral filled bar.

### AC7 — Clear checked
`data-testid="shopping-list-clear-checked"` button appears when `checkedIds.size > 0`. Clicking moves checked items to dismissed (hidden) and resets checked state. Progress bar counts dismissed items as done.

### AC8 — Week scope
Only entries for the current week (Mon–Sun of `getWeekStart(new Date())`) are included. Entries for other weeks are excluded.

### AC9 — Cooked entries excluded
Entries where `entry.cooked === true` are excluded from aggregation (future-proofing for Story 2.3).

---

## Category Config

```ts
const CATEGORY_ORDER = [
  { key: 'Produce', emoji: '🥬' },
  { key: 'Fish & Seafood', emoji: '🐟' },
  { key: 'Meat', emoji: '🥩' },
  { key: 'Dairy', emoji: '🥛' },
  { key: 'Pantry & Dry Goods', emoji: '🫙' },
  { key: 'Other', emoji: '📦' },
]
```

---

## Tasks

### A — Create `shoppingListSelector.ts`
- Pure function `computeShoppingList()` as described in data model
- Export `ShoppingItem` type
- Export `CATEGORY_ORDER` config

### B — Create `shoppingListSelector.test.ts` (7 tests)
- (a) empty entries → []
- (b) entry outside current week → []
- (c) cooked entry excluded
- (d) single entry → ShoppingItem with correct scaled quantity
- (e) same ingredient from two entries → summed
- (f) unknown recipe ID → item excluded
- (g) unknown ingredient ID → excluded

### C — Rewrite `shopping-list/index.tsx`
- `useStore((s) => s.entries)` + `useStore((s) => s.recipes)` for live data
- `ingredientsDbService.getAll()` called in `useMemo` (stable reference)
- `computeShoppingList(...)` called in `useMemo` with entries/recipes/db/weekStart deps
- Local state: `checkedIds: Set<string>`, `clearedIds: Set<string>`
- Render category groups, item rows, progress bar, clear-checked button, empty state
