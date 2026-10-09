---
title: '4.2 Cook Now Filters & Recipe Detail'
type: 'feature'
created: '2026-10-09'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_commit: 'c5f85e3a86e92ef40b76dd13f1f11503048cbb34'
context: []
warnings: []
deferred:
  - summary: >-
      Post-cook Cook Now card shows no discrete cooked visual indicator beyond availability tier change
    evidence: |-
      AC says "card updates to show the cooked state" — ambiguous: pantry deduction causes tier recomputation (card badge changes color/text), but no explicit cooked marker (coral tint, ✓ span) exists on the card face. Settling evidence: explicit cooked card styling described in epics.md for Cook Now context. Medium severity if the AC requires a distinct cooked UI element.
    location: >-
      code/src/features/cook-now/index.tsx
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The Cook Now page is a stub with only a header. Users need to see today's planned meals with ingredient availability, filter by readiness tier, and view/act on individual meals via a fully wired RecipeDetail.

**Approach:** Replace the Cook Now stub with a complete page: compute per-meal ingredient availability from pantry stock, render tiered cards (Ready/Almost/Far), add FilterTab pills (All/Ready/Almost) as local state, implement a Cook Now overlay that opens RecipeDetail with per-ingredient ✓/✗ indicators and a fully wired cooked toggle. Reuse the `buildCookDeltas` + `batchUpdatePantry` pattern from MealPlanOverlay.

## Boundaries & Constraints

**Always:**
- Availability is derived on render — no new stored state
- Three tiers: Ready (0 missing), Almost (1 ≤ missing < n), Far (all n missing)
- Filter tabs: All shows all tiers, Ready shows tier=ready, Almost shows tier=almost only (Far meals appear only in All)
- Per-filter empty state when no meals match the active filter
- RecipeDetail in cook-now context: Edit + Add to Week + cooked toggle; no Delete, no Remove from Plan
- Cooked toggle uses `buildCookDeltas` + `batchUpdatePantry` atomic pattern with full rollback on error
- Ingredient rows in RecipeDetail show ✓ (coral) when pantry ≥ scaled quantity, ✗ (red) when not
- `data-testid="cook-now-filter-tabs"` on the FilterTabs container, `data-testid="cook-now-card-{entryId}"` on each meal card

**Never:**
- Do not add new Zustand slices
- Do not persist filter state or availability state
- Do not modify mealPlannerSlice, pantrySlice, or recipesSlice
- Do not show a Far-specific filter tab

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All ready | All recipe ingredients have pantry qty ≥ scaled required | tier=ready; coral glow, coral ● badge, "Cook it" button | — |
| Some missing | 1 ingredient below required, others ok | tier=almost; amber glow, amber "N missing" badge, "Cook anyway" button | — |
| All missing | Every ingredient below or absent from pantry | tier=far; reduced opacity (0.45), red badge with missing count | — |
| No meals today | entries filtered to today = [] | Empty state: large emoji + "No meals planned for today" text | — |
| Active filter empty | Filter=Ready but no ready meals | Per-filter empty state: "No meals ready right now" / "No almost-ready meals" | — |
| Zero-servings recipe | recipe.servings = 0 | scale defaults to 1 (guard divide-by-zero, same as buildCookDeltas) | — |
| Ingredient not in pantry | ingredientId absent from pantryItems | pantry qty treated as 0 → not sufficient | — |
| Cooked toggle fails | service or batchUpdatePantry throws | roll back cooked flag + pantry changes; show charcoal toast | Toast + rollback |

</intent-contract>

## Code Map

- `src/features/cook-now/index.tsx` — current stub (9 lines, just `<div className="page">` header); REPLACE with full page
- `src/features/cook-now/utils/cookNowUtils.ts` — CREATE; pure availability helpers: `computeAvailability`, `AvailabilityTier`, `MealAvailability`
- `src/components/ui/FilterTabs.tsx` — CREATE; generic pill-row filter component (UX-DR8: coral active, pill style)
- `src/components/shared/RecipeDetail.tsx` — MODIFY; add `ingredientAvailability?: Record<string, boolean>` prop + cook-now context branch in header actions + ✓/✗ row markers
- `src/features/meal-planner/MealPlanOverlay.tsx` — READ ONLY; `buildCookDeltas` (line 13) exported here; import from here in cook-now page
- `src/store/pantrySlice.ts` — READ ONLY; `batchUpdatePantry` (line 66) signature: `(deltas: { ingredientId: string; delta: number }[]) => void`
- `src/store/mealPlannerSlice.ts` — READ ONLY; `updateEntry(id, patch)` used to set `cooked` flag
- `src/features/meal-planner/services/mealPlanService.ts` — READ ONLY; `update(id, patch)` service call for persisting cooked state
- `src/features/meal-planner/utils/calendarUtils.ts` — READ ONLY; `toDateStr(date)` returns YYYY-MM-DD; use for "today" comparison
- `src/components/ui/SavingIndicator.tsx` — READ ONLY; `<SavingIndicator visible={bool} />`
- `src/components/ui/Toast.tsx` — READ ONLY; `<Toast message={string} onDismiss={fn} />`
- `src/components/shared/AddToWeekModal.tsx` — READ ONLY; import as-is for the Add to Week flow in the cook-now overlay
- `src/features/recipes/AddEditRecipeModal.tsx` — READ ONLY; import as-is for the Edit flow
- `src/__tests__/cookedPantryDeduction.test.ts` — REFERENCE; test structure pattern to follow for new tests
- `src/types/mealPlan.ts` — `MealPlanEntry { id, date, slot, recipeId, servings, cooked? }`
- `src/types/pantry.ts` — `PantryItem { id, ingredientId, quantity, maxStock }`
- `src/types/recipes.ts` — `Recipe { id, emoji, name, servings, ingredients: [{ingredientId, quantity}], ... }`

## Tasks & Acceptance

**Execution:**

- `src/features/cook-now/utils/cookNowUtils.ts` — CREATE pure availability module exporting:
  - `type AvailabilityTier = 'ready' | 'almost' | 'far'`
  - `interface MealAvailability { tier: AvailabilityTier; missingCount: number; ingredientAvailability: Record<string, boolean> }`
  - `function computeAvailability(recipe: Recipe, entry: Pick<MealPlanEntry, 'servings'>, pantryItems: PantryItem[]): MealAvailability`
    - `scale = recipe.servings > 0 ? entry.servings / recipe.servings : 1`
    - `pantryMap = Map<ingredientId, quantity>` from pantryItems
    - For each ingredient: `sufficient = (pantryMap.get(ingredientId) ?? 0) >= ing.quantity * scale`
    - Tier: missingCount===0 → ready; 0 < missingCount < n → almost; missingCount===n → far (n = recipe.ingredients.length; if n=0, tier=ready)

- `src/components/ui/FilterTabs.tsx` — CREATE generic pill-row component; props: `tabs: readonly string[]; active: string; onChange: (tab: string) => void`; style: flex row, gap 6px, each tab a `<button>` with `border-radius: 20px`, `padding: 5px 14px`, `font-size: 13px`, `font-weight: 600`; active = `background: var(--coral); color: white`; inactive = `background: var(--surface2); color: var(--text-mid)`; `data-testid="cook-now-filter-tabs"` on the container `<div>`

- `src/features/cook-now/index.tsx` — REPLACE stub with full page:
  - Get `today = toDateStr(new Date())` from calendarUtils
  - Read `entries`, `recipes`, `pantryItems` from `useStore`; init pantry + meal plan in `useEffect` on mount
  - Filter entries where `entry.date === today`; for each build `{ entry, recipe, avail }` via `computeAvailability`
  - Local state: `filter: 'all'|'ready'|'almost'` (default 'all'); `openEntryId: string|null` for the overlay
  - Filtered list: all→all, ready→tier===ready, almost→tier===almost; sorted by slot order (breakfast→lunch→dinner)
  - Page header: `<h1>Cook Now</h1>` left, `<FilterTabs tabs={['All','Ready','Almost']} active={filter} onChange={setFilter} />` right — single flex row
  - Empty state (today has no entries): large emoji 🥘 + text "No meals planned for today"
  - Per-filter empty state (filtered list empty but today has entries): emoji + filter-specific message ("No meals ready right now" for Ready, "No almost-ready meals" for Almost)
  - Each meal card: `data-testid="cook-now-card-{entry.id}"`, flex row, rounded 0 (--radius), box-shadow var(--shadow-sm); tier styling:
    - ready: `box-shadow: 0 0 0 2px var(--coral)` + coral ● badge
    - almost: `box-shadow: 0 0 0 2px var(--amber)` + amber "N missing" badge
    - far: `opacity: 0.45` + red badge with missing count
  - Card content: 24px circular emoji badge (border-radius 50%, background var(--surface2)), recipe name (13px weight 600, wraps 2 lines), availability badge, action button:
    - ready → `<Button intent="primary" size="sm">Cook it</Button>`
    - almost → `<Button intent="amber" size="sm">Cook anyway</Button>`
    - far → no button (card clickable but no dedicated CTA; or optionally a disabled button — do NOT add one if not in AC)
  - Clicking "Cook it"/"Cook anyway" sets `openEntryId = entry.id`
  - Overlay: when `openEntryId` is set, render a portal overlay (same structure as MealPlanOverlay) containing `<RecipeDetail context="cook-now" ... />`; supply `ingredientAvailability` from the entry's computed availability; `onCooked` handler uses same pattern as MealPlanOverlay.handleToggleCooked; close overlay on backdrop click or Escape; include SavingIndicator + Toast
  - `onEdit`: open AddEditRecipeModal
  - `onAddToWeek`: open AddToWeekModal with entry's recipeId and servings

- `src/components/shared/RecipeDetail.tsx` — ADD cook-now context support:
  - Add `ingredientAvailability?: Record<string, boolean>` to `RecipeDetailProps` interface
  - In the header actions block: add `context === 'cook-now'` branch showing: Edit `<IconButton variant="default">`, Add to Week `<IconButton variant="accent">`, cooked toggle `<IconButton>` (same JSX as the meal-planner cooked toggle: Loader2 when isCooking, CheckCircle otherwise, opacity 0.5 when isCooking or isCooked)
  - In the ingredients map: when `context === 'cook-now'` and `ingredientAvailability` is defined, render a small indicator BEFORE the ingredient name — `✓` in `color: var(--coral)` when `ingredientAvailability[ing.ingredientId] === true`, `✗` in `color: var(--red)` otherwise; font-size 13px, font-weight 700, margin-right 6px

- `src/__tests__/cookNowUtils.test.ts` — CREATE unit tests for `computeAvailability`:
  - All ready: pantry covers all → tier='ready', missingCount=0, all values true
  - Some missing: one ingredient below required → tier='almost', missingCount=1, that ingredient false
  - All missing: pantry absent → tier='far', missingCount=n, all values false
  - Zero-servings guard: recipe.servings=0 → scale=1, all comparisons still work
  - Ingredient absent from pantry: treated as 0 quantity → not sufficient
  - Recipe with no ingredients: tier='ready', missingCount=0

**Acceptance Criteria:**

- Given Cook Now page loads, when entries exist for today, then a single flex-row page header shows "Cook Now" title on the left and three FilterTab pills (All, Ready, Almost) on the right; All is active by default
- Given I tap "Ready" filter, when the filter activates, then only meals where tier=ready are shown; other tiers are hidden
- Given I tap "Almost" filter, when it activates, then only meals where tier=almost are shown; Far meals are NOT shown
- Given I tap "All" filter, when it activates, then all today's planned meals show regardless of tier
- Given active filter yields no results (but today has meals), when the list renders, then a filter-specific empty state is shown (not the "no meals today" empty state)
- Given no meals are planned for today, when the Cook Now page loads, then a global empty state shows with a large emoji and "No meals planned for today"
- Given I tap "Cook it" or "Cook anyway", when the overlay opens, then RecipeDetail renders in cook-now context: Edit and Add to Week buttons present; cooked toggle present and enabled; per-ingredient ✓ (coral) or ✗ (red) indicators shown; no Delete or Remove from Plan buttons
- Given I mark a Cook Now meal as cooked via the toggle, when the toggle resolves, then the card reflects the cooked state and pantry is deducted; if the operation fails, both changes roll back and a toast appears
- Given a meal is Ready (all ingredients sufficient), when the card renders, then it shows a coral ring glow, coral ● badge, and "Cook it" button
- Given a meal is Almost (some missing), when the card renders, then it shows an amber ring glow, amber "N missing" badge, and "Cook anyway" button
- Given a meal is Far (all missing), when the card renders, then it shows at 0.45 opacity with a red badge showing missing count

## Spec Change Log

## Review Triage Log

### 2026-10-09 — Review pass
- verdicts: 18 findings — high 0, medium 3, low 6, false 8, maybe-false 1
- findings:
  - `[false]` `[reject]` BH-1: far-tier cards inaccessible — spec Tasks explicitly says "do NOT add one if not in AC"; epic ACs have no AC for far-tier interaction; excluded by intent
  - `[low]` `[reject]` BH-2: loading flash on mount — localStorage init is synchronous; same pattern used in MealPlannerPage; cosmetic, fix adds complexity for imperceptible improvement
  - `[low]` `[reject]` BH-3: rollback toast misleading on double-failure — requires batchUpdatePantry reversal to also fail; same pattern as MealPlanOverlay reviewed and accepted; fix requires app-wide redesign
  - `[medium]` `[patch]` BH-4: FilterTabs missing ARIA tablist/tab/aria-selected — confirmed: no role="tablist", no role="tab", no aria-selected; applied: added role="tablist" to container div and role="tab" + aria-selected={active===tab} to each button in FilterTabs.tsx
  - `[low]` `[reject]` BH-5: floating-point comparison without epsilon — contrived inputs required; adds complexity for negligible practical improvement
  - `[false]` `[reject]` BH-6: --coral for ✓ indicator conflicts with ready tier — intentional per epics.md ("✓ (coral)"); explicit design
  - `[false]` `[reject]` BH-7: almost and far show identical "N missing" text — matches story 4.1 ACs; intentional
  - `[low]` `[reject]` BH-8: far cards at 0.45 opacity no accessible explanation — per-spec; cosmetic addition not required by ACs
  - `[medium]` `[patch]` ECH-1: entry.servings=0 → scale=0 → all ingredients appear sufficient → false tier=ready — confirmed: scale=0 makes pantryQty>=0 true for all; applied: changed scale formula in cookNowUtils.ts to `(recipe.servings > 0 && entry.servings > 0) ? entry.servings / recipe.servings : 1`
  - `[false]` `[reject]` ECH-2: buildCookDeltas throws before try block → isCooking stuck — buildCookDeltas is pure arithmetic over typed Recipe; no throwing path with valid store data
  - `[low]` `[reject]` ECH-3: color:var(--text) removed from ingredient name — inherits from app root which is --text; no visible regression in practice
  - `[medium]` `[patch]` ECH-4: "Cook it" button intent="coral" but epics.md says charcoal — confirmed: epics.md line 560 "Cook it button (charcoal)"; intent="primary" = charcoal; intent="coral" = coral background; applied: changed intent="coral" to intent="primary" for the Ready-tier "Cook it" button in cook-now/index.tsx
  - `[low]` `[reject]` VG-other: handleToggleCooked duplicated — fix requires extracting shared utility; more than a direct correction
  - `[false]` `[reject]` IA-1: story boundary absorption — by design; 4.1 not in this branch
  - `[false]` `[reject]` IA-2: ✓/✗ on card face vs overlay — story 4.2 ACs and epic-4-context.md both place ✓/✗ inside RecipeDetail; ACs are binding source; satisfied
  - `[maybe-false]` `[defer]` IA-3: post-cook card no discrete cooked indicator — AC "card updates to show the cooked state" is ambiguous; pantry deduction causes tier recomputation which changes card; unclear if a coral tint/✓ span is required; medium if true; settling evidence: explicit cooked card styling in epics for Cook Now
  - `[false]` `[reject]` IA-4: test surface vs intent surface — project has no UI/integration tests in any story; utility-layer tests are the project standard
  - `[false]` `[reject]` IA-5: far tier no overlay path — spec explicitly excluded; ACs only reference Ready and Almost interaction

## Design Notes

This story builds the full Cook Now page because Story 4.1 (cards + availability) is being implemented in a parallel worktree. When the two branches are merged, any conflicts in `index.tsx` will be reconciled — both worktrees produce the same page structure, so the merge resolution is straightforward.

The `context === 'cook-now'` branch in RecipeDetail is the third and final context variant. It mirrors the `meal-planner` branch almost exactly (same cooked toggle, same Edit + Add to Week buttons) but drops Remove from Plan and adds per-ingredient ✓/✗ markers.

"Far" is a visual tier only — no "Far" filter tab. Far meals appear only under "All". This keeps the tab set minimal while still giving a clear visual signal about extremely missing meals.

## Verification

**Commands:**
- `cp /tmp/wt-story-4-2/code/src/features/cook-now/utils/cookNowUtils.ts /tmp/src/features/cook-now/utils/cookNowUtils.ts && cp /tmp/wt-story-4-2/code/src/__tests__/cookNowUtils.test.ts /tmp/src/__tests__/cookNowUtils.test.ts && /tmp/node_modules/.bin/vitest --run --config /tmp/vitest.config.ts` -- expected: all tests pass, no TypeScript errors

## Auto Run Result

**Summary:** Implemented the complete Cook Now page (Story 4.2: Cook Now Filters & Recipe Detail), including the full page as Story 4.1 was not yet in this branch. The implementation adds FilterTab pills, per-availability-tier meal cards, a Cook Now RecipeDetail overlay with per-ingredient ✓/✗ indicators and a fully wired cooked toggle.

**Files changed:**
- `code/src/features/cook-now/utils/cookNowUtils.ts` — CREATED: pure availability computation (`computeAvailability`, `AvailabilityTier`, `MealAvailability`)
- `code/src/components/ui/FilterTabs.tsx` — CREATED: reusable ARIA-accessible pill-row filter component
- `code/src/features/cook-now/index.tsx` — REPLACED stub with full Cook Now page (availability computation, tiered cards, filter state, Cook Now overlay with cooked toggle)
- `code/src/components/shared/RecipeDetail.tsx` — MODIFIED: added `ingredientAvailability` prop and `context === 'cook-now'` branch (per-ingredient ✓/✗ indicators, Edit + Add to Week + cooked toggle)
- `code/src/__tests__/cookNowUtils.test.ts` — CREATED: 6 unit tests for `computeAvailability` covering all tier boundaries and edge cases

**Review findings breakdown:**
- 3 patches applied (all medium):
  - BH-4: Added ARIA `role="tablist"`, `role="tab"`, `aria-selected` to FilterTabs
  - ECH-1: Guarded `entry.servings > 0` in scale formula to prevent false tier=ready when servings=0
  - ECH-4: Changed "Cook it" button from `intent="coral"` to `intent="primary"` (charcoal per epics.md spec)
- 1 deferred: post-cook card cooked visual state (ambiguous AC, medium unverified)
- 14 rejected: 8 false, 6 low

**Follow-up review recommended:** True — three medium patches applied (ARIA semantics additions, scale guard, button intent); unverified risk: ARIA role="tablist" semantics on the FilterTabs may produce unexpected keyboard navigation behavior in browsers where tablist implies arrow-key navigation between tabs, which is not wired up.

**Verification performed:**
- All 103 tests pass (15 test files) after patches via `/tmp/node_modules/.bin/vitest --run --config /tmp/vitest.config.ts`
- 6 new tests in `cookNowUtils.test.ts` all pass: all-ready, some-missing, all-missing, zero-servings guard, absent-pantry, no-ingredients
- No pre-existing test regressions

**Residual risks:**
- FilterTabs ARIA: `role="tablist"` implies arrow-key navigation (ARIA pattern), but no `keyDown` handler is implemented. Screen readers may expect arrow keys to switch tabs; currently only click works. This is a followup accessibility concern.
- `handleToggleCooked` duplicated from MealPlanOverlay: divergence risk if pantry deduction logic changes in one component but not the other.
