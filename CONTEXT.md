# Meal Planner & Shopping List App — Project Context

## Vision

A personal web app to plan weekly meals and auto-generate a shopping list from recipe ingredients. Future possibility of turning this into a SaaS product.

---

## Core Pillars

### A — Recipe Database

- Add, edit, delete recipes
- Each recipe contains: name, servings, tags (e.g. "vegetarian", "quick"), ingredients with quantities and units
- Browse, search, and filter recipes
### B — Meal Planner

- Weekly calendar (Mon–Sun) with slots per meal (breakfast / lunch / dinner)
- Assign recipes to meal slots
- Adjust servings per planned meal
- Weekly overview at a glance
### C — Shopping List

- Auto-generated from the week's planned meals
- Ingredients aggregated across recipes (e.g. 3 recipes use onions → "5 onions total")
- Manual one-off items can be added
- Check off items while shopping
### D — Pantry (Home Inventory)

- Track ingredients already at home with quantities
- Shopping list automatically subtracts pantry stock before generating the list
---

## Users

- **MVP:** Single user, no login required
- **Future:** Multi-user / SaaS with accounts and data isolation
## Platform

- Browser-based web app
- Always-online for now; mobile app (offline-capable) considered for a later version

### Deployment constraints

| Constraint | Detail |
|---|---|
| Hosting | Shared hosting — FTP upload only. No Node.js runtime on the server. |
| Backend | PHP + MySQL. Data exposed via PHP REST API scripts. No server-side JS frameworks (no Express, Next.js, etc.). |
| Frontend | Static files only (HTML/CSS/JS). Purely client-side app. A build step that outputs a `dist/` folder is fine — Node is allowed at build time, not runtime. |
| Persistent storage | Browser `localStorage` acceptable for MVP. Production uses the PHP/MySQL REST API. |
| Build tooling | Node/npm for development and build time only. Build scripts must run on both Windows and Linux — no Unix-only shell syntax; use npm scripts or cross-platform tools (e.g. `cross-env`). |
| SPA routing | `.htaccess` rewrite rules redirect all requests to `index.html`. Clean URLs (`/meal-planner`, etc.) are fine. |
## Tech Stack

- **Frontend:** decided — see `docs/STACK.md`
- **Backend:** decided — see `docs/BACKEND-STACK.md`
---

## Design Decisions

| Topic | MVP | Future |
| --- | --- | --- |
| Week carry-over | Each week starts blank | Copy last week + saved week templates |
| Recipe detail | Ingredients + free-text notes/instructions field | — |
| Pantry tracking | Quantity-aware (deficit calculation) + auto-deduct on "I cooked this" | Expiry dates, receipt scanning to load pantry |
| Shopping list editing | Read-only — check items off only | Full edit (quantities, add/remove, reorder) |
| Units | Metric only (g, ml, kg, l, pcs, tbsp, tsp) — one `default_unit` per ingredient, enforced across recipes and pantry | — |
| Ingredient identity | Stored as canonical `ingredients_db` ID — no freeform ingredient strings in recipes or pantry | Nutritional data enrichment via external API |

## Data Consistency Principle

Shopping list, pantry, and meal plan must stay in sync at all times:

- Shopping list is **live-computed** (not stored) from meal_plan + recipes + pantry — no manual sync needed
- Marking a meal as cooked → **auto-deducts** used ingredients from pantry
- Removing a meal from the planner → shopping list updates automatically (next render)
- Pantry edits → shopping list updates automatically (next render)
- **No "Generate" buttons** — data drives UI, not the other way around
## Ingredients Database

Prototype has an `ingredients_db` collection in db.json with ~76 common ingredients (name, default_unit, category).

- Used for autocomplete in recipe creation/editing
- **Future:** integrate with [kaloricketabluky.sk](https://www.kaloricketabluky.sk) or similar nutritional databases to enrich ingredient data with calories, macros, allergens
- Architecture: ingredients_db is provider-agnostic; swap/extend the source without touching the rest of the app

### Canonical ingredient identity — required for shopping list correctness

The shopping list aggregates quantities across all planned recipes and subtracts pantry stock. This only works correctly if the same real-world ingredient is always represented by the same record — not by a freeform string that may differ between recipes ("garlic" vs "Garlic cloves").

**Decision:** Every ingredient stored in a recipe or the pantry must reference a canonical `ingredients_db` entry by ID. The unit stored with that ingredient must be the `default_unit` of that `ingredients_db` entry.

- The recipe form's ingredient name field resolves to an `ingredients_db` ID via autocomplete. Freeform text that does not match an existing entry creates a new `ingredients_db` record (with a user-chosen name and unit) rather than being stored inline.
- The quantity unit is determined by the ingredient's `default_unit` and is not freely editable per recipe. This guarantees that two recipes referencing the same ingredient always store quantities in the same unit.
- Shopping list aggregation groups by `ingredient_id`, sums quantities (same unit, safe to add), then subtracts the pantry quantity for that `ingredient_id`.
- Pantry items follow the same rule: each pantry row references an `ingredients_db` ID and stores quantity in `default_unit`.

**Why this matters:** without canonical IDs and a single unit per ingredient, the shopping list deficit calculation produces nonsense (e.g. `200g + 4 pcs` for cherry tomatoes) and the pantry subtraction silently fails when units don't match.
## Tags System

Tags are stored in a `tags` collection in db.json with `{ id, name, color }`. Recipes store tag names as strings (look up color from tags collection). Users can create tags with custom colors in the recipe form.

## Design System

see DESIGN.md
## v1 Scope (MVP)

**In scope:**
- All 5 pages as specced in FUNCTIONALITY.md: Recipes, Meal Planner, Cook Now, Shopping List, Pantry
- Single-user, no login
- Metric units only (g, ml, kg, l, pcs, cloves, tbsp, tsp)
- Live-computed shopping list (no "Generate" button)
- Pantry deficit subtraction + auto-deduct on mark-as-cooked

**Deferred to future versions:**
- AI chatbot
- Week templates / copy last week
- Receipt scanner
- Nutritional data integration (kaloricketabluky.sk or similar)
- Import recipe from URL
- Full shopping list editor (rename, reorder, regroup)
- Multi-user / auth

---

## Status

- [x]   v1 scope definition
- [x]   Frontend tech stack decision (see `docs/STACK.md`)
- [x]   Backend tech stack decision (see `docs/BACKEND-STACK.md`)
- [ ]   Development kickoff (production build)