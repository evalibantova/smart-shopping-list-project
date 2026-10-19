# Frontend on the backend API (localStorage replaced, shipped to production)

## Context
Plan 1 of the backend work is done and committed on `run/4-superpowers`: a Slim + illuminate/database REST API under `code/public/api/`, a Phinx migration and a cookbook seeder (163 ingredients, 53 recipes). It was verified on in-memory SQLite and, by hand, on MariaDB (migrate, seed, reset, dump, HTTP smoke test on the dev router). The React app still reads and writes localStorage.

This spec covers the rest: the frontend switches to the API, then the app ships to production. It builds on `2026-10-14-backend-persistence-design.md` (the approved spec), whose decisions still hold: single shared dataset with no login, old localStorage data discarded, Gemini key stays in the browser, shopping list stays computed on the client, TanStack Query for server state, Zustand reduced to UI state.

## Slicing: two cycles
Each cycle gets its own plan and subagent-driven run, with a checkpoint between them.

1. **Cycle A — the whole frontend switch** (plan `2026-10-19-frontend-on-backend.md`): dev environment fix, API client and app gate, then ingredients, tags, recipes, pantry, meal plan, import and cook-now, then deletion of the localStorage services. Tasks are ordered so unit tests stay green after each one.
2. **Cycle B — docs and production deploy**.

Why not pantry first (the original three-cycle split): the cookbook import creates local ingredients with random UUIDs and the seeded recipes point at those ids, while the server seeder generates its own ids. A server-side pantry only makes sense with server ingredient ids, so with recipes still local the shopping list, cook-now and the cooked deduction would silently mismatch. Every cross-feature view needs ingredients, recipes, pantry and meal plan together, so the resources must move as one. The app is therefore only coherent in manual use at the end of cycle A.

## Decisions made while brainstorming
- **Loading and errors:** one app-level gate (see below), no per-page loading states, no persisted offline cache.
- **Writes:** hybrid. Optimistic with rollback for quick independent edits, awaited for creates other data depends on and for deliberate saves.
- **Dev API:** PHP installed from apt in the devcontainer (not a compose api service, not a docker-run wrapper).

## Client architecture

### Layers
- `src/api/client.ts` — thin `fetch` wrapper. Reuses `timedFetch` from `services/recipeImport/request.ts`. Sends and parses JSON against the relative path `/api/...` (Vite proxy in dev, same origin in production). Throws a typed `ApiError` carrying the HTTP status and the server's `{"error": code}`.
- `src/api/` resource hooks — `useRecipes`, `useTags`, `useIngredients`, `usePantry`, `useMealPlan`. Each owns the queries and mutations of one resource. One flat query key per resource.
- Zustand keeps UI state only (`selectedId` and other transient selections). `recipes`, `tags`, `entries`, `pantryItems` and all `init*` actions leave the store. The five localStorage services are deleted in cycle A.
- Unchanged: pure selectors (`cookNowSelector`, `shoppingListSelector`, `calendarUtils`, `search`), `settingsService`, the shopping list's local checked state.

### Loading and errors (app-level gate)
`AppShell` renders its children only after the five queries have loaded. Until then it shows one loader. If any query fails it shows one full-screen "can't reach the server" panel with a Retry button. Pages and modals keep assuming their data exists, so the "empty array means not loaded" checks in `AppShell` and the feature pages are removed. Later refetches are silent.

### Write policy
- **Optimistic, rolled back with a toast on failure:** pantry quantity and delete, mark-cooked deductions through `PUT /api/pantry/batch`, meal-plan add, move, remove and cooked toggle. The existing `batchUpdatePantry` in `pantrySlice.ts` is the template. `SavingIndicator` shows while a write is in flight.
- **Awaited before the UI updates:** creating an ingredient (the autocomplete shows a short spinner and returns the saved entry), creating a tag, recipe save and delete, import. A recipe save runs only after any new ingredient or tag it needs has been created. This avoids foreign-key races without a write queue.
- **Error mapping:** a 409 on a recipe save means "something it references no longer exists". A 409 on a tag or ingredient create means that name already exists. A 422 shows the validation message. A network failure shows the generic save error.

### Ingredients, import and the cookbook
- `IngredientAutocomplete` keeps its synchronous `search`, now over the cached ingredient list.
- `importRecipe.ts`, `RecipeDetail`, `AddEditRecipeModal`, the pantry page and the shopping list read the same cached list instead of `ingredientsDbService.getAll()`.
- `importCookbookIfNeeded()` in `main.tsx`, `src/data/cookbookImport.ts` and the `slist_cookbook_imported` flag are deleted: the server seeds the data. `cookbookSeed.json` stays as the single source for the PHP seeder.
- The Gemini key stays in `settingsService` (localStorage).

## Dev environment (first task of cycle A)
The devcontainer's hand-built `pdo_mysql` cannot log in to MariaDB or MySQL (`Bad handshake`, with MySQL 8.4 and MariaDB 11 both). Fix by installing PHP from apt in the devcontainer: `php-cli`, `php-mysql`, `php-mbstring`, `php-xml`, `php-curl`, `php-sqlite3`, `unzip`, `mariadb-client`. Remove the `pdo_mysql` build from `.devcontainer/post-create.sh` and keep the PHPUnit phar download. Keep the `db` service (MariaDB 11). `npm run api` stays `php -S localhost:8080 -t public public/api/router.php`.
This changes the base devcontainer and needs a container rebuild by the user, so it is the first step of cycle A and gates the rest. If the rebuild is not possible, the fallback is the throwaway `php:8.4-cli + pdo_mysql` image used so far.

## Testing
- Hooks and `ApiError`: vitest with a mocked `fetch`, using the injected-`fetchImpl` style from `fetchPage.test.ts`.
- Components: a fresh `QueryClient` per test wrapper; the API module mocked where a component test should not touch hooks.
- The localStorage-asserting tests are replaced, not ported: `recipeService`, `pantryService`, `mealPlanService`, `mealPlanPersistence`, `ingredientsDbService`, `cookbookImport`, and the slice tests that assert service calls.
- Kept as they are: selector tests (`cookNowSelector`, `shoppingListSelector`, `calendarUtils`, `recipesFilter`) and the import-parsing tests.
- Cycle A ends with a manual check: `npm run api` plus `npm run dev`, create, edit and delete each resource, reload, confirm persistence, and confirm cooked deductions hit the pantry.
- Gates: `npm test`, `npm run lint`, `npm run test:php`.

## Production (cycle B)
- Hosting prerequisites: (sub)domain, HTTPS, mod_rewrite and AllowOverride, FTP details; `host-check.php` for PHP >= 8.1 and the extensions (pdo_mysql, mbstring, curl, dom, iconv); verify `public/api/.htaccess` on real Apache.
- Build: `composer install --no-dev --optimize-autoloader` in `public/api`, then `npm run build` so `vendor/` ships inside `dist/api/`.
- Database: apply `schema.sql` (from `npm run api:sql`, which includes the seed) through phpMyAdmin; create `config.local.php` on the host from the example.
- Parked backend items to fix before the production cut: a bound and finiteness check on `delta` in `PantryRepository::adjust`; byte-based limits for `Input::text`; lowercase UUIDs on input; the `Allow` header on 405.
- Docs: update `BACKEND-STACK.md`, `ALPHA-DEPLOY.md` (no longer frontend-only; the `IMPORT_VERSION` freeze is obsolete; add DB setup steps), `STACK.md`, `COOKBOOK-IMPORT-WIRING.md` and the `AGENTS.md` tree. Note that `composer install` must run before `npm run test:php`.
- Release record: tag `alpha-0.1` after the live smoke test.

## Out of scope
Accounts and login, importing old localStorage data, offline mode or a persisted query cache, moving the Gemini key to the server, a server-side shopping list or checked state, real-time sync between devices.

## Risks
- The host PHP version, extensions and `.htaccess` behaviour are unverified until cycle B. A failed host check could force changes to the API code.
- The apt PHP in the devcontainer is untested until the user rebuilds the container.
- Unknown foreign ids on a recipe or meal-plan write return 409, not 422. The client has to map that deliberately.
- The cascade from recipe delete to meal-plan entries is silent, so the delete confirmation should say so. This is a design choice from plan 1, not a bug.
