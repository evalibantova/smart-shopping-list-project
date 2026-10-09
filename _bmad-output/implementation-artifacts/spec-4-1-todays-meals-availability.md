---
title: '4.1 Today''s Meals & Availability'
type: 'feature'
created: '2026-10-09'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_commit: 'c5f85e3a86e92ef40b76dd13f1f11503048cbb34'
context: []
warnings: []
deferred:
  - summary: >-
      CookNowCard.cooked field is populated but MealCard renders no visual distinction for already-cooked meals.
    evidence: |-
      Story 4.1 has no AC for cooked visual treatment; the field is forward-declared for Story 4.2's cooked toggle wiring. MealCard does not read card.cooked.
    location: >-
      code/src/features/cook-now/index.tsx (MealCard component)
    severity: low
  - summary: >-
      Negative pantry quantity inflates missingCount in computeCookNowCards.
    evidence: |-
      pantryMap accumulation does not guard against negative PantryItem.quantity; pre-existing concern mirrored in shoppingListSelector; pantryService does not enforce non-negative quantities.
    location: >-
      code/src/features/cook-now/cookNowSelector.ts:272-274
    severity: low
  - summary: >-
      Floating-point drift could cause a pantry quantity exactly meeting the requirement to be flagged as missing.
    evidence: |-
      pantryQty < required uses strict less-than with no epsilon; same pattern as shoppingListSelector (pre-existing project-wide decision); unlikely in practice since users enter whole numbers.
    location: >-
      code/src/features/cook-now/cookNowSelector.ts:293
    severity: low
  - summary: >-
      MealCard component rendering layer is untested.
    evidence: |-
      Project pattern excludes component-level tests; all tests are pure function unit tests (selector/service/slice); presentational rendering logic in MealCard is outside test scope.
    location: >-
      code/src/features/cook-now/index.tsx (MealCard)
    severity: low
---

<intent-contract>

## Intent

**Problem:** The Cook Now page is a placeholder stub with no content — users cannot see what meals they have planned for today or whether they have the ingredients to cook them.

**Approach:** Build a pure availability-computation selector that compares each today-entry's scaled ingredient requirements against pantry quantities, then replace the stub CookNowPage with a card list that renders each meal with its computed availability tier (ready/almost/far), appropriate visual treatment, and CTA buttons (no-op stubs for the modal that Story 4.2 will wire).

## Boundaries & Constraints

**Always:**
- Filter meal plan entries to `entry.date === today` where today = `new Date().toISOString().slice(0, 10)`
- Scale each ingredient's requirement by `entry.servings / recipe.servings`; guard divide-by-zero → scale = 1
- Availability tiers: **ready** (0 missing), **almost** (some missing but not all), **far** (all ingredients missing, i.e. missingCount === totalIngredients > 0). Recipe with 0 ingredients → ready.
- "Missing" = pantry quantity for that ingredientId is strictly less than the scaled required amount
- Pantry quantities aggregate per ingredientId (same pattern as shoppingListSelector)
- The `AvailabilityStatus` type and `CookNowCard` interface must be exported from `cookNowSelector.ts` so Story 4.2 can consume them directly
- CTA buttons ("Cook it" / "Cook anyway") are rendered with correct labels and styles but their `onClick` is left as a placeholder (`onCookPress?: () => void` prop, default no-op)
- Empty state required when no meals are planned for today
- All read from store slices only — no direct localStorage access

**Never:**
- Do not add filter tabs (All/Ready/Almost) — that is Story 4.2
- Do not wire the RecipeDetail modal — that is Story 4.2
- Do not add cooked toggle handling in this story — that is Story 4.2
- Do not modify any slice files
- Do not add component-level tests — project pattern: unit tests only (selector functions)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All ingredients in pantry | entry scaled need 1.5; pantry qty 2.0 | availability = `ready`; card shows coral glow + coral ● badge | — |
| Some ingredients missing | 3 ingredients; pantry covers 2, 1 below threshold | availability = `almost`; missingCount = 1; amber glow | — |
| All ingredients missing | pantry has none of the required ingredients | availability = `far`; missingCount = totalIngredients | — |
| Recipe has no ingredients | recipe.ingredients = [] | availability = `ready`; missingCount = 0 | — |
| No entries today | no entries match today's date | empty state rendered, no cards | — |
| Entry references unknown recipe | recipeId not in recipes array | card omitted from output | — |
| recipe.servings = 0 | divide-by-zero guard | scale = 1 | — |

</intent-contract>

## Code Map

- `code/src/features/cook-now/index.tsx` — MODIFY: stub CookNowPage; replace with full implementation reading store and rendering cards
- `code/src/features/cook-now/cookNowSelector.ts` — CREATE: exports `AvailabilityStatus`, `CookNowCard` interface, `computeCookNowCards()` pure function; mirrors `shoppingListSelector.ts` pattern
- `code/src/__tests__/cookNowSelector.test.ts` — CREATE: unit tests for `computeCookNowCards` covering the I/O matrix
- `code/src/store/mealPlannerSlice.ts` — READ-ONLY: `entries: MealPlanEntry[]`; `MealPlanEntry = { id, date, slot, recipeId, servings, cooked? }`
- `code/src/store/pantrySlice.ts` — READ-ONLY: `pantryItems: PantryItem[]`; `PantryItem = { id, ingredientId, quantity, maxStock }`; `batchUpdatePantry` pattern for reference
- `code/src/store/recipesSlice.ts` — READ-ONLY: `recipes: Recipe[]`; `Recipe = { id, emoji, name, servings, ingredients: RecipeIngredient[] }` where `RecipeIngredient = { ingredientId, quantity }`
- `code/src/store/index.ts` — READ-ONLY: `useStore` combines all slices; no changes needed
- `code/src/features/shopping-list/shoppingListSelector.ts` — READ-ONLY REFERENCE: pantry aggregation pattern (`pantryMap` per ingredientId summing duplicates) and scaling pattern to replicate exactly
- `code/src/styles/tokens.css` — READ-ONLY: `--coral`, `--coral-pale`, `--coral-border`, `--amber`, `--amber-pale`, `--red`, `--red-pale`; card glow = `box-shadow` with pale color; no border-radius except slot-item cards (4px)
- `code/src/features/pantry/index.tsx` — READ-ONLY REFERENCE: `SavingIndicator`, `Toast` usage pattern and page layout structure

## Tasks & Acceptance

**Execution:**

- `code/src/features/cook-now/cookNowSelector.ts` -- CREATE: export `AvailabilityStatus = 'ready' | 'almost' | 'far'`; export `CookNowCard { entryId: string; recipeId: string; recipeName: string; emoji: string; slot: MealPlanEntry['slot']; servings: number; availability: AvailabilityStatus; missingCount: number; totalIngredients: number; cooked: boolean }`; export `computeCookNowCards(entries: MealPlanEntry[], recipes: Recipe[], pantryItems: PantryItem[], today: string): CookNowCard[]` — (1) build pantryMap aggregating qty by ingredientId; (2) build recipeMap; (3) for each entry where `entry.date === today` and recipeId is found in recipeMap: compute scale, count missingIngredients (pantryQty < scaled required), derive availability tier; (4) return sorted by slot order (breakfast → lunch → dinner) omitting entries whose recipe is not found

- `code/src/features/cook-now/index.tsx` -- MODIFY: full CookNowPage -- (1) read `entries`, `recipes`, `pantryItems` from `useStore`; (2) compute `today = new Date().toISOString().slice(0, 10)`; (3) call `computeCookNowCards(entries, recipes, pantryItems, today)`; (4) render empty state if no cards; (5) render card list — each card: 48px circular emoji badge (24px emoji, coral-pale bg for ready/amber-pale for almost/red-pale for far), recipe name + slot label, availability badge (coral ● for ready; amber "N missing" for almost; red "N missing" for far), CTA button only for ready and almost ("Cook it" charcoal filled for ready; "Cook anyway" amber outline for almost; far cards show no CTA button); card visual: white surface, shadow-sm, border-radius 4px, glow via `box-shadow`; far tier: `opacity: 0.55` on entire card

- `code/src/__tests__/cookNowSelector.test.ts` -- CREATE: unit tests for `computeCookNowCards` -- (a) all ingredients covered → ready; (b) some missing → almost with correct missingCount; (c) all missing → far; (d) no ingredients → ready; (e) no entries today → empty array; (f) unknown recipeId → entry omitted; (g) recipe.servings=0 → scale=1, still computes correctly; (h) slot ordering: dinner entry before breakfast entry in store → sorted breakfast-first in output; (i) pantry deduplicates by ingredientId (two pantry entries for same ingredient combine quantities)

**Acceptance Criteria:**

- Given I navigate to Cook Now with meals planned for today, when the page loads, then one card per today-entry is shown (entries for other dates are absent)
- Given a meal where all scaled ingredients are in pantry, when the card renders, then it shows coral glow, coral ● badge, and a "Cook it" charcoal button
- Given a meal where some ingredients are below the scaled required quantity, when the card renders, then it shows amber glow, an amber badge reading "{N} missing", and a "Cook anyway" amber outline button
- Given a meal where all ingredients are missing from pantry, when the card renders, then it shows at reduced opacity (~0.55) with a red badge showing the missing count and no CTA button
- Given no meals are planned for today, when I view the Cook Now page, then an empty state with a large emoji and descriptive text is shown and no cards are rendered
- Given an entry's recipeId is not found in the recipes list, when cards are computed, then that entry is silently omitted from the displayed list
- Given today's entries include breakfast, lunch, and dinner in arbitrary store order, when rendered, then cards appear in breakfast → lunch → dinner order

## Design Notes

**Availability glow implementation:** Apply `box-shadow` to the card using the pale color token: ready → `0 0 0 2px var(--coral-border), var(--shadow-sm)`; almost → `0 0 0 2px rgba(245,166,35,0.3), var(--shadow-sm)`; far → standard `var(--shadow-sm)` with card at `opacity: 0.55`.

**Slot ordering:** Sort by `['breakfast','lunch','dinner'].indexOf(card.slot)` ascending.

**Empty state:** Matches project pattern — centered column, large emoji (48–64px), `var(--text-mid)` label, `var(--text-dim)` sub-label (see ShoppingListPage empty state for reference).

## Verification

**Commands:**
- Setup: `cp /tmp/wt-story-4-1/code/package.json /tmp/ && cp /tmp/wt-story-4-1/code/package-lock.json /tmp/ && cd /tmp && npm install` (if /tmp/node_modules missing)
- Sync source: `cp -r /tmp/wt-story-4-1/code/src /tmp/src`
- `cd /tmp && node_modules/.bin/vitest --run --config /tmp/vitest.config.ts` -- expected: all tests pass including new cookNowSelector tests

## Spec Change Log

## Review Triage Log

### 2026-10-09 — Review pass

- verdicts: 19 findings — high 0, medium 1, low 5, false 11, maybe-false 0, rejected 2
- findings:
  - `[false]` `[reject]` BH-1: Malformed diff structure for cookNowSelector.ts — diff file ordering artifact from staging; code files themselves are correctly formed and not affected
  - `[false]` `[reject]` BH-2: onCookPress never wired at page level — intentional stub by spec design; Story 4.2 wires the RecipeDetail modal; `onCookPress` prop is the designated extension point
  - `[low]` `[defer]` BH-3/IA-2: cooked field populated in selector but never consumed by MealCard — `CookNowCard.cooked` is forward-declared infrastructure for Story 4.2; no AC in Story 4.1 requires visual cooked treatment; deferred to 4.2
  - `[low]` `[reject]` BH-4: No test for cooked field propagation — cooked visual treatment is Story 4.2 concern; testing it in 4.1 is out of scope; low/no user impact in current story
  - `[low]` `[reject]` BH-5/EC-1: entry.servings=0 → scale=0 → all requirements=0 → ready — planning 0 servings is not a supported use case; very unlikely to be reached; no user impact in normal use
  - `[false]` `[reject]` BH-6: isAlmost and isFar badge text identical ("N missing") — by spec design; color distinction (amber vs. red) differentiates tiers; no ambiguity problem
  - `[low]` `[reject]` BH-7/EC-5/EC-6: Unknown slot → undefined in label, sorts before breakfast — TypeScript type `'breakfast'|'lunch'|'dinner'` prevents unknown slot at compile time; only reachable via corrupted data; project pattern does not guard against corrupted data shapes
  - `[low]` `[reject]` BH-8: Redundant double-call in test (g) — cosmetic test style issue; no user/developer impact; fix would be more than direct correction (restructure test)
  - `[low]` `[reject]` BH-9: makePantryItem hard-codes maxStock — cosmetic test helper style; maxStock not used in selector logic; no functional concern
  - `[low]` `[reject]` BH-10: Unnecessary vi.mock in test file — cosmetic; no runtime impact; computeCookNowCards has no service dependency, but the mock does not cause harm
  - `[low]` `[patch]` BH-11: Missing aria-labels on interactive buttons — buttons lack `aria-label`; fix applied: added `aria-label="Cook it"` and `aria-label="Cook anyway"` to respective buttons in index.tsx
  - `[false]` `[reject]` BH-12: isFar cards have no CTA — by spec design; spec explicitly states far cards show no CTA button; not a defect
  - `[low]` `[defer]` EC-2: Negative pantry quantity inflates missingCount — pre-existing data model concern; pantryService does not prevent negative quantities; same issue exists in shoppingListSelector; out of scope
  - `[low]` `[defer]` EC-3: Floating-point drift in pantry comparison — same pattern as shoppingListSelector which uses no epsilon guard; pre-existing project-wide decision; out of scope
  - `[false]` `[reject]` EC-4: UTC vs. local date for today string — by spec design; Technical Decisions section of epic context explicitly states `new Date().toISOString().slice(0, 10)` as the comparison; working as designed
  - `[medium]` `[patch]` VG-1: Non-unity scaling not tested — all 9 original tests use scale=1 (entry.servings=2/recipe.servings=2); hardcoding scale=1 would pass all; fix applied: added test (j) with entry.servings=4, recipe.servings=2, pantry covering one base batch (egg=8 covers, butter=1 and salt=0.5 below threshold) → `availability === 'almost'`; proves scaling is applied
  - `[low]` `[defer]` VG-extra/BH-3: cooked field not rendered — same as BH-3; deferred to 4.2
  - `[false]` `[reject]` IA-1: Per-ingredient rows absent from card — epic context assigns ingredient ✓/✗ rows to RecipeDetail modal context (FR21/4.2), not to the card list; diff correctly follows epic context over FUNCTIONALITY.md card spec; alignment confirmed
  - `[low]` `[defer]` IA-3: Component layer untested — project pattern: unit tests only (selector/service/slice); MealCard is a presentational component; excluded by project test convention

## Auto Run Result

**Status:** PASS — all patches applied, 103 tests pass

**Summary:** Built the Cook Now page for Story 4.1: a pure availability-computation selector (`computeCookNowCards`) that compares today's meal plan entries against pantry stock, and a full card-list UI in `CookNowPage` rendering each meal with its availability tier (ready/almost/far), appropriate visual treatment (coral/amber glow, reduced opacity for far), availability badges, and CTA buttons ("Cook it"/"Cook anyway") as placeholders for Story 4.2's modal wiring.

**Files changed:**
- `code/src/features/cook-now/cookNowSelector.ts` (new) — exports `AvailabilityStatus`, `CookNowCard`, and `computeCookNowCards()` pure function; pantry aggregation and scaling follow shoppingListSelector pattern
- `code/src/features/cook-now/index.tsx` (replaced) — full CookNowPage reading store slices, computing today's cards, rendering card list with availability-driven styles and empty state
- `code/src/__tests__/cookNowSelector.test.ts` (new) — 10 unit tests covering all I/O matrix rows plus non-unity scaling

**Review findings breakdown:**
- Patches applied: 2 — VG-1 (medium): added test (j) for non-unity scale; BH-11 (low): added aria-labels to CTA buttons
- Deferred: 4 items — cooked visual treatment (Story 4.2), negative pantry qty (pre-existing), floating-point drift (pre-existing project pattern), component layer tests (project convention)
- Rejected: 13 — 6 false findings, 2 low findings with no user impact, 5 cosmetic/out-of-scope low findings

**Verification:** `npm test -- --run` via /tmp workaround: 103 tests pass across 15 test files. Build not verifiable in this environment due to broken Windows node_modules (pre-existing constraint).

**Residual risks:**
- Cooked cards have no visual treatment yet (forward-declared `CookNowCard.cooked` field unused by `MealCard`) — Story 4.2 concern
- Component layer (MealCard rendering logic) is untested per project convention
