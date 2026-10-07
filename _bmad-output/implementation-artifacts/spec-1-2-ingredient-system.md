---
title: '1.2 Ingredient System'
type: 'feature'
created: '2026-10-07'
status: 'done'
review_loop_iteration: 1
baseline_commit: 'fd456df3abad653773f38a6482cb16ad9365182f'
followup_review_recommended: false
context: []
warnings: []
deferred:
  - 'D1: seedIfEmpty() call in main.tsx has no automated test — requires e2e harness or complex module-mock; defer to Epic 4 e2e setup'
  - 'D2: No engines field for jsdom Node ≥22.22.2 requirement — project-setup convention; address in project-wide DX setup pass'
  - 'D3: localStorage inaccessible in strict private browsing — defensive concern; address systemically across all services, not per-service'
---

<intent-contract>

## Intent

**Problem:** No canonical ingredient database exists, so recipe ingredients have no consistent identity or units. This blocks recipe creation (Story 1.3), pantry tracking (Epic 3), shopping list aggregation, and cook-now availability — all of which require canonical ingredient IDs and units for safe aggregation.

**Approach:** Seed 76 canonical ingredients into `slist_ingredients_db` on first load; expose `ingredientsDbService` for lookup and creation; build the standalone `IngredientAutocomplete` component that resolves typed names to canonical entries and handles new-ingredient creation with a unit prompt.

## Boundaries & Constraints

**Always:**
- Service reads/writes localStorage only via key `slist_ingredients_db`; never touches Zustand
- IDs generated with `crypto.randomUUID()` at seed time and on every `create()` call
- Units are one of the 8 canonical values only: `g`, `ml`, `kg`, `l`, `pcs`, `cloves`, `tbsp`, `tsp`
- `IngredientAutocomplete.onSelect` always fires with a full `IngredientDbEntry` — never a freeform string
- All design tokens from `tokens.css` — no hardcoded colors, shadows, or radii in components

**Never:**
- No Zustand slice for ingredients_db in this story — service-layer-only is sufficient
- Do not build the recipe form or ingredient rows (Story 1.3)
- No freeform unit editing once an entry is bound
- No fuzzy matching — substring match only (`String.includes` on lowercased name)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|----------------|----------------|
| Fresh load | `slist_ingredients_db` absent or empty | 76 entries written with UUID ids | No error expected |
| Repeat load | `slist_ingredients_db` already populated | Seed skipped; data unchanged | No error expected |
| Type 2+ chars | `"chi"` in autocomplete input | Dropdown lists "Chicken breast", "Chicken thigh", "Chicken stock", "Chickpeas" | No error expected |
| Type <2 chars | `"c"` in autocomplete input | Dropdown hidden | No error expected |
| Select match | Click "Chicken breast" in dropdown | `onSelect({ id, name:"Chicken breast", default_unit:"g", category:"Meat" })` | No error expected |
| Confirm no-match | `"Tahini"` with no matches, user confirms | Unit picker renders with 8 unit options | No error expected |
| Pick unit | `"tbsp"` selected in unit picker | New entry written to `slist_ingredients_db`; `onSelect(newEntry)` fired | No error expected |
| Cancel unit picker | User dismisses picker | No entry created; input cleared | No error expected |

</intent-contract>

## Code Map

- `code/src/types/ingredients.ts` — new; defines `IngredientDbEntry` interface used across services and components
- `code/src/data/ingredientsSeed.ts` — new; exports `INGREDIENTS_SEED` array (76 objects: name, default_unit, category; no id — assigned at seed time)
- `code/src/services/ingredientsDbService.ts` — new; `seedIfEmpty()`, `getAll()`, `search(query)`, `create(name, unit, category)` — localStorage key `slist_ingredients_db`
- `code/src/main.tsx` — existing (lines 1–12, React 19 root + BrowserRouter); add synchronous `seedIfEmpty()` call before `createRoot()`
- `code/src/components/shared/IngredientAutocomplete.tsx` — new; autocomplete input + dropdown + unit picker flow; `.gitkeep` present in the dir

## Tasks & Acceptance

**Execution:**
- `code/src/types/ingredients.ts` — create; export `interface IngredientDbEntry { id: string; name: string; default_unit: string; category: string }`
- `code/src/data/ingredientsSeed.ts` — create; export `INGREDIENTS_SEED` covering all 6 categories with correct `default_unit` values; categories must be exactly: `"Produce"`, `"Fish & Seafood"`, `"Meat"`, `"Dairy"`, `"Pantry & Dry Goods"`, `"Other"`; 76 total entries; units only from canonical set
- `code/src/services/ingredientsDbService.ts` — create; `seedIfEmpty()` reads key, writes all 76 seeds (each gets a fresh UUID) if empty; `getAll()` returns parsed array; `search(query)` returns entries where `name.toLowerCase().includes(query.toLowerCase())` when query ≥ 2 chars, else `[]`; `create(name, unit, category)` writes new entry and returns it
- `code/src/main.tsx` — import `ingredientsDbService` and call `ingredientsDbService.seedIfEmpty()` synchronously before `createRoot()`
- `code/src/components/shared/IngredientAutocomplete.tsx` — create component with props `{ value: string; onChange: (v: string) => void; onSelect: (entry: IngredientDbEntry) => void; placeholder?: string }`; renders text input; on 2+ chars shows absolute-positioned dropdown of matches; shows "Create '[name]'" option when no matches; on "Create" click shows inline unit picker (8 radio-style buttons); on unit select calls `ingredientsDbService.create()` then `onSelect(newEntry)`; on match click calls `onSelect(entry)`; Escape or click-outside closes dropdown/picker
- `code/src/components/shared/.gitkeep` — delete; no longer needed once a real file exists in the directory
- `code/src/__tests__/ingredientsDbService.test.ts` — create vitest unit tests using mocked `localStorage` (via `vi.stubGlobal` or a simple in-memory mock); cover: (a) `seedIfEmpty()` on empty storage writes 76 entries each with UUID id and valid unit; (b) `seedIfEmpty()` when already populated makes no change to count; (c) `search("chi")` returns only matching entries; (d) `search("c")` returns `[]`; (e) `create("Tahini","tbsp","Other")` writes a new entry, returns it with a UUID id, and count becomes 77
- `code/src/__tests__/IngredientAutocomplete.test.tsx` — create vitest + ReactDOM + act component tests (no @testing-library); cover: (a) input with 2 chars renders a dropdown element; (b) input with 1 char renders no dropdown; (c) clicking a dropdown entry calls `onSelect` with the correct `IngredientDbEntry`; (d) typing a no-match name renders a "Create" option; (e) clicking "Create" then selecting a unit calls `onSelect` with a new entry written to localStorage; (f) Escape key or outside-click closes dropdown without calling `onSelect`

**Acceptance Criteria:**
- Given the app opens on a fresh browser with no `slist_ingredients_db`, when the page loads, then 76 entries are present in localStorage under `slist_ingredients_db`, each with a UUID `id`, non-empty `name`, one of the 8 canonical `default_unit` values, and one of the 6 category strings
- Given `slist_ingredients_db` is already populated, when the page loads again, then entry count does not increase and existing IDs are unchanged
- Given an `IngredientAutocomplete` input has ≥2 characters, when the user types, then a dropdown appears below the input listing matching entries (case-insensitive substring match on name)
- Given an `IngredientAutocomplete` input has <2 characters, when the user types, then no dropdown is visible
- Given the dropdown is open and the user clicks an entry, when selected, then `onSelect` fires with the full `IngredientDbEntry` and the dropdown closes
- Given the user types a name with no matching entry and clicks "Create '[name]'", when the unit picker renders, then selecting one of the 8 units writes a new entry to `slist_ingredients_db` with a UUID id and calls `onSelect` with that new entry
- Given the user dismisses the unit picker (Escape or click-outside), when dismissed, then no new entry is created and the input is cleared
- Given an `IngredientAutocomplete` has called `onSelect`, when the parent inspects the received entry's `default_unit`, then it is one of the 8 canonical values and matches what is stored in `slist_ingredients_db`

## Spec Change Log

## Review Triage Log

### 2026-10-07 — Pass 1

verdicts: 24 findings across 4 layers — high 0, medium 11, low 10, false 3

**BH-01** `false` — jsdom env missing — `vite.config.ts:15` already declares `test: { environment: 'jsdom' }`.

**BH-02** `medium` `patch` → G1 — `create()` no unit validation — violates "Units are one of the 8 canonical values only" boundary; no guard against arbitrary strings.

**BH-03** `low` `reject` — Eggs in Dairy — US grocery convention; no objectively correct single category. Editorial, not a defect.

**BH-04** `low` `patch` → G8 — Chicken stock / Beef stock in Meat — cooking liquids belong in Pantry & Dry Goods; Meat grouping misleads shopping list.

**BH-05** `low` `patch` → G9 — IngredientSeed not typed as `Omit<IngredientDbEntry, 'id'>` — silent divergence risk if IngredientDbEntry gains a field.

**BH-06** `medium` `patch` → G3 — no click-outside dismissal test — test suite covers Escape only; click-outside path untested.

**BH-07** `low` `reject` — search() re-parses localStorage every keystroke — 76 items, negligible cost; caching adds complexity without measurable benefit.

**BH-08** `false` — input has no design-token styling — boundary says "no hardcoded values", not "must have explicit styling"; an unstyled element does not violate the constraint.

**BH-09** `low` `defer` → D2 — no engines field for Node ≥22.22.2 requirement — project-setup convention; no runtime impact.

**BH-10** `false` — ESLint missing Vitest globals — test files import explicitly from `'vitest'`; no implicit globals needed; lint exits 0.

**ECH-01** `low` `patch` → G5 — `readAll()` no non-array guard — `JSON.parse("null")` succeeds; callers crash on `.length`; add `Array.isArray` check.

**ECH-02** `medium` `patch` → G1 (dup BH-02) — `create()` no unit validation — same root cause.

**ECH-03** `medium` `patch` → G2 — `handleClickOutside` does not call `onChange('')` — AC: "the input is cleared"; Escape handler correctly clears, mousedown handler does not.

**ECH-04** `low` `patch` → G6 — `showDropdown` and `showUnitPicker` can both be true — `useEffect(>=2)` sets `showDropdown(true)` without resetting `showUnitPicker`; add `setShowUnitPicker(false)` in that branch.

**ECH-05** `low` `defer` → D3 — localStorage inaccessible in strict private browsing — cross-service defensive concern; better addressed systemically.

**ECH-06** `medium` `patch` → G3 (dup BH-06) — test (f) covers only Escape, not click-outside — same root cause.

**ECH-07** `low` `patch` → G7 — `handleUnitSelect` passes untrimmed value — `value.trim()` missing before `create()` call.

**ECH-08** `medium` `patch` → G1 (claims-check dup) — unit validation not enforced — same root cause as BH-02.

**ECH-09** `medium` `patch` → G2 (claims-check dup) — click-outside AC not met — same root cause as ECH-03.

**VG-01** `low` `defer` → D1 — `seedIfEmpty()` in `main.tsx` not tested — no unit test reaches app entry point; requires e2e infrastructure.

**VG-02** `medium` `patch` → G3 (dup BH-06) — click-outside path has no test — same root cause.

**VG-03** `medium` `patch` → G4 — Escape-while-unit-picker has no test — test (f) tests Escape during dropdown only; Escape-while-picker-open path untested.

**IA-01** `medium` `patch` → G2 (dup ECH-03) — click-outside does not clear input — same root cause.

**IA-02** `medium` `patch` → G3 (dup BH-06) — no click-outside test — same root cause.

**Patch groups (unique, after dedup):**
- G1 (unit validation): BH-02, ECH-02, ECH-08 → `create()`: throw if unit not in canonical set
- G2 (click-outside clear): ECH-03, ECH-09, IA-01 → `handleClickOutside`: add `onChange('')`
- G3 (click-outside test): BH-06, ECH-06, VG-02, IA-02 → add mousedown-outside test
- G4 (Escape-while-picker test): VG-03 → add Escape-cancels-unit-picker test
- G5 (readAll guard): ECH-01 → `readAll()`: add `Array.isArray` check
- G6 (concurrent state): ECH-04 → `useEffect(>=2)`: add `setShowUnitPicker(false)`
- G7 (trim): ECH-07 → `handleUnitSelect`: `value.trim()` before `create()`
- G8 (stock categories): BH-04 → seed: 'Chicken stock', 'Beef stock' → 'Pantry & Dry Goods'
- G9 (IngredientSeed type): BH-05 → `type IngredientSeed = Omit<IngredientDbEntry, 'id'>`

### 2026-10-07 — Pass 2 (follow-up, inline)

All 9 patch groups applied. Verification: 13/13 tests pass (includes new tests g, h covering G3/G4 paths), lint exits 0, build exits 0. Each patch was a single-point, targeted change; no new conditional paths beyond the added tests. No new findings.

## Auto Run Result

Status: done  
Baseline commit: `fd456df3abad653773f38a6482cb16ad9365182f`

**Implementation summary:** Created 5 new files and modified 2 existing. Seeded 76 canonical ingredients on app load; exposed `ingredientsDbService` with `seedIfEmpty`, `getAll`, `search`, `create`; built standalone `IngredientAutocomplete` component with dropdown, "Create" flow, and unit picker.

**Files changed:**
- `code/src/types/ingredients.ts` — new; `IngredientDbEntry` interface
- `code/src/data/ingredientsSeed.ts` — new; 76-entry seed array (typed as `Omit<IngredientDbEntry, 'id'>`)
- `code/src/services/ingredientsDbService.ts` — new; localStorage service with canonical unit validation and `Array.isArray` guard
- `code/src/components/shared/IngredientAutocomplete.tsx` — new; autocomplete + dropdown + unit picker; click-outside and Escape both clear input
- `code/src/main.tsx` — modified; `seedIfEmpty()` called before `createRoot()`
- `code/src/__tests__/ingredientsDbService.test.ts` — new; 5 tests, all pass
- `code/src/__tests__/IngredientAutocomplete.test.tsx` — new; 8 tests, all pass
- `code/eslint.config.js` — new; ESLint v9 flat config
- `code/package.json` — modified; added ESLint + jsdom devDependencies, fixed lint script for ESLint v9

**Review findings:** 24 findings across 4 layers — 0 high, 11 medium, 10 low, 3 false — resolved as: 9 patch groups applied (all passing), 3 deferred (D1–D3 in frontmatter), 2 false-rejected, 2 low-rejected.

**Verification:**
- `npm test -- --run` (scoped to story files): 13/13 pass
- `npm run build`: exits 0; dist/ generated
- `npm run lint`: exits 0

## Design Notes

The unit picker is a compact inline UI appended below the autocomplete input — not a full `Modal`. Render 8 unit buttons in a single row/wrap; picking one immediately triggers creation and closes the picker. This keeps the component self-contained without depending on a modal system that Story 1.3 hasn't built yet.

Dropdown styling: `position: absolute`, `z-index: 100`, `background: var(--surface)`, `box-shadow: var(--shadow-md)`, `max-height: 200px`, `overflow-y: auto`. Each row `padding: 8px 12px`, hover `background: var(--bg)`. "Create" row italic or dimmed to distinguish from existing matches.

## Verification

**Commands:**
- `cd code && npm test -- --run` — expected: all tests pass; service and component tests listed
- `cd code && npm run build` — expected: exits 0; `dist/` generated
- `cd code && npm run lint` — expected: exits 0 (eslint now in devDependencies per 1.1 review patch)

**Manual checks (if no CLI):**
- Open app in browser, DevTools → Application → Local Storage → check `slist_ingredients_db` has exactly 76 items with expected shape
- Type `"chi"` into an `IngredientAutocomplete` — dropdown should appear listing chicken/chickpea entries
- Type a novel ingredient name, click "Create", pick a unit — verify new entry appears in `slist_ingredients_db` and count becomes 77
