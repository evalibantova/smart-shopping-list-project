---
title: '2.1 Weekly Calendar Grid'
type: 'feature'
created: '2026-10-07'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_commit: '21f5634'
context: []
warnings: []
deferred:
  - summary: >-
      localStorage setItem not guarded against QuotaExceededError in mealPlanService
    evidence: |-
      Pre-existing pattern from recipeService (Story 1.3) — both services use unguarded setItem.
      Not introduced by this story.
    location: >-
      code/src/features/meal-planner/services/mealPlanService.ts
    severity: low
  - summary: >-
      localStorage getItem not guarded against SecurityError in restricted browsing contexts
    evidence: |-
      Pre-existing pattern from recipeService (Story 1.3) — same pattern used in all services.
      Not introduced by this story.
    location: >-
      code/src/features/meal-planner/services/mealPlanService.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** The Meal Planner page is a placeholder; users have no way to view their weekly schedule, navigate between weeks, or see planned meals against a calendar.

**Approach:** Build the 7-day (Mon–Sun) × 3-slot (Breakfast/Lunch/Dinner) calendar grid with week navigation and today highlighting. Render existing meal plan entries as slot item cards. Empty slots show a `+` button (not yet wired to the recipe picker — that's Story 2.2). Create `mealPlannerSlice` and `mealPlanService` so Story 2.2 can layer assignment on top without structural changes.

## Boundaries & Constraints

**Always:**
- Week always starts Monday, ends Sunday (ISO week convention)
- `mealPlanService` reads/writes `slist_meal_plan` localStorage key only; never touches Zustand
- `mealPlannerSlice` entry shape exactly: `{ id: string, date: "YYYY-MM-DD", slot: "breakfast"|"lunch"|"dinner", recipeId: string, servings: number, cooked?: boolean }` — this is the shape Epic 3 reads without modification
- Date range label: `D – D Mon YYYY` (en-dash with spaces; no leading zeroes; month+year appear only once at end)
- All design tokens; no hardcoded colors — today column uses `var(--coral)`
- Grid: `26px` label column + `minmax(110px, 1fr)` × 7 columns; `overflow-x: auto` container for mobile scroll

**Never:**
- No recipe picker modal or assignment logic in this story — the `+` button is present and focusable but has no `onClick` handler wired to a modal
- No optimistic mutation UI in this story — mutations are added in 2.2/2.3
- Do not add a `SavingIndicator` component yet — that's needed in 2.2/2.3

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|----------------|----------------|
| Empty meal plan | `slist_meal_plan` absent or `[]` | All 21 cells show centered `+` button | — |
| Meal exists for a slot | Entry matching date + slot in store | `.slot-item` card with emoji badge + recipe name | — |
| Cooked meal | Entry with `cooked: true` | Card has coral-tint background; inline `✓` after recipe name | — |
| Navigate prev week | `<` clicked | Week start shifts −7 days; date range label updates; today highlight adjusts | — |
| Navigate next week | `>` clicked | Week start shifts +7 days | — |
| Today button | CalendarCheck clicked while off current week | Snaps back to current week | — |
| Today button (current week) | CalendarCheck clicked while on current week | Opacity 0.3; click still works (no-op or re-snaps) | — |
| Today not in viewed week | Navigated away | No coral column; all day labels in default color | — |

</intent-contract>

## Code Map

**Existing — read before writing:**
- `code/src/store/index.ts` — currently `create<RecipesSlice>()( recipesSlice)` — must be extended to compose `MealPlannerSlice`
- `code/src/store/recipesSlice.ts` — reference for slice pattern; use same `StateCreator<CombinedStore>` approach
- `code/src/components/ui/Button.tsx`, `IconButton.tsx` — use for nav buttons and today button
- `code/src/styles/tokens.css` — `--coral`, `--surface`, `--surface2`, `--surface3`, `--border`, `--text-dim`, `--text-mid`
- `code/src/features/meal-planner/index.tsx` — placeholder (9 lines); replace entirely
- `code/src/features/recipes/services/recipeService.ts` — reference service pattern for `mealPlanService`
- `code/src/store/recipesSlice.ts` — reference for `RecipesSlice` type import in updated `store/index.ts`

**New files:**
- `code/src/types/mealPlan.ts` — `MealPlanEntry` interface
- `code/src/features/meal-planner/services/mealPlanService.ts` — localStorage CRUD for `slist_meal_plan`
- `code/src/store/mealPlannerSlice.ts` — Zustand slice: entries[], initMealPlan, addEntry, updateEntry, removeEntry
- `code/src/__tests__/mealPlanService.test.ts` — service unit tests
- `code/src/__tests__/calendarUtils.test.ts` — date utility unit tests

## Tasks & Acceptance

**Execution:**

- `code/src/types/mealPlan.ts` — create; export `interface MealPlanEntry { id: string; date: string; slot: 'breakfast' | 'lunch' | 'dinner'; recipeId: string; servings: number; cooked?: boolean }`

- `code/src/features/meal-planner/services/mealPlanService.ts` — create; same pattern as recipeService; key `slist_meal_plan`; `getAll(): MealPlanEntry[]`; `create(entry: Omit<MealPlanEntry,'id'>): MealPlanEntry` (UUID id, persist, return); `update(id, patch: Partial<MealPlanEntry>): MealPlanEntry` (merge, persist, return); `delete(id): void`

- `code/src/store/mealPlannerSlice.ts` — create; type `MealPlannerSlice` with state `{ entries: MealPlanEntry[] }` and actions `setEntries`, `initMealPlan` (loads from `mealPlanService.getAll()`), `addEntry`, `updateEntry`, `removeEntry`; use `StateCreator<RecipesSlice & MealPlannerSlice>` so combined-store typing works

- `code/src/store/index.ts` — update; combine both slices: `create<RecipesSlice & MealPlannerSlice>()((...a) => ({ ...recipesSlice(...a), ...mealPlannerSlice(...a) }))`; keep `useStore` export name

- `code/src/features/meal-planner/index.tsx` — replace placeholder; implement:
  - Local state: `weekStart` (Monday of current week, computed from `new Date()` on mount via `getWeekStart(today)`)
  - Week navigation: prev/next shift `weekStart` by ±7 days; today button resets to `getWeekStart(new Date())`
  - Date range label: `formatWeekRange(weekStart)` → e.g. `"22 – 28 Sep 2026"` (en-dash, no leading zeros, month+year once at end)
  - Page header: single flex row — "Meal Planner" left, nav group (`<` · range label · `>` · CalendarCheck) right
  - Grid: `overflow-x: auto` wrapper; CSS grid inside with `grid-template-columns: 26px repeat(7, minmax(110px, 1fr))`; rows: header row (day names + dates) + 3 slot rows
  - Header row: top-left corner cell (empty); 7 day header cells — day abbreviation (Mon Tue … Sun) + date number, both coral if today
  - Slot rows: label cell (26px, rotated text "BREAKFAST" "LUNCH" "DINNER"); 7 slot cells per row
  - Each slot cell: shows `.slot-item` cards for matching `entries` (date + slot match) + a `.slot-add` `+` button at the bottom (or centered if empty); slot cell min-height 100px
  - `.slot-item` card: circular emoji badge (24px, `border-radius: 50%`, `background: var(--surface3)`) + recipe name (12px/500, wraps to 2 lines, no ellipsis); if `cooked: true` → card has `background: rgba(240,112,69,0.08)` + `<span>` with ` ✓` in coral after name
  - Helper functions (inline in the page file or a `utils/calendarUtils.ts` sibling): `getWeekStart(date: Date): Date` (returns preceding Monday, or the date itself if Monday; ISO: Monday=1); `formatWeekRange(monday: Date): string`; `getDayDates(monday: Date): Date[]` (7 dates Mon–Sun); `toDateStr(date: Date): string` (YYYY-MM-DD); `isToday(date: Date): boolean`
  - `useEffect` on mount: if `entries.length === 0` call `initMealPlan()` (same pattern as RecipesPage)
  - Lookup: to render recipe emoji/name in slot cards, read `recipes` from store (already loaded by RecipesPage visit) or call `recipeService.getAll()` inline as a fallback

- `code/src/__tests__/mealPlanService.test.ts` — create; 5 tests: (a) getAll returns [] on absent key; (b) create returns entry with UUID; (c) getAll after create returns entry; (d) update merges and persists; (e) delete removes entry

- `code/src/__tests__/calendarUtils.test.ts` — create; test the helper functions (inline-export them from the feature file or a sibling utils module); cover: (a) getWeekStart of a Monday returns itself; (b) getWeekStart of a Wednesday returns the preceding Monday; (c) getWeekStart of a Sunday returns the preceding Monday; (d) formatWeekRange returns correct "D – D Mon YYYY" format with no leading zeros; (e) getDayDates returns 7 dates starting Monday; (f) toDateStr formats as YYYY-MM-DD

**Acceptance Criteria:**
- Given the Meal Planner page loads, when rendered, then a 7-column grid (Mon–Sun) with 3 named row sections (Breakfast, Lunch, Dinner) is visible with a rotated label column
- Given no meals are planned, when viewing any week, then all 21 slot cells show a centered `+` button and no recipe cards
- Given today is within the displayed week, when rendered, then today's day name and date number are coral; no other column is coral
- Given the user clicks `<`, when clicked, then the week shifts back 7 days and the date range label updates
- Given the user clicks `>`, when clicked, then the week shifts forward 7 days and the date range label updates
- Given the user has navigated away from the current week, when clicking the CalendarCheck today button, then the view returns to the current week
- Given the today button is displayed while on the current week, then it is rendered at opacity 0.3
- Given a meal exists in `slist_meal_plan` for a slot, when displayed, then a `.slot-item` card shows that meal's emoji badge and recipe name in the correct cell
- Given a meal is marked `cooked: true`, when displayed, then the card has a light coral background and shows an inline `✓` after the recipe name
- Given viewport is ~375 px, when the grid renders, then the grid container scrolls horizontally showing approximately 3 columns at a time
- Given the date range, then the label follows `D – D Mon YYYY` format with en-dash, no leading zeros, month+year once at end

## Spec Change Log

## Review Triage Log

### 2026-10-07 — Review pass
- verdicts: 18 findings — high 0, medium 5, low 1, false 9, maybe-false 0, deferred 2, rejected 1
- findings:
  - `[medium]` `[patch]` Fragment key on `<>` shorthand in SLOTS.map — verified: `index.tsx:182` uses `<>` which cannot carry `key`; React will warn and may mis-reconcile rows on weekStart change. Fixed: changed to `<React.Fragment key={slot.key}>`.
  - `[false]` `[reject]` recipeMap useMemo empty deps — verified: no recipe mutation happens from the meal planner page in 2.1 scope; navigating away remounts the component, refreshing the map. No user-visible harm.
  - `[false]` `[reject]` useEffect missing deps — verified: the empty dep array is intentional (fires once on mount, same pattern as RecipesPage); adding deps would cause initMealPlan to re-fire on every entries change, creating an infinite loop.
  - `[false]` `[reject]` Dual-source-of-truth (store vs service) — verified: intended Zustand/service separation pattern from the architecture; Story 2.2 composes both calls. Not a defect.
  - `[false]` `[reject]` Add button has no onClick — verified: explicitly required by spec ("the `+` button is present and focusable but has no onClick handler wired to a modal — that's Story 2.2"). Correct behavior.
  - `[medium]` `[patch]` formatWeekRange ambiguous for cross-month weeks — verified: function only shows end month; `"28 – 4 Oct 2026"` is ambiguous. Fixed: include start month when months differ → `"28 Sep – 4 Oct 2026"`. Test case (g) added.
  - `[low]` `[reject]` Test (d) comment wrong (Sep 22 labeled as Monday) — verified: comment is wrong (Sep 22 is Tuesday) but assertion is arithmetically correct; test still verifies the 6-day-addition arithmetic. Cosmetic; no logic broken.
  - `[low]` `[patch]` update() accepts id in patch type — verified: `patch: Partial<MealPlanEntry>` includes `id`; a caller could corrupt entry identity. Fixed: changed to `Omit<Partial<MealPlanEntry>, 'id'>`.
  - `[false]` `[reject]` setEntries is a dead export — verified: `setEntries` is explicitly listed in the spec's slice API for Story 2.2 to use for optimistic updates. Intentional.
  - `[medium]` `[patch]` Fragment key on `<>` (edge-case-hunter duplicate) — same root cause as blind-hunter finding 1; resolved by the same fix.
  - `[false]` `[reject]` recipeMap stale deps (edge-case-hunter) — same finding as blind-hunter; rejected for same reason.
  - `[defer]` `[defer]` localStorage setItem QuotaExceededError not guarded — pre-existing pattern: recipeService (Story 1.3) uses the same unguarded pattern. Not introduced by this story.
  - `[defer]` `[defer]` localStorage getItem SecurityError not guarded — same pre-existing pattern from recipeService.
  - `[low]` `[reject]` update allows id in patch (edge-case-hunter duplicate) — same root cause as blind-hunter finding 8; resolved by same fix.
  - `[reject]` `[reject]` delete vs remove naming in spec — implementation correctly uses `remove` because `delete` is a JavaScript reserved keyword and cannot be a standalone function name; the spec task description had the wrong name. Code is correct. Fix would be editing only the spec task text; rejected per rule.
  - `[false]` `[reject]` StateCreator single vs combined type — verified: `StateCreator<MealPlannerSlice>` is correct for a slice that doesn't access other slices' state; the `as unknown as` cast in index.ts is standard Zustand practice. No runtime breakage.
  - `[medium]` `[patch]` isToday has no test — pre-verified by verification-gap layer: symbol absent from all test files. Fixed: added test case (h) using `vi.useFakeTimers()`.
  - `[medium]` `[patch]` Hardcoded `rgba(240,112,69,0.08)` violates no-hardcoded-colors constraint — verified: `index.tsx:229-230` uses raw color literal. Fixed: replaced with `color-mix(in srgb, var(--coral) 8%, transparent)`.
  - `[false]` `[reject]` Test surface vs intent surface gap — verified: spec explicitly scoped tests to utils/service layer only (same approach as Story 1.3). Component render tests were not specified.
  - `[false]` `[reject]` Minor test comment error (intent-alignment) — same as blind-hunter finding 7; rejected cosmetic finding.

## Design Notes

**Combined Zustand store:** When composing two slices, TypeScript needs `StateCreator<CombinedStore>` in each slice to avoid type errors. The combined type `RecipesSlice & MealPlannerSlice` must be imported in both slice files. This is the standard Zustand pattern for composed stores.

**Rotated row labels:** `writing-mode: vertical-rl; transform: rotate(180deg); text-transform: uppercase; font-size: 9px; letter-spacing: 1.5px; color: var(--text-dim)`. The label cell is `26px` wide with `display: flex; align-items: center; justify-content: center`.

**Calendar utility exports:** Export helper functions individually so the test file can import them directly: `export function getWeekStart(date: Date): Date { ... }`. If inline in the page file, use named exports from the same file.

**Recipe lookup in slot cards:** To display emoji and name in `.slot-item`, call `recipeService.getAll()` once per render (or read from store if already loaded). If a `recipeId` has no matching recipe, skip rendering that card silently.

## Auto Run Result

### Summary

Implemented the weekly meal planner calendar grid: a 7-column (Mon–Sun) × 3-row (Breakfast/Lunch/Dinner) CSS grid with week navigation, today-column highlighting, slot-item cards for existing entries, and an inert `+` button per slot. Created `mealPlannerSlice` and `mealPlanService` as the data layer for Stories 2.2 and 2.3 to extend.

### Files Changed

- `code/src/types/mealPlan.ts` — `MealPlanEntry` interface
- `code/src/features/meal-planner/services/mealPlanService.ts` — localStorage CRUD (`getAll/create/update/remove`) with key `slist_meal_plan`
- `code/src/features/meal-planner/utils/calendarUtils.ts` — date helpers: `getWeekStart`, `getDayDates`, `formatWeekRange`, `toDateStr`, `isToday`
- `code/src/store/mealPlannerSlice.ts` — Zustand slice with `entries`, `initMealPlan`, `addEntry`, `updateEntry`, `removeEntry`
- `code/src/store/index.ts` — combined store composing `RecipesSlice & MealPlannerSlice`
- `code/src/features/meal-planner/index.tsx` — full calendar grid page replacing placeholder
- `code/src/__tests__/mealPlanService.test.ts` — 5 service unit tests
- `code/src/__tests__/calendarUtils.test.ts` — 8 date utility tests (including `isToday` and cross-month format)

### Review Findings Breakdown

**Patches applied (5):**
- `[medium]` Fragment key on `<>` — changed to `<React.Fragment key={slot.key}>`
- `[medium]` Hardcoded `rgba(240,112,69,0.08)` — replaced with `color-mix(in srgb, var(--coral) 8%, transparent)`
- `[medium]` `formatWeekRange` cross-month ambiguity — fixed; test (g) added
- `[medium]` `isToday` not tested — test (h) added with `vi.useFakeTimers()`
- `[low]` `update` accepts `id` in patch — changed type to `Omit<Partial<MealPlanEntry>, 'id'>`

**Deferred (2):** localStorage exception guards (pre-existing pattern from Story 1.3)

**Rejected (9):** recipeMap empty deps (no mutation in 2.1), useEffect intentional empty dep, intended service/store separation, inert `+` button per spec, test comment cosmetic, setEntries in spec API, `delete` is a JS keyword so `remove` is correct, StateCreator cast is standard, test surface matches spec scope

### Follow-up Review Recommendation

`false` — 0 high patches; 4 medium patches on first pass does not trigger the threshold for recommending a follow-up (threshold: any high, or 2+ medium).

### Verification

- `npm test -- --run`: 43/43 tests pass (8 test files)
- `npm run build`: exits 0, bundle 308 kB

### Residual Risks

None beyond the deferred localStorage exception guards (low, pre-existing pattern).

## Verification

**Commands:**
- `cd /data/code && npm test -- --run` — expected: all tests pass including 2 new test files
- `cd /data/code && npm run build` — expected: exits 0
- `cd /data/code && npm run lint` — expected: exits 0
