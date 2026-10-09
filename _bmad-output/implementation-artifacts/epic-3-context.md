# Epic 3 Context: Pantry & Live Shopping

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable users to track their home ingredient stock and see a live, auto-generated shopping list. This epic wires the cooked toggle to auto-deduct pantry quantities (completing the loop started in Epic 2), delivers full pantry CRUD with stock-bar visualisation, and exposes a shopping list that is always live-computed from the current week's uncooked planned meals minus pantry stock — never persisted.

## Stories

- Story 3.1: Pantry Management
- Story 3.2: Cooked → Pantry Deduction
- Story 3.3: Live Shopping List

## Requirements & Constraints

**Pantry CRUD**
- Each pantry item references a canonical `ingredients_db` entry by ID; quantity is stored in that ingredient's `default_unit` — no freeform units.
- Data shape: `{ id: crypto.randomUUID(), ingredientId, quantity, maxStock }` written to `slist_pantry`.
- `maxStock` defaults to 3× the initial quantity when not supplied.
- The stock bar (52 px wide) colors: coral when `quantity/max > 50%`, amber at 20–50%, red below 20%.
- Inline edit activates on row click: editable quantity + maxStock, Save / Cancel / Delete buttons, row background changes to `--surface2` with coral left accent.
- Add Item modal uses ingredient autocomplete against `ingredients_db`; unit field is read-only.
- Empty state required when no pantry items exist.

**Cooked → pantry deduction**
- When a meal is marked cooked, deduct each recipe ingredient (scaled to planned servings) from the matching pantry entry by `ingredientId`; skip silently if no pantry entry exists.
- Pantry quantity floor is 0 — never negative.
- Unmarking reverses all deductions (adds quantities back).
- Any deduction failure rolls back all pantry changes **and** the `cooked` flag; surface a toast.

**Live shopping list**
- The shopping list is **never stored** — `shoppingListSlice` contains selectors only, no state.
- Computation: collect ingredients from all uncooked planned meals this week (scaled to planned servings); aggregate by `ingredientId`; subtract pantry quantity; expose items where deficit > 0.
- Items grouped by ingredient category: Produce, Fish & Seafood, Meat, Dairy, Pantry & Dry Goods, Other.
- Each item shows: unfilled checkbox, ingredient name, deficit quantity + unit, coral "auto" badge.
- Checking an item calls `pantryService.update()` to add the deficit quantity to pantry stock immediately; item shows strikethrough + reduced opacity but stays visible.
- Unchecking reverses the pantry update.
- "Clear checked" removes checked items from the visible list; pantry updates from checking persist.
- Progress bar in page header: "X / Y checked"; "Clear checked" button appears when ≥1 item is checked.
- Empty state when pantry covers all planned meals.
- Shopping list recomputes automatically on any upstream change (pantry edit, meal plan change, cooked toggle) — no manual refresh.

**Mutations**
- All writes are optimistic: update Zustand immediately, call service, roll back + toast on error (AD-10).
- Service functions used: `pantryService.create()`, `pantryService.update()`, `pantryService.delete()`.

**Empty states**
- Required on: Pantry page (no items), Shopping List page (nothing needed).

## Technical Decisions

**Store structure (AD-4)**
- `pantrySlice` owns `slist_pantry` state (read/write).
- `shoppingListSlice` is selectors only — it derives from `mealPlanSlice`, `recipesSlice`, and `pantrySlice`; it must never hold stored state.
- Both live in `src/store/`; composed in `src/store/index.ts`.

**Service layer (AD-2)**
- `pantryService` lives in `src/features/pantry/services/`; it is the only layer that touches `localStorage` key `slist_pantry`.
- The cooked deduction logic (Story 3.2) calls `pantryService.update()` for each ingredient — it does not write to localStorage directly from the meal planner feature.

**Data shapes**
- Pantry localStorage record: `{ id, ingredientId, quantity, maxStock }`.
- Meal plan records (from Epic 2): `{ id, date: "YYYY-MM-DD", slot, recipeId, servings, cooked: boolean }`.
- Ingredient identity is always by `ingredientId` (canonical `ingredients_db` UUID) — never freeform strings.

**IDs and keys (AD-8, AD-9)**
- New pantry records: `id: crypto.randomUUID()`.
- localStorage key: `slist_pantry`.

**Ingredient categories**
- Categories come from `ingredients_db.category`; the six display groups are: Produce, Fish & Seafood, Meat, Dairy, Pantry & Dry Goods, Other.

**Feature folder (AD-1)**
- Pantry feature code lives in `src/features/pantry/`.
- Shopping list UI lives in `src/features/shopping-list/`; its slice lives in `src/store/shoppingListSlice.ts`.

## UX & Interaction Patterns

**Pantry page**
- Header: item count, "click a row to edit" hint, charcoal "Add Item" button (+ icon).
- Inline edit row: `--surface2` background, coral left accent, Save / Cancel / Delete (danger red, trash icon) buttons.
- Stock bar: 52 px wide, coral / amber / red thresholds as above.

**Shopping list page**
- Page header is a single flex row (title left, controls right — never stacked).
- Progress bar and "Clear checked" live in the header controls area.
- Checked items: strikethrough + reduced opacity, remain in-place until "Clear checked".
- "Clear checked" resets the checked-off list view; pantry changes from checking persist.

**Modals and toasts**
- Add Item modal follows the standard modal spec: backdrop `rgba(0,0,0,0.4)` + `blur(6px)`, `slideUp` animation, 480 px centered on desktop, full-width bottom-sheet on mobile.
- Errors surface via charcoal toast, auto-dismiss 2.5 s.
- SavingIndicator (16×16 px spinning ring, top-right) shows while any mutation is in flight.

## Cross-Story Dependencies

- **3.1 before 3.2:** pantry entries and `pantryService` must exist before cooked deduction can write to them.
- **3.1 before 3.3:** `pantrySlice` must be populated for the shopping list selector to subtract stock correctly.
- **3.2 requires Epic 2 (Story 2.3):** the `cooked` boolean on meal plan entries and `mealPlanService.update()` are implemented in Epic 2; Story 3.2 extends that flow with pantry side-effects.
- **3.3 requires Epic 1 + Epic 2 slices:** `shoppingListSlice` reads from `recipesSlice` (for ingredient lists) and `mealPlanSlice` (for planned meals + cooked state); both must be in place.
- Shopping list recomputation is automatic via Zustand selector reactivity — no explicit cross-story coordination needed at runtime beyond the store being composed correctly.
