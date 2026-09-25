---
stepsCompleted: [1, 2, 3-epic1]
# stopped after Epic 1 stories approved; Epic 2 story breakdown proposed (3 stories), not yet written
inputDocuments:
  - CONTEXT.md
  - docs/FUNCTIONALITY.md
  - docs/DESIGN.md
  - docs/STACK.md
  - docs/BACKEND-STACK.md
  - _bmad-output/planning-artifacts/architecture/architecture-data-2026-09-25/ARCHITECTURE-SPINE.md
---

# Smart Shopping List - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Smart Shopping List, decomposing the requirements from the functional spec, design system, and architecture spine into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can add, edit, and delete recipes with name, emoji, servings, tags, ingredients (with quantities), and free-text notes
FR2: Ingredient names are resolved to canonical ingredients_db entries via autocomplete; unmatched entries create a new ingredients_db record with a user-supplied unit
FR3: Units are read-only per recipe ingredient, determined by the ingredient's ingredients_db.default_unit — not freely editable per recipe
FR4: Users can search and filter recipes by name or tag
FR5: Users can view a 7-day weekly meal planner (Mon–Sun) with Breakfast, Lunch, and Dinner slots
FR6: Users can assign recipes to meal slots with a per-slot servings override
FR7: Users can navigate between weeks (previous/next) and jump to the current week
FR8: Users can mark a planned meal as cooked; cooked state auto-deducts used ingredients from the pantry
FR9: Users can unmark a cooked meal; pantry quantities are restored
FR10: Users can remove a recipe from the meal plan
FR11: The shopping list is live-computed from the current week's uncooked planned meals, aggregated by canonical ingredient ID, with pantry stock subtracted — never stored
FR12: Shopping list items are grouped by ingredient category
FR13: Users can check off shopping list items; checking immediately updates pantry stock (adds deficit quantity)
FR14: Users can uncheck shopping list items; pantry update is reversed
FR15: A progress bar shows how many shopping list items have been checked off
FR16: Checked items remain visible (strikethrough, dimmed) until "Clear checked" is tapped
FR17: Cook Now page shows today's planned meals with ingredient availability status (Ready / Almost / Far)
FR18: Cook Now meals are filterable by All / Ready / Almost tabs
FR19: Users can manage pantry inventory: view items with stock levels, add new items, edit inline, delete
FR20: Pantry items reference canonical ingredients_db entries and store quantity in default_unit
FR21: The shared RecipeDetail component is usable in Recipes, Meal Planner, and Cook Now contexts with context-appropriate action buttons
FR22: Users can add a recipe to the meal plan via an "Add to Week" modal (day, slot, servings)
FR23: Tags can be created with custom name and color; recipes can have multiple tags
FR24: Empty states are shown when lists have no items

### NonFunctional Requirements

NFR1: Mobile-first — primary target ~375 px viewport; desktop layout activates at 768 px
NFR2: All mutations update local state immediately (optimistic UI); API errors surface via toast and roll back
NFR3: The app deploys as static files (dist/) via FTP to shared hosting — no Node.js runtime on server
NFR4: Build must be cross-platform (npm scripts only, no Unix-only shell syntax)
NFR5: SPA routing via BrowserRouter with .htaccess rewrite — clean URLs (/meal-planner, etc.)
NFR6: MVP data persisted in browser localStorage; production uses PHP REST API (mutually exclusive phases)
NFR7: Single-user, no authentication for MVP
NFR8: Shopping list is never stored — always live-computed on render

### Additional Requirements

- Feature-sliced SPA: each feature in src/features/{feature}/; shared business components in src/components/shared/; design primitives in src/components/ui/
- Service layer: features never touch localStorage or fetch directly — they call service functions; services live in src/features/{feature}/services/ or src/services/ for cross-feature
- Zustand composed slices: each feature owns its own slice file; src/store/index.ts composes all; shoppingListSlice = selectors only
- Vite project root in code/; build outputs dist/
- PHP REST routes prefixed /api/ (e.g. /api/recipes, /api/meal-plan, /api/pantry)
- PHP backend structure: api/src/Actions/, api/src/Repositories/, api/src/Routes/
- Meal plan entries: { id, date: "YYYY-MM-DD", slot: "breakfast"|"lunch"|"dinner", recipeId, servings }
- localStorage IDs via crypto.randomUUID(); localStorage keys prefixed slist_
- Phinx migrations run locally → SQL applied via phpMyAdmin; vendor/ built locally and FTP-uploaded

### UX Design Requirements

UX-DR1: All design tokens (colors, shadows, typography) defined as CSS custom properties in src/styles/tokens.css — mapped from DESIGN.md; components consume tokens, never hardcoded values
UX-DR2: App shell: sidebar (220px, charcoal) on desktop; fixed bottom nav bar (60px, charcoal) on mobile; .page-header is always a single flex row (title left, controls right) — never stacked
UX-DR3: Button component library — 6 variants (primary/charcoal, coral, secondary, ghost, amber, danger) + 2 size modifiers (sm, xs); hover opacity 0.88; active scale(0.97)
UX-DR4: Icon-only action buttons (.rd-act) — 44×44px, 4 color variants (neutral/dim, accent/charcoal, coral/cooked, red/danger)
UX-DR5: Modal component — backdrop rgba(0,0,0,0.4) + blur(6px), slideUp animation, 480px centered on desktop, full-width bottom-sheet on mobile
UX-DR6: Toast component — charcoal and amber variants, auto-dismiss 2.5s, fixed bottom-center
UX-DR7: SavingIndicator — 16×16px spinning ring, fixed top-right, visible only while mutations are in flight
UX-DR8: FilterTabs — pill row, active state coral background + white text
UX-DR9: TagChip — flat colored label (dot + name, no background pill), color set inline per tag
UX-DR10: Meal Planner grid — CSS grid 26px label col + 7×min(110px); horizontal scroll on mobile; today column coral; slot items: circular icon badge 24px, recipe name wraps 2 lines (no ellipsis, no fixed height), cooked state = small inline coral ✓ span
UX-DR11: Bottom nav mobile — sentence-case labels, coral icon + label (no background pill), 20×20px icons, 10px/600 font
UX-DR12: Stock bar — 52px wide, coral (>50%) / amber (20–50%) / red (<20%) based on quantity/max ratio
UX-DR13: Recipes page mobile — detail panel slides in as full-screen overlay (translateX animation); back button in header
UX-DR14: Animations — fadeIn 0.15s (backdrop), slideUp 0.20s (modal card), toastIn 0.20s, saving-spin 0.7s linear infinite, button active scale(0.97) 0.1s
UX-DR15: No rounded corners by default (--radius: 0); slot-item cards use border-radius: 4px as the only contextual exception; no blue anywhere in the UI; shadows not borders for elevation

### FR Coverage Map

FR1 → Epic 1 — Recipe CRUD (name, emoji, servings, notes)
FR2 → Epic 1 — Ingredient autocomplete + canonical ID resolution
FR3 → Epic 1 — Unit read-only, from ingredients_db.default_unit
FR4 → Epic 1 — Recipe search and tag filter
FR5 → Epic 2 — 7-day calendar grid (Mon–Sun, 3 slots)
FR6 → Epic 2 — Assign recipe to slot with servings override
FR7 → Epic 2 — Week navigation (prev/next/today)
FR8 → Epic 2 (cooked flag) + Epic 3 (pantry deduction — completed)
FR9 → Epic 3 — Unmark cooked; pantry quantities restored
FR10 → Epic 2 — Remove recipe from meal plan
FR11 → Epic 3 — Live-computed shopping list (never stored)
FR12 → Epic 3 — Shopping list grouped by ingredient category
FR13 → Epic 3 — Check off item → pantry stock updated immediately
FR14 → Epic 3 — Uncheck item → pantry update reversed
FR15 → Epic 3 — Progress bar (checked / total)
FR16 → Epic 3 — Checked items stay visible until "Clear checked"
FR17 → Epic 4 — Cook Now: today's meals with availability status
FR18 → Epic 4 — Cook Now filter tabs (All / Ready / Almost)
FR19 → Epic 3 — Pantry CRUD (add, inline edit, delete)
FR20 → Epic 3 — Pantry items reference ingredients_db, quantity in default_unit
FR21 → Epic 1 (RecipeDetail component built) + Epic 2 (meal planner context) + Epic 4 (Cook Now context)
FR22 → Epic 2 — "Add to Week" modal fully wired (day, slot, servings)
FR23 → Epic 1 — Tag system (create with name + color, multi-tag recipes)
FR24 → Epics 1–4 — Empty states per feature

## Epic List

### Epic 1: Foundation & Recipe Library
Users can manage their complete recipe collection in a fully styled, navigable app shell.

Sets up the entire project scaffold, design system, shared component library, canonical ingredient system, and full Recipe CRUD — the foundation every subsequent epic builds on.

**FRs covered:** FR1, FR2, FR3, FR4, FR21 (component), FR23, FR24
**UX-DRs covered:** UX-DR1 through UX-DR15
**NFRs covered:** NFR1, NFR4, NFR5, NFR7

---

### Epic 2: Meal Planning
Users can plan their week's meals and mark meals as cooked.

Full 7-day calendar grid, week navigation, recipe picker, "Add to Week" modal wired end-to-end, remove from plan, and cooked toggle (sets cooked flag; pantry deduction added in Epic 3).

**FRs covered:** FR5, FR6, FR7, FR8 (cooked flag), FR10, FR21 (meal planner context), FR22, FR24
**NFRs covered:** NFR1, NFR2

---

### Epic 3: Pantry & Live Shopping
Users can track home inventory and see a live, auto-generated shopping list.

Pantry CRUD with stock bars and inline editing. Completes FR8/FR9 by wiring the cooked toggle to auto-deduct pantry. Shopping list live-computed via Zustand selectors — grouped by category, checkable, pantry-synced.

**FRs covered:** FR8 (complete: pantry deduction), FR9, FR11, FR12, FR13, FR14, FR15, FR16, FR19, FR20, FR24
**NFRs covered:** NFR2, NFR8

---

### Epic 4: Cook Now
Users can see what they can cook today and act on it.

Today's planned meals with per-ingredient availability status, filter tabs (All / Ready / Almost), and RecipeDetail in Cook Now context (Cook it / Cook anyway buttons).

**FRs covered:** FR17, FR18, FR21 (Cook Now context), FR24
**NFRs covered:** NFR1, NFR2

---

## Epic 1: Foundation & Recipe Library

Users can manage their complete recipe collection in a fully styled, navigable app shell.

### Story 1.1: Navigable App Shell

As a user,
I want to open the app and navigate between all five pages,
So that I can access any feature of Smart Shopping List from a consistent, well-styled interface.

**Acceptance Criteria:**

**Given** the app is opened in a browser
**When** the page loads
**Then** the app shell renders with sidebar (desktop ≥768px) or bottom nav (mobile <768px) and Recipes is shown by default

**Given** I'm on desktop
**When** I look at the navigation
**Then** a 220px charcoal sidebar shows 5 nav links with Lucide icons; active link has coral background + white text

**Given** I'm on mobile
**When** I look at the navigation
**Then** a fixed 60px charcoal bottom bar shows 5 icon+label items in sentence-case; active item shows coral icon + coral label, no background pill; page content has bottom padding so nothing hides behind the bar

**Given** I click any nav link
**When** navigation completes
**Then** the URL changes to a clean path (/recipes, /meal-planner, /cook-now, /shopping-list, /pantry) and the correct page renders

**Given** any page is loaded directly via URL
**When** the browser requests it
**Then** the .htaccess SPA fallback serves index.html and React Router renders the correct page

**Given** I inspect the styles
**When** I look at src/styles/tokens.css
**Then** all color tokens, shadow scale, and typography (Plus Jakarta Sans, base 14px/1.5) are defined as CSS custom properties; no component hardcodes these values

**Given** I look at any page header
**When** the page renders
**Then** the header is always a single flex row (title left, controls right) — never stacked vertically

**Given** I look at the Vite project structure
**When** examining src/
**Then** the feature-sliced folder structure exists: src/features/{recipes,meal-planner,shopping-list,pantry,cook-now}/, src/components/ui/, src/components/shared/, src/store/, src/services/

---

### Story 1.2: Ingredient System

As a user,
I want the app to know about common ingredients with consistent units,
So that my recipes always use the same ingredient identity and quantities can be safely aggregated.

**Acceptance Criteria:**

**Given** the app starts on a fresh browser
**When** it runs for the first time
**Then** 76 canonical ingredients are seeded into slist_ingredients_db (each with id via crypto.randomUUID(), name, default_unit, category)

**Given** I type 2+ characters in a recipe ingredient name field
**When** I pause typing
**Then** an autocomplete dropdown shows matching ingredients_db entries filtered by name

**Given** I select an autocomplete suggestion
**When** the selection is confirmed
**Then** the ingredient row binds to that entry's canonical ID and displays the default_unit as a read-only label

**Given** I type a name with no matching ingredient and confirm it
**When** I submit
**Then** I am prompted to choose a unit; a new ingredients_db record is created (with crypto.randomUUID() id) in slist_ingredients_db, and the row binds to the new canonical ID

**Given** an ingredient row is bound to an ingredients_db entry
**When** I look at the unit field
**Then** it is read-only — always shows the ingredient's default_unit; free-text unit entry is not possible

---

### Story 1.3: Recipe Management

As a user,
I want to create, view, edit, and delete recipes with ingredients and tags,
So that I have a personal recipe collection to plan meals from.

**Acceptance Criteria:**

**Given** I open the Recipes page on desktop
**When** the page loads
**Then** a 280px left panel shows the recipe list and a right panel shows the selected recipe detail (or empty state if none selected)

**Given** I open the Recipes page on mobile and tap a recipe
**When** the detail opens
**Then** RecipeDetail slides in as a full-screen overlay (translateX animation); a chevron-left back button in the header returns me to the list

**Given** no recipes exist
**When** I view the Recipes page
**Then** an empty state shows (large emoji + descriptive text)

**Given** recipes exist in slist_recipes
**When** I view the recipe list
**Then** each row shows emoji, name (truncated with ellipsis if too long), servings count, and color-coded flat tag chips

**Given** I type in the search bar
**When** I type any character
**Then** the recipe list filters in real-time by recipe name or tag name

**Given** I click "Add recipe"
**When** the modal opens
**Then** a form shows: emoji, name, servings, tags picker (existing + create new with name + color), ingredient rows (autocomplete → canonical ID, quantity, read-only unit), notes textarea

**Given** I complete and save the recipe form
**When** the save completes
**Then** the recipe is stored in slist_recipes via recipeService.create() with a crypto.randomUUID() id and appears immediately in the list

**Given** I open an existing recipe and click Edit
**When** the form opens
**Then** all fields are pre-populated; saving calls recipeService.update() and the list updates immediately

**Given** I delete a recipe
**When** I confirm
**Then** recipeService.delete() removes it from slist_recipes and the list updates immediately

**Given** I view the RecipeDetail component in any context
**When** it renders
**Then** it shows: emoji + name header; action buttons top-right (Edit — wired; Add to Week — present but disabled in this epic); flat color-coded tag chips; servings scaler (−/+/reset) scaling all quantities proportionally; per-ingredient rows with name + scaled quantity + unit; notes section if present

**Given** I create a new tag in the recipe form
**When** I provide a name and pick a color
**Then** the tag is saved to slist_tags and available in the tag picker for all future recipes
