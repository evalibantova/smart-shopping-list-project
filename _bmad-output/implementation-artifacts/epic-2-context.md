# Epic 2 Context: Meal Planning

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 2 delivers the weekly meal planning feature. Users get a 7-day calendar grid with prev/next week navigation, can assign recipes to any Breakfast, Lunch, or Dinner slot with a per-slot servings override, remove planned meals, and mark meals as cooked. The cooked toggle sets the `cooked` flag only — pantry deduction is wired in Epic 3. This epic also activates the "Add to Week" button in RecipeDetail, which was present but disabled in Epic 1.

## Stories

- Story 2.1: Weekly Calendar Grid
- Story 2.2: Assign & Remove Meals
- Story 2.3: Mark as Cooked

## Requirements & Constraints

**Functional:**
- Display a 7-day grid (Mon–Sun) with 3 slot rows: Breakfast, Lunch, Dinner; today's column highlighted in coral
- Week navigation: `<` prev, `>` next, and a today button that snaps back to the current week
- Assign a recipe to any slot via an "Add to Week" modal — inputs are day (radio), slot (selector), and servings (number, defaults to recipe's servings)
- Multiple recipes can be assigned to the same slot; they stack vertically in the cell
- Remove a recipe from the meal plan; if the slot becomes empty it reverts to the empty `+` state
- Mark a planned meal as cooked (sets `cooked: true`); unmark reverses it — no pantry side-effect in this epic
- RecipeDetail renders in meal planner context with Edit, Add to Week, cooked toggle, and Remove from Plan buttons
- Empty slot cells display a centered `+` sign; recipe picker shows an empty state if no recipes exist yet

**Non-functional:**
- Mobile-first: grid scrolls horizontally on mobile (<768 px) with each column minimum 110 px wide
- All mutations are optimistic: update Zustand state immediately, call service, on error roll back store state and show a toast notification (AD-10)

## Technical Decisions

**Feature location:** `src/features/meal-planner/` — owns its service layer (`services/mealPlanService.ts`) and Zustand slice (`src/store/mealPlannerSlice.ts`). Never imports directly from other feature folders (AD-1).

**Meal plan data shape (AD-7):**
```ts
{ id: string, date: "YYYY-MM-DD", slot: "breakfast" | "lunch" | "dinner", recipeId: string, servings: number, cooked?: boolean }
```
The calendar grid derives displayed meals by filtering the flat `slist_meal_plan` array on a date range — no week-keyed grouping in storage.

**localStorage key:** `slist_meal_plan` (AD-9). New entries use `id: crypto.randomUUID()` (AD-8).

**Service interface:** `mealPlanService.getAll()`, `.create(entry)`, `.update(id, patch)`, `.delete(id)`. The service never touches the store; the hook/component calls the service then dispatches to `mealPlannerSlice` (AD-2).

**RecipeDetail reuse:** The component lives in `src/components/shared/` (built in Epic 1). Story 2.2 enables its "Add to Week" `.rd-act` button; Story 2.3 enables its cooked toggle. No structural changes to the component — only the action handlers and button states are added.

**Cooked flag scope:** `mealPlanService.update(id, { cooked })` persists the flag. Pantry deduction is intentionally absent — Epic 3 (Story 3.2) adds that side-effect on top of this flag without modifying the toggle mechanics.

## UX & Interaction Patterns

**Grid layout:** CSS grid — 26 px rotated-label column (row names: uppercase, 9 px, 1.5 px letter-spacing) + 7 day columns at `minmax(110px, 1fr)`; overflows to horizontal scroll on mobile showing ~3 columns at once.

**Page header:** single flex row — "Meal Planner" title left; week nav group right: `<` (prev), date range label (e.g. `22 – 28 Sep 2026`, en-dash with spaces, 3-letter month, no repeated month on start date if same month), `>` (next), calendar-check icon button (today). Today button dims to 30% opacity when already on the current week.

**Slot item card (`.slot-item`):** `border-radius: 4px` (only contextual rounded-corner exception in the app). Left: circular emoji icon badge, 24 px, `border-radius: 50%`. Right: recipe name, 12 px, weight 500, wraps to 2 lines — no ellipsis, no fixed card height. Cooked state: coral background tint on the card + small inline coral ✓ `<span>` appended to the recipe name.

**Cooked toggle button:** coral `.rd-act` (44×44 px); dims to 50% opacity when meal is already cooked; shows a spinner on the button and the SavingIndicator ring (top-right, 16×16 px) while the mutation is in flight.

**Recipe picker modal:** full modal overlay (slideUp 0.20 s); searchable input filters by recipe name or tag in real time; tapping a recipe commits to the slot immediately (optimistic); empty state shown if recipe list is empty.

**"Add to Week" modal:** 7 day radio buttons (abbreviated day name + date for current week), Breakfast / Lunch / Dinner slot selector, servings number input, Confirm button.

**Tapping a slot item card:** opens RecipeDetail as a centered modal overlay with the meal planner action set.

## Cross-Story Dependencies

- **Depends on Epic 1 (complete):** app shell, design tokens, UI component library (`Button`, `Modal`, `Toast`, `SavingIndicator`, `FilterTabs`, `TagChip`), `RecipeDetailModal` in `components/shared/`, recipe data in `slist_recipes`, and `ingredientsDbService` must all exist before any Epic 2 story begins.
- **Story 2.1 before 2.2 and 2.3:** the calendar grid and `mealPlannerSlice` must exist before meal assignment and cooked-toggle logic can be layered on.
- **Story 2.2 activates RecipeDetail's "Add to Week" button** — disabled in Epic 1; wired here without structural change to the shared component.
- **Story 2.3 sets cooked flag only** — do not implement pantry deduction here; Epic 3 Story 3.2 adds that on top.
- **Epic 3 reads `mealPlannerSlice`** for shopping list computation and pantry deduction — the data shape in AD-7 must be followed exactly so Epic 3 can filter on `cooked` and read `servings`.
