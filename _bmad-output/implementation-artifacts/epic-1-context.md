# Epic 1 Context: Foundation & Recipe Library

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 establishes the complete project scaffold and delivers a fully functional Recipe Library. By the end, users can manage their entire recipe collection in a polished, navigable app shell built on the agreed design system. Every subsequent epic builds on these foundations — the design tokens, UI component library, routing shell, canonical ingredient system, Zustand store, and service layer must all be in place before Meal Planning, Pantry, or Cook Now work can begin.

## Stories

- Story 1.1: Navigable App Shell
- Story 1.2: Ingredient System
- Story 1.3: Recipe Management

## Requirements & Constraints

**Functional:**
- Recipes have name, emoji, servings, multi-tag, ingredient rows (canonical ID + quantity + read-only unit), and free-text notes
- Ingredient names resolve to `ingredients_db` entries via autocomplete; unmatched names prompt unit selection and create a new `ingredients_db` record
- Units are always read-only per ingredient row — derived from `ingredients_db.default_unit`; no freeform unit editing
- Recipe list is searchable and filterable by name or tag in real time
- Tags have a custom name and color; recipes support multiple tags
- 76 canonical ingredients seeded into `slist_ingredients_db` on first load
- `RecipeDetail` component must support multiple render contexts from the start (Recipes now; Meal Planner and Cook Now in later epics) — action buttons are context-driven; "Add to Week" is present but disabled in this epic
- Empty states required wherever a list can be empty (recipe list, ingredient autocomplete no-match)

**Non-functional:**
- Mobile-first: primary target ~375 px viewport; desktop layout activates at ≥768 px
- Build must be cross-platform: npm scripts only; use `cross-env` if env vars are needed — no Unix-only shell syntax
- SPA routing via `BrowserRouter`; Vite project root at `code/`; `base: '/'`; `build.outDir: 'dist'`; `.htaccess` rewrites all paths to `index.html`
- MVP data persisted in `localStorage`; no authentication required

## Technical Decisions

**Stack:** React 18.3, Vite (latest stable), Tailwind CSS v4 + `class-variance-authority`, Zustand, React Router v6, Lucide React, React Hook Form for simple fields + `useState<IngredientRow[]>` for ingredient rows (not `useFieldArray` — keeps autocomplete/canonical-ID resolution readable; rows merge into RHF on submit).

**Folder layout (must be created in Story 1.1):**
```
code/src/
  features/recipes/
    services/            ← recipeService, tagsService
  components/
    ui/                  ← Button, IconButton, Input, Modal, Toast, FilterTabs,
                            TagChip, SavingIndicator, StockBar
    shared/              ← RecipeDetailModal (multi-context from day one)
  store/
    recipesSlice.ts
    index.ts             ← composes all slices
  services/              ← ingredientsDbService (cross-feature)
  styles/tokens.css      ← @theme design tokens
```

**Architectural rules (must not break):**
- Features never touch `localStorage` or `fetch` directly — always via service functions (AD-2)
- No direct cross-feature imports; shared components in `components/shared/` (AD-1)
- Zustand mutation pattern: update store optimistically → call service → on error roll back store + show toast (AD-10)
- All `localStorage` keys prefixed `slist_`; new IDs via `crypto.randomUUID()` (AD-8, AD-9)
- No `unit` column on recipe ingredients — unit always read from `ingredients_db.default_unit`

**Data shapes (localStorage MVP):**
- Recipe: `{ id, name, emoji, servings, notes, tagIds: string[], ingredients: [{ ingredientId, quantity }] }`
- Ingredient DB entry: `{ id, name, default_unit, category }`
- Tag: `{ id, name, color }`
- Keys: `slist_recipes`, `slist_ingredients_db`, `slist_tags`

## UX & Interaction Patterns

**Design tokens:** all colors, shadows, and typography defined as CSS custom properties in `src/styles/tokens.css` (mapped from DESIGN.md). Components consume tokens — never hardcoded values. Font: Plus Jakarta Sans, base 14 px / 1.5.

**App shell layout:** `.app` is `display: flex; height: 100vh; overflow: hidden`. Desktop (≥768 px): 220 px charcoal sidebar; nav links sentence-case, active = coral background + white text. Mobile (<768 px): 60 px charcoal fixed bottom nav; active = coral icon + coral label text, no background pill, 10 px / 600 weight labels, 20×20 px icons.

**Page structure:** `.page` scrolls by default; `.page--fit` modifier sets `overflow-y: hidden` for pages where an inner panel owns scroll. `.page-header` is always `flex-direction: row; justify-content: space-between` — title left, controls right. Never stack vertically.

**Recipes page layout:** Desktop — 280 px left list panel + right detail panel side-by-side. Mobile — list fills screen; tapping a recipe slides `RecipeDetail` in as a full-screen `translateX(0)` overlay with a chevron-left back button in the header.

**RecipeDetail component:** emoji + name header; `.rd-act` action buttons (44×44 px icon-only) top-right; flat color-coded TagChip list; servings scaler (−/+/reset) that proportionally scales all quantities; per-ingredient name + scaled quantity + unit rows; notes section if present.

**Component variants (all via `cva`):**
- Button: 6 intent variants (primary/charcoal, coral, secondary, ghost, amber, danger) + sm/xs size modifiers; hover `opacity: 0.88`; active `scale(0.97)`
- IconButton (`.rd-act`): 44×44 px, 4 color variants (default/dim, accent/charcoal, coral/cooked, red/danger)
- Modal: backdrop `rgba(0,0,0,0.4)` + `blur(6px)`, 480 px centered on desktop, full-width bottom-sheet on mobile, `slideUp` 0.20 s animation
- Toast: charcoal + amber variants, auto-dismiss 2.5 s, fixed bottom-center
- TagChip: flat dot + name, no background pill, color set via inline `style`

**Hard rules:** no blue anywhere; no rounded corners by default (`--radius: 0`); elevation via shadows not borders; no `text-overflow: ellipsis` on recipe names inside cards.

## Cross-Story Dependencies

- Story 1.1 (app shell + design tokens + folder scaffold) must complete before Stories 1.2 and 1.3 can begin
- Story 1.2 (seeded `ingredients_db` + `ingredientsDbService`) must be in place before Story 1.3's ingredient autocomplete can function
- `RecipeDetail` (Story 1.3) is designed for multi-context reuse — do not hard-wire Recipes-only assumptions; Epic 2 and Epic 4 extend its action buttons without modifying the component's core
