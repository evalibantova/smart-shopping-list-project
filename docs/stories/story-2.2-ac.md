# Story 2.2 — Meal Slot Interactions: Acceptance Criteria

## AC1 — Empty Slot Tap → Recipe Picker Opens

- Clicking the `.slot-add` button (`data-testid="slot-add"`) on an empty slot opens the recipe picker modal (`data-testid="recipe-picker-modal"`).
- Before the picker opens, the target slot's `date` (ISO `YYYY-MM-DD`) and `mealType` (`breakfast` | `lunch` | `dinner`) are captured so that any recipe selected is added to the correct cell.
- The picker modal uses the standard `.picker-modal` backdrop: `rgba(0,0,0,0.4)` background with `backdrop-filter: blur(6px)`, a centered white panel (480 px / `max-width: 94vw`), and a `slideUp` open animation.
- The search input (`data-testid="recipe-picker-search"`) receives focus automatically when the picker opens.
- Pressing Escape or clicking the backdrop closes the picker without adding any meal.

## AC2 — Filled Slot Add-More Tap → Recipe Picker Opens

- Clicking the `.slot-add-more` button (`data-testid="slot-add-more"`) on a slot that already contains one or more meal cards opens the same recipe picker modal.
- The picker is scoped to the slot of the `+` button that was clicked (same `date` + `mealType` capture as AC1).
- Selecting a recipe from this picker pushes a new `.slot-item` card below the existing cards in that slot (no existing cards are replaced or removed).
- The picker modal behavior (backdrop, focus, Escape) is identical to AC1.

## AC3 — Recipe Picker Modal Content

- The picker modal shows a search input at the top and a scrollable list of all recipes below it.
- Typing in `recipe-picker-search` filters the list to recipes whose name contains the search string (case-insensitive partial match); filtering applies on every keystroke with no debounce requirement.
- The filter is cleared when the modal closes, so reopening the picker always starts with the full unfiltered list.
- Each recipe row in the list has `data-testid="recipe-picker-item"` and displays the recipe emoji, name, and default servings count.
- When the recipe store contains no recipes at all, the recipe list is replaced by an empty-state message (`data-testid="recipe-picker-empty-state"`) — e.g. "No recipes yet. Add one from the Recipes page."
- When the search query matches zero recipes (but recipes do exist), the same `recipe-picker-empty-state` element is shown with a "no results" variant message — e.g. "No recipes match "xyz"."

## AC4 — Selecting a Recipe Adds a Meal Card

- Tapping a `recipe-picker-item` row calls `addMeal(date, mealType, recipeId, recipe.servings, recipe.name, recipe.emoji)` on the meal plan store.
- The new `.slot-item` card appears immediately in the correct calendar cell (optimistic update — no loading spinner).
- The recipe picker modal closes immediately after the selection, without requiring a separate Confirm step.
- No toast is required for this action (silent success).

## AC5 — Slot Card Visual Spec

- Each meal card in a slot has `data-testid="slot-item"` and the CSS class `slot-item`.
- The card contains a circular emoji badge (`data-testid="slot-emoji-badge"`, 24 px diameter, `border-radius: 50%`, tinted background) positioned to the left.
- The recipe name (`.slot-name`) is displayed to the right of the badge at 12 px / weight 500 / `line-height: 1.35` and wraps naturally to at most 2 lines.
- `text-overflow: ellipsis`, `white-space: nowrap`, and `overflow: hidden` are **forbidden** on `.slot-name`.
- A fixed height is **forbidden** on `.slot-item` — the card must grow to fit wrapped text.

## AC6 — Tapping a Slot Card → RecipeDetail Overlay

- Clicking anywhere on a `.slot-item` card opens the meal-plan overlay (`data-testid="meal-plan-overlay"`).
- The overlay uses the standard `.picker-modal` backdrop and centered panel pattern (same as the recipe picker: `rgba(0,0,0,0.4)` + blur, 480 px panel, `slideUp` animation).
- The overlay renders the shared `RecipeDetail` component populated with the recipe matching the card's `recipeId`.
- Clicking the backdrop closes the overlay without making changes.
- Pressing Escape closes the overlay without making changes.

## AC7 — RecipeDetail Overlay Action Buttons

- The RecipeDetail inside the meal-plan overlay includes the following four action buttons in the recipe header:
  - **Edit** (`data-testid="recipe-detail-edit-btn"`, `.rd-act.accent`) — opens the recipe edit form; the overlay remains open behind the form.
  - **Add to Week** (`data-testid="recipe-detail-add-to-week-btn"`, `.rd-act`) — **must be enabled** (the `disabled` attribute present in Story 2.1 is removed in this story); clicking opens the Add to Week modal (see AC9).
  - **Cooked toggle** — present in the header but rendered as disabled/non-interactive (grayed out, `pointer-events: none` or `disabled` attribute); cooked functionality is Story 2.3 scope.
  - **Remove from Plan** (`data-testid="meal-plan-remove-btn"`, `.rd-act.danger`) — red trash icon; clicking removes the meal (see AC8).
- Button order (left to right): Edit · Add to Week · Cooked toggle · Remove from Plan.

## AC8 — Remove from Plan

- Clicking `meal-plan-remove-btn` calls `removeMeal(date, mealType, id)` where `date` and `mealType` are the slot context captured when the card was tapped, and `id` is the `PlannedMeal.id` of the selected card.
- The `.slot-item` card disappears immediately from the calendar cell (optimistic update).
- The meal-plan overlay closes immediately after removal.
- If the slot now contains zero meal cards, the `.slot-add` `+` button reappears in the cell (empty-slot state is restored).
- If the slot still contains other meal cards, those cards remain and the `.slot-add-more` `+` control remains visible at the bottom.

## AC9 — Add to Week Modal

- Clicking `recipe-detail-add-to-week-btn` (from either the meal-plan overlay or the Recipes page detail panel) opens the Add to Week modal (`data-testid="add-to-week-modal"`).
- The modal contains exactly 7 day radio buttons (`data-testid="add-to-week-day-radio"`), one per day Mon–Sun of the **currently displayed week** in the Meal Planner. Each radio is labeled with the abbreviated day name and the formatted date — e.g. "Mon 29 Sep".
- The modal contains a slot selector (`data-testid="add-to-week-slot-select"`) — a `<select>` or equivalent — with exactly three options: Breakfast, Lunch, Dinner.
- The modal contains a servings number input (`data-testid="add-to-week-servings"`) that defaults to the recipe's own `servings` value; the user may change it before confirming.
- The modal contains a Confirm button (`data-testid="add-to-week-confirm"`).
- The Add to Week modal uses the standard `.picker-modal` backdrop and panel pattern.
- Pressing Escape or clicking the backdrop closes the modal without adding any meal.

## AC10 — Confirm in Add to Week

- Clicking `add-to-week-confirm` calls `addMeal(date, mealType, recipeId, servings, recipeName, recipeEmoji)` using the day selected via `add-to-week-day-radio`, the slot selected via `add-to-week-slot-select`, the servings value from `add-to-week-servings`, and the recipe's name and emoji.
- The new `.slot-item` card appears immediately in the correct calendar cell.
- The Add to Week modal closes immediately after Confirm.
- If the Add to Week modal was opened from the meal-plan overlay, the overlay also closes after Confirm.
- If the Add to Week modal was opened from the Recipes page, only the modal closes; the Recipes page remains visible.
