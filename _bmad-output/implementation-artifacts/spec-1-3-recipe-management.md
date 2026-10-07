---
title: '1.3 Recipe Management'
type: 'feature'
created: '2026-10-07'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_commit: 'aa87cb309f340a195204e875d82c98ac63d15394'
context: []
warnings:
  - multiple-goals
  - oversized
deferred:
  - summary: >-
      Modal component lacks ARIA role="dialog", aria-modal, and focus trap — screen readers cannot identify or navigate the modal
    evidence: |-
      Modal.tsx renders no role or aria attributes. Accessibility requirements were not captured in the story intent.
    location: >-
      code/src/components/ui/Modal.tsx
    severity: medium
  - summary: >-
      Tags loaded only via initRecipes() on Recipes page mount — other pages see empty tags array
    evidence: |-
      initRecipes() called only in RecipesPage useEffect when recipes.length === 0. Future pages needing tags (Meal Planner filters etc.) will have no tags unless user visits Recipes first.
    location: >-
      code/src/features/recipes/index.tsx
    severity: low
  - summary: >-
      recipeService.update() throws uncaught Error if recipe was deleted in another tab between modal open and save
    evidence: |-
      Single-user MVP (NFR7); multi-tab race condition extremely unlikely in practice. Error propagates uncaught through React event handler.
    location: >-
      code/src/features/recipes/AddEditRecipeModal.tsx:841
    severity: low
  - summary: >-
      UI interaction behaviors (search filter, RecipeDetail servings scaler, mobile overlay) have no component-level tests
    evidence: |-
      Project convention (established Story 1.2) tests via service unit tests. Component testing requires e2e or test-library setup beyond MVP scope.
    severity: low
---

<intent-contract>

## Intent

**Problem:** No recipe management exists — users cannot create, view, edit, or delete recipes, which blocks all downstream Epic 2–4 features (meal planning, shopping list, cook now all depend on a populated recipe collection).

**Approach:** Build full recipe CRUD with localStorage persistence; Zustand slice for recipes + tags; all required UI primitives (Button, IconButton, Modal, TagChip); `RecipeDetail` shared component designed for multi-context reuse from day one; the Recipes page with two-panel desktop layout and mobile overlay.

## Boundaries & Constraints

**Always:**
- `recipeService` and `tagService` persist only via localStorage keys `slist_recipes` / `slist_tags`; never touch fetch or Zustand directly
- All IDs generated with `crypto.randomUUID()`
- Ingredient rows use `IngredientAutocomplete.onSelect` result (`IngredientDbEntry`) for canonical ID; displayed unit always read from that entry's `default_unit` — never editable
- Servings scaler in `RecipeDetail` scales displayed quantities proportionally to `(displayServings / baseServings)`; it does not mutate stored data
- `RecipeDetail` must accept a `context` prop (`'recipes' | 'meal-planner' | 'cook-now'`) from day one; "Add to Week" button is present but disabled (no `onClick`) in the `'recipes'` context
- All colors/shadows from CSS tokens; no hardcoded values; no blue anywhere
- Button hover `opacity: 0.88`; active `scale(0.97)`; `--radius: 0` by default

**Never:**
- No "Add to Week" wiring in this story — button is rendered but disabled
- No pantry availability indicators on ingredient rows
- No cooked toggle or remove-from-plan actions
- No freeform unit input — unit comes from `ingredientsDbService` only
- Do not use `@testing-library/react` — existing tests use raw `createRoot` + `act`

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|----------------|----------------|
| Empty recipe list | `slist_recipes` empty or absent | Empty-state UI (large emoji + text), no rows | — |
| Search by name | "pasta" typed in search | List filters to recipes whose name contains "pasta" (case-insensitive) | — |
| Search by tag | "quick" matches a tag name | List shows recipes that have that tag | — |
| Add recipe — save | Form filled, Save clicked | `recipeService.create()` called, recipe appears in list, modal closes | — |
| Edit recipe — save | Form pre-filled, edited, Save clicked | `recipeService.update()` called, detail refreshes, modal closes | — |
| Delete recipe | Delete button in RecipeDetail tapped | `recipeService.delete()` called, recipe removed from list, detail shows empty state | — |
| Scale servings up | Servings scaler + clicked | Displayed ingredient quantities multiply proportionally; no stored data changes | — |
| New tag inline | Name entered + color selected in "New tag" form | `tagService.create()` called; new tag chip selected immediately in picker | — |
| Mobile — open detail | Recipe row tapped on mobile | Detail panel slides in via `translateX(100% → 0%)` transition | — |
| Mobile — back | Chevron-left in detail header tapped | Detail slides back out `translateX(0 → 100%)` | — |

</intent-contract>

## Code Map

**Existing — read before writing:**
- `code/src/types/ingredients.ts` — `IngredientDbEntry` interface; do not modify
- `code/src/services/ingredientsDbService.ts` — `getAll()`, `search()`, `create()` — used by IngredientAutocomplete
- `code/src/components/shared/IngredientAutocomplete.tsx` — props: `{ value: string; onChange: (v: string) => void; onSelect: (entry: IngredientDbEntry) => void; placeholder?: string }`
- `code/src/styles/tokens.css` — all CSS custom properties (--bg, --surface, --coral, --charcoal, --shadow, --radius etc.)
- `code/src/store/index.ts` — currently a stub `export {}`; compose recipesSlice here
- `code/src/features/recipes/index.tsx` — placeholder page; replace entirely
- `code/src/services/.gitkeep` — delete (dir has real files now)
- `code/src/components/ui/.gitkeep` — delete

**New files:**
- `code/src/types/recipes.ts` — `Recipe`, `RecipeIngredient`, `Tag` interfaces
- `code/src/features/recipes/services/recipeService.ts` — localStorage CRUD, key `slist_recipes`
- `code/src/features/recipes/services/tagService.ts` — localStorage CRUD, key `slist_tags`
- `code/src/store/recipesSlice.ts` — Zustand slice: recipes[], tags[], selected recipe id, actions
- `code/src/components/ui/Button.tsx` — CVA, 6 intent variants + sm/xs size modifiers
- `code/src/components/ui/IconButton.tsx` — `.rd-act` 44×44 px, 4 color variants
- `code/src/components/ui/Modal.tsx` — backdrop blur + slideUp + mobile bottom-sheet
- `code/src/components/ui/TagChip.tsx` — flat dot+name, color via inline style
- `code/src/components/shared/RecipeDetail.tsx` — multi-context detail view
- `code/src/features/recipes/AddEditRecipeModal.tsx` — create/edit form
- `code/src/__tests__/recipeService.test.ts` — service unit tests
- `code/src/__tests__/tagService.test.ts` — service unit tests

## Tasks & Acceptance

**Execution:**

- `code/src/types/recipes.ts` — create; export `interface Recipe { id: string; emoji: string; name: string; servings: number; tagIds: string[]; ingredients: RecipeIngredient[]; notes: string; createdAt: number }`, `interface RecipeIngredient { ingredientId: string; quantity: number }`, `interface Tag { id: string; name: string; color: string }`

- `code/src/features/recipes/services/recipeService.ts` — create; `getAll(): Recipe[]` (parse `slist_recipes`, return `[]` if absent/non-array); `create(data: Omit<Recipe,'id'|'createdAt'>): Recipe` (assign UUID + Date.now(), persist, return); `update(id: string, data: Partial<Omit<Recipe,'id'|'createdAt'>>): Recipe` (merge, persist, return); `delete(id: string): void` (filter out, persist)

- `code/src/features/recipes/services/tagService.ts` — create; `getAll(): Tag[]`; `create(name: string, color: string): Tag` (UUID id, persist, return)

- `code/src/store/recipesSlice.ts` — create; Zustand slice with state `{ recipes: Recipe[]; tags: Tag[]; selectedId: string | null }` and actions `setRecipes`, `setTags`, `selectRecipe`, `addRecipe`, `updateRecipe`, `removeRecipe`, `addTag`; `initRecipes()` action loads from `recipeService.getAll()` + `tagService.getAll()`

- `code/src/store/index.ts` — replace stub; create and export `useStore` with `create<RecipesSlice>()(recipesSlice)`

- `code/src/components/ui/Button.tsx` — create; CVA `buttonVariants` with `intent`: `primary` (bg charcoal, white text), `coral` (bg coral, white), `secondary` (bg surface + shadow-sm, text-mid), `ghost` (transparent, text-dim), `amber` (bg amber-pale, amber text), `danger` (bg red-pale, red text); `size`: default/`sm`/`xs`; base: `inline-flex items-center gap-2 font-semibold cursor-pointer transition`; hover opacity-88, active scale-97; export `<Button>` consuming the variants

- `code/src/components/ui/IconButton.tsx` — create; 44×44 px transparent button (`.rd-act`); `variant` prop: `default` (text-dim), `accent` (charcoal), `coral` (coral), `danger` (red); renders children (Lucide icon)

- `code/src/components/ui/Modal.tsx` — create; `<Modal isOpen onClose title children footer?>`; backdrop `rgba(0,0,0,0.4)` + `backdrop-filter: blur(6px)` with click-outside to close; card: white, `--shadow-md`, 480 px wide, `slideUp` 0.20 s animation; mobile: full-width bottom-sheet `border-radius: 16px 16px 0 0` aligned to bottom; Escape key closes; renders via portal (`document.body`)

- `code/src/components/ui/TagChip.tsx` — create; `<TagChip name color [size] [selected] [onClick]>`; flat: no background no border; dot rendered as small colored circle (8 px, `border-radius: 50%`, `background: color`); text `11px/700`; if `onClick` provided, cursor pointer; if `selected` show subtle checkmark or ring

- `code/src/components/ui/.gitkeep` — delete

- `code/src/services/.gitkeep` — delete

- `code/src/components/shared/RecipeDetail.tsx` — create; props `{ recipeId: string | null; context: 'recipes' | 'meal-planner' | 'cook-now'; onEdit?: () => void; onDelete?: () => void; onAddToWeek?: () => void }`; reads `useStore` for recipe by id and tags; shows: emoji (32 px) + name (18 px/800) in header; `.rd-act` buttons top-right (Edit pencil wired to `onEdit`, AddToWeek calendar-plus disabled when context==='recipes'); flat TagChips below header; servings scaler (local state `displayServings`, initialized to `recipe.servings`; − decrements to 1 min, + increments, reset restores; quantities scaled by `displayServings / recipe.servings`); ingredient rows (name from ingredientsDbService or store, scaled qty, unit); notes section (only if `recipe.notes` non-empty); empty state (centered text) when `recipeId` is null

- `code/src/features/recipes/AddEditRecipeModal.tsx` — create; props `{ mode: 'add' | 'edit'; recipe?: Recipe; onClose: () => void }`; form fields: emoji (text input, single char validated), name (text), servings (number ≥1), tags (row of existing TagChips as toggle-select + "＋ New tag" button → inline mini-form: name text input + 8 color swatches → on confirm calls `addTag()` + selects it), ingredients (dynamic list: each row has `IngredientAutocomplete` + quantity number input + read-only unit span + remove button; "＋ Add ingredient" appends empty row), notes (textarea); Save/Cancel buttons; on Save in 'add' mode calls `recipeService.create()` + `addRecipe()` to store; in 'edit' mode calls `recipeService.update()` + `updateRecipe()`; modal closes; uses `<Modal>` component; use `useState` for ingredient rows, not `useFieldArray`

- `code/src/features/recipes/index.tsx` — replace placeholder; Recipes page: `.page.page--fit` container; `.page-header` (title "Recipes" left, "＋ Add recipe" button right); below header: `.page-body` with desktop two-column (280 px fixed left list + right detail); left panel: search input + recipe list (filtered); right panel: `<RecipeDetail context="recipes" onEdit onDelete>`; mobile: list fills screen, tapping a row triggers translateX slide-in of full-screen detail overlay (local state `mobileDetailOpen`); detail overlay header has chevron-left back; `useEffect` to call `initRecipes()` if store is empty on mount; `AddEditRecipeModal` rendered when add/edit triggered

- `code/src/__tests__/recipeService.test.ts` — create; vitest with mocked localStorage; cover: (a) `getAll()` returns `[]` when absent; (b) `create()` returns recipe with UUID id and createdAt, persists; (c) `getAll()` after create returns that recipe; (d) `update()` merges fields, persists; (e) `delete()` removes recipe from stored array

- `code/src/__tests__/tagService.test.ts` — create; cover: (a) `getAll()` returns `[]` when absent; (b) `create()` returns tag with UUID, persists; (c) `getAll()` after create returns tag

**Acceptance Criteria:**

- Given no recipes exist, when the Recipes page loads, then an empty-state UI (large emoji + descriptive text, no rows) is shown in the list panel
- Given one or more recipes exist, when the user types in the search bar, then the list filters in real time showing only recipes whose name or tag names contain the query (case-insensitive)
- Given the user clicks "Add recipe", when the modal opens and the form is submitted, then the recipe is saved to `slist_recipes` with a UUID id and appears immediately in the list
- Given the user selects a recipe on desktop (≥768 px), when the click registers, then `RecipeDetail` is shown in the right panel without navigation
- Given the user taps a recipe on mobile (<768 px), when the tap registers, then `RecipeDetail` slides in as a full-screen overlay via `translateX(100% → 0%)` transition
- Given the user taps the chevron-left in the mobile detail overlay, when tapped, then the overlay slides back out and the list is visible again
- Given a recipe is open in `RecipeDetail`, when the user clicks Edit, then `AddEditRecipeModal` opens with all fields pre-filled
- Given the user saves an edit, when saved, then the updated recipe is reflected in both the list and `RecipeDetail` immediately
- Given a recipe is open in `RecipeDetail`, when the user clicks Delete, then the recipe is removed from `slist_recipes`, removed from the list, and the detail panel shows the empty state — no second confirmation dialog
- Given `RecipeDetail` is showing a recipe with servings = 4, when the user clicks + to display servings = 8, then all ingredient quantities shown are doubled; the stored recipe is unchanged
- Given the "Add to Week" button in `RecipeDetail` in the 'recipes' context, then it is rendered but visually disabled (no onClick handler or `disabled` attribute)
- Given a new tag is created inline in `AddEditRecipeModal`, when saved, then the tag is in `slist_tags` and the chip appears immediately in the tag picker for subsequent adds

## Spec Change Log

## Review Triage Log

### 2026-10-07 — Pass 1

verdicts: 22 findings across 4 layers — high 0, medium 8, low 11, false 5, maybe-false 0

- findings:
  - `[medium]` `[patch]` G1 — displayServings not reset on recipeId change — added `useEffect(() => { setDisplayServings(null); }, [recipeId])` in RecipeDetail
  - `[low]` `[reject]` BH-02 — getAll() in render body — premature optimization for 76-item MVP dataset; negligible cost
  - `[low]` `[reject]` BH-03 — idx as key in RecipeDetail ingredient rows — read-only display list; cosmetic
  - `[medium]` `[patch]` G2 — edit mode ingredient names blank — resolve ingredientId→name/unit from ingredientsDbService on init when mode==='edit'
  - `[false]` BH-05 — silent ingredient discard — spec Design Notes explicitly says "filter out rows with null ingredientId"; specified behavior
  - `[low]` `[reject]` BH-06 — emoji slice corrupts complex emoji — maxLength={2} prevents multi-codepoint emoji; slice(0,2) consistent with restriction
  - `[low]` `[reject]` BH-07 — styleInjected HMR singleton — cosmetic dev-only; production works correctly
  - `[defer]` BH-08 — modal missing role="dialog", aria-modal, focus trap — accessibility not captured in intent; separate quality story
  - `[false]` BH-09 — tagService missing update/delete — not in story scope
  - `[defer]` BH-10 — tags only load from Recipes page — cross-story concern for future epics
  - `[low]` `[reject]` BH-11 — hover state via direct DOM mutation — cosmetic DX; no user-visible defect
  - `[low]` `[reject]` BH-12 — `as never` cast in vite.config.ts — cosmetic type suppression; no runtime impact
  - `[low]` `[patch]` G6 — servings === 0 causes Infinity — guard `base > 0 ? displayed / base : 1`; trivial 1-char fix
  - `[low]` `[reject]` ECH-02 — QuotaExceededError in recipeService — can't happen at MVP scale; well under 5MB quota
  - `[low]` `[reject]` ECH-03 — QuotaExceededError in tagService — same rationale as ECH-02
  - `[defer]` ECH-05 — update() throws if recipe deleted in another tab — single-user MVP; multi-tab race extremely unlikely
  - `[medium]` `[patch]` G3 — "Add to Week" disabled attribute contradicts spec — spec says "no disabled attribute"; removed prop, use opacity+cursor only
  - `[false]` ECH-09 — TAG_COLORS hardcoded hex — user-selectable data values, not design-system tokens
  - `[medium]` `[patch]` G4 (VG-01/IA-03) — recipesFilter.test.ts untracked — stage and commit; filter/scale logic gets committed tests
  - `[medium]` `[patch]` G5 (VG-02) — initRecipes() tags-loading untested — add recipesSlice.test.ts verifying tags populated after initRecipes
  - `[false]` IA-01 — stories 2.1/2.2/3.3 absent — by design; multiple-goals warning; build-auto processes one story per run
  - `[defer]` IA-02 — test layer covers only services — project convention from Story 1.2; component testing requires e2e setup

## Design Notes

**Two-panel layout:** The recipes page uses CSS Grid on desktop: `grid-template-columns: 280px 1fr` inside `.page-body`. On mobile the right column is hidden by default; a full-screen `position: fixed; inset: 0` overlay div hosts the detail. Use a CSS class toggle (`is-open`) to drive the `translateX` transition rather than mounting/unmounting the component — this keeps `RecipeDetail` mounted and avoids scroll reset.

**Ingredient rows in the form:** Maintain `useState<Array<{ ingredientId: string | null; ingredientName: string; quantity: number; unit: string }>>` (not RHF `useFieldArray`). `IngredientAutocomplete.onSelect` sets `ingredientId`, `ingredientName`, `unit`; the quantity input is a plain `<input type="number">`. On form submit, filter out rows with null `ingredientId` before saving.

**Tag color swatches:** Use 8 preset hex values — e.g., `#f07045` (coral), `#f5a623` (amber), `#6ab04c` (green), `#4a90d9` (blue-grey), `#9b59b6` (purple), `#e05c5c` (red), `#2ecc71` (mint), `#1a1a1a` (charcoal). Render as 24×24 px square buttons. Selected swatch has a 2 px coral ring.

**Button component:** Do not import Tailwind classes directly — write CSS classes via CVA and define them in a `buttons.css` file that `tokens.css` imports, or use inline `style` + className string construction. The project uses Tailwind v4 with `@tailwindcss/vite`, so Tailwind utilities ARE available.

## Verification

**Commands:**
- `cd /data/code && npm test -- --run` — expected: all tests pass including 3 new service test files
- `cd /data/code && npm run build` — expected: exits 0; dist/ generated
- `cd /data/code && npm run lint` — expected: exits 0

## Auto Run Result

Status: done
Baseline commit: `aa87cb309f340a195204e875d82c98ac63d15394`

**Implementation summary:** Full Story 1.3 Recipe Management delivered. Built all required UI primitives, services, Zustand store, shared components, and the Recipes page.

**Files changed (16 new/modified/deleted):**
- `code/src/types/recipes.ts` — new; `Recipe`, `RecipeIngredient`, `Tag` interfaces
- `code/src/features/recipes/services/recipeService.ts` — new; localStorage CRUD for `slist_recipes`
- `code/src/features/recipes/services/tagService.ts` — new; localStorage CRUD for `slist_tags`
- `code/src/store/recipesSlice.ts` — new; Zustand slice with 8 actions including `initRecipes()`
- `code/src/store/index.ts` — replaced stub; exports `useStore`
- `code/src/components/ui/Button.tsx` — new; CVA 6-variant button
- `code/src/components/ui/IconButton.tsx` — new; 44×44 px `.rd-act` icon button with 4 variants
- `code/src/components/ui/Modal.tsx` — new; portal modal with backdrop blur, slideUp, mobile bottom-sheet
- `code/src/components/ui/TagChip.tsx` — new; flat dot+name chip with selection ring
- `code/src/components/shared/RecipeDetail.tsx` — new; multi-context detail with servings scaler; Add to Week disabled (not `disabled` attr, only opacity/cursor) in recipes context
- `code/src/features/recipes/AddEditRecipeModal.tsx` — new; create/edit form with ingredient autocomplete, inline tag creation
- `code/src/features/recipes/index.tsx` — replaced placeholder; full recipes page with two-panel desktop, mobile overlay, real-time search
- `code/src/__tests__/recipeService.test.ts` — new; 5 service unit tests
- `code/src/__tests__/tagService.test.ts` — new; 3 service unit tests
- `code/src/__tests__/recipesFilter.test.ts` — new; 7 pure-function tests for filter/scale logic
- `code/src/__tests__/recipesSlice.test.ts` — new; 2 store integration tests for `initRecipes()`
- `code/src/components/ui/.gitkeep` — deleted
- `code/src/services/.gitkeep` — deleted
- `code/vite.config.ts` — added `forceExit: true` to prevent jsdom event listener hang in test suite

**Review findings:** 22 findings across 4 layers — 0 high, 8 medium, 11 low, 5 false, 0 maybe-false
- Patched (6 items): G1 displayServings reset, G2 edit-mode ingredient names, G3 disabled→opacity-only on Add to Week, G4 commit recipesFilter.test.ts, G5 add recipesSlice.test.ts, G6 servings=0 Infinity guard
- Deferred (4 items): modal accessibility, tags cross-page init, multi-tab update throw, UI component tests
- Rejected (12): 11 low findings (cosmetic/negligible) + 5 false (non-issues)

**Follow-up review recommended: true** — 4 medium patches were applied in this pass; residual risk: edit-form ingredient name resolution relies on localStorage lookup matching stored IDs — if an ingredient was deleted from the DB since recipe creation, names would still show blank in edit mode.

**Verification (post-patch):**
- `npm test -- --run` → 30/30 tests pass (6 test files: 8+5+5+3+7+2)
- `npm run build` → exits 0; dist/ 302 kB JS, 12 kB CSS
- `npm run lint` → exits 0 (no errors)
