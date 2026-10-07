# Story 1.3 — Recipe Management

As a user,
I want to create, view, edit, and delete recipes with ingredients and tags,
So that I have a personal recipe collection to plan meals from.

---

## Acceptance Criteria

### AC1 — Desktop two-panel layout

**Given** I open the Recipes page on desktop (viewport ≥ 768 px)
**When** the page loads
**Then** a fixed 280 px left panel shows the recipe list and a right panel occupies the remaining width showing the selected recipe detail (or empty state if no recipe is selected)

---

### AC2 — Mobile full-screen overlay

**Given** I open the Recipes page on mobile (viewport < 768 px) and tap a recipe row
**When** the detail view opens
**Then** `RecipeDetail` slides in as a full-screen overlay using a `translateX` CSS transition (from 100% → 0%); a chevron-left back button in the overlay header returns me to the list (translateX back to 100%)

---

### AC3 — Empty state

**Given** no recipes exist in `slist_recipes`
**When** I view the Recipes page
**Then** an empty state is shown consisting of a large emoji and a short descriptive text; no list rows are rendered

---

### AC4 — Recipe list rows

**Given** one or more recipes exist in `slist_recipes`
**When** I view the recipe list panel
**Then** each row displays:
- The recipe's emoji
- The recipe name (truncated with `text-overflow: ellipsis` if too long)
- The servings count
- Flat color-coded tag chips (dot + name, color from `slist_tags`, no pill background)

---

### AC5 — Real-time search / filter

**Given** I am on the Recipes page with at least one recipe
**When** I type any character into the search bar
**Then** the recipe list filters in real-time (no submit required) to show only recipes whose name contains the search text OR whose associated tag names contain the search text; the filter is case-insensitive

---

### AC6 — Add-recipe modal form

**Given** I click the "Add recipe" button in the page header
**When** the modal opens
**Then** a form is shown with all of the following fields:
- **Emoji** — single-emoji text input
- **Name** — text input
- **Servings** — number input (positive integer)
- **Tags** — tag picker showing existing tags as selectable chips; an inline "New tag" flow allowing the user to enter a name and choose a color swatch; selected tags shown as flat colored chips
- **Ingredients** — add/remove rows, each row consisting of: `IngredientAutocomplete` (name field resolves to canonical ingredient ID), quantity number input, read-only unit (locked to ingredient's `default_unit`)
- **Notes** — textarea for free-form cooking instructions
- **Save** and **Cancel** buttons

---

### AC7 — Create recipe

**Given** I complete the recipe form and click Save
**When** the save completes
**Then**:
- `recipeService.create()` is called with the form data
- The new recipe is assigned an ID via `crypto.randomUUID()`
- The recipe is persisted to `slist_recipes` in localStorage
- The recipe appears immediately in the list without page reload
- The modal closes

---

### AC8 — Edit recipe

**Given** I open a recipe and click the Edit action button in `RecipeDetail`
**When** the recipe form opens in edit mode
**Then**:
- All fields are pre-populated with the recipe's current values (emoji, name, servings, tags, ingredients, notes)
- Saving calls `recipeService.update()` with the recipe ID and updated data
- The recipe list and detail view update immediately without page reload
- The modal closes

---

### AC9 — Delete recipe

**Given** I open a recipe and click the Delete action button in `RecipeDetail`
**When** I confirm the deletion
**Then**:
- `recipeService.delete()` is called with the recipe ID
- The recipe is removed from `slist_recipes` in localStorage
- The recipe list updates immediately; the detail panel returns to empty state
- No confirmation required beyond the initial delete button click (single-confirm pattern)

---

### AC10 — RecipeDetail component

**Given** I view the `RecipeDetail` component in any context (Recipes page, future Meal Planner, Cook Now)
**When** it renders with a valid recipe
**Then** it displays:
- **Header**: emoji (32 px) followed by recipe name (18 px / 800 weight)
- **Action buttons** (icon-only, 44×44 px, top-right):
  - Edit (pencil icon, neutral) — wired; clicking opens the recipe form in edit mode
  - Add to Week (calendar-plus icon, charcoal) — present but **disabled** in this story
- **Tags**: flat color-coded tag chips below the header (dot + name, color from `slist_tags`)
- **Servings scaler**: current servings display with − and + buttons; a reset link restores the original servings count; scaling adjusts all ingredient quantities proportionally
- **Ingredient rows**: one row per ingredient showing canonical ingredient name, scaled quantity, and unit
- **Notes section**: shown only when notes are non-empty; displays the free-text notes below the ingredient list

---

### AC11 — Tag persistence

**Given** I use the "New tag" flow inside the recipe form to create a tag with a name and a color
**When** I save the new tag
**Then**:
- The tag is written to `slist_tags` in localStorage as `{ id: crypto.randomUUID(), name, color }`
- The tag is immediately available in the tag picker for all subsequent recipe creates and edits
- The tag color is a non-empty string (any valid CSS color value chosen by the user)

---

## Data Model Reference

```typescript
interface Recipe {
  id: string;                        // crypto.randomUUID()
  emoji: string;
  name: string;
  servings: number;
  tagIds: string[];                  // references Tag.id values from slist_tags
  ingredients: RecipeIngredient[];
  notes: string;
  createdAt: number;                 // Date.now()
}

interface RecipeIngredient {
  ingredientId: string;              // references Ingredient.id from slist_ingredients
  quantity: number;
}

interface Tag {
  id: string;                        // crypto.randomUUID()
  name: string;
  color: string;                     // CSS color value, e.g. "#f07045" or "coral"
}
```

## Storage Keys

| Key | Contents |
|---|---|
| `slist_recipes` | Array of `Recipe` objects |
| `slist_tags` | Array of `Tag` objects |

## Out of Scope (This Story)

- Add to Week / meal planning integration (AC10 button present but disabled)
- Pantry availability indicator in ingredient rows
- Cooked toggle
- Remove from plan button
