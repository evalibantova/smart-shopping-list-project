# Move persistence from localStorage to a PHP/MySQL backend

## Context
All data (recipes, tags, meal plan, pantry, ingredients DB) lives in browser localStorage behind sync services in `code/src`. The alpha ships frontend-only; a real backend is needed for durable, cross-device data. `docs/BACKEND-STACK.md` already chose Slim v4 + MySQL (PDO/illuminate-database, Phinx migrations applied via phpMyAdmin, vendor/ uploaded by FTP).

## Decisions (confirmed with user)
- **Users:** single shared dataset, no login. Every table carries `user_id` (fixed 1) so accounts can be added later.
- **Existing localStorage data:** discarded. No import path.
- **Gemini key:** stays in browser localStorage (`settingsService` untouched).
- **Client layer:** TanStack Query for server state (as STACK.md planned). Zustand shrinks to UI state (`selectedId`, etc.).
- Shopping list stays computed on the client (`shoppingListSelector`); checked state stays local.

## Backend (`code/public/api/`)
- Slim v4 front controller `public/api/index.php`, Composer deps (`slim/slim`, `php-di`, `illuminate/database`), built locally, `vendor/` uploaded by FTP. `fetch-recipe.php` stays as a standalone script; `public/api/.htaccess` rewrites only non-existing paths to `index.php`.
- Dev: `npm run api` switches to `php -S localhost:8080 -t public public/api/router.php`; the existing Vite `/api` proxy is reused (no CORS middleware needed).
- Resources, JSON REST: `GET/POST/PUT/DELETE` on `/api/recipes`, `/api/tags`, `/api/ingredients`, `/api/pantry` (+ `PUT /api/pantry/batch` for cooked deductions, in one transaction), `/api/meal-plan`. Errors follow the existing `{"error":"<code>"}` convention.
- IDs stay client-generated UUIDs (`CHAR(36)`), so optimistic updates keep stable ids.
- Schema (Phinx): `ingredients`, `tags`, `recipes`, `recipe_tags`, `recipe_ingredients` (no unit column; unit from `ingredients.default_unit`), `pantry_items`, `meal_plan_entries`. All with `user_id`.
- Seed: Phinx seeder reads `cookbookSeed.json` (163 ingredients, 53 recipes), reusing the name→id and tag/emoji logic from `src/data/cookbookImport.ts`. Replaces `importCookbookIfNeeded` and the `slist_cookbook_imported` version flag.

## Frontend (`code/src`)
- Add `@tanstack/react-query`; `QueryClientProvider` in `main.tsx`; remove `importCookbookIfNeeded()`.
- New `src/api/client.ts` (fetch wrapper reusing `timedFetch` from `services/recipeImport/request.ts`, typed errors).
- Per-feature hooks (`useRecipes`, `useTags`, `useIngredients`, `useMealPlan`, `usePantry`) with optimistic mutations, rollback + toast on error (pantry slice's `batchUpdatePantry` is the template), and `SavingIndicator` for in-flight writes.
- Replace the five localStorage services and the recipes/mealPlanner/pantry slices' data; fix the inconsistent "component calls service then store" pairing (`AddEditRecipeModal.tsx`, `features/recipes/index.tsx`, meal-planner modals).
- Ingredients: load once into the query cache; `IngredientAutocomplete` keeps its synchronous `search` over the cached list. Components currently calling `ingredientsDbService` directly (`RecipeDetail`, `AddEditRecipeModal`, pantry, shopping list, `importRecipe.ts`) read from the hook or cache.
- Loading/error states replace the "array empty means not loaded" checks in `AppShell.tsx` and the three feature pages.
- Pure selectors (`cookNowSelector`, `shoppingListSelector`, `calendarUtils`, `search`) unchanged.

## Testing
- PHP: PHPUnit with in-memory SQLite for repositories and handlers; bootstrap gains `vendor/autoload.php` (existing `require_once` tests keep working).
- Frontend: vitest tests rewritten around a mocked `fetch` and a `QueryClient` test wrapper, replacing the localStorage-asserting service/slice tests (`recipeService`, `pantryService`, `mealPlanPersistence`, `cookbookImport`, etc.). Keep the injected-`fetchImpl` style used in `fetchPage.test.ts`.

## Docs to update
`BACKEND-STACK.md` (76 vs 163 seed, no-CORS dev proxy, "no SSH" vs "FTP only"), `ALPHA-DEPLOY.md` (no longer frontend-only; `IMPORT_VERSION` freeze obsolete; DB setup steps), `STACK.md`, `COOKBOOK-IMPORT-WIRING.md` (server-side seed), `AGENTS.md` tree.

## Risks / notes
- Shared host is FTP-only: migrations are generated locally and applied by hand in phpMyAdmin; the Slim app has not yet been run on the host (the PHP check in ALPHA-DEPLOY steps 5-11 is still open).
- This is a large change (~15 consumer files, most data-layer tests). Suggest an implementation plan split into: (1) backend + schema + seed, (2) client hooks + one feature end to end (pantry), (3) remaining features, (4) docs/deploy.
- Working tree has uncommitted import-matching work (`geminiResolve.ts`, etc.); do this on a separate branch/worktree.

## Verification
- `npm run test:php` and `npm test` pass; `npm run lint`.
- Run `npm run api` + `npm run dev`; create/edit/delete a recipe, plan a meal, mark cooked (pantry deducts), reload and confirm persistence; clear localStorage and confirm nothing is lost except the Gemini key.
- Fresh DB: apply Phinx SQL + seed, confirm 163 ingredients / 53 recipes appear.
