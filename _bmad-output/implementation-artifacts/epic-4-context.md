# Epic 4 Context: Cook Now

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 4 completes the active-cooking loop: the Cook Now page surfaces all of today's planned meals alongside a real-time ingredient availability status derived from pantry stock. Users can filter by readiness, drill into a full ingredient checklist, and mark a meal as cooked directly from this page — triggering the same pantry deduction path established in Epic 3. This makes the transition from planning to actually cooking frictionless.

## Stories

- Story 4.1: Today's Meals & Availability
- Story 4.2: Cook Now Filters & Recipe Detail

## Requirements & Constraints

- Show every meal plan entry whose `date` matches today, regardless of cooked state.
- Compute each meal's availability by comparing pantry stock against recipe ingredients scaled to planned servings. Three tiers: Ready (all ingredients meet quantity), Almost (some missing), Far (many missing).
- Filter tabs (All / Ready / Almost) narrow the visible card list; an appropriate empty state appears when no meals match the active filter.
- RecipeDetail opened from Cook Now must show per-ingredient availability indicators (✓ coral / ✗ red) and have the cooked toggle fully wired — marks cooked and deducts pantry atomically, using the same rollback logic from Story 3.2.
- All mutations are optimistic: store updates immediately, rolls back with a toast on error.
- Mobile-first layout at ~375 px; desktop layout unlocks at 768 px.
- Empty state required when no meals are planned for today.

## Technical Decisions

- Feature lives in `src/features/cook-now/` (AD-1). No direct cross-feature imports; state is read from Zustand slices.
- All data reads go through the service layer (AD-2); the feature never touches localStorage or fetch directly.
- Meal plan entries are shaped as `{ id, date: "YYYY-MM-DD", slot: "breakfast"|"lunch"|"dinner", recipeId, servings }`. Filter today's entries by matching `date` to the current date string.
- Availability computation is derived in-component (or as a selector): for each meal entry, iterate recipe ingredients scaled by `entry.servings / recipe.servings`, compare against pantry quantities by `ingredientId`. No new stored state is introduced.
- The cooked toggle in Cook Now invokes the same atomic cook → pantry deduction flow from Story 3.2 (all pantry changes and the cooked flag roll back together on any failure).
- RecipeDetail in Cook Now context is the shared component from `src/components/shared/`. The context determines which action buttons appear: Edit, Add to Week, and a fully wired cooked toggle — distinct from the Recipes and Meal Planner configurations.
- Optimistic mutation pattern (AD-10): update Zustand immediately → call service → on error roll back store and show toast.

## UX & Interaction Patterns

- Availability tiers drive card visual treatment:
  - Ready → coral glow, coral ● badge, "Cook it" button (charcoal)
  - Almost → amber glow, amber "N missing" badge, "Cook anyway" button (amber, outline style)
  - Far → reduced opacity, red missing-count badge
- Tapping "Cook it" or "Cook anyway" opens the RecipeDetail modal in Cook Now context.
- FilterTab pills (UX-DR8): pill row, active tab coral background + white text. Three tabs: All (default), Ready, Almost.
- RecipeDetail ingredient rows each show ✓ (coral) or ✗ (red) against the scaled-to-servings quantity.
- After marking a Cook Now meal as cooked, the card on the page reflects the updated cooked state; availability indicators recompute against the updated pantry.

## Cross-Story Dependencies

- Story 4.2 depends on Story 4.1: the card list and availability computation must exist before the filter layer and RecipeDetail integration are built.
- Both stories depend on Epic 3's pantry deduction logic (Story 3.2): the cooked toggle's atomic deduction/rollback is reused from the shared service and store layer — no new deduction logic is needed.
- RecipeDetail was built in Epic 1 and extended in Epic 2; Cook Now is its third context and requires a new context-aware action button configuration — no new modal component is needed.
