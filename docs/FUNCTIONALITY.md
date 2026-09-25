# Functionality Manual — Meal Planner Prototype

This document describes all user-facing features and views of the app from a UX perspective. It is intended to help agents and developers understand what the app does and how users interact with it.

---

## Overview

A **mobile-first personal meal planning app** with five main views accessible from the navigation. The core workflow is:

> Add recipes → Plan meals for the week → Check what to cook today → Build a shopping list → Track pantry stock

---

## Navigation

### Desktop
A fixed left sidebar (220 px, dark charcoal) displays the app brand and five navigation links with icons. The active link is highlighted with a coral background.

### Mobile
A fixed bottom bar replaces the sidebar. Each nav item shows an icon + small label. The active item uses coral text (no background). The bottom bar is always 60 px tall; page content has matching bottom padding so nothing is hidden behind it.

**Pages (in nav order):**
1. Recipes
2. Meal Planner
3. Cook Now
4. Shopping List
5. Pantry

---

## 1. Recipes

A two-panel layout: recipe list on the left, recipe detail on the right.

### Recipe List Panel (left, 280 px)

- **Search bar** at the top — filters recipes by name or tag as the user types.
- **Recipe rows** — each row shows emoji, name (truncated with ellipsis if too long), servings count, and color-coded tags. Tapping a row selects it and shows its detail.
- Selected row is highlighted with a coral-tinted background.
- **Add recipe button** in the page header opens the recipe creation form.

### Recipe Detail Panel (right)

Displays the full recipe using the shared `RecipeDetail` component (see §6). In this context it provides:
- **Edit** button (pencil icon) — opens the recipe edit form.
- **Add to Week** button (calendar+ icon) — opens the "Add to Week" modal.
- No cooked/remove buttons (those are meal-plan-specific).

### Mobile behaviour
On mobile, the detail panel slides in from the right as a full-screen overlay when a recipe is tapped. A **back button** (chevron-left) in the top-left of the detail header returns to the list.

### Recipe Form (modal)

Opened for both creating and editing recipes. Fields:
- **Emoji** — free text (single emoji)
- **Name** — text
- **Servings** — number
- **Tags** — tag picker: select from existing color-coded tags or create a new one (with name + color swatch). Tags are flat colored labels (no pill background).
- **Ingredients** — add/remove rows of (name, quantity, unit). The ingredient name field autocompletes against `ingredients_db`. Selecting an autocomplete result binds the row to that entry's canonical ID and pre-fills the unit with its `default_unit`. If the user types a name with no match, confirming it creates a new `ingredients_db` record (they must supply a unit, which becomes that entry's `default_unit`). Freeform ingredient strings that bypass the canonical ID are not permitted — the unit shown is read-only and determined by the ingredient's `default_unit`, not freely editable per recipe.
- **Notes** — textarea for free-form cooking instructions.

Save creates/updates the recipe via the API.

### Add to Week Modal

Lets the user schedule a recipe on a specific day and meal slot:
- **Day selector** — 7 radio buttons labeled with abbreviated day names and dates for the current week.
- **Slot selector** — Breakfast / Lunch / Dinner.
- **Servings** — number input (defaults to recipe's servings).
- Confirm button adds the entry to the meal plan.

---

## 2. Meal Planner

A 7-day calendar grid showing all planned meals for the current week. The primary view for organizing the week's eating.

### Header (single row)

- **Page title** ("Meal Planner") on the left.
- **Week navigation** on the right: previous-week arrow (`<`), date range label (e.g. "22 Sep – 28 Sep 2026"), next-week arrow (`>`), then a **Today button** (calendar-check icon) that jumps back to the current week. The Today button is always visible; it is dimmed (30 % opacity) when already on the current week.

### Calendar Grid

- **Rows:** Breakfast, Lunch, Dinner — each row has a rotated vertical label (9 px, uppercase) in a narrow left column.
- **Columns:** 7 days (Mon–Sun). Each column is at minimum 110 px wide, forcing horizontal scroll on narrow screens so ~3 days are visible at once. The user scrolls left/right to see all 7 days.
- **Today's column** is highlighted with coral text on the day header and date number.

### Meal Slots

Each cell is one meal slot (e.g. Thursday Lunch).

**Empty slot:**
- Faint background, centered `+` sign.
- Tapping anywhere in the cell opens the recipe picker.

**Slot with meals:**
- Shows stacked `.slot-item` cards, one per planned recipe. Each card shows an emoji and up to 2 lines of the recipe name (clipped with `…`).
- **Cooked meals** have a light coral background tint and a faint `✓` watermark in the bottom-right corner of the card.
- A `+` spacer at the bottom of the slot allows adding another meal to the same slot. Tapping the spacer (or any free area) opens the recipe picker.
- Tapping a meal card opens the Recipe Detail modal for that entry.

### Recipe Detail (in Meal Planner)

Opens as a centered modal overlay. Uses the shared `RecipeDetail` component with two additional action buttons:
- **Mark as Cooked / Uncooked** (check icon, coral) — toggles cooked state. If already cooked, marks it uncooked and restores pantry quantities. If uncooked, marks it cooked and deducts ingredients from the pantry. A spinner shows while the API call is in flight.
- **Remove from Plan** (trash icon, red) — removes the meal plan entry.

### Recipe Picker

A searchable modal listing all recipes. The user types to filter by name or tag, then taps a recipe to add it to the selected slot.

---

## 3. Cook Now

Shows today's planned meals with ingredient availability status, helping the user decide what to cook right now.

### Filters

Three filter tabs in the page header:
- **All** — all of today's meals.
- **Ready** — meals where all ingredients are in stock.
- **Almost** — meals where some ingredients are missing.

### Meal Cards

Each planned meal appears as a card (`cook-now-card`) with:
- **Status highlight:** coral glow for "ready", amber glow for "almost ready", reduced opacity for "far" (many missing).
- **Header:** emoji, recipe name, and an availability badge (`●` coral = ready, `1 missing` amber, `3 missing` red).
- **Ingredient list:** every ingredient with name, scaled quantity, and a ✓ (coral) or ✗ (red) icon showing pantry availability.
- **Action buttons:**
  - "Cook it" (charcoal) for ready meals.
  - "Cook anyway" (amber, outline) for almost-ready meals.

Tapping an action button opens the full Recipe Detail (same shared component as in Recipes and Meal Planner), including Edit and Add to Week actions.

---

## 4. Shopping List

Auto-generated list of ingredients needed for this week's uncooked meals, after subtracting what's already in the pantry.

### Aggregation logic

Because every recipe ingredient and every pantry item references a canonical `ingredients_db` ID and stores quantity in that ingredient's `default_unit`, aggregation is safe:

1. Collect all ingredients from uncooked planned meals for the current week, scaled to their planned servings.
2. Group by `ingredient_id` and sum quantities (same unit guaranteed — no conversion needed).
3. For each ingredient, subtract the pantry quantity for that `ingredient_id` (same unit).
4. Display items where deficit > 0, grouped by the ingredient's `category`.

### Header

- **Progress bar** — shows how many items have been checked off (e.g. "3 / 7 checked").
- **Clear checked** button — appears when at least one item is checked; removes checked items from the visible list and refreshes data.

### List

Items are grouped by category:
- 🥬 Produce
- 🐟 Fish & Seafood
- 🥩 Meat
- 🥛 Dairy
- 🫙 Pantry & Dry Goods
- 📦 Other

Each item shows:
- **Checkbox** (filled coral when checked).
- **Ingredient name**.
- **Quantity needed** (deficit: total required minus what's in pantry).
- **"auto" badge** (coral) — indicates the item was generated from the meal plan.

**Checking an item** marks it bought and immediately updates the pantry (adds the deficit quantity to the pantry stock). The item stays visible with strikethrough and reduced opacity until **Clear checked** is tapped — this prevents the list from jumping around while shopping.

**Unchecking an item** reverses the pantry update.

---

## 5. Pantry

Manages the household's ingredient stock levels.

### Header

Shows the total item count and a hint ("click a row to edit"). An **Add Item** button (charcoal, with + icon) opens the add form.

### Pantry Items

Each item shows:
- **Name** — ingredient name.
- **Quantity + unit** — current stock (e.g. "400 g").
- **Stock bar** — 52 px wide horizontal bar colored coral (hi > 50%), amber (mid 20–50%), or red (lo < 20%) based on `quantity / max` ratio.
- **Edit hint** (pencil icon) — appears on hover.

Tapping a row switches it to **inline editing mode**:
- Editable fields: name, quantity, unit, max stock.
- **Save** / **Cancel** buttons.
- **Delete** button (red, trash icon) removes the item entirely.

### Add Item Modal

Form fields: ingredient name, quantity (number), unit (dropdown), max stock (optional — defaults to 3× the initial quantity).

---

## 6. Shared: Recipe Detail Component

The `RecipeDetail` component is used identically across Recipes, Meal Planner, and Cook Now. Its structure:

### Header

- Recipe emoji (32 px) + name (18 px, weight 800).
- **Action buttons** (icon-only, 44 × 44 px, top-right of the header):
  - Edit (pencil) — neutral icon, opens recipe form.
  - Add to Week (calendar+) — charcoal icon, opens Add to Week modal.
  - Cooked toggle (check) — coral icon; shows as dimmed when already cooked; animates with a spinner while saving.
  - Remove from plan (trash) — red icon; only shown when the recipe is in the meal plan.
- **Tags** — color-coded flat tag chips below the header.

### Ingredients

- **Servings scaler** — `−` / `+` buttons adjust display servings; all quantities scale proportionally. A "reset" link returns to the original.
- Each ingredient row: name, scaled quantity + unit, and a ✓ (coral) or ✗ (red) availability indicator if pantry data is available.

### Notes

Free-text cooking instructions displayed below ingredients, if present.

---

## 7. Global UX Patterns

### Saving indicator

A small spinning ring appears in the top-right corner of the screen whenever any API write is in flight. It disappears as soon as all pending saves complete. This gives users confidence that changes are being persisted without intrusive loading states.

### Toast notifications

Brief confirmation messages appear at the bottom center of the screen after actions (adding a meal, marking as cooked, saving a recipe, etc.). They auto-dismiss after 2.5 seconds. Charcoal for success, dark amber for warnings/undo.

### Optimistic UI

All mutations update the local state immediately before the API call completes, so the UI feels instant. If the API call fails, the error is surfaced via toast.

### Empty states

When a list has no items, a centered illustration (large emoji + description text) replaces the list. Examples: "Nothing needed — your pantry covers this week's meals" on the Shopping List.
