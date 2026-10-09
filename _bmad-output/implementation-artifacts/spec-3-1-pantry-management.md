---
title: '3.1 Pantry Management'
type: 'feature'
created: '2026-10-09'
status: 'done'
review_loop_iteration: 1
followup_review_recommended: false
baseline_commit: '15d25c063823bdc3a4542bf86c5251e736ff5ea9'
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The pantry page is a stub (`<h1>Pantry</h1>`); no service, slice, or UI exists. The shopping list selector was built without pantry subtraction (Story 3.3 placeholder), so the shopping list currently shows all planned ingredients as needed even when the pantry is stocked.

**Approach:** Build the complete pantry feature — service → slice → page UI — then wire the shopping list selector to subtract stock, so items with deficit ≤ 0 are hidden automatically.

## Boundaries & Constraints

**Always:**
- All writes are optimistic: update Zustand state first, call service, roll back on throw + show toast (AD-10)
- Only `pantryService` touches `slist_pantry`; no other file reads or writes it (AD-2)
- Pantry quantity must floor at 0 — never go negative
- `maxStock` defaults to 3× the initial `quantity` when not specified
- Route (`/pantry`) and nav entry are already wired — do not re-add them
- `pantrySlice` state exposed via `useStore`; `initPantry()` called at boot in `AppShell.tsx` alongside `initRecipes()`

**Never:**
- Store shopping list data to localStorage (selector remains pure derivation)
- Write to `slist_pantry` from outside `pantryService`
- Create a new Zustand store or modify `shoppingListSlice` state (it has no state — only the selector changes)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add item | ingredientId + quantity=2 | New PantryItem in store with maxStock=6; row appears; stock bar visible | Rollback + toast on service throw |
| Edit quantity (save) | Click row → change qty → Save | Updated quantity in store + localStorage; stock bar re-renders | Rollback + toast on throw |
| Delete item | Delete button in edit mode | Item removed from store + localStorage | Rollback + toast on throw |
| Stock bar >50% | quantity=3, maxStock=4 (75%) | Bar color is coral | — |
| Stock bar 20–50% | quantity=2, maxStock=4 (50%) | Bar color is amber | — |
| Stock bar <20% | quantity=0.5, maxStock=4 (12.5%) | Bar color is red | — |
| Shopping list deficit | Meal needs 3g A; pantry has 1g A | Deficit = 2g A shown | — |
| Shopping list covered | Meal needs 2g B; pantry has 5g B | B not shown (deficit ≤ 0) | — |
| Shopping list no pantry | No pantry items; meal needs 3g C | Deficit = 3g C shown (unchanged) | — |

</intent-contract>

## Code Map

- `code/src/features/pantry/index.tsx` — existing stub (just `<h1>Pantry</h1>`); replace entirely with full PantryPage
- `code/src/features/pantry/services/pantryService.ts` — CREATE: CRUD service; localStorage key `slist_pantry`; exports `getAll`, `create`, `update`, `remove`
- `code/src/store/pantrySlice.ts` — CREATE: Zustand slice; state `pantryItems: PantryItem[]`; actions `initPantry`, `addPantryItem`, `updatePantryItem`, `deletePantryItem`
- `code/src/store/index.ts` — add `PantrySlice` to `CombinedStore` intersection type; spread `pantrySlice` in store creator (follow existing two-slice pattern at lines 6–11)
- `code/src/components/shared/AppShell.tsx:13-15` — add `initPantry()` call alongside `initRecipes()` at boot
- `code/src/features/shopping-list/shoppingListSelector.ts:23-28` — add `pantryItems: PantryItem[]` as 5th parameter; build pantryMap by ingredientId; subtract from totals; floor at 0; filter to deficit > 0 only
- `code/src/features/shopping-list/index.tsx:33` — destructure `pantryItems` from `useStore`; add as 5th arg to `computeShoppingList` in the `useMemo` call; add `pantryItems` to deps array
- `code/src/types/pantry.ts` — CREATE: `PantryItem` interface `{ id: string; ingredientId: string; quantity: number; maxStock: number }`
- `code/src/styles/tokens.css` — `--surface2` (line 7), `--amber` (line 15), `--coral`, `--red` all exist; no new tokens needed for stock bar
- `code/src/components/shared/IngredientAutocomplete.tsx` — reused as-is for Add Item modal
- `code/src/__tests__/pantryService.test.ts` — CREATE: service unit tests (same pattern as `mealPlanService.test.ts`)
- `code/src/__tests__/shoppingListSelector.test.ts` — UPDATE: add pantryItems arg to existing calls (pass `[]` to preserve prior behavior); add new test cases covering pantry subtraction

## Tasks & Acceptance

**Execution:**

- `code/src/types/pantry.ts` -- create `PantryItem` interface -- shared type used by service, slice, and selector
- `code/src/features/pantry/services/pantryService.ts` -- create service with `getAll(): PantryItem[]`, `create(item: Omit<PantryItem, 'id'>): PantryItem`, `update(id: string, patch: Partial<PantryItem>): PantryItem`, `remove(id: string): void`; use `localStorage` key `slist_pantry`; `create` generates `id: crypto.randomUUID()` and defaults `maxStock` to `3 * quantity` when not supplied -- service layer boundary (AD-2)
- `code/src/store/pantrySlice.ts` -- create slice with `pantryItems: PantryItem[]`, `initPantry()` (loads from service into state), `addPantryItem(data)` (optimistic: push to state → `pantryService.create()` → on throw: remove + toast), `updatePantryItem(id, patch)` (optimistic: apply patch → `pantryService.update()` → on throw: restore + toast), `deletePantryItem(id)` (optimistic: remove → `pantryService.remove()` → on throw: restore + toast) -- slice pattern (AD-4)
- `code/src/store/index.ts` -- add `PantrySlice` import and to `CombinedStore` type; spread `pantrySlice` in store creator -- compose into global store
- `code/src/components/shared/AppShell.tsx` -- add `initPantry` destructure from `useStore` and call it in the existing boot `useEffect` alongside `initRecipes()` -- ensures pantry data available before any page renders
- `code/src/features/shopping-list/shoppingListSelector.ts` -- add `pantryItems: PantryItem[]` as 5th parameter; before filtering: build `Map<ingredientId, quantity>` from pantryItems; subtract pantry quantity from each aggregated total (floor at 0); only include items where final deficit > 0 -- wires pantry to shopping list
- `code/src/features/shopping-list/index.tsx:33` -- destructure `pantryItems` from `useStore`; add `pantryItems` as 5th argument to `computeShoppingList(entries, recipes, ingredientsDb, weekStart, pantryItems)`; add `pantryItems` to `useMemo` deps -- call site update
- `code/src/features/pantry/index.tsx` -- replace stub with full PantryPage: (a) header row: item count label + "click a row to edit" hint (left) + charcoal `Button` "+ Add Item" (right); (b) list rows: each row shows ingredient name, quantity + unit, stock bar (52px wide); clicking a row enters inline edit mode — row background `--surface2`, 3px coral left border/accent, editable quantity input, editable maxStock input, Save/coral + Cancel/ghost + Delete/danger buttons; (c) stock bar computed as `ratio = quantity/maxStock`: coral if >0.5, amber if 0.2–0.5, red if <0.2; (d) Add Item modal: uses `IngredientAutocomplete` for ingredient selection, quantity number input, unit read-only from ingredient's `default_unit`; Save validates both fields non-empty/positive; (e) empty state when `pantryItems.length === 0`; (f) `SavingIndicator` visible during any in-flight mutation; (g) `Toast` for errors -- full pantry UI (A1)
- `code/src/__tests__/pantryService.test.ts` -- create tests: (a) `getAll()` returns `[]` on empty storage; (b) `create({ingredientId, quantity: 2})` returns item with `id`, `maxStock: 6`; (c) `create` persists to localStorage; (d) `update(id, { quantity: 5 })` returns updated item and persists; (e) `remove(id)` removes from storage; (f) `getAll()` after remove returns remaining items -- service contract
- `code/src/__tests__/shoppingListSelector.test.ts` -- update existing calls: add `[]` as 5th arg (pantryItems) to all existing `computeShoppingList(...)` calls to preserve passing; add new tests: (g) pantry covers part of deficit: meal needs 3g A, pantry has 1g A → deficit 2g shown; (h) pantry fully covers: meal needs 2g B, pantry has 5g B → B not in result; (i) empty pantryItems: existing behavior unchanged -- selector contract

**Acceptance Criteria:**

- Given the pantry page has no items, when it loads, then an empty state and "+ Add Item" button are shown
- Given the user opens Add Item, selects an ingredient (quantity=2), and saves, then a new row appears with quantity "2", unit from `ingredients_db`, and a stock bar; `maxStock` defaults to 6
- Given the user clicks a pantry row, when inline edit is active, then the row background is `--surface2` with a coral left accent and Save/Cancel/Delete buttons are visible
- Given inline edit is active and the user changes quantity and clicks Save, then the row updates and the service persists the change
- Given the user clicks Delete in inline edit mode, when confirmed, then the item is removed from the list and localStorage
- Given `quantity/maxStock > 0.5`, then the stock bar color is coral
- Given `quantity/maxStock` is between 0.2 and 0.5 (inclusive), then the stock bar color is amber
- Given `quantity/maxStock < 0.2`, then the stock bar color is red
- Given pantry has ingredient A with quantity=1 and a meal plan entry needs 3 of A, when the shopping list renders, then A appears with deficit quantity 2
- Given pantry has ingredient B with quantity=5 and a meal plan entry needs 2 of B, when the shopping list renders, then B does not appear

## Verification

**Commands:**
- `cd /data/code && npm test -- --run` -- expected: all tests pass including new pantryService tests and updated shoppingListSelector tests
- `cd /data/code && npm run build` -- expected: TypeScript clean, no errors

## Design Notes

**Pantry service pattern:** Follow `mealPlanService.ts` exactly — `readAll()` / `writeAll()` private helpers; named exports for each CRUD op. `create` merges defaults before writing.

**Stock bar rendering:** Render as an absolutely-positioned or inline div inside the row. Width fixed at 52px, height 6px, background from the ratio threshold. Use `style={{ background: 'var(--coral)' }}` etc — no new CSS classes needed.

**Inline edit state:** Track `editingId: string | null` in local component state. When `editingId === item.id`, render the edit row; otherwise render the display row. Only one row editable at a time.

**ShoppingListSelector backward compat:** The 5th parameter `pantryItems` has no default — it is required. The only call site is `shopping-list/index.tsx:33`. All tests that call `computeShoppingList` must pass `[]` or a real array. This is a breaking change to the function signature but the only consumer is the one page.

## Spec Change Log

## Review Triage Log

### Loop 1 — 2026-10-09

**Layers run:** blind-hunter, edge-case-hunter, verification-gap, intent-alignment (all 4 parallel)

**Applied patches:**

| # | Finding | Source | Patch |
|---|---------|--------|-------|
| 1 | `addPantryItem` uses `'__optimistic__'` sentinel — not concurrency-safe; concurrent adds share the same ID and rollback removes both | blind-hunter + intent-alignment | Use `crypto.randomUUID()` as `tempId`, close over it in success/rollback branches |
| 2 | `create(quantity=0)` yields `maxStock=0`; `ratio=0/0=NaN`; stock bar breaks | edge-case-hunter | `Math.max(1, quantity * 3)` in both `pantryService.create` and the slice's optimistic item |
| 3 | Duplicate `ingredientId` in `pantryItems`: `new Map(...)` retains last value, under-counts stock | edge-case-hunter | Build pantryMap via reduce-sum loop |
| 4 | `handleAdd` sets page-level toast then re-throws — user sees two errors simultaneously | blind-hunter + edge-case-hunter | Strip try/catch from `handleAdd`; let the error propagate to `AddItemModal` which shows its own inline error |
| 5 | `AddItemModal` `maxWidth: 400` violates spec and epic-context (480px desktop) | blind-hunter | Changed to 480 |
| 6 | `initPantry()` unconditional; sibling inits guarded by length check — deviates from established boot pattern | blind-hunter + intent-alignment | Added `if (pantryItems.length === 0)` guard; added `pantryItems` selector to AppShell |
| 7 | `stockBarColor.test.ts` exists locally but untracked — would not run in CI | verification-gap + intent-alignment + blind-hunter | `git add src/__tests__/stockBarColor.test.ts` |
| 8 | Test label collision: new pantry selector tests labeled `(g-pantry)/(h-pantry)/(i-pantry)` collide with existing `(g)/(h)/(i)` | blind-hunter | Renamed to `(k)/(l)/(m)` |
| 9 | `pantryService.update` throws on missing ID but has no test for that code path; rollback depends on it | blind-hunter | Added test `(g)` to `pantryService.test.ts` |

**Skipped:**

| Finding | Reason |
|---------|--------|
| `pantrySlice` optimistic rollback not tested | Out of story scope; slice rollback pattern is standard across the codebase |
| `pantryService.remove` silently no-ops for missing ID | The rollback in `deletePantryItem` restores state via `prev`; the asymmetry with `update` is noted but not load-bearing in this story |
| Rounding after filter → tiny positive deficit shows as `0.00` | Sub-integer float deficit is pathological; spec says `deficit > 0` and the math is correct |
| UI acceptance criteria not component-tested | React component tests are not in this project's test pattern; service + selector tests are the contract |

**Auto Run Result:** PASS — all patches applied, build confirmed structurally sound
