# Story 3.3 — Live Shopping List: Acceptance Criteria

## AC1 — Ingredient Aggregation (Scaling + Summing)

- Every `PlannedMeal` in the current week's `slots` contributes its recipe's ingredients to the list.
- For each `PlannedMeal`, each `RecipeIngredient.quantity` is scaled by `(plannedMeal.servings / recipe.servings)` before aggregation.
- Multiple planned meals that share the same `ingredientId` (regardless of which recipe or slot they come from) are summed into a single line item.
- Summing is safe and requires no unit conversion — all quantities for a given `ingredientId` are guaranteed to be in `Ingredient.defaultUnit`.
- The aggregated quantity displayed is the sum of all scaled contributions for that `ingredientId`.
- Cooked meals (`PlannedMeal.cooked === true`) are **excluded** from aggregation — only uncooked meals contribute to the shopping list.

## AC2 — Live-Computed (No Generate Button)

- The shopping list is derived entirely at render time from `useMealPlanStore` (slots), `useRecipesStore` (recipes), and `useIngredientsStore` (ingredientsDb). It is never stored separately.
- There is no "Generate", "Refresh", or "Recalculate" button — the list always reflects the current store state.
- When a meal is added to or removed from the meal plan, the shopping list updates immediately on the next render without any user action.
- When a meal is marked as cooked, its ingredients disappear from the shopping list on the next render.
- The page has `data-testid="shopping-list-page"`.

## AC3 — Category Grouping

- Aggregated line items are grouped by the `Ingredient.category` value looked up from `ingredientsDb`.
- Each category group renders a heading (`data-testid="shopping-list-category"`) that includes the category emoji and name:
  - 🥬 Produce
  - 🥩 Meat
  - 🐟 Fish & Seafood
  - 🥛 Dairy
  - 🫙 Pantry & Dry Goods
  - 📦 Other
- A category group only appears when at least one item in that category is needed (no empty category sections).
- The order of category groups is fixed in the display order listed above.
- Items within each category group are sorted alphabetically by ingredient name.

## AC4 — Check Off an Item

- Each line item renders a checkbox (`data-testid="shopping-list-checkbox"`) on the left.
- Clicking an unchecked checkbox marks the item as checked.
- A checked item's name text has `text-decoration: line-through`.
- A checked item renders at reduced opacity (≤ 0.5).
- Checked items remain visible in the list — they are not removed from the DOM until "Clear checked" is activated.
- Checked items are displayed below unchecked items within their category group.

## AC5 — Uncheck an Item

- Clicking the checkbox on an already-checked item marks it unchecked.
- Unchecking removes the strikethrough and restores full opacity.
- The unchecked item returns to its normal position (above checked items) within its category group.
- The progress bar (AC6) updates immediately when an item is unchecked.

## AC6 — Progress Bar

- The page header contains a progress bar section (`data-testid="shopping-list-progress"`) showing the count of checked vs total items, e.g. "3 / 7 checked".
- When zero items are checked the label reads "0 / N checked" and the visual bar is at 0 %.
- The visual bar fill width equals `(checkedCount / totalCount) * 100 %`, clamped to [0, 100].
- When all items are checked the label reads "N / N checked" and the bar is at 100 %.
- The progress bar is always visible whenever there is at least one shopping list item (empty state, AC8, replaces it when there are none).

## AC7 — Clear Checked Button

- A "Clear checked" button (`data-testid="shopping-list-clear-btn"`) appears in the page header when at least one item is checked.
- The button is absent (not rendered) when zero items are checked.
- Clicking "Clear checked" resets all checked items to unchecked.
- After clearing: the progress bar resets to "0 / N checked" and 0 % fill.
- The items that were checked remain in the list (still visible, now unchecked).

## AC8 — Empty State

- When the meal plan contains no planned meals for the current week (or all planned meals are cooked), the shopping list body shows an empty-state element (`data-testid="shopping-list-empty"`) instead of the grouped list.
- The empty state displays a centered message, e.g. "Nothing needed — plan some meals first."
- The progress bar (AC6) and "Clear checked" button (AC7) are not rendered in the empty state.
- The empty state is replaced by the live list as soon as a meal is added to the plan.

## AC9 — Auto Badge

- Each line item that was generated from the meal plan (all items in Story 3.3 scope) renders a small badge (`data-testid="shopping-list-auto-badge"`) with the text "auto".
- The badge uses a coral background (`#f07045` or the `--color-coral` token).
- The badge is positioned to the right of the ingredient name and quantity, within the same row.

## AC10 — No Persistence (Local State Only)

- Checked/unchecked state is held in React component state (e.g. `useState` or `useReducer`) — it is not written to `localStorage`, Zustand, or any other persistent store.
- Reloading the page resets all checkboxes to unchecked.
- Checked state is scoped to the component lifetime and does not survive navigation away from and back to the Shopping List page.
