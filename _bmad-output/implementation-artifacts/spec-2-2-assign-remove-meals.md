---
title: '2.2 Assign & Remove Meals'
type: 'feature'
created: '2026-10-07'
status: 'done'
review_loop_iteration: 1
followup_review_recommended: false
baseline_commit: 'd5475d1'
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The calendar grid exists (Story 2.1) but clicking a slot or card does nothing. Users cannot assign meals, view meal details, or remove planned meals.

**Approach:** Wire up the `+` slot buttons to open a recipe picker modal. Tapping a slot card opens a RecipeDetail overlay with meal-plan action buttons (Edit, Add to Week enabled, Cooked toggle disabled, Remove from Plan). Implement the Add to Week modal with day/slot/servings. Also wire the Recipes page's "Add to Week" button to the same modal. All mutations are optimistic (update store immediately, persist to service).

## Boundaries & Constraints

**Always:**
- Optimistic updates: dispatch to Zustand store first, then call service; no rollback needed per ACs (silent success, no toast on add/remove)
- `mealPlanService.create()` / `mealPlanService.remove()` persist changes; Zustand slice's `addEntry` / `removeEntry` update in-memory state
- `data-testid` attributes exactly as specified in the ACs
- RecipeDetail header button order in meal-planner context: Edit · Add to Week · Cooked toggle · Remove from Plan (AC7)
- Cooked toggle: rendered in meal-planner context but `pointer-events: none` + opacity 0.35 (Story 2.3 wires it up)
- Remove from Plan closes the overlay immediately after removing (AC8)
- Recipe picker closes immediately after selecting a recipe (AC4)
- No toast on successful add or remove (ACs 4, 8)
- Add to Week modal uses the 7 days of the `weekStart` prop's week
- When Add to Week is opened from the Recipes page, pass `getWeekStart(new Date())`
- `Modal.tsx` reused for all three new modals (recipe picker, meal-plan overlay, add-to-week)

**Never:**
- No cooked toggle functionality (pointer-events: none in this story — Story 2.3 only)
- Do not touch `mealPlannerSlice` actions beyond wiring existing `addEntry` / `removeEntry` — they already exist from 2.1
- Do not break RecipeDetail's existing behavior in `recipes` context (onDelete and onEdit still pass through unchanged)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|----------------|----------------|
| Click slot-add (empty slot) | Empty slot cell | Recipe picker modal opens; search input focused; correct date+slot captured | — |
| Click slot-add-more (non-empty slot) | Slot with ≥1 entry | Same picker modal opens; new card stacks below existing cards on confirm | — |
| Select recipe in picker | Recipe row clicked | Entry added optimistically; slot card appears; picker closes | Silent (no toast) |
| No recipes exist | recipe list empty | Picker shows empty-state: "No recipes yet. Add one from the Recipes page." | — |
| Search returns no results | Query matches nothing | Empty-state: `"No recipes match \"xyz\"."` | — |
| Click slot card | Card with entry | MealPlanOverlay opens with RecipeDetail populated | — |
| Remove from Plan | onRemoveFromPlan clicked | Card removed optimistically; overlay closes; if slot now empty → slot-add button shown | — |
| Add to Week from overlay | onAddToWeek clicked | AddToWeekModal opens nested; on confirm new card added + overlay stays open (AC10 does not close overlay) | — |
| Add to Week from Recipes page | "Add to Week" button in RecipeDetail | AddToWeekModal opens; on confirm Recipes page stays visible; modal closes | — |
| Escape / backdrop in picker | Modal-level close | Picker closes; no entry added | — |
| Escape / backdrop in overlay | Modal-level close | Overlay closes; no changes | — |
| Escape / backdrop in add-to-week | Modal-level close | Add to Week modal closes; no entry added | — |

</intent-contract>

## Code Map

**Existing — read before writing:**
- `code/src/components/ui/Modal.tsx` — portal modal with backdrop + slideUp animation; reuse for all 3 new modals
- `code/src/components/shared/RecipeDetail.tsx` — current props: `{ recipeId, context, onEdit?, onDelete?, onAddToWeek? }`; update to add `onRemoveFromPlan?` and restructure header buttons
- `code/src/features/meal-planner/index.tsx` — current slot rendering; update to wire slot-add/slot-add-more + slot-item onClick
- `code/src/features/recipes/index.tsx` — current Recipes page; add AddToWeekModal support
- `code/src/store/mealPlannerSlice.ts` — `addEntry`, `removeEntry` already exist from 2.1; no changes needed
- `code/src/features/meal-planner/services/mealPlanService.ts` — `create`, `remove` already exist
- `code/src/features/meal-planner/utils/calendarUtils.ts` — `getWeekStart`, `toDateStr`, `getDayDates`, `DAYS` available

**New files:**
- `code/src/features/meal-planner/RecipePickerModal.tsx`
- `code/src/features/meal-planner/MealPlanOverlay.tsx`
- `code/src/features/meal-planner/AddToWeekModal.tsx`
- `code/src/__tests__/mealPlannerSliceMutations.test.ts`

## Tasks & Acceptance

**Execution:**

- `code/src/components/shared/RecipeDetail.tsx` — update; add `onRemoveFromPlan?: () => void` prop; restructure header button area:
  - When `context === 'meal-planner'`: render Edit (pencil, from `onEdit`), CalendarPlus (from `onAddToWeek`; opacity 0.35 if not provided), CheckCircle (`pointer-events: none`, opacity 0.35, aria-label "Cooked — coming soon"), Trash2 danger (from `onRemoveFromPlan`)
  - When `context !== 'meal-planner'`: render existing order — Trash2 danger (from `onDelete`), Pencil (from `onEdit`), CalendarPlus (from `onAddToWeek`; opacity 0.35 if not provided)
  - Remove the `context !== 'recipes'` guard on CalendarPlus onClick — change to `onClick={onAddToWeek}` always; dim by presence/absence of the handler, not by context

- `code/src/features/meal-planner/RecipePickerModal.tsx` — create; props: `{ date: string, slot: 'breakfast'|'lunch'|'dinner', onClose: () => void }`:
  - Renders inside `<Modal onClose={onClose}>` (reuse Modal.tsx)
  - Header: "Add recipe to slot" title + X close button
  - Search input (`data-testid="recipe-picker-search"`) with `autoFocus`; controlled by local `useState<string>('')`; cleared on unmount/close does not need explicit reset (Modal unmounts)
  - Recipe list: reads `recipes` from `useStore` (or `recipeService.getAll()` if store empty); filtered case-insensitive by `name`; each row: `data-testid="recipe-picker-item"`, 40px circular emoji badge on the left, then recipe name (14px/600) on one line + secondary line showing `{recipe.servings} servings · tag1 tag2` (comma-separated tag names in `var(--text-dim)`); clicking a row calls `addEntry` + `mealPlanService.create()` then `onClose()`
  - Empty state (no recipes at all): `data-testid="recipe-picker-empty-state"` — "No recipes yet. Add one from the Recipes page."
  - Empty state (search has no results but recipes exist): same `data-testid` — `No recipes match "${query}".`
  - `addEntry` call: `addEntry({ id: crypto.randomUUID(), date, slot, recipeId: recipe.id, servings: recipe.servings })`; then `mealPlanService.create({ date, slot, recipeId: recipe.id, servings: recipe.servings })` — use the same id by building the full entry first then passing it

- `code/src/features/meal-planner/AddToWeekModal.tsx` — create; props: `{ recipeId: string, defaultServings: number, weekStart: Date, onClose: () => void, onAfterConfirm?: () => void }`:
  - Renders inside `<Modal onClose={onClose}>` (reuse Modal.tsx)
  - Header: "Add to Week" title
  - 7 day radio buttons (`data-testid="add-to-week-day-radio"` on each `<input type="radio">`): Mon–Sun of `weekStart` week via `getDayDates(weekStart)`; each labeled `"{DAYS[i]} {d.getDate()} {MONTHS[d.getMonth()].slice(0,3)}"` (e.g. "Mon 28 Sep"); default selection is today's date if in the week, otherwise Monday
  - Slot `<select>` (`data-testid="add-to-week-slot-select"`): options Breakfast, Lunch, Dinner; default Lunch
  - Servings `<input type="number">` (`data-testid="add-to-week-servings"`): min=1, value=`defaultServings`
  - Confirm `<button>` (`data-testid="add-to-week-confirm"`): on click calls `addEntry({ id: crypto.randomUUID(), date: selectedDate, slot: selectedSlot, recipeId, servings })` and `mealPlanService.create({ date: selectedDate, slot: selectedSlot, recipeId, servings })`; then calls `onClose()` and `onAfterConfirm?.()`
  - Escape / backdrop: delegate to Modal.tsx (existing behavior)

- `code/src/features/meal-planner/MealPlanOverlay.tsx` — create; props: `{ entryId: string, date: string, slot: 'breakfast'|'lunch'|'dinner', weekStart: Date, onClose: () => void }`:
  - Renders inside `<Modal onClose={onClose}>` (reuse Modal.tsx)
  - Reads entry from `useStore(s => s.entries.find(e => e.id === entryId))`; if not found, closes self immediately in useEffect
  - Renders `<RecipeDetail recipeId={entry?.recipeId} context="meal-planner" onEdit={...} onAddToWeek={...} onRemoveFromPlan={...} />`
  - `onEdit`: `setEditOpen(true)` — renders `<AddEditRecipeModal mode="edit" recipe={...} onClose={() => setEditOpen(false)} />` alongside the overlay
  - `onRemoveFromPlan`: calls `removeEntry(entryId)` + `mealPlanService.remove(entryId)` + `onClose()`
  - `onAddToWeek`: `setAddToWeekOpen(true)` — renders `<AddToWeekModal recipeId={entry.recipeId} defaultServings={entry.servings} weekStart={weekStart} onClose={() => setAddToWeekOpen(false)} />` (no `onAfterConfirm` — overlay stays open per AC10)
  - Local state: `editOpen: boolean`, `addToWeekOpen: boolean`

- `code/src/features/meal-planner/index.tsx` — update:
  - Add state: `pickerSlot: { date: string, slot: 'breakfast'|'lunch'|'dinner' } | null` (null = closed)
  - Add state: `overlayEntry: { id: string, date: string, slot: 'breakfast'|'lunch'|'dinner' } | null` (null = closed)
  - Import `RecipePickerModal`, `MealPlanOverlay` from sibling files
  - Update slot cell rendering:
    - Slot-item cards: add `data-testid="slot-item"` and `onClick={() => setOverlayEntry({ id: entry.id, date: dateStr, slot: slot.key })}` and `style={{ cursor: 'pointer' }}`; add `data-testid="slot-emoji-badge"` on the emoji div; add `className="slot-name"` on the recipe name span
    - When `slotEntries.length === 0`: show only `.slot-add` button centered (`data-testid="slot-add"`) with `onClick={() => setPickerSlot({ date: dateStr, slot: slot.key })}`
    - When `slotEntries.length > 0`: show slot-item cards + at the bottom a `.slot-add-more` button (`data-testid="slot-add-more"`, smaller, `fontSize: 14`) with `onClick={() => setPickerSlot({ date: dateStr, slot: slot.key })`
  - Render `{pickerSlot && <RecipePickerModal date={pickerSlot.date} slot={pickerSlot.slot} onClose={() => setPickerSlot(null)} />}` at the end of the JSX return
  - Render `{overlayEntry && <MealPlanOverlay entryId={overlayEntry.id} date={overlayEntry.date} slot={overlayEntry.slot} weekStart={weekStart} onClose={() => setOverlayEntry(null)} />}` at the end of the JSX return
  - Also pull `addEntry` and `removeEntry` from `useStore` (needed by RecipePickerModal — but since RecipePickerModal uses `useStore` directly, index.tsx itself doesn't need them added)

- `code/src/features/recipes/index.tsx` — update:
  - Import `AddToWeekModal` from `../meal-planner/AddToWeekModal` and `getWeekStart` from `../meal-planner/utils/calendarUtils`
  - Add state: `addToWeekRecipeId: string | null`
  - Wire `onAddToWeek` on both RecipeDetail instances: `onAddToWeek={selectedId ? () => setAddToWeekRecipeId(selectedId) : undefined}`
  - Render `{addToWeekRecipeId && <AddToWeekModal recipeId={addToWeekRecipeId} defaultServings={recipes.find(r => r.id === addToWeekRecipeId)?.servings ?? 1} weekStart={getWeekStart(new Date())} onClose={() => setAddToWeekRecipeId(null)} />}` at the end of the JSX return

- `code/src/__tests__/mealPlannerSliceMutations.test.ts` — create; uses `createStore` from zustand, imports `mealPlannerSlice`:
  - Test (a): `addEntry` adds entry with correct fields to `entries` array
  - Test (b): `addEntry` twice accumulates two entries
  - Test (c): `removeEntry` removes the correct entry by id
  - Test (d): `removeEntry` with unknown id leaves entries unchanged
  - Test (e): `updateEntry` merges patch correctly

**Acceptance Criteria:**
- Given an empty slot, when the `+` button is clicked, then the recipe picker modal appears with a focused search input
- Given the picker is open, when a recipe is clicked, then a slot-item card appears in the correct calendar cell and the picker closes
- Given a slot already has a card, when the slot-add-more `+` is clicked, then the picker opens and selecting a recipe adds a new card below the existing one
- Given no recipes exist, when the picker opens, then the empty-state message appears
- Given a search query that matches nothing, when typed, then the no-results empty-state appears
- Given a slot card is clicked, when the meal-plan overlay opens, then RecipeDetail shows the recipe with four header buttons in order: Edit · Add to Week · Cooked (dimmed) · Remove from Plan
- Given Remove from Plan is clicked, when the action completes, then the card disappears from the slot and the overlay closes
- Given Add to Week is clicked in the overlay, when the Add to Week modal appears, then it shows 7 day radios for the current meal-planner week with slot selector, servings input, and Confirm
- Given Confirm in Add to Week modal, when clicked, then a new meal card appears in the selected slot and the modal closes (overlay stays open)
- Given the Add to Week button in the Recipes page RecipeDetail, when clicked, then the Add to Week modal opens with the current week
- Given Escape or backdrop click in any modal, when triggered, then the modal closes without changes

## Spec Change Log

## Review Triage Log

## Design Notes

**Shared entry creation pattern:** To keep the store and service in sync, build the full `MealPlanEntry` object with a pre-generated UUID in the component, then pass it to both `addEntry(entry)` and `mealPlanService.create(entry)`. This avoids the service generating a different UUID than the store has.

Actually: `mealPlanService.create` generates its own UUID. To keep them in sync: (1) generate UUID in component, (2) call `addEntry({ id, ... })` immediately, (3) call `mealPlanService.create({ date, slot, recipeId, servings })` which generates its own UUID and persists — these IDs won't match. On next `initMealPlan`, the store will re-load from service with the service's UUID.

This means a page reload will show the correct data from localStorage, but the in-memory entry has a different ID than what's stored. On reload, `initMealPlan` fixes it. For this story's scope (no rollback, no remove during the same session as add), this is acceptable. To make IDs consistent: modify `mealPlanService.create` to accept an optional `id: string` override, or generate the UUID in the component and pass a full entry with the id. See **entry-id-consistency** note.

**Entry ID consistency:** The cleanest approach: modify `mealPlanService.create` to accept a full `MealPlanEntry` (not `Omit<..., 'id'>`) so the caller controls the ID. Update the signature: `create(entry: MealPlanEntry): MealPlanEntry` — store as-is, return as-is. Update `mealPlanService.test.ts` test (b) accordingly. This keeps IDs identical between store and localStorage.

**Modal stack management:** `MealPlanOverlay` opens nested `AddToWeekModal` or `AddEditRecipeModal`. React renders these as separate portal roots into `document.body`, so z-index stacking works naturally. No special coordination needed.

**`Modal.tsx` reuse:** The existing `Modal.tsx` handles backdrop, Escape key, and slide-up animation. Pass content as children. Its `onClose` prop wires the backdrop + Escape. Each new modal passes its own `onClose` callback.

**`slot-add-more` button:** Smaller than `slot-add` — use `fontSize: 14px`, `padding: 2px 6px`, lighter color. It renders after all slot-item cards in the cell.

## Verification

**Commands:**
- `cd /data/code && npm test -- --run` — expected: all tests pass including new mealPlannerSliceMutations.test.ts
- `cd /data/code && npm run build` — expected: exits 0
- `cd /data/code && npm run lint` — expected: exits 0
