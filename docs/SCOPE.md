# MVP Scope — Presentable Build

## Goal

Deliver a complete, demonstrable end-to-end workflow:

> Add recipes → Plan the week → Get a shopping list automatically

Six stories. No pantry. No cook-now. The core value proposition, fully working.

---

## In Scope

### Story 1.1 — App Shell & Design System
Navigable app with sidebar (desktop) and bottom nav (mobile), clean URLs via React Router + `.htaccess`, all CSS design tokens defined, feature-sliced folder structure in place.

### Story 1.2 — Ingredient System
76 canonical ingredients seeded into `slist_ingredients_db` on first load. Autocomplete in recipe forms resolves ingredient names to canonical IDs with read-only `default_unit`. Unmatched entries create a new `ingredients_db` record. This is what makes shopping list aggregation correct.

### Story 1.3 — Recipe Management
Full recipe CRUD: create, view, edit, delete. Emoji, name, servings, tags (with custom color), ingredients (canonical IDs, quantities), free-text notes. Recipe list with real-time search/filter. `RecipeDetail` shared component with servings scaler. Mobile: detail slides in as full-screen overlay.

### Story 2.1 — Weekly Calendar Grid
7-day grid (Mon–Sun × Breakfast/Lunch/Dinner). Week navigation (prev/next/today). Today's column highlighted in coral. Horizontal scroll on mobile. Empty slots show `+`. Page header: title left, week controls right.

### Story 2.2 — Assign & Remove Meals
Tap empty slot → recipe picker modal (searchable). Add recipe to slot → stored as `{ id, date, slot, recipeId, servings }` in `slist_meal_plan`. Slot cards show emoji + recipe name (wraps 2 lines). Tap card → RecipeDetail modal with Remove from Plan. "Add to Week" modal wired from RecipeDetail.

### Story 3.3 — Live Shopping List
Computed on every render from `slist_meal_plan` + `slist_recipes` — never stored. Aggregates ingredients by canonical ID, sums quantities (safe — same unit guaranteed). Groups by category (Produce, Meat, Dairy, etc.). Check off items (strikethrough, stays visible). Progress bar. "Clear checked" button. Empty state when nothing needed.

**Pantry subtraction:** with no pantry in this scope, deficit = full quantity needed. The selector is written pantry-aware so Story 3.1 can plug in later without changes to the shopping list component.

---

## Out of Scope (deferred)

| Feature | Story |
|---|---|
| Mark as Cooked | 2.3 |
| Pantry Management | 3.1 |
| Cooked → Pantry Deduction | 3.2 |
| Cook Now | 4.1, 4.2 |

Cook Now and pantry pages should still exist as nav destinations with empty states — so navigation works and the app feels complete.

---

## Demo Flow

1. Open app — see empty Recipes page.
2. Add 2–3 recipes with real ingredients (e.g. pasta, chicken stir-fry).
3. Go to Meal Planner — assign recipes to days this week.
4. Go to Shopping List — see ingredients aggregated and grouped automatically.
5. Check items off while "shopping".
