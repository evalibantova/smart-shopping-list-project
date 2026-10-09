# Epic 4 Context: Cook Now

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable users to act on today's meal plan by showing each scheduled meal alongside a computed ingredient availability status. The page surfaces at a glance which meals can be cooked right now (all ingredients in pantry), which can almost be cooked (some missing), and which are far off — and lets the user open the full recipe detail to mark a meal as cooked, triggering pantry deduction automatically.

## Stories

- Story 4.1: Today's Meals & Availability
- Story 4.2: Cook Now Filters & Recipe Detail

## Requirements & Constraints

**Functional:**

- Show all meal plan entries where `date` equals today's date, regardless of cooked state (FR17).
- Compute availability per meal by comparing pantry quantities against each recipe's ingredient quantities scaled to the entry's planned servings:
  - **Ready** — all ingredients are in pantry at or above the required scaled quantity (coral glow, coral `●` badge, "Cook it" charcoal button).
  - **Almost** — some but not all ingredients are below required quantity (amber glow, amber "N missing" badge, "Cook anyway" amber outline button).
  - **Far** — many ingredients missing (reduced opacity, red badge showing missing count).
- Filter tabs — All (default active), Ready, Almost — narrow the visible card list (FR18).
- RecipeDetail in Cook Now context shows each ingredient with a ✓ (coral, pantry ≥ required) or ✗ (red, insufficient); quantities are scaled to planned servings (FR21).
- The cooked toggle in this context is fully wired: marks the meal plan entry `cooked: true` AND performs pantry deduction (same logic as Story 3.2). Unmarking reverses both.
- After toggling cooked, the Cook Now card updates immediately to reflect the new cooked state and recomputed availability.
- Empty state required when no meals are planned today, and per-filter empty states when no cards match the active tab (FR24).

**Non-functional:**

- Mobile-first at ~375 px; desktop layout at ≥768 px (NFR1).
- All mutations optimistic: store updates immediately, service call follows, roll back + toast on error (NFR2).

## Technical Decisions

**Feature location:** `src/features/cook-now/` (AD-1). No direct cross-feature imports — read store slices, call service functions.

**Availability computation:** Pure derived logic. Read `mealPlanSlice` entries for today's date, join to `recipesSlice` for ingredient lists, cross-reference `pantrySlice` quantities. This is a selector/computed value, not stored state — consistent with how `shoppingListSlice` works (AD-4).

**RecipeDetail component:** Lives in `src/components/shared/` and is context-aware via props. Epic 4 adds a Cook Now context variant that renders per-ingredient availability markers (✓/✗) and exposes the cooked toggle + pantry deduction path. Edit and Add to Week buttons are also present in this context (FR21).

**Cooked toggle mutation flow (AD-10):**
1. Optimistically set `cooked: true` in `mealPlanSlice` and apply pantry deductions in `pantrySlice`.
2. Call service(s) to persist.
3. On error: roll back both slices and show a charcoal toast.

**Service layer:** Cook Now feature calls `mealPlanService` (update cooked flag) and `pantryService` (deduct quantities). No direct localStorage access (AD-2). Atomic rollback on failure matches Story 3.2's established pattern.

**Data shapes:**
- Meal plan entry: `{ id, date: "YYYY-MM-DD", slot: "breakfast"|"lunch"|"dinner", recipeId, servings, cooked }` (AD-7).
- "Today" filter: compare `entry.date` against `new Date().toISOString().slice(0, 10)`.
- Ingredient identity always by `ingredients_db` ID, quantities always in the ingredient's `default_unit`.

**ID generation:** `crypto.randomUUID()` in MVP localStorage phase (AD-8); keys prefixed `slist_` (AD-9).

## UX & Interaction Patterns

**Page header:** Single flex row — title left, FilterTab pills right (UX-DR2). Pills use the standard FilterTabs pattern: active tab = coral background + white text (UX-DR8). Tabs: All / Ready / Almost.

**Meal cards:** Circular emoji icon badge (24 px) on left, recipe name right, availability badge below name. Visual state driven by availability tier: coral glow (Ready), amber glow (Almost), reduced opacity (Far). "Cook it" (charcoal button) or "Cook anyway" (amber outline button) opens the RecipeDetail modal.

**RecipeDetail modal:** Standard modal — backdrop with blur, slideUp animation, 480 px centered on desktop, full-width bottom-sheet on mobile (UX-DR5). Per-ingredient rows show ✓ (coral) or ✗ (red) inline with name + scaled quantity + unit. Action buttons: cooked toggle (coral, check icon), Edit, Add to Week.

**Saving feedback:** SavingIndicator ring (16×16 px, top-right) during in-flight mutations (UX-DR7). Toast (charcoal variant, 2.5 s auto-dismiss) on error (UX-DR6).

**Animations:** Backdrop fadeIn 0.15 s, modal card slideUp 0.20 s, saving-spin 0.7 s linear infinite (UX-DR14).

**No rounded corners** except slot-item cards (border-radius: 4 px); no blue anywhere; shadows not borders for elevation (UX-DR15).

## Cross-Story Dependencies

- **Depends on Epic 1** — RecipeDetail component (`components/shared/`) and the full ingredient/recipe data model are in place.
- **Depends on Epic 2** — `mealPlanSlice` and `mealPlanService` (cooked flag, entry shape) are established.
- **Depends on Epic 3** — `pantrySlice`, `pantryService`, and the cooked → pantry deduction logic (Story 3.2) must be in place before Story 4.2's cooked toggle is fully wired.
- **Story 4.1 → Story 4.2:** Story 4.1 builds the card list and availability computation; Story 4.2 layers in the filter tabs and wires the RecipeDetail modal (including the cooked toggle). The availability status enum/logic defined in 4.1 is consumed directly by the filter logic in 4.2.
- **Shopping list side-effect:** Marking a meal cooked via Cook Now updates `pantrySlice`, which causes the live shopping list (shoppingListSlice selectors) to recompute automatically on next render — no extra wiring needed.
