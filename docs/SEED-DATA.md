# Default Seed Data

When the app loads on a fresh localStorage (no existing recipes), `seedAppDataIfEmpty()` in `src/data/seedData.ts` populates the app with the following default data so every new session starts with a realistic, fully-functional state.

---

## Tags

| Name | Color |
|---|---|
| Comfort Food | `#FF7043` (deep orange) |
| Vegetarian | `#66BB6A` (green) |
| Quick | `#42A5F5` (blue) |
| Healthy | `#26A69A` (teal) |

---

## Recipes

| Emoji | Name | Servings | Tags | Key Ingredients |
|---|---|---|---|---|
| 🍝 | Spaghetti Bolognese | 4 | Comfort Food | Ground beef 400 g, Pasta 300 g, Onion, Garlic, Canned tomatoes 400 g, Tomato paste, Olive oil |
| 🥗 | Greek Salad | 2 | Vegetarian, Quick | Tomato × 2, Cucumber, Bell pepper, Avocado, Olive oil |
| 🍗 | Garlic Butter Chicken | 4 | Healthy | Chicken breast 600 g, Garlic × 4 cloves, Butter 40 g, Lemon |
| 🍛 | Chickpea Curry | 3 | Vegetarian, Healthy | Chickpeas 400 g, Coconut milk 400 ml, Onion, Garlic, Ginger 10 g, Cumin, Paprika, Canned tomatoes 200 g, Olive oil |
| 🥚 | Scrambled Eggs | 2 | Quick | Eggs × 4, Butter 20 g, Salt 0.5 tsp, Black pepper 0.25 tsp |

All ingredient references use canonical `ingredients_db` IDs resolved at seed time — no freeform strings.

---

## Meal Plan

The meal plan is seeded for the **current week (Mon–Sun)**, calculated dynamically at seed time. Meals before today are marked `cooked: true` to reflect a realistic mid-week state. The example below uses the week of **6–12 Oct 2026** (seeded on Thu 8 Oct).

| Day | Slot | Recipe | Servings | Cooked |
|---|---|---|---|---|
| Mon Oct 5 | Dinner | 🍝 Spaghetti Bolognese | 4 | ✓ |
| Tue Oct 6 | Breakfast | 🥚 Scrambled Eggs | 2 | ✓ |
| Tue Oct 6 | Dinner | 🍛 Chickpea Curry | 3 | — |
| Wed Oct 7 | Lunch | 🍗 Garlic Butter Chicken | 4 | ✓ |
| Thu Oct 8 | Lunch | 🥗 Greek Salad | 2 | — |
| Thu Oct 8 | Dinner | 🍝 Spaghetti Bolognese | 4 | — |
| Fri Oct 9 | Dinner | 🍛 Chickpea Curry | 3 | — |
| Sat Oct 10 | Lunch | 🥗 Greek Salad | 2 | — |
| Sat Oct 10 | Dinner | 🍗 Garlic Butter Chicken | 4 | — |
| Sun Oct 11 | Breakfast | 🥚 Scrambled Eggs | 2 | — |

> Dates shift automatically each time the seed runs on a new week — the relative day offsets (Mon+0 through Sun+6) stay constant.

---

## Implementation Notes

- Guard: `seedAppDataIfEmpty()` is a no-op if `recipeService.getAll().length > 0`.
- Ingredient IDs are resolved by name from the already-seeded `ingredients_db` (populated by `ingredientsDbService.seedIfEmpty()`), so seed order in `main.tsx` matters: ingredients first, then app data.
- Pantry is not seeded — the shopping list will therefore show the full ingredient deficit for all uncooked planned meals.
