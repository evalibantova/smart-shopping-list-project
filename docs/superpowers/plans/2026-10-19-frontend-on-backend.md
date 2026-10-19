# Frontend on the Backend API (cycle A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the React app in `code/` off localStorage and onto the REST API that already exists in `code/public/api` (ingredients, tags, recipes, pantry, meal plan, import, cook-now), and fix the devcontainer so the API can run locally.

**Architecture:** TanStack Query owns server state. Five query-option modules in `src/api/` (one flat query key per resource) feed pure arrays to the existing pure selectors; mutations are optimistic with rollback plus a global toast (pantry, meal plan, cooked) or awaited with inline errors (create ingredient/tag, recipe save/delete). Zustand keeps UI state only (`selectedId`, the toast message). `AppShell` is a gate: it renders the pages only after the five lists have loaded, shows one loader meanwhile and one "can't reach the server" panel with Retry if a list fails. The old localStorage services and slices stay alive while consumers are switched feature by feature, and are deleted in the last task.

**Tech Stack:** React 19, Vite, TypeScript (strict), Zustand 5, `@tanstack/react-query` v5 (new), vitest 3 + jsdom (no Testing Library is installed: component tests use `createRoot` + `act`, wrapped by a helper), PHP 8.x from apt in the devcontainer (Slim + MariaDB backend, already built and not changed here).

**Spec:** `docs/superpowers/specs/2026-10-19-frontend-on-backend-design.md` (authoritative). It builds on `docs/superpowers/specs/2026-10-14-backend-persistence-design.md`. JSON shapes, routes and error codes come from `docs/superpowers/plans/2026-10-14-backend-api.md` (plan 1, done) and were re-verified against `code/public/api/src` (see the table below).

## Global Constraints

- React 19 and TypeScript strict. `code/tsconfig.app.json` has `strict`, `noUnusedLocals`, `noUnusedParameters`: an unused import or variable is a type error, so every edit that removes the last use of an import must remove the import.
- Commands (all from `/data/shopping-list/code`):
  - Tests: `npx vitest run <test files>` (`npm test` is `vitest` in watch mode, do not use it). Each task names its files. In this container the jsdom start-up costs about 40 s, so run only the named files per step, and for the full run use `timeout 600 npx vitest run > /tmp/vitest-full.txt 2>&1; tail -30 /tmp/vitest-full.txt` (give the shell tool a 10 minute timeout).
  - Lint: `npm run lint` (`eslint src`). Baseline before this plan: 0 errors, 5 warnings (react-refresh warnings). A task must not add errors; new warnings of the same react-refresh kind are tolerated.
  - Type-check: `npx tsc --noEmit -p tsconfig.app.json` (baseline exit code 0; this is the config `npm run build`'s `tsc -b` uses for `src`).
  - Gate after every task that touches `src`: the named vitest files, `npm run lint`, the type-check. From Task 3 on also run the files of earlier tasks listed in that task's "Regression files".
- Do not edit anything under `design-v1/` (reference screenshots only). `design-v2/` is reference only too; the live implementation and `docs/DESIGN.md` are the source of truth.
- The backend is done and verified: do not change anything under `code/public/api/`. If a task finds a backend change is truly needed, stop and report it as a flagged exception instead of editing PHP.
- `settingsService` (Gemini key, `slist_gemini_key`) stays in localStorage and is not touched. The shopping list's checked state stays local React state.
- Pure selectors stay unchanged: `features/cook-now/cookNowSelector.ts`, `features/shopping-list/shoppingListSelector.ts`, `features/meal-planner/utils/calendarUtils.ts`, `features/cook-now/utils/cookNowUtils.ts`, `utils/search.ts`. Hooks only feed them arrays. (Task 10 edits two selector TEST files, only to drop a dead `vi.mock`.)
- Cycle B (production deploy, host checks, doc rewrites of `BACKEND-STACK.md`, `ALPHA-DEPLOY.md`, `STACK.md`, `COOKBOOK-IMPORT-WIRING.md`, `AGENTS.md` tree) is a separate later plan. Do not write it here. Deleting the localStorage services and `cookbookImport` IS part of this plan (Task 10); `src/data/cookbookSeed.json` and the CSV files stay (the PHP seeder reads them).
- Backend facts the client must respect (verified in `code/public/api/src`):
  - Routes: `GET|POST /api/{recipes,tags,ingredients,pantry,meal-plan}`, `PUT|DELETE /api/<res>/{id}`, `PUT /api/pantry/batch` with `{"deltas":[{"ingredientId","delta"}]}` returning the changed items. POST returns 201 with the object, DELETE returns 204 with no body. Errors are `{"error":"<code>"}`: `invalid` 422, `not_found` 404, `bad_method` 405, `conflict` 409, `server_error` 500. An unknown foreign id (recipe to a missing ingredient/tag, meal plan to a missing recipe) and a duplicate name are both 409, never 422.
  - `ingredients` use `default_unit` (snake_case), units limited to `g ml kg l pcs cloves tbsp tsp`; names unique per user, case-sensitive (utf8mb4_bin); `tags` names unique too. `pantry_items` has `UNIQUE (user_id, ingredient_id)`. Ids may be client-supplied UUIDs (`id` in the body, validated as a UUID) or omitted. `recipe.createdAt` is set by the server on create and never changes on update. Deleting a recipe silently cascades to its meal-plan entries. Deleting an ingredient or tag that is still referenced is a 409.
  - Input limits: servings integer 1..1,000,000; text up to 20,000 chars; names 60/120/200 chars; numbers 0..1e9 (`Input.php`). The client does not enforce them beyond what it already does; a 422 is shown as a generic validation message.
- Commit hygiene: the repo has unrelated files in the working tree. Stage only the files named in the task (`git add <paths>`, never `git add -A` or `git add .`), commit path-limited (`git commit -m "<msg>" -- <paths>`), conventional-commit style messages as in the history, no trailer lines.
- Shell hooks in this environment block recursive forced deletion, `git clean` with force, and any command containing the literal path fragment made of a slash followed by the three letters v, a, r. Delete tracked files with `git rm <path>`, never with a recursive forced remove, and keep that path fragment out of every command, heredoc and commit message.
- Frontend conventions to follow: inline styles with the CSS variables of `docs/DESIGN.md`, `Button`/`IconButton`/`Modal` from `components/ui`, no new CSS framework. All API calls use the relative path `/api/...` (Vite proxies it to `localhost:8080` in dev).
- The app is only coherent in manual use after Task 9 (the resources move together; consumers are switched feature by feature while the old localStorage slices still exist). Unit tests stay green after every task because each task switches a coherent set of consumers together with their tests.

## Verified backend contract (source of truth for the hooks)

| Resource | Cached list type | Create body | Update body | Notes |
|---|---|---|---|---|
| `/api/ingredients` | `IngredientDbEntry[]` | `{id?, name, default_unit, category}` | any subset | 409 on duplicate name |
| `/api/tags` | `Tag[]` | `{id?, name, color}` | any subset | 409 on duplicate name |
| `/api/recipes` | `Recipe[]` | `{id?, emoji, name, servings, notes?, tagIds?, ingredients?}` | any subset (`tagIds`/`ingredients` replace the list) | 409 on unknown tag/ingredient id; `createdAt` ignored |
| `/api/pantry` | `PantryItem[]` | `{id?, ingredientId, quantity, maxStock?}` | any subset | 409 on duplicate ingredient |
| `/api/pantry/batch` | returns `PantryItem[]` (changed only) | `{deltas:[{ingredientId, delta}]}` | | applies sequentially, clamps at 0, skips unknown ingredients |
| `/api/meal-plan` | `MealPlanEntry[]` | `{id?, date, slot, recipeId, servings, cooked?}` | any subset | 409 on unknown recipe; response always has `cooked: boolean` |

## File Structure

All paths relative to `/data/shopping-list/code` unless they start with `.devcontainer`.

Create:

| File | Responsibility |
|---|---|
| `src/api/client.ts` | `ApiError`, `request()` (JSON over `timedFetch`), `api.get/post/put/delete`, `messageForError()` |
| `src/api/queryKeys.ts` | one flat key per resource |
| `src/api/queryClient.ts` | `makeQueryClient()` used by `main.tsx` |
| `src/api/optimistic.ts` | `optimisticUpdate()` (cache edit + restore function), `failOptimistic()` (restore, refetch, toast) |
| `src/api/ingredients.ts`, `tags.ts`, `recipes.ts`, `pantry.ts`, `mealPlan.ts`, `cooking.ts` | query options + hooks of one resource each (`cooking.ts` is the cooked toggle that touches meal plan and pantry) |
| `src/utils/ingredientSearch.ts` | `searchIngredients(list, query)` synchronous search over the cached list |
| `src/utils/pantryDeltas.ts` | `applyPantryDeltas(items, deltas)` pure, mirrors the server batch |
| `src/store/toastStore.ts` | Zustand store for the global toast message |
| `src/components/ui/ToastHost.tsx` | renders the global toast |
| `src/components/shared/ServerGate.tsx` | `GateLoader`, `ServerErrorPanel` for the AppShell gate |
| `src/test/seed.ts`, `fixtures.ts`, `fetchMock.ts`, `renderWithClient.tsx` | shared test helpers |
| `src/__tests__/*.test.ts(x)` | new and rewritten tests, named in each task |

Modify: `AppShell.tsx`, `main.tsx`, `components/shared/{IngredientAutocomplete,RecipeDetail,AddToWeekModal}.tsx`, `features/recipes/{AddEditRecipeModal,ImportRecipeModal,index}.tsx`, `services/recipeImport/importRecipe.ts`, `features/meal-planner/{index,RecipePickerModal,MealPlanOverlay}.tsx`, `features/pantry/index.tsx`, `features/cook-now/index.tsx`, `features/shopping-list/index.tsx`, `store/index.ts`, `package.json`, `package-lock.json`, `.devcontainer/*`.

Delete (Task 10): the five localStorage services, `data/cookbookImport.ts`, the three data slices, `features/meal-planner/AddToWeekModal.tsx` (an unused duplicate, deleted in Task 7), and their tests.

## Task order

1. Devcontainer: apt PHP, no hand-built pdo_mysql
2. API client, query client, test helpers
3. Ingredients, tags and recipes API modules
4. Pantry, meal plan and cooking API modules, optimistic helper, toast store
5. Recipe editing UI: IngredientAutocomplete, RecipeDetail, AddEditRecipeModal
6. Recipes page (delete confirmation) and import
7. Meal planner and AddToWeekModal
8. Pantry page, Cook Now, Shopping List
9. AppShell gate, global toast and saving indicator, `main.tsx`
10. Delete the localStorage code, shrink Zustand, final sweep and manual E2E checklist

---

### Task 1: Devcontainer: apt PHP, no hand-built pdo_mysql

The devcontainer's hand-built `pdo_mysql` cannot log in to MariaDB ("Bad handshake"). Replace the `php` devcontainer feature and the source build in `post-create.sh` with PHP from apt, installed by a small Dockerfile layered on the existing base image.

**THE EXECUTOR CANNOT VERIFY THIS TASK.** It changes the base container, which only the user can rebuild, and the executor cannot drive that from inside the container. The executor makes the file changes, runs the static checks in Step 6, commits, and then hands the "Rebuild checklist" (Step 8) to the user. Nothing in Tasks 2 to 9 needs a running API: every frontend test mocks `fetch`. Only the manual check in Task 10 needs the API.

**Files:**
- Create: `.devcontainer/Dockerfile`
- Modify: `.devcontainer/devcontainer.json`
- Modify: `.devcontainer/devcontainer-lock.json`
- Modify: `.devcontainer/docker-compose.yml`
- Modify: `.devcontainer/post-create.sh`

**Interfaces:**
- Consumes: nothing.
- Produces: a container where `php -m` lists `pdo_mysql`, `composer` and `mariadb-dump` exist, and the compose `db` service (`mariadb:11`, user, password and database all `meal_planner`, reachable at `127.0.0.1:3306` through the shared network) is unchanged. `npm run api` stays `php -S localhost:8080 -t public public/api/router.php`.

Assumptions to flag to the user: the base image is Debian-based with apt and a `root` user available at build time (the old `php` feature needed Debian/Ubuntu too); `composer` is added to the apt list because removing the php feature also removes its `installComposer` step; PHP from apt must be 8.2 or newer because the downloaded `phpunit-11.phar` requires it (Debian 12 gives 8.2, Ubuntu 22.04 gives 8.1 and would not work).

- [ ] **Step 1: Remove the php feature from `.devcontainer/devcontainer.json`**

Replace the `features` block. Before:

```json
  "features": {
    "ghcr.io/devcontainers/features/php:1": {
      "version": "8.4",
      "installComposer": true
    },
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "moby": false
    }
  },
```

After:

```json
  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "moby": false
    }
  },
```

- [ ] **Step 2: Remove the php entry from `.devcontainer/devcontainer-lock.json`**

Replace the whole file with:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "version": "1.10.1",
      "resolved": "ghcr.io/devcontainers/features/docker-outside-of-docker@sha256:698f5900fac471e046c6e9d4333fec88c0e8d952c713494fa0712dce80baeca0",
      "integrity": "sha256:698f5900fac471e046c6e9d4333fec88c0e8d952c713494fa0712dce80baeca0"
    }
  }
}
```

- [ ] **Step 3: Create `.devcontainer/Dockerfile`**

```dockerfile
# Layers PHP on the Claude Code base image. PHP comes from apt: the devcontainer php feature builds PHP
# without pdo_mysql, and a hand-built pdo_mysql could not log in to MariaDB ("Bad handshake").
ARG BASE_IMAGE
FROM ${BASE_IMAGE}

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    php-cli php-mysql php-mbstring php-xml php-curl php-sqlite3 unzip mariadb-client composer \
 && apt-get clean
USER claude-user
```

- [ ] **Step 4: Point the compose `app` service at the Dockerfile**

In `.devcontainer/docker-compose.yml`, replace the `image:` line of the `app` service. Before:

```yaml
  app:
    image: registry.gitlab.tech.orange/unified-cloud-p/technology-office/ia-support/container/claude-code
```

After:

```yaml
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        BASE_IMAGE: registry.gitlab.tech.orange/unified-cloud-p/technology-office/ia-support/container/claude-code
    # Local tag of the built image (must differ from BASE_IMAGE, which the Dockerfile starts FROM).
    image: shopping-list-app:local
```

Also update the stale comment of the `db` service. Before:

```yaml
    # MariaDB, not MySQL 8.4: the php feature's hand-built mysqlnd cannot complete the MySQL 8.4
    # handshake ("Bad handshake"), and MariaDB uses mysql_native_password by default.
```

After:

```yaml
    # MariaDB: matches the common shared-hosting database and uses mysql_native_password by default.
```

- [ ] **Step 5: Rewrite `.devcontainer/post-create.sh`**

Replace the whole file with:

```bash
#!/usr/bin/env bash
# Runs once after the devcontainer is created. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")/../code"

# PHPUnit (no Composer for the test runner, see docs/STACK.md)
[ -f phpunit.phar ] || curl -sSL https://phar.phpunit.de/phpunit-11.phar -o phpunit.phar

# PHP and pdo_mysql come from apt (see .devcontainer/Dockerfile). Fail loudly when the container
# was not rebuilt from it.
if ! php -m | grep -qx pdo_mysql; then
  echo "pdo_mysql is missing: rebuild the devcontainer so .devcontainer/Dockerfile is applied." >&2
  exit 1
fi
php -m | grep -x pdo_mysql
```

- [ ] **Step 6: Static checks (the only checks the executor can run)**

Run from `/data/shopping-list`:

```bash
node -e "for (const f of ['.devcontainer/devcontainer.json', '.devcontainer/devcontainer-lock.json']) JSON.parse(require('fs').readFileSync(f, 'utf8')); console.log('json ok')"
bash -n .devcontainer/post-create.sh && echo "sh ok"
```

Expected: `json ok` and `sh ok`. Optionally, if the docker CLI answers: `docker compose -f .devcontainer/docker-compose.yml config -q` (no output means valid). If it does not work in this container, skip it.

- [ ] **Step 7: Commit**

```bash
git add .devcontainer/Dockerfile .devcontainer/devcontainer.json .devcontainer/devcontainer-lock.json .devcontainer/docker-compose.yml .devcontainer/post-create.sh
git commit -m "chore(devcontainer): install PHP from apt instead of building pdo_mysql" -- .devcontainer/Dockerfile .devcontainer/devcontainer.json .devcontainer/devcontainer-lock.json .devcontainer/docker-compose.yml .devcontainer/post-create.sh
```

- [ ] **Step 8: Hand the rebuild checklist to the user (NOT verifiable by the executor until the user rebuilds the container)**

Report this checklist in the task result and continue with Task 2. In the REBUILT container the user runs, from `/data/shopping-list/code`:

1. `php -v` shows 8.2 or newer; `php -m | grep -E "pdo_mysql|mbstring|curl|dom|pdo_sqlite"` lists all five; `composer --version` and `mariadb-dump --version` work.
2. `bash ../.devcontainer/post-create.sh` ends by printing `pdo_mysql`.
3. `npm run api:install` (composer install; only needed if `public/api/vendor` is missing), then `npm run api:migrate && npm run api:seed`. Expect the migration to apply and the seeder to finish without "Bad handshake".
4. `mariadb -h127.0.0.1 -umeal_planner -pmeal_planner meal_planner -e "select count(*) from recipes; select count(*) from ingredients"` prints 53 and 163.
5. `npm run api` (leave it running), then in another terminal `curl -s localhost:8080/api/ingredients | head -c 200` prints a JSON array with `default_unit` keys, and `curl -s -o /dev/null -w "%{http_code}\n" localhost:8080/api/nope` prints 404.
6. `npm run test:php` passes.

Documented fallback if the rebuild is not possible: use a throwaway PHP image on the db container's network namespace. Build it once with `docker build -t php-mysql-throwaway -` and this Dockerfile on stdin: `FROM php:8.4-cli`, `RUN docker-php-ext-install pdo_mysql`. Then run PHP commands with `docker run --rm --network container:shopping-list-db-1 -v <host path of the repo root>:/data/shopping-list -w /data/shopping-list/code php-mysql-throwaway php public/api/vendor/bin/phinx migrate -c public/api/phinx.php` (use the `seed:run` subcommand for the seeder). To serve the API, run the same image with `php -S localhost:8080 -t public public/api/router.php`: because it shares the db container's network namespace, `localhost:8080` is also reachable from the app container, so `npm run dev` and its Vite proxy still work. `<host path of the repo root>` must be the path on the Docker host (docker-outside-of-docker resolves bind mounts there).

---

### Task 2: API client, query client, test helpers

**Files:**
- Modify: `package.json`, `package-lock.json` (add `@tanstack/react-query`)
- Create: `src/api/client.ts`, `src/api/queryKeys.ts`, `src/api/queryClient.ts`
- Create: `src/test/seed.ts`, `src/test/fixtures.ts`, `src/test/fetchMock.ts`, `src/test/renderWithClient.tsx`
- Test: `src/__tests__/apiClient.test.ts`, `src/__tests__/testHelpers.test.tsx`

**Interfaces:**
- Consumes: `timedFetch(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number, userSignal?: AbortSignal): Promise<Response>` and `ImportError` (with `.code`: `'network' | 'timeout' | 'aborted' | ...`) from `src/services/recipeImport/request.ts` and `types.ts`.
- Produces (exact signatures, used by every later task):
  - `class ApiError extends Error { readonly status: number; readonly code: string; constructor(status: number, code: string) }` (`status` 0 = no HTTP response; `code` is the server code or `'network' | 'timeout' | 'aborted' | 'bad_response' | 'server_error'`).
  - `interface RequestOptions { fetchImpl?: typeof fetch; signal?: AbortSignal }`
  - `request<T = void>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, opts?: RequestOptions): Promise<T>` (path without the `/api` prefix, for example `'/pantry/batch'`; returns `undefined` for 204)
  - `api.get<T>(path, opts?)`, `api.post<T>(path, body, opts?)`, `api.put<T>(path, body, opts?)`, `api.delete<T = void>(path, opts?)`
  - `type WriteKind = 'generic' | 'recipe' | 'tag' | 'ingredient' | 'delete'`
  - `messageForError(err: unknown, kind?: WriteKind): string`
  - `queryKeys = { recipes: ['recipes'], tags: ['tags'], ingredients: ['ingredients'], pantry: ['pantry'], mealPlan: ['meal-plan'] } as const`
  - `makeQueryClient(): QueryClient`
  - Test helpers: `Seed`, `seedClient(client, seed)`; fixtures `FLOUR, MILK, TAG_BREAKFAST, PANCAKES, PANTRY_FLOUR, PANTRY_MILK, ENTRY_PANCAKES`; `jsonResponse(body, status?)`, `emptyResponse(status?)`, `errorResponse(status, code)`, `installFetch(handler)`, `installApi({ seed?, handler? })` (returns `{ calls, impl, find(method, path) }`), `gate()`; `makeTestClient(seed?: Seed | null)`, `renderWithClient(ui, { seed?, client? })`, `renderHookWithClient(hook, opts?)`, `waitFor(assertion, timeoutMs?)`, `typeInto(el, value)`.

- [ ] **Step 1: Install the dependency**

Run: `cd /data/shopping-list/code && npm install @tanstack/react-query`
Then verify: `node -e "console.log(require('@tanstack/react-query/package.json').version)"`
Expected: a 5.x version, and `package.json` lists `"@tanstack/react-query": "^5..."` under `dependencies`.

- [ ] **Step 2: Write the failing client test**

Create `src/__tests__/apiClient.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiError, api, messageForError, request } from '../api/client'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('request', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('GETs /api<path> and parses the JSON body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json([{ id: 'a' }]))
    expect(await request('GET', '/ingredients', undefined, { fetchImpl })).toEqual([{ id: 'a' }])
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/ingredients')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
  })

  it('sends a JSON body with a JSON content type', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ id: 'x' }, 201))
    await request('POST', '/tags', { name: 'Soup', color: '#fff' }, { fetchImpl })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"name":"Soup","color":"#fff"}')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('returns undefined for a 204 answer', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    expect(await request('DELETE', '/recipes/r1', undefined, { fetchImpl })).toBeUndefined()
  })

  it.each([
    [409, 'conflict'],
    [422, 'invalid'],
    [404, 'not_found'],
    [500, 'server_error'],
  ])('maps a %i answer with {error:"%s"} to an ApiError', async (status, code) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ error: code }, status))
    await expect(request('GET', '/x', undefined, { fetchImpl })).rejects.toMatchObject({ status, code })
  })

  it('falls back to server_error when the error body is not JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502 }))
    const err = await request('GET', '/x', undefined, { fetchImpl }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 502, code: 'server_error' })
  })

  it('treats a successful answer that is not JSON as bad_response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('hello', { status: 200 }))
    await expect(request('GET', '/x', undefined, { fetchImpl })).rejects.toMatchObject({ status: 200, code: 'bad_response' })
  })

  it('turns a network failure into ApiError(0, "network")', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(request('GET', '/x', undefined, { fetchImpl })).rejects.toMatchObject({ status: 0, code: 'network' })
  })

  it('turns a timeout into ApiError(0, "timeout")', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const outcome = expect(request('GET', '/x', undefined, { fetchImpl })).rejects.toMatchObject({ status: 0, code: 'timeout' })
    await vi.advanceTimersByTimeAsync(15_000)
    await outcome
  })
})

describe('api helpers', () => {
  it('use the right verb and body', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json({ ok: true }))
    await api.get('/a', { fetchImpl })
    await api.post('/b', { n: 1 }, { fetchImpl })
    await api.put('/c', { n: 2 }, { fetchImpl })
    await api.delete('/d', { fetchImpl })
    expect(fetchImpl.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      'GET /api/a',
      'POST /api/b',
      'PUT /api/c',
      'DELETE /api/d',
    ])
    expect(fetchImpl.mock.calls[1][1]?.body).toBe('{"n":1}')
    expect(fetchImpl.mock.calls[2][1]?.body).toBe('{"n":2}')
  })
})

describe('messageForError', () => {
  it('409 on a recipe save means something it references is gone', () => {
    expect(messageForError(new ApiError(409, 'conflict'), 'recipe')).toBe(
      'Something this recipe uses no longer exists. Reload the page and try again.',
    )
  })
  it('409 on tag and ingredient creation means the name exists', () => {
    expect(messageForError(new ApiError(409, 'conflict'), 'tag')).toBe('A tag with that name already exists.')
    expect(messageForError(new ApiError(409, 'conflict'), 'ingredient')).toBe('An ingredient with that name already exists.')
  })
  it('422 is a validation message', () => {
    expect(messageForError(new ApiError(422, 'invalid'), 'recipe')).toContain('rejected')
  })
  it('a network failure or anything else is the generic save error', () => {
    expect(messageForError(new ApiError(0, 'network'), 'recipe')).toBe('Could not save — please try again.')
    expect(messageForError(new Error('boom'))).toBe('Could not save — please try again.')
    expect(messageForError(new ApiError(409, 'conflict'))).toBe('Could not save — please try again.')
  })
  it('a delete has its own wording', () => {
    expect(messageForError(new ApiError(500, 'server_error'), 'delete')).toBe('Could not delete — please try again.')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/apiClient.test.ts`
Expected: FAIL, "Failed to resolve import ../api/client".

- [ ] **Step 4: Implement `src/api/client.ts`**

```ts
import { timedFetch } from '../services/recipeImport/request'
import { ImportError } from '../services/recipeImport/types'

const BASE_PATH = '/api'
const TIMEOUT_MS = 15_000

/** A failed API call. `status` is 0 when no HTTP response arrived (network down, timeout, aborted). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(`API error ${status}: ${code}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface RequestOptions {
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

// Looked up at call time, so a test can stub the global fetch after this module was imported.
const defaultFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)

/** JSON request against `/api<path>`. Resolves with the parsed body (undefined for 204) or throws an ApiError. */
export async function request<T = void>(
  method: Method,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const init: RequestInit = { method, headers }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await timedFetch(opts.fetchImpl ?? defaultFetch, BASE_PATH + path, init, TIMEOUT_MS, opts.signal)
  } catch (err) {
    if (err instanceof ImportError) throw new ApiError(0, err.code)
    throw err
  }

  if (res.status === 204) return undefined as T

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const code = (data as { error?: unknown } | null)?.error
    throw new ApiError(res.status, typeof code === 'string' ? code : 'server_error')
  }
  if (data === null) throw new ApiError(res.status, 'bad_response')
  return data as T
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, body, opts),
  put: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PUT', path, body, opts),
  delete: <T = void>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),
}

/** What the failing write was, so a 409 can be explained. */
export type WriteKind = 'generic' | 'recipe' | 'tag' | 'ingredient' | 'delete'

/** The user-facing sentence for a failed write. */
export function messageForError(err: unknown, kind: WriteKind = 'generic'): string {
  if (kind === 'delete') return 'Could not delete — please try again.'
  if (err instanceof ApiError) {
    if (err.status === 409 && kind === 'recipe') {
      return 'Something this recipe uses no longer exists. Reload the page and try again.'
    }
    if (err.status === 409 && kind === 'tag') return 'A tag with that name already exists.'
    if (err.status === 409 && kind === 'ingredient') return 'An ingredient with that name already exists.'
    if (err.status === 422) {
      return 'The server rejected something you entered (empty, invalid or too large). Check it and try again.'
    }
  }
  return 'Could not save — please try again.'
}
```

- [ ] **Step 5: Run the client test to verify it passes**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/apiClient.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Create the query keys and the app query client**

`src/api/queryKeys.ts`:

```ts
/** One flat key per resource: every list is fetched, cached and invalidated as a whole. */
export const queryKeys = {
  recipes: ['recipes'],
  tags: ['tags'],
  ingredients: ['ingredients'],
  pantry: ['pantry'],
  mealPlan: ['meal-plan'],
} as const
```

`src/api/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

/** The app's client. Lists stay fresh for a minute; later refetches are silent (the AppShell gate only reacts to the first load). */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
      mutations: { retry: false },
    },
  })
}
```

- [ ] **Step 7: Create the test helpers**

`src/test/seed.ts`:

```ts
import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import type { IngredientDbEntry } from '../types/ingredients'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'
import type { Recipe, Tag } from '../types/recipes'

/** The five server lists, as a test wants them to look. */
export interface Seed {
  recipes?: Recipe[]
  tags?: Tag[]
  ingredients?: IngredientDbEntry[]
  pantry?: PantryItem[]
  mealPlan?: MealPlanEntry[]
}

/** Writes all five lists into the cache (missing ones become empty), as if the AppShell gate had loaded them. */
export function seedClient(client: QueryClient, seed: Seed): void {
  client.setQueryData(queryKeys.recipes, seed.recipes ?? [])
  client.setQueryData(queryKeys.tags, seed.tags ?? [])
  client.setQueryData(queryKeys.ingredients, seed.ingredients ?? [])
  client.setQueryData(queryKeys.pantry, seed.pantry ?? [])
  client.setQueryData(queryKeys.mealPlan, seed.mealPlan ?? [])
}
```

`src/test/fixtures.ts`:

```ts
import type { IngredientDbEntry } from '../types/ingredients'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'
import type { Recipe, Tag } from '../types/recipes'

export const FLOUR: IngredientDbEntry = { id: 'ing-flour', name: 'Flour', default_unit: 'g', category: 'Pantry & Dry Goods' }
export const MILK: IngredientDbEntry = { id: 'ing-milk', name: 'Milk', default_unit: 'ml', category: 'Dairy' }

export const TAG_BREAKFAST: Tag = { id: 'tag-breakfast', name: 'Breakfast', color: '#F5A623' }

export const PANCAKES: Recipe = {
  id: 'rec-pancakes',
  emoji: '🥞',
  name: 'Pancakes',
  servings: 2,
  tagIds: [TAG_BREAKFAST.id],
  ingredients: [
    { ingredientId: FLOUR.id, quantity: 200 },
    { ingredientId: MILK.id, quantity: 300 },
  ],
  notes: 'Mix and fry.',
  createdAt: 1000,
}

export const PANTRY_FLOUR: PantryItem = { id: 'pan-flour', ingredientId: FLOUR.id, quantity: 500, maxStock: 1000 }
export const PANTRY_MILK: PantryItem = { id: 'pan-milk', ingredientId: MILK.id, quantity: 100, maxStock: 1000 }

export const ENTRY_PANCAKES: MealPlanEntry = {
  id: 'mp-1',
  date: '2026-10-19',
  slot: 'lunch',
  recipeId: PANCAKES.id,
  servings: 4,
}
```

`src/test/fetchMock.ts`:

```ts
import { vi } from 'vitest'
import type { Seed } from './seed'

export interface RecordedCall {
  method: string
  /** The URL as requested, e.g. `/api/pantry/batch`. */
  path: string
  /** The parsed JSON request body, or undefined. */
  body: unknown
}

export type Handler = (call: RecordedCall) => Response | Promise<Response> | undefined | Promise<undefined>

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function emptyResponse(status = 204): Response {
  return new Response(null, { status })
}

export function errorResponse(status: number, code: string): Response {
  return jsonResponse({ error: code }, status)
}

/** Replaces the global fetch with a recording stub. Call `vi.unstubAllGlobals()` in afterEach. */
export function installFetch(handler: (call: RecordedCall) => Response | Promise<Response>) {
  const calls: RecordedCall[] = []
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: RecordedCall = {
      method: init?.method ?? 'GET',
      path: String(input),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    return handler(call)
  })
  vi.stubGlobal('fetch', impl)
  return { calls, impl }
}

const LIST_PATHS: Record<string, keyof Seed> = {
  '/api/recipes': 'recipes',
  '/api/tags': 'tags',
  '/api/ingredients': 'ingredients',
  '/api/pantry': 'pantry',
  '/api/meal-plan': 'mealPlan',
}

/**
 * A fake API. `handler` may answer a call itself (return a Response) or return undefined to get the default:
 * GET lists come from `seed`, POST echoes the body with an id `srv-<n>` (a client-supplied id wins),
 * PUT merges the body into the seeded object with that id (the batch route answers `[]`), DELETE is 204.
 */
export function installApi(opts: { seed?: Seed; handler?: Handler } = {}) {
  const seed = opts.seed ?? {}
  const known: { id: string }[] = [
    ...(seed.recipes ?? []),
    ...(seed.tags ?? []),
    ...(seed.ingredients ?? []),
    ...(seed.pantry ?? []),
    ...(seed.mealPlan ?? []),
  ]
  let n = 0
  const fetchStub = installFetch(async (call) => {
    const custom = await opts.handler?.(call)
    if (custom) return custom
    const id = call.path.split('/').pop() ?? ''
    const body = (call.body ?? {}) as object
    if (call.method === 'GET') {
      const key = LIST_PATHS[call.path]
      return jsonResponse(key ? (seed[key] ?? []) : [])
    }
    if (call.method === 'POST') {
      const createdAt = call.path === '/api/recipes' ? { createdAt: 1 } : {}
      return jsonResponse({ id: `srv-${++n}`, ...createdAt, ...body }, 201)
    }
    if (call.method === 'PUT') {
      if (call.path === '/api/pantry/batch') return jsonResponse([])
      return jsonResponse({ ...known.find((k) => k.id === id), id, ...body })
    }
    return emptyResponse()
  })
  return {
    ...fetchStub,
    /** The recorded calls with this method and path. */
    find: (method: string, path: string) => fetchStub.calls.filter((c) => c.method === method && c.path === path),
  }
}

/** A promise a handler can await, released by the test with `open()` (to observe optimistic state mid-flight). */
export function gate(): { wait: Promise<void>; open: () => void } {
  let open!: () => void
  const wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return { wait, open }
}
```

`src/test/renderWithClient.tsx`:

```tsx
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { seedClient, type Seed } from './seed'

// Tell React this is an act() environment so act() calls do not warn
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** A fresh client for one test: no retries, nothing goes stale. `seed: null` leaves the cache empty (to test loading). */
export function makeTestClient(seed: Seed | null = {}): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  if (seed !== null) seedClient(client, seed)
  return client
}

export interface Rendered {
  client: QueryClient
  container: HTMLElement
  unmount: () => void
}

export function renderWithClient(ui: ReactElement, opts: { seed?: Seed | null; client?: QueryClient } = {}): Rendered {
  const client = opts.client ?? makeTestClient(opts.seed === undefined ? {} : opts.seed)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  })
  return {
    client,
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

export function renderHookWithClient<T>(hook: () => T, opts: { seed?: Seed | null; client?: QueryClient } = {}) {
  const result = { current: undefined as T }
  function Probe() {
    result.current = hook()
    return null
  }
  return { ...renderWithClient(<Probe />, opts), result }
}

/** Retries `assertion` (flushing React between tries) until it stops throwing or the timeout passes. */
export async function waitFor(assertion: () => void, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  for (;;) {
    try {
      assertion()
      return
    } catch (err) {
      if (Date.now() - start > timeoutMs) throw err
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

/** Sets an input's or textarea's value the way a keystroke would, so React's onChange fires. */
export function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
```

- [ ] **Step 8: Write the helper smoke test**

`src/__tests__/testHelpers.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { installApi } from '../test/fetchMock'
import { TAG_BREAKFAST } from '../test/fixtures'
import { makeTestClient, renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { Tag } from '../types/recipes'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('test helpers', () => {
  it('makeTestClient seeds all five lists and null seeds none', () => {
    const client = makeTestClient({ tags: [TAG_BREAKFAST] })
    expect(client.getQueryData(queryKeys.tags)).toEqual([TAG_BREAKFAST])
    expect(client.getQueryData(queryKeys.recipes)).toEqual([])
    expect(makeTestClient(null).getQueryData(queryKeys.tags)).toBeUndefined()
  })

  it('renderHookWithClient exposes the hook result, and installApi serves lists and echoes writes', async () => {
    const server = installApi({ seed: { tags: [TAG_BREAKFAST] } })
    const { result } = renderHookWithClient(
      () => useQuery({ queryKey: queryKeys.tags, queryFn: () => api.get<Tag[]>('/tags') }),
      { seed: null },
    )
    await waitFor(() => expect(result.current.data).toEqual([TAG_BREAKFAST]))
    expect(server.find('GET', '/api/tags')).toHaveLength(1)

    const created = await api.post<Tag>('/tags', { name: 'X', color: '#000000' })
    expect(created).toEqual({ id: 'srv-1', name: 'X', color: '#000000' })
    expect(server.find('POST', '/api/tags')[0].body).toEqual({ name: 'X', color: '#000000' })
  })
})
```

- [ ] **Step 9: Run the gate**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/apiClient.test.ts src/__tests__/testHelpers.test.tsx`
Expected: PASS.
Then: `npm run lint` (0 errors) and `npx tsc --noEmit -p tsconfig.app.json` (exit 0).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/api/client.ts src/api/queryKeys.ts src/api/queryClient.ts src/test/seed.ts src/test/fixtures.ts src/test/fetchMock.ts src/test/renderWithClient.tsx src/__tests__/apiClient.test.ts src/__tests__/testHelpers.test.tsx
git commit -m "feat(api): add TanStack Query, the API client and test helpers" -- package.json package-lock.json src/api/client.ts src/api/queryKeys.ts src/api/queryClient.ts src/test/seed.ts src/test/fixtures.ts src/test/fetchMock.ts src/test/renderWithClient.tsx src/__tests__/apiClient.test.ts src/__tests__/testHelpers.test.tsx
```

(Run the `git` commands from `/data/shopping-list/code`; the paths are relative to it.)

---

### Task 3: Ingredients, tags and recipes API modules

Adds the read hooks and the awaited writes for the three resources the recipe UI needs. No consumer changes yet, so nothing existing can break.

**Files:**
- Create: `src/utils/ingredientSearch.ts`, `src/api/ingredients.ts`, `src/api/tags.ts`, `src/api/recipes.ts`
- Test (create): `src/__tests__/ingredientSearch.test.ts`, `src/__tests__/ingredientsApi.test.tsx`, `src/__tests__/tagsApi.test.tsx`, `src/__tests__/recipesApi.test.tsx`

**Interfaces:**
- Consumes: from Task 2 `api`, `queryKeys`, test helpers and fixtures; `searchMatches(target: string, query: string): boolean` from `src/utils/search.ts`.
- Produces:
  - `searchIngredients(list: IngredientDbEntry[], query: string): IngredientDbEntry[]` (empty when `query.trim().length < 2`)
  - `ingredientsQueryOptions`; `useIngredients(): IngredientDbEntry[]`; `interface NewIngredient { name: string; default_unit: string; category: string }`; `useCreateIngredient()` whose `mutateAsync(input: NewIngredient): Promise<IngredientDbEntry>` is awaited (appends the saved entry to the cache; on error invalidates the list)
  - `tagsQueryOptions`; `useTags(): Tag[]`; `interface NewTag { name: string; color: string }`; `useCreateTag()` with `mutateAsync(input: NewTag): Promise<Tag>`
  - `recipesQueryOptions`; `useRecipes(): Recipe[]`; `type RecipeInput = Omit<Recipe, 'id' | 'createdAt'>`; `useSaveRecipe()` with `mutateAsync({ id?: string; data: RecipeInput }): Promise<Recipe>` (no `id` = POST, with `id` = PUT; never sends `createdAt`); `useDeleteRecipe()` with `mutateAsync(id: string): Promise<void>` (also removes that recipe's meal-plan entries from the cache, because the server cascades silently)
  - Every `*QueryOptions` is a `queryOptions({ queryKey, queryFn })` value the AppShell gate (Task 9) passes to `useQueries`.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/ingredientSearch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { searchIngredients } from '../utils/ingredientSearch'
import type { IngredientDbEntry } from '../types/ingredients'

const entry = (id: string, name: string): IngredientDbEntry => ({ id, name, default_unit: 'g', category: 'Other' })
const LIST = [entry('1', 'Cibuľa'), entry('2', 'Chicken breast'), entry('3', 'Chickpeas')]

describe('searchIngredients', () => {
  it('returns nothing for fewer than two characters', () => {
    expect(searchIngredients(LIST, '')).toEqual([])
    expect(searchIngredients(LIST, 'c')).toEqual([])
    expect(searchIngredients(LIST, ' c ')).toEqual([])
  })

  it('matches ignoring case and accents, in list order', () => {
    expect(searchIngredients(LIST, 'CHICK').map((e) => e.id)).toEqual(['2', '3'])
    expect(searchIngredients(LIST, 'cibul').map((e) => e.id)).toEqual(['1'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchIngredients(LIST, 'tahini')).toEqual([])
  })
})
```

`src/__tests__/ingredientsApi.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { useCreateIngredient, useIngredients } from '../api/ingredients'
import { ApiError } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, installApi } from '../test/fetchMock'
import { FLOUR, MILK } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { IngredientDbEntry } from '../types/ingredients'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('useIngredients', () => {
  it('returns the cached list', () => {
    const { result } = renderHookWithClient(() => useIngredients(), { seed: { ingredients: [FLOUR, MILK] } })
    expect(result.current).toEqual([FLOUR, MILK])
  })

  it('fetches /api/ingredients when nothing is cached, and is [] until then', async () => {
    const server = installApi({ seed: { ingredients: [FLOUR] } })
    const { result } = renderHookWithClient(() => useIngredients(), { seed: null })
    expect(result.current).toEqual([])
    await waitFor(() => expect(result.current).toEqual([FLOUR]))
    expect(server.find('GET', '/api/ingredients')).toHaveLength(1)
  })
})

describe('useCreateIngredient', () => {
  const input = { name: 'Tahini', default_unit: 'tbsp', category: 'Other' }

  it('posts the entry, returns the saved one and appends it to the cache', async () => {
    const server = installApi({ seed: { ingredients: [FLOUR] } })
    const { result, client } = renderHookWithClient(() => useCreateIngredient(), { seed: { ingredients: [FLOUR] } })
    let saved: IngredientDbEntry | undefined
    await act(async () => {
      saved = await result.current.mutateAsync(input)
    })
    expect(server.find('POST', '/api/ingredients')[0].body).toEqual(input)
    expect(saved).toEqual({ id: 'srv-1', ...input })
    expect(client.getQueryData(queryKeys.ingredients)).toEqual([FLOUR, saved])
  })

  it('a 409 rejects with an ApiError and leaves the cache as it was', async () => {
    installApi({ handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
    const { result, client } = renderHookWithClient(() => useCreateIngredient(), { seed: { ingredients: [FLOUR] } })
    await act(async () => {
      const outcome = await result.current.mutateAsync(input).catch((e: unknown) => e)
      expect(outcome).toBeInstanceOf(ApiError)
      expect(outcome).toMatchObject({ status: 409, code: 'conflict' })
    })
    expect(client.getQueryData(queryKeys.ingredients)).toEqual([FLOUR])
  })
})
```

`src/__tests__/tagsApi.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { useCreateTag, useTags } from '../api/tags'
import { ApiError } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, installApi } from '../test/fetchMock'
import { TAG_BREAKFAST } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { Tag } from '../types/recipes'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('useTags', () => {
  it('returns the cached list', () => {
    const { result } = renderHookWithClient(() => useTags(), { seed: { tags: [TAG_BREAKFAST] } })
    expect(result.current).toEqual([TAG_BREAKFAST])
  })

  it('fetches /api/tags when nothing is cached', async () => {
    installApi({ seed: { tags: [TAG_BREAKFAST] } })
    const { result } = renderHookWithClient(() => useTags(), { seed: null })
    await waitFor(() => expect(result.current).toEqual([TAG_BREAKFAST]))
  })
})

describe('useCreateTag', () => {
  it('posts the tag, returns the saved one and appends it to the cache', async () => {
    const server = installApi()
    const { result, client } = renderHookWithClient(() => useCreateTag(), { seed: { tags: [TAG_BREAKFAST] } })
    let saved: Tag | undefined
    await act(async () => {
      saved = await result.current.mutateAsync({ name: 'Soup', color: '#26A69A' })
    })
    expect(server.find('POST', '/api/tags')[0].body).toEqual({ name: 'Soup', color: '#26A69A' })
    expect(saved).toEqual({ id: 'srv-1', name: 'Soup', color: '#26A69A' })
    expect(client.getQueryData(queryKeys.tags)).toEqual([TAG_BREAKFAST, saved])
  })

  it('a 409 (name exists) rejects with an ApiError and leaves the cache as it was', async () => {
    installApi({ handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
    const { result, client } = renderHookWithClient(() => useCreateTag(), { seed: { tags: [TAG_BREAKFAST] } })
    await act(async () => {
      const outcome = await result.current.mutateAsync({ name: 'Breakfast', color: '#000000' }).catch((e: unknown) => e)
      expect(outcome).toBeInstanceOf(ApiError)
      expect(outcome).toMatchObject({ status: 409 })
    })
    expect(client.getQueryData(queryKeys.tags)).toEqual([TAG_BREAKFAST])
  })
})
```

`src/__tests__/recipesApi.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { useDeleteRecipe, useRecipes, useSaveRecipe, type RecipeInput } from '../api/recipes'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, PANCAKES, TAG_BREAKFAST } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { Recipe } from '../types/recipes'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const DATA: RecipeInput = {
  emoji: '🥞',
  name: 'Pancakes v2',
  servings: 4,
  tagIds: [TAG_BREAKFAST.id],
  ingredients: [{ ingredientId: FLOUR.id, quantity: 250 }],
  notes: 'Better.',
}

describe('useRecipes', () => {
  it('returns the cached list, or fetches /api/recipes when empty', async () => {
    const cached = renderHookWithClient(() => useRecipes(), { seed: { recipes: [PANCAKES] } })
    expect(cached.result.current).toEqual([PANCAKES])

    installApi({ seed: { recipes: [PANCAKES] } })
    const fresh = renderHookWithClient(() => useRecipes(), { seed: null })
    await waitFor(() => expect(fresh.result.current).toEqual([PANCAKES]))
  })
})

describe('useSaveRecipe', () => {
  it('without an id it POSTs /api/recipes and appends the saved recipe', async () => {
    const server = installApi()
    const { result, client } = renderHookWithClient(() => useSaveRecipe(), { seed: { recipes: [PANCAKES] } })
    let saved: Recipe | undefined
    await act(async () => {
      saved = await result.current.mutateAsync({ data: DATA })
    })
    expect(server.find('POST', '/api/recipes')[0].body).toEqual(DATA)
    expect(saved).toMatchObject({ id: 'srv-1', name: 'Pancakes v2', createdAt: 1 })
    expect(client.getQueryData(queryKeys.recipes)).toEqual([PANCAKES, saved])
  })

  it('with an id it PUTs /api/recipes/<id> without createdAt and replaces the recipe in place', async () => {
    const server = installApi({ seed: { recipes: [PANCAKES] } })
    const { result, client } = renderHookWithClient(() => useSaveRecipe(), { seed: { recipes: [PANCAKES] } })
    await act(async () => {
      await result.current.mutateAsync({ id: PANCAKES.id, data: DATA })
    })
    const sent = server.find('PUT', `/api/recipes/${PANCAKES.id}`)[0].body as Record<string, unknown>
    expect(sent).toEqual(DATA)
    expect('createdAt' in sent).toBe(false)
    expect(client.getQueryData(queryKeys.recipes)).toEqual([{ ...PANCAKES, ...DATA }])
  })

  it('a 409 rejects with status 409 and leaves the cache as it was', async () => {
    installApi({ handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
    const { result, client } = renderHookWithClient(() => useSaveRecipe(), { seed: { recipes: [PANCAKES] } })
    await act(async () => {
      const outcome = await result.current.mutateAsync({ data: DATA }).catch((e: unknown) => e)
      expect(outcome).toMatchObject({ status: 409, code: 'conflict' })
    })
    expect(client.getQueryData(queryKeys.recipes)).toEqual([PANCAKES])
  })
})

describe('useDeleteRecipe', () => {
  it('DELETEs the recipe and drops it and its meal-plan entries from the cache', async () => {
    const server = installApi()
    const other = { ...ENTRY_PANCAKES, id: 'mp-2', recipeId: 'rec-other' }
    const { result, client } = renderHookWithClient(() => useDeleteRecipe(), {
      seed: { recipes: [PANCAKES], mealPlan: [ENTRY_PANCAKES, other] },
    })
    await act(async () => {
      await result.current.mutateAsync(PANCAKES.id)
    })
    expect(server.find('DELETE', `/api/recipes/${PANCAKES.id}`)).toHaveLength(1)
    expect(client.getQueryData(queryKeys.recipes)).toEqual([])
    expect(client.getQueryData(queryKeys.mealPlan)).toEqual([other])
  })

  it('a failed delete rejects and keeps everything', async () => {
    installApi({ handler: (call) => (call.method === 'DELETE' ? errorResponse(500, 'server_error') : undefined) })
    const { result, client } = renderHookWithClient(() => useDeleteRecipe(), {
      seed: { recipes: [PANCAKES], mealPlan: [ENTRY_PANCAKES] },
    })
    await act(async () => {
      const outcome = await result.current.mutateAsync(PANCAKES.id).catch((e: unknown) => e)
      expect(outcome).toMatchObject({ status: 500 })
    })
    expect(client.getQueryData(queryKeys.recipes)).toEqual([PANCAKES])
    expect(client.getQueryData(queryKeys.mealPlan)).toEqual([ENTRY_PANCAKES])
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/ingredientSearch.test.ts src/__tests__/ingredientsApi.test.tsx src/__tests__/tagsApi.test.tsx src/__tests__/recipesApi.test.tsx`
Expected: FAIL, unresolved imports (`../utils/ingredientSearch`, `../api/ingredients`, ...).

- [ ] **Step 3: Implement `src/utils/ingredientSearch.ts`**

```ts
import type { IngredientDbEntry } from '../types/ingredients'
import { searchMatches } from './search'

/** Synchronous search over an already loaded ingredient list (the old `ingredientsDbService.search`). */
export function searchIngredients(list: IngredientDbEntry[], query: string): IngredientDbEntry[] {
  if (query.trim().length < 2) return []
  return list.filter((e) => searchMatches(e.name, query))
}
```

- [ ] **Step 4: Implement `src/api/ingredients.ts`**

```ts
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { IngredientDbEntry } from '../types/ingredients'
import { api } from './client'
import { queryKeys } from './queryKeys'

export const ingredientsQueryOptions = queryOptions({
  queryKey: queryKeys.ingredients,
  queryFn: () => api.get<IngredientDbEntry[]>('/ingredients'),
})

const NONE: IngredientDbEntry[] = []

/** The cached ingredient list. The AppShell gate guarantees it is loaded before any page renders. */
export function useIngredients(): IngredientDbEntry[] {
  return useQuery(ingredientsQueryOptions).data ?? NONE
}

export interface NewIngredient {
  name: string
  default_unit: string
  category: string
}

/** Awaited create: callers wait for the saved entry (with its server id) before using it. */
export function useCreateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewIngredient) => api.post<IngredientDbEntry>('/ingredients', input),
    onSuccess: (saved) => {
      qc.setQueryData<IngredientDbEntry[]>(queryKeys.ingredients, (old = []) => [...old, saved])
    },
    // A 409 means the name exists (our list is stale): refetch so the existing entry shows up.
    onError: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.ingredients })
    },
  })
}
```

- [ ] **Step 5: Implement `src/api/tags.ts`**

```ts
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Tag } from '../types/recipes'
import { api } from './client'
import { queryKeys } from './queryKeys'

export const tagsQueryOptions = queryOptions({
  queryKey: queryKeys.tags,
  queryFn: () => api.get<Tag[]>('/tags'),
})

const NONE: Tag[] = []

/** The cached tag list. The AppShell gate guarantees it is loaded before any page renders. */
export function useTags(): Tag[] {
  return useQuery(tagsQueryOptions).data ?? NONE
}

export interface NewTag {
  name: string
  color: string
}

/** Awaited create: callers wait for the saved tag (with its server id). */
export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTag) => api.post<Tag>('/tags', input),
    onSuccess: (saved) => {
      qc.setQueryData<Tag[]>(queryKeys.tags, (old = []) => [...old, saved])
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tags })
    },
  })
}
```

- [ ] **Step 6: Implement `src/api/recipes.ts`**

```ts
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MealPlanEntry } from '../types/mealPlan'
import type { Recipe } from '../types/recipes'
import { api } from './client'
import { queryKeys } from './queryKeys'

export type RecipeInput = Omit<Recipe, 'id' | 'createdAt'>

export const recipesQueryOptions = queryOptions({
  queryKey: queryKeys.recipes,
  queryFn: () => api.get<Recipe[]>('/recipes'),
})

const NONE: Recipe[] = []

/** The cached recipe list. The AppShell gate guarantees it is loaded before any page renders. */
export function useRecipes(): Recipe[] {
  return useQuery(recipesQueryOptions).data ?? NONE
}

/** Awaited save. No `id` creates (POST), an `id` updates (PUT; the server keeps createdAt). */
export function useSaveRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: RecipeInput }) =>
      id ? api.put<Recipe>(`/recipes/${id}`, data) : api.post<Recipe>('/recipes', data),
    onSuccess: (saved) => {
      qc.setQueryData<Recipe[]>(queryKeys.recipes, (old = []) =>
        old.some((r) => r.id === saved.id) ? old.map((r) => (r.id === saved.id ? saved : r)) : [...old, saved],
      )
    },
    // A 409 means something the recipe references is gone: resync everything it can reference.
    onError: () => {
      for (const queryKey of [queryKeys.recipes, queryKeys.tags, queryKeys.ingredients]) {
        void qc.invalidateQueries({ queryKey })
      }
    },
  })
}

/** Awaited delete. The server removes the recipe's meal-plan entries too, so the cache drops them as well. */
export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: (_void, id) => {
      qc.setQueryData<Recipe[]>(queryKeys.recipes, (old) => old?.filter((r) => r.id !== id))
      qc.setQueryData<MealPlanEntry[]>(queryKeys.mealPlan, (old) => old?.filter((e) => e.recipeId !== id))
    },
  })
}
```

- [ ] **Step 7: Run the gate**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/ingredientSearch.test.ts src/__tests__/ingredientsApi.test.tsx src/__tests__/tagsApi.test.tsx src/__tests__/recipesApi.test.tsx`
Expected: PASS.
Regression files: `src/__tests__/apiClient.test.ts src/__tests__/testHelpers.test.tsx`. Then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json`.

- [ ] **Step 8: Commit**

```bash
git add src/utils/ingredientSearch.ts src/api/ingredients.ts src/api/tags.ts src/api/recipes.ts src/__tests__/ingredientSearch.test.ts src/__tests__/ingredientsApi.test.tsx src/__tests__/tagsApi.test.tsx src/__tests__/recipesApi.test.tsx
git commit -m "feat(api): ingredients, tags and recipes hooks over the REST API" -- src/utils/ingredientSearch.ts src/api/ingredients.ts src/api/tags.ts src/api/recipes.ts src/__tests__/ingredientSearch.test.ts src/__tests__/ingredientsApi.test.tsx src/__tests__/tagsApi.test.tsx src/__tests__/recipesApi.test.tsx
```

---

### Task 4: Pantry, meal plan and cooking API modules, optimistic helper, toast store

Adds the optimistic hooks, using `batchUpdatePantry` in `store/pantrySlice.ts` as the semantic template (match by ingredient, clamp at 0, skip unknown ingredients, roll everything back on failure). Replaces the localStorage-asserting half of `cookedPantryDeduction.test.ts`. No consumer changes yet.

**Files:**
- Create: `src/utils/pantryDeltas.ts`, `src/store/toastStore.ts`, `src/components/ui/ToastHost.tsx`, `src/api/optimistic.ts`, `src/api/pantry.ts`, `src/api/mealPlan.ts`, `src/api/cooking.ts`
- Test (create): `src/__tests__/pantryApi.test.tsx`, `src/__tests__/mealPlanApi.test.tsx`, `src/__tests__/cookingApi.test.tsx`, `src/__tests__/toastHost.test.tsx`
- Test (REPLACE, same path): `src/__tests__/cookedPantryDeduction.test.ts` (its slice/pantryService half is replaced by `applyPantryDeltas` and `useBatchPantry` tests; the `buildCookDeltas` half is kept as is)

**Interfaces:**
- Consumes: Task 2 (`api`, `messageForError`, `queryKeys`, test helpers, fixtures), Task 3 nothing.
- Produces:
  - `interface PantryDelta { ingredientId: string; delta: number }`; `applyPantryDeltas(items: PantryItem[], deltas: PantryDelta[]): PantryItem[]` (pure; sequential, clamped at 0 after each delta, unknown ingredients skipped, input not mutated, unchanged items keep their identity)
  - `useToastStore` with state `{ message: string; show(message: string): void; dismiss(): void }`; `<ToastHost />` (renders `Toast` for the message, `role="alert"`)
  - `optimisticUpdate<T>(qc: QueryClient, key: QueryKey, update: (old: T[]) => T[]): Promise<() => void>` (cancels in-flight fetches of the list, applies `update`, returns a function that restores the snapshot); `failOptimistic(qc, keys: QueryKey[], restore: (() => void) | undefined, err: unknown, kind?: WriteKind): void` (restore, invalidate each key, show the toast `messageForError(err, kind)`); `replaceById<T extends { id: string }>(qc, key, saved: T): void`
  - `pantryQueryOptions`; `usePantry(): PantryItem[]`; `newPantryItem(data: { ingredientId: string; quantity: number; maxStock?: number }): PantryItem` (client UUID id, default `maxStock = Math.max(1, quantity * 3)`); `recipeDeltas(recipe: Pick<Recipe, 'ingredients'>): PantryDelta[]` (one `-quantity` delta per ingredient); optimistic hooks `useAddPantryItem()` (`mutate(item: PantryItem)`), `useUpdatePantryItem()` (`mutate({ id: string; patch: { quantity?: number; maxStock?: number } })`), `useDeletePantryItem()` (`mutate(id: string)`), `useBatchPantry()` (`mutate(deltas: PantryDelta[])`). Failure rolls the cache back and toasts through `failOptimistic`, so callers add no error handling (they may pass per-call `onError` for extra UI such as un-checking).
  - `mealPlanQueryOptions`; `useMealPlan(): MealPlanEntry[]`; `type MealPlanPatch = Partial<Omit<MealPlanEntry, 'id'>>`; `newMealEntry(data: Omit<MealPlanEntry, 'id' | 'cooked'>): MealPlanEntry` (client UUID id); optimistic hooks `useAddMealEntry()` (`mutate(entry: MealPlanEntry)`), `useUpdateMealEntry()` (`mutate({ id: string; patch: MealPlanPatch })`, used for moves; no UI moves entries yet, the hook is provided for spec parity), `useRemoveMealEntry()` (`mutate(id: string)`)
  - `interface SetCookedInput { entry: MealPlanEntry; deltas: PantryDelta[]; cooked: boolean }`; `useSetEntryCooked()` with `mutate(input: SetCookedInput)`: optimistic on both the meal-plan and pantry caches; sends `PUT /api/meal-plan/<id>` `{cooked}` first, then `PUT /api/pantry/batch` `{deltas}` (skipped when `deltas` is empty); if the batch fails it sets the entry back on the server (best effort), rolls both caches back and toasts.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/cookedPantryDeduction.test.ts` (replace the whole file):

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { applyPantryDeltas } from '../utils/pantryDeltas'
import { useBatchPantry } from '../api/pantry'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { buildCookDeltas } from '../features/meal-planner/MealPlanOverlay'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'
import type { Recipe } from '../types/recipes'
import type { MealPlanEntry } from '../types/mealPlan'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const item = (id: string, ingredientId: string, quantity: number): PantryItem => ({
  id,
  ingredientId,
  quantity,
  maxStock: quantity * 3,
})

describe('applyPantryDeltas', () => {
  it('(a) deducts a matched ingredient: qty=3, delta=-1.5 -> 1.5', () => {
    const result = applyPantryDeltas([item('p1', 'ing-1', 3)], [{ ingredientId: 'ing-1', delta: -1.5 }])
    expect(result[0].quantity).toBe(1.5)
  })

  it('(b) floors at 0: qty=1, delta=-3 -> 0', () => {
    const result = applyPantryDeltas([item('p1', 'ing-2', 1)], [{ ingredientId: 'ing-2', delta: -3 }])
    expect(result[0].quantity).toBe(0)
  })

  it('(c) skips an unknown ingredientId silently; other items keep their identity', () => {
    const items = [item('p1', 'ing-3', 5)]
    const result = applyPantryDeltas(items, [{ ingredientId: 'unknown-ing', delta: -2 }])
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(items[0])
    expect(result[0].quantity).toBe(5)
  })

  it('(e) a reverse delta adds back: qty=1.5, delta=+1.5 -> 3', () => {
    const result = applyPantryDeltas([item('p1', 'ing-6', 1.5)], [{ ingredientId: 'ing-6', delta: 1.5 }])
    expect(result[0].quantity).toBe(3)
  })

  it('(f) two deltas for the same ingredient apply one after the other, clamping at each step (like the server)', () => {
    const items = [item('p1', 'ing-7', 5)]
    expect(applyPantryDeltas(items, [{ ingredientId: 'ing-7', delta: -3 }, { ingredientId: 'ing-7', delta: -3 }])[0].quantity).toBe(0)
    expect(applyPantryDeltas(items, [{ ingredientId: 'ing-7', delta: -3 }, { ingredientId: 'ing-7', delta: 1 }])[0].quantity).toBe(3)
  })

  it('(g) does not mutate its input', () => {
    const items = [item('p1', 'ing-8', 5)]
    applyPantryDeltas(items, [{ ingredientId: 'ing-8', delta: -2 }])
    expect(items[0].quantity).toBe(5)
  })
})

describe('useBatchPantry', () => {
  const SEED = { pantry: [item('p4', 'ing-4', 5), item('p5', 'ing-5', 5)] }
  const DELTAS = [
    { ingredientId: 'ing-4', delta: -2 },
    { ingredientId: 'ing-5', delta: -2 },
  ]

  it('applies the deductions at once, sends PUT /api/pantry/batch and keeps the server answer', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.path !== '/api/pantry/batch') return undefined
        await g.wait
        return new Response(JSON.stringify([item('p4', 'ing-4', 3), item('p5', 'ing-5', 3)]), { status: 200 })
      },
    })
    const { result, client } = renderHookWithClient(() => useBatchPantry(), { seed: SEED })
    act(() => {
      result.current.mutate(DELTAS)
    })
    await waitFor(() =>
      expect((client.getQueryData(queryKeys.pantry) as PantryItem[]).map((i) => i.quantity)).toEqual([3, 3]),
    )
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({ deltas: DELTAS })
  })

  it('(d) rollback on failure: restores every matched item and toasts when the server rejects the batch', async () => {
    const g = gate()
    installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.path !== '/api/pantry/batch') return undefined
        await g.wait
        return errorResponse(500, 'server_error')
      },
    })
    const { result, client } = renderHookWithClient(() => useBatchPantry(), { seed: SEED })
    act(() => {
      result.current.mutate(DELTAS)
    })
    await waitFor(() =>
      expect((client.getQueryData(queryKeys.pantry) as PantryItem[]).map((i) => i.quantity)).toEqual([3, 3]),
    )
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(client.getQueryData(queryKeys.pantry)).toEqual(SEED.pantry)
  })
})

describe('buildCookDeltas', () => {
  const baseRecipe: Recipe = {
    id: 'r1',
    emoji: '🍝',
    name: 'Test Recipe',
    servings: 2,
    tagIds: [],
    ingredients: [{ ingredientId: 'ing-a', quantity: 3 }],
    notes: '',
    createdAt: 0,
  }

  const baseEntry: Pick<MealPlanEntry, 'servings'> = { servings: 4 }

  it('(a) scale formula: entry.servings=4, recipe.servings=2, quantity=3, cooking → delta=-6', () => {
    const result = buildCookDeltas(baseRecipe, baseEntry, true)
    expect(result).toHaveLength(1)
    expect(result[0].ingredientId).toBe('ing-a')
    expect(result[0].delta).toBe(-6)
  })

  it('(b) direction: same inputs, newCooked=false → delta=+6', () => {
    const result = buildCookDeltas(baseRecipe, baseEntry, false)
    expect(result[0].delta).toBe(6)
  })

  it('(c) zero-servings guard: recipe.servings=0 → scale=1, delta=-3 for quantity=3', () => {
    const zeroServingsRecipe: Recipe = { ...baseRecipe, servings: 0 }
    const result = buildCookDeltas(zeroServingsRecipe, { servings: 4 }, true)
    expect(result[0].delta).toBe(-3)
  })

  it('(d) recipe with no ingredients → returns []', () => {
    const emptyRecipe: Recipe = { ...baseRecipe, ingredients: [] }
    const result = buildCookDeltas(emptyRecipe, baseEntry, true)
    expect(result).toHaveLength(0)
  })
})
```

`src/__tests__/pantryApi.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import {
  newPantryItem,
  recipeDeltas,
  useAddPantryItem,
  useDeletePantryItem,
  usePantry,
  useUpdatePantryItem,
} from '../api/pantry'
import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { PANCAKES, PANTRY_FLOUR, PANTRY_MILK } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const cached = (client: QueryClient) => client.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []

describe('usePantry, newPantryItem, recipeDeltas', () => {
  it('usePantry returns the cached list', () => {
    const { result } = renderHookWithClient(() => usePantry(), { seed: { pantry: [PANTRY_FLOUR] } })
    expect(result.current).toEqual([PANTRY_FLOUR])
  })

  it('newPantryItem makes a client id and defaults maxStock to max(1, 3 x quantity)', () => {
    const a = newPantryItem({ ingredientId: 'i', quantity: 2 })
    expect(a).toMatchObject({ ingredientId: 'i', quantity: 2, maxStock: 6 })
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(newPantryItem({ ingredientId: 'i', quantity: 0.1 }).maxStock).toBe(1)
    expect(newPantryItem({ ingredientId: 'i', quantity: 2, maxStock: 10 }).maxStock).toBe(10)
  })

  it('recipeDeltas deducts every ingredient quantity', () => {
    expect(recipeDeltas(PANCAKES)).toEqual([
      { ingredientId: 'ing-flour', delta: -200 },
      { ingredientId: 'ing-milk', delta: -300 },
    ])
  })
})

describe('useAddPantryItem', () => {
  it('shows the item at once and keeps the id it sent', async () => {
    const g = gate()
    const server = installApi({
      handler: async (call) => {
        if (call.method === 'POST') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useAddPantryItem(), { seed: { pantry: [PANTRY_FLOUR] } })
    const item = newPantryItem({ ingredientId: 'ing-sugar', quantity: 2 })
    act(() => {
      result.current.mutate(item)
    })
    await waitFor(() => expect(cached(client)).toEqual([PANTRY_FLOUR, item]))
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('POST', '/api/pantry')[0].body).toEqual(item)
    expect(cached(client)).toEqual([PANTRY_FLOUR, item])
  })

  it('rolls back and toasts when the server answers 409', async () => {
    const g = gate()
    installApi({
      handler: async (call) => {
        if (call.method !== 'POST') return undefined
        await g.wait
        return errorResponse(409, 'conflict')
      },
    })
    const { result, client } = renderHookWithClient(() => useAddPantryItem(), { seed: { pantry: [PANTRY_FLOUR] } })
    const item = newPantryItem({ ingredientId: 'ing-flour', quantity: 2 })
    act(() => {
      result.current.mutate(item)
    })
    await waitFor(() => expect(cached(client)).toHaveLength(2))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(cached(client)).toEqual([PANTRY_FLOUR])
  })
})

describe('useUpdatePantryItem', () => {
  const SEED = { pantry: [PANTRY_FLOUR, PANTRY_MILK] }

  it('applies the patch at once, then keeps the server answer', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method === 'PUT') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useUpdatePantryItem(), { seed: SEED })
    act(() => {
      result.current.mutate({ id: 'pan-flour', patch: { quantity: 250 } })
    })
    await waitFor(() => expect(cached(client)[0].quantity).toBe(250))
    expect(result.current.isPending).toBe(true)
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('PUT', '/api/pantry/pan-flour')[0].body).toEqual({ quantity: 250 })
    expect(cached(client)[0]).toEqual({ ...PANTRY_FLOUR, quantity: 250 })
  })

  it('restores the old quantity and toasts on failure', async () => {
    const g = gate()
    installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method !== 'PUT') return undefined
        await g.wait
        return errorResponse(500, 'server_error')
      },
    })
    const { result, client } = renderHookWithClient(() => useUpdatePantryItem(), { seed: SEED })
    act(() => {
      result.current.mutate({ id: 'pan-flour', patch: { quantity: 250, maxStock: 2000 } })
    })
    await waitFor(() => expect(cached(client)[0]).toMatchObject({ quantity: 250, maxStock: 2000 }))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).not.toBe(''))
    expect(cached(client)).toEqual(SEED.pantry)
  })
})

describe('useDeletePantryItem', () => {
  const SEED = { pantry: [PANTRY_FLOUR, PANTRY_MILK] }

  it('removes the item at once and DELETEs it', async () => {
    const g = gate()
    const server = installApi({
      handler: async (call) => {
        if (call.method === 'DELETE') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useDeletePantryItem(), { seed: SEED })
    act(() => {
      result.current.mutate('pan-flour')
    })
    await waitFor(() => expect(cached(client)).toEqual([PANTRY_MILK]))
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('DELETE', '/api/pantry/pan-flour')).toHaveLength(1)
  })

  it('puts the item back and toasts "Could not delete" on failure', async () => {
    const g = gate()
    installApi({
      handler: async (call) => {
        if (call.method !== 'DELETE') return undefined
        await g.wait
        return errorResponse(500, 'server_error')
      },
    })
    const { result, client } = renderHookWithClient(() => useDeletePantryItem(), { seed: SEED })
    act(() => {
      result.current.mutate('pan-flour')
    })
    await waitFor(() => expect(cached(client)).toHaveLength(1))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not delete — please try again.'))
    expect(cached(client)).toEqual(SEED.pantry)
  })
})
```

`src/__tests__/mealPlanApi.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { newMealEntry, useAddMealEntry, useMealPlan, useRemoveMealEntry, useUpdateMealEntry } from '../api/mealPlan'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { MealPlanEntry } from '../types/mealPlan'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const cached = (client: QueryClient) => client.getQueryData<MealPlanEntry[]>(queryKeys.mealPlan) ?? []

describe('useMealPlan and newMealEntry', () => {
  it('useMealPlan returns the cached list', () => {
    const { result } = renderHookWithClient(() => useMealPlan(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    expect(result.current).toEqual([ENTRY_PANCAKES])
  })

  it('newMealEntry makes a client uuid and leaves cooked unset', () => {
    const entry = newMealEntry({ date: '2026-10-20', slot: 'dinner', recipeId: 'r', servings: 3 })
    expect(entry).toMatchObject({ date: '2026-10-20', slot: 'dinner', recipeId: 'r', servings: 3 })
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/)
    expect('cooked' in entry).toBe(false)
  })
})

describe('useAddMealEntry', () => {
  it('shows the entry at once and POSTs it with its client id', async () => {
    const g = gate()
    const server = installApi({
      handler: async (call) => {
        if (call.method === 'POST') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useAddMealEntry(), { seed: { mealPlan: [] } })
    const entry = newMealEntry({ date: '2026-10-20', slot: 'lunch', recipeId: 'rec-pancakes', servings: 2 })
    act(() => {
      result.current.mutate(entry)
    })
    await waitFor(() => expect(cached(client)).toEqual([entry]))
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('POST', '/api/meal-plan')[0].body).toEqual(entry)
  })

  it('removes the entry again and toasts when the recipe no longer exists (409)', async () => {
    const g = gate()
    installApi({
      handler: async (call) => {
        if (call.method !== 'POST') return undefined
        await g.wait
        return errorResponse(409, 'conflict')
      },
    })
    const { result, client } = renderHookWithClient(() => useAddMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    const entry = newMealEntry({ date: '2026-10-20', slot: 'lunch', recipeId: 'gone', servings: 2 })
    act(() => {
      result.current.mutate(entry)
    })
    await waitFor(() => expect(cached(client)).toHaveLength(2))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(cached(client)).toEqual([ENTRY_PANCAKES])
  })
})

describe('useUpdateMealEntry (moves)', () => {
  it('moves an entry optimistically and PUTs only the patch', async () => {
    const g = gate()
    const server = installApi({
      seed: { mealPlan: [ENTRY_PANCAKES] },
      handler: async (call) => {
        if (call.method === 'PUT') await g.wait
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useUpdateMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    act(() => {
      result.current.mutate({ id: 'mp-1', patch: { date: '2026-10-21', slot: 'dinner' } })
    })
    await waitFor(() => expect(cached(client)[0]).toMatchObject({ date: '2026-10-21', slot: 'dinner' }))
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('PUT', '/api/meal-plan/mp-1')[0].body).toEqual({ date: '2026-10-21', slot: 'dinner' })
  })

  it('moves it back and toasts on failure', async () => {
    const g = gate()
    installApi({
      handler: async (call) => {
        if (call.method !== 'PUT') return undefined
        await g.wait
        return errorResponse(500, 'server_error')
      },
    })
    const { result, client } = renderHookWithClient(() => useUpdateMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    act(() => {
      result.current.mutate({ id: 'mp-1', patch: { date: '2026-10-21' } })
    })
    await waitFor(() => expect(cached(client)[0].date).toBe('2026-10-21'))
    g.open()
    await waitFor(() => expect(useToastStore.getState().message).not.toBe(''))
    expect(cached(client)).toEqual([ENTRY_PANCAKES])
  })
})

describe('useRemoveMealEntry', () => {
  it('removes the entry at once and DELETEs it', async () => {
    const server = installApi()
    const { result, client } = renderHookWithClient(() => useRemoveMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    act(() => {
      result.current.mutate('mp-1')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(cached(client)).toEqual([])
    expect(server.find('DELETE', '/api/meal-plan/mp-1')).toHaveLength(1)
  })

  it('brings the entry back and toasts "Could not delete" on failure', async () => {
    installApi({ handler: (call) => (call.method === 'DELETE' ? errorResponse(500, 'server_error') : undefined) })
    const { result, client } = renderHookWithClient(() => useRemoveMealEntry(), { seed: { mealPlan: [ENTRY_PANCAKES] } })
    act(() => {
      result.current.mutate('mp-1')
    })
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not delete — please try again.'))
    expect(cached(client)).toEqual([ENTRY_PANCAKES])
  })
})
```

`src/__tests__/cookingApi.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { useSetEntryCooked } from '../api/cooking'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi, jsonResponse } from '../test/fetchMock'
import { ENTRY_PANCAKES, PANTRY_FLOUR, PANTRY_MILK } from '../test/fixtures'
import { renderHookWithClient, waitFor } from '../test/renderWithClient'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'

afterEach(() => {
  vi.unstubAllGlobals()
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

const SEED = { mealPlan: [ENTRY_PANCAKES], pantry: [PANTRY_FLOUR, PANTRY_MILK] }
const DELTAS = [{ ingredientId: 'ing-flour', delta: -200 }]
const order = (calls: { method: string; path: string }[]) => calls.map((c) => `${c.method} ${c.path}`)
const entries = (c: QueryClient) => c.getQueryData<MealPlanEntry[]>(queryKeys.mealPlan) ?? []
const pantry = (c: QueryClient) => c.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []

describe('useSetEntryCooked', () => {
  it('marks the entry and deducts the pantry at once, then sends the entry first and the batch second', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.path === '/api/meal-plan/mp-1') await g.wait
        if (call.path === '/api/pantry/batch') return jsonResponse([{ ...PANTRY_FLOUR, quantity: 300 }])
        return undefined
      },
    })
    const { result, client } = renderHookWithClient(() => useSetEntryCooked(), { seed: SEED })
    act(() => {
      result.current.mutate({ entry: ENTRY_PANCAKES, deltas: DELTAS, cooked: true })
    })
    await waitFor(() => expect(entries(client)[0].cooked).toBe(true))
    expect(pantry(client)[0].quantity).toBe(300)
    g.open()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(order(server.calls)).toEqual(['PUT /api/meal-plan/mp-1', 'PUT /api/pantry/batch'])
    expect(server.calls[0].body).toEqual({ cooked: true })
    expect(server.calls[1].body).toEqual({ deltas: DELTAS })
  })

  it('skips the batch when there is nothing to deduct', async () => {
    const server = installApi({ seed: SEED })
    const { result } = renderHookWithClient(() => useSetEntryCooked(), { seed: SEED })
    act(() => {
      result.current.mutate({ entry: ENTRY_PANCAKES, deltas: [], cooked: true })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(order(server.calls)).toEqual(['PUT /api/meal-plan/mp-1'])
  })

  it('un-cooking sends the reverse deltas it was given', async () => {
    const cookedEntry = { ...ENTRY_PANCAKES, cooked: true }
    const seed = { mealPlan: [cookedEntry], pantry: [PANTRY_FLOUR] }
    const server = installApi({ seed })
    const { result, client } = renderHookWithClient(() => useSetEntryCooked(), { seed })
    act(() => {
      result.current.mutate({ entry: cookedEntry, deltas: [{ ingredientId: 'ing-flour', delta: 200 }], cooked: false })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(server.find('PUT', '/api/meal-plan/mp-1')[0].body).toEqual({ cooked: false })
    expect(entries(client)[0].cooked).toBe(false)
  })

  it('when the batch fails it sets the entry back on the server, restores both caches and toasts', async () => {
    const server = installApi({
      seed: SEED,
      handler: (call) => (call.path === '/api/pantry/batch' ? errorResponse(500, 'server_error') : undefined),
    })
    const { result, client } = renderHookWithClient(() => useSetEntryCooked(), { seed: SEED })
    act(() => {
      result.current.mutate({ entry: ENTRY_PANCAKES, deltas: DELTAS, cooked: true })
    })
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(order(server.calls)).toEqual(['PUT /api/meal-plan/mp-1', 'PUT /api/pantry/batch', 'PUT /api/meal-plan/mp-1'])
    expect(server.calls[2].body).toEqual({ cooked: false })
    expect(entries(client)).toEqual([ENTRY_PANCAKES])
    expect(pantry(client)).toEqual(SEED.pantry)
  })

  it('when the entry update fails the batch is never sent', async () => {
    const server = installApi({
      seed: SEED,
      handler: (call) => (call.path === '/api/meal-plan/mp-1' ? errorResponse(404, 'not_found') : undefined),
    })
    const { result, client } = renderHookWithClient(() => useSetEntryCooked(), { seed: SEED })
    act(() => {
      result.current.mutate({ entry: ENTRY_PANCAKES, deltas: DELTAS, cooked: true })
    })
    await waitFor(() => expect(useToastStore.getState().message).not.toBe(''))
    expect(order(server.calls)).toEqual(['PUT /api/meal-plan/mp-1'])
    expect(entries(client)).toEqual([ENTRY_PANCAKES])
    expect(pantry(client)).toEqual(SEED.pantry)
  })
})
```

`src/__tests__/toastHost.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { act } from 'react'
import { ToastHost } from '../components/ui/ToastHost'
import { useToastStore } from '../store/toastStore'
import { renderWithClient } from '../test/renderWithClient'

afterEach(() => {
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

describe('ToastHost', () => {
  it('renders nothing without a message and the message once the store has one', () => {
    renderWithClient(<ToastHost />)
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
    act(() => useToastStore.getState().show('Could not save — please try again.'))
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('Could not save — please try again.')
  })

  it('dismiss clears the message', () => {
    renderWithClient(<ToastHost />)
    act(() => useToastStore.getState().show('Oops'))
    act(() => useToastStore.getState().dismiss())
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/cookedPantryDeduction.test.ts src/__tests__/pantryApi.test.tsx src/__tests__/mealPlanApi.test.tsx src/__tests__/cookingApi.test.tsx src/__tests__/toastHost.test.tsx`
Expected: FAIL, unresolved imports (`../utils/pantryDeltas`, `../store/toastStore`, `../api/pantry`, ...).

- [ ] **Step 3: Implement the pure delta function**

`src/utils/pantryDeltas.ts`:

```ts
import type { PantryItem } from '../types/pantry'

export interface PantryDelta {
  ingredientId: string
  delta: number
}

/**
 * Applies quantity deltas keyed by ingredient, exactly like `PUT /api/pantry/batch`: one after the other,
 * clamped at 0 after each, ingredients without a pantry item skipped. Returns a new list; items that did not
 * change keep their identity and the input is never mutated.
 */
export function applyPantryDeltas(items: PantryItem[], deltas: PantryDelta[]): PantryItem[] {
  const changed = new Map<string, PantryItem>()
  for (const { ingredientId, delta } of deltas) {
    const current = items.find((i) => i.ingredientId === ingredientId)
    if (!current) continue
    const base = changed.get(current.id) ?? current
    changed.set(current.id, { ...base, quantity: Math.max(0, base.quantity + delta) })
  }
  return items.map((i) => changed.get(i.id) ?? i)
}
```

- [ ] **Step 4: Implement the toast store and host**

`src/store/toastStore.ts`:

```ts
import { create } from 'zustand'

interface ToastState {
  message: string
  show: (message: string) => void
  dismiss: () => void
}

/** UI state: the one message the global toast shows (failed optimistic writes report through it). */
export const useToastStore = create<ToastState>()((set) => ({
  message: '',
  show: (message) => set({ message }),
  dismiss: () => set({ message: '' }),
}))
```

`src/components/ui/ToastHost.tsx`:

```tsx
import { Toast } from './Toast'
import { useToastStore } from '../../store/toastStore'

/** Mounted once in the AppShell. Keyed by message so a new message restarts the 3 s timer. */
export function ToastHost() {
  const message = useToastStore((s) => s.message)
  const dismiss = useToastStore((s) => s.dismiss)
  if (!message) return null
  return <Toast key={message} message={message} onDismiss={dismiss} />
}
```

- [ ] **Step 5: Implement the optimistic helper**

`src/api/optimistic.ts`:

```ts
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { useToastStore } from '../store/toastStore'
import { messageForError, type WriteKind } from './client'

/**
 * Cancels in-flight fetches of a cached list (they would overwrite the edit), applies `update` to it and
 * returns a function that puts the previous list back. Use it as the `onMutate` of an optimistic mutation.
 */
export async function optimisticUpdate<T>(
  qc: QueryClient,
  key: QueryKey,
  update: (old: T[]) => T[],
): Promise<() => void> {
  await qc.cancelQueries({ queryKey: key })
  const snapshot = qc.getQueryData<T[]>(key)
  qc.setQueryData<T[]>(key, (old) => update(old ?? []))
  return () => {
    qc.setQueryData<T[]>(key, snapshot)
  }
}

/** The `onError` of an optimistic mutation: roll back, refetch the truth, tell the user. */
export function failOptimistic(
  qc: QueryClient,
  keys: QueryKey[],
  restore: (() => void) | undefined,
  err: unknown,
  kind: WriteKind = 'generic',
): void {
  restore?.()
  for (const queryKey of keys) void qc.invalidateQueries({ queryKey })
  useToastStore.getState().show(messageForError(err, kind))
}

/** Swaps the server's version of an item into a cached list (matched by id). */
export function replaceById<T extends { id: string }>(qc: QueryClient, key: QueryKey, saved: T): void {
  qc.setQueryData<T[]>(key, (old) => old?.map((x) => (x.id === saved.id ? saved : x)))
}
```

- [ ] **Step 6: Implement `src/api/pantry.ts`**

```ts
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PantryItem } from '../types/pantry'
import type { Recipe } from '../types/recipes'
import { applyPantryDeltas, type PantryDelta } from '../utils/pantryDeltas'
import { api } from './client'
import { failOptimistic, optimisticUpdate, replaceById } from './optimistic'
import { queryKeys } from './queryKeys'

export const pantryQueryOptions = queryOptions({
  queryKey: queryKeys.pantry,
  queryFn: () => api.get<PantryItem[]>('/pantry'),
})

const NONE: PantryItem[] = []

/** The cached pantry. The AppShell gate guarantees it is loaded before any page renders. */
export function usePantry(): PantryItem[] {
  return useQuery(pantryQueryOptions).data ?? NONE
}

/** A new item with a client-side id, so the optimistic copy and the saved one are the same row. */
export function newPantryItem(data: { ingredientId: string; quantity: number; maxStock?: number }): PantryItem {
  return {
    id: crypto.randomUUID(),
    ingredientId: data.ingredientId,
    quantity: data.quantity,
    maxStock: data.maxStock ?? Math.max(1, data.quantity * 3),
  }
}

/** What cooking a recipe once takes out of the pantry. */
export function recipeDeltas(recipe: Pick<Recipe, 'ingredients'>): PantryDelta[] {
  return recipe.ingredients.map((ing) => ({ ingredientId: ing.ingredientId, delta: -ing.quantity }))
}

export interface PantryPatch {
  quantity?: number
  maxStock?: number
}

const KEYS = [queryKeys.pantry]

export function useAddPantryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: PantryItem) => api.post<PantryItem>('/pantry', item),
    onMutate: (item) => optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) => [...old, item]),
    onSuccess: (saved) => replaceById(qc, queryKeys.pantry, saved),
    onError: (err, _item, restore) => failOptimistic(qc, KEYS, restore, err),
  })
}

export function useUpdatePantryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PantryPatch }) => api.put<PantryItem>(`/pantry/${id}`, patch),
    onMutate: ({ id, patch }) =>
      optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) =>
        old.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      ),
    onSuccess: (saved) => replaceById(qc, queryKeys.pantry, saved),
    onError: (err, _vars, restore) => failOptimistic(qc, KEYS, restore, err),
  })
}

export function useDeletePantryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pantry/${id}`),
    onMutate: (id) => optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) => old.filter((i) => i.id !== id)),
    onError: (err, _id, restore) => failOptimistic(qc, KEYS, restore, err, 'delete'),
  })
}

/** Quantity deltas keyed by ingredient (cooking, shopping). Mirrors the old `batchUpdatePantry` of the slice. */
export function useBatchPantry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deltas: PantryDelta[]) => api.put<PantryItem[]>('/pantry/batch', { deltas }),
    onMutate: (deltas) =>
      optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) => applyPantryDeltas(old, deltas)),
    onSuccess: (changed) => {
      const byId = new Map(changed.map((i) => [i.id, i]))
      qc.setQueryData<PantryItem[]>(queryKeys.pantry, (old) => old?.map((i) => byId.get(i.id) ?? i))
    },
    onError: (err, _deltas, restore) => failOptimistic(qc, KEYS, restore, err),
  })
}
```

- [ ] **Step 7: Implement `src/api/mealPlan.ts`**

```ts
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MealPlanEntry } from '../types/mealPlan'
import { api } from './client'
import { failOptimistic, optimisticUpdate, replaceById } from './optimistic'
import { queryKeys } from './queryKeys'

export const mealPlanQueryOptions = queryOptions({
  queryKey: queryKeys.mealPlan,
  queryFn: () => api.get<MealPlanEntry[]>('/meal-plan'),
})

const NONE: MealPlanEntry[] = []

/** The cached meal plan. The AppShell gate guarantees it is loaded before any page renders. */
export function useMealPlan(): MealPlanEntry[] {
  return useQuery(mealPlanQueryOptions).data ?? NONE
}

export type MealPlanPatch = Partial<Omit<MealPlanEntry, 'id'>>

/** A new entry with a client-side id, so the optimistic copy and the saved one are the same row. */
export function newMealEntry(data: Omit<MealPlanEntry, 'id' | 'cooked'>): MealPlanEntry {
  return { id: crypto.randomUUID(), ...data }
}

const KEYS = [queryKeys.mealPlan]

export function useAddMealEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entry: MealPlanEntry) => api.post<MealPlanEntry>('/meal-plan', entry),
    onMutate: (entry) => optimisticUpdate<MealPlanEntry>(qc, queryKeys.mealPlan, (old) => [...old, entry]),
    onSuccess: (saved) => replaceById(qc, queryKeys.mealPlan, saved),
    onError: (err, _entry, restore) => failOptimistic(qc, KEYS, restore, err),
  })
}

/** Patch an entry, for example move it to another day or slot. */
export function useUpdateMealEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MealPlanPatch }) =>
      api.put<MealPlanEntry>(`/meal-plan/${id}`, patch),
    onMutate: ({ id, patch }) =>
      optimisticUpdate<MealPlanEntry>(qc, queryKeys.mealPlan, (old) =>
        old.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      ),
    onSuccess: (saved) => replaceById(qc, queryKeys.mealPlan, saved),
    onError: (err, _vars, restore) => failOptimistic(qc, KEYS, restore, err),
  })
}

export function useRemoveMealEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/meal-plan/${id}`),
    onMutate: (id) => optimisticUpdate<MealPlanEntry>(qc, queryKeys.mealPlan, (old) => old.filter((e) => e.id !== id)),
    onError: (err, _id, restore) => failOptimistic(qc, KEYS, restore, err, 'delete'),
  })
}
```

- [ ] **Step 8: Implement `src/api/cooking.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'
import { applyPantryDeltas, type PantryDelta } from '../utils/pantryDeltas'
import { api } from './client'
import { failOptimistic, optimisticUpdate } from './optimistic'
import { queryKeys } from './queryKeys'

export interface SetCookedInput {
  /** The entry as it is now (its `cooked` flag is the state to go back to on failure). */
  entry: MealPlanEntry
  /** Pantry changes that go with the new state (see `buildCookDeltas`); empty = none. */
  deltas: PantryDelta[]
  /** The new state. */
  cooked: boolean
}

/**
 * Marks a planned meal cooked or not and moves the pantry with it. Both caches change at once; the server gets
 * the entry first and the pantry batch second. If the batch fails the entry is put back (best effort).
 */
export function useSetEntryCooked() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ entry, deltas, cooked }: SetCookedInput) => {
      await api.put<MealPlanEntry>(`/meal-plan/${entry.id}`, { cooked })
      if (deltas.length === 0) return
      try {
        await api.put<PantryItem[]>('/pantry/batch', { deltas })
      } catch (err) {
        try {
          await api.put<MealPlanEntry>(`/meal-plan/${entry.id}`, { cooked: !!entry.cooked })
        } catch {
          // best-effort reversal: the refetch after the rollback shows the server's truth
        }
        throw err
      }
    },
    onMutate: async ({ entry, deltas, cooked }) => {
      const restoreEntries = await optimisticUpdate<MealPlanEntry>(qc, queryKeys.mealPlan, (old) =>
        old.map((e) => (e.id === entry.id ? { ...e, cooked } : e)),
      )
      const restorePantry = await optimisticUpdate<PantryItem>(qc, queryKeys.pantry, (old) =>
        applyPantryDeltas(old, deltas),
      )
      return () => {
        restoreEntries()
        restorePantry()
      }
    },
    onError: (err, _input, restore) => failOptimistic(qc, [queryKeys.mealPlan, queryKeys.pantry], restore, err),
  })
}
```

- [ ] **Step 9: Run the gate**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/cookedPantryDeduction.test.ts src/__tests__/pantryApi.test.tsx src/__tests__/mealPlanApi.test.tsx src/__tests__/cookingApi.test.tsx src/__tests__/toastHost.test.tsx`
Expected: PASS. Note `cookedPantryDeduction.test.ts` still imports `buildCookDeltas` from `features/meal-planner/MealPlanOverlay` (untouched until Task 7), which transitively imports the old store; that is fine.
Regression files: `src/__tests__/apiClient.test.ts src/__tests__/testHelpers.test.tsx src/__tests__/ingredientsApi.test.tsx src/__tests__/tagsApi.test.tsx src/__tests__/recipesApi.test.tsx src/__tests__/ingredientSearch.test.ts`. Then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json`.

- [ ] **Step 10: Commit**

```bash
git add src/utils/pantryDeltas.ts src/store/toastStore.ts src/components/ui/ToastHost.tsx src/api/optimistic.ts src/api/pantry.ts src/api/mealPlan.ts src/api/cooking.ts src/__tests__/cookedPantryDeduction.test.ts src/__tests__/pantryApi.test.tsx src/__tests__/mealPlanApi.test.tsx src/__tests__/cookingApi.test.tsx src/__tests__/toastHost.test.tsx
git commit -m "feat(api): optimistic pantry, meal plan and cooking hooks with a global toast store" -- src/utils/pantryDeltas.ts src/store/toastStore.ts src/components/ui/ToastHost.tsx src/api/optimistic.ts src/api/pantry.ts src/api/mealPlan.ts src/api/cooking.ts src/__tests__/cookedPantryDeduction.test.ts src/__tests__/pantryApi.test.tsx src/__tests__/mealPlanApi.test.tsx src/__tests__/cookingApi.test.tsx src/__tests__/toastHost.test.tsx
```

---

### Task 5: Recipe editing UI: IngredientAutocomplete, RecipeDetail, AddEditRecipeModal

Switches the three components that edit and show a recipe to the cached lists and the awaited writes: creating an ingredient (the autocomplete shows a short spinner and returns the saved entry), creating a tag, and the recipe save, which runs only after every new ingredient and tag it needs exists. Maps 409 / 422 / network errors to inline messages.

Tests REPLACED in this task (they seeded localStorage and asserted the Zustand store): `IngredientAutocomplete.test.tsx`, `AddEditRecipeModalImport.test.tsx`, `AddEditRecipeModalImportAi.test.tsx`. New: `RecipeDetail.test.tsx`, `AddEditRecipeModalSave.test.tsx`.

**Files:**
- Modify (full rewrite): `src/components/shared/IngredientAutocomplete.tsx`
- Modify: `src/components/shared/RecipeDetail.tsx`, `src/features/recipes/AddEditRecipeModal.tsx`
- Test (replace): `src/__tests__/IngredientAutocomplete.test.tsx`, `src/__tests__/AddEditRecipeModalImport.test.tsx`, `src/__tests__/AddEditRecipeModalImportAi.test.tsx`
- Test (create): `src/__tests__/RecipeDetail.test.tsx`, `src/__tests__/AddEditRecipeModalSave.test.tsx`

**Interfaces:**
- Consumes (Task 2/3): `useIngredients(): IngredientDbEntry[]`, `useCreateIngredient()` (`mutateAsync(input: NewIngredient): Promise<IngredientDbEntry>`, `isPending`), `useTags(): Tag[]`, `useCreateTag()` (`mutateAsync(input: NewTag): Promise<Tag>`, `isPending`), `useRecipes(): Recipe[]`, `useSaveRecipe()` (`mutateAsync({ id?: string; data: RecipeInput }): Promise<Recipe>`), `searchIngredients(list, query)`, `messageForError(err, kind)`, `WriteKind`, test helpers.
- Produces: the public props of the three components are unchanged: `IngredientAutocomplete({ value, onChange, onSelect(entry: IngredientDbEntry), placeholder? })`, `RecipeDetail(props)`, `AddEditRecipeModal({ mode: 'add' | 'edit' | 'import', recipe?, draft?, onClose })`. New behaviour: `onSelect` after "Create" fires only after the server saved the ingredient; the modal's Save button shows "Saving…" and is disabled while a save runs; a failed save shows a `role="alert"` message in the footer and keeps the modal open; `onClose` is called only after the recipe was saved.

- [ ] **Step 1: Write the failing tests**

Replace `src/__tests__/IngredientAutocomplete.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { IngredientAutocomplete } from '../components/shared/IngredientAutocomplete'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { IngredientDbEntry } from '../types/ingredients'

const SEED: IngredientDbEntry[] = ['Chicken breast', 'Chicken thigh', 'Chickpeas'].map((name, i) => ({
  id: `ing-${i}`,
  name,
  default_unit: 'g',
  category: 'Other',
}))

describe('IngredientAutocomplete', () => {
  let rendered: Rendered | undefined

  afterEach(() => {
    rendered?.unmount()
    rendered = undefined
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  async function renderComponent(
    value: string,
    { onChange = vi.fn(), onSelect = vi.fn(), typed = true }: { onChange?: ReturnType<typeof vi.fn>; onSelect?: ReturnType<typeof vi.fn>; typed?: boolean } = {},
  ) {
    rendered = renderWithClient(<IngredientAutocomplete value={value} onChange={onChange} onSelect={onSelect} />, {
      seed: { ingredients: SEED },
    })
    const container = rendered.container
    if (typed) {
      // The dropdown opens only after the user types, so simulate a keystroke
      const input = container.querySelector('input') as HTMLInputElement
      await act(async () => {
        typeInto(input, value + 'x')
      })
    }
    return { container, onChange, onSelect }
  }

  const dropdownOf = (c: HTMLElement) => c.querySelector('[data-testid="ingredient-dropdown"]')

  async function openUnitPicker(container: HTMLElement) {
    const createDiv = dropdownOf(container)!.querySelector('div') as HTMLElement
    await act(async () => {
      createDiv.click()
    })
    return container.querySelector('[data-testid="unit-picker"]')!
  }
  const unitButton = (picker: Element, unit: string) =>
    Array.from(picker.querySelectorAll('button')).find((b) => b.textContent === unit) as HTMLButtonElement

  it('(a) input with 2 chars renders a dropdown element', async () => {
    const { container } = await renderComponent('ch')
    expect(dropdownOf(container)).not.toBeNull()
  })

  it('pre-filled value does not open the dropdown until the user types', async () => {
    const { container } = await renderComponent('chicken', { typed: false })
    expect(dropdownOf(container)).toBeNull()
  })

  it('(b) input with 1 char renders no dropdown', async () => {
    const { container } = await renderComponent('c')
    expect(dropdownOf(container)).toBeNull()
  })

  it('(c) clicking a dropdown entry calls onSelect with the cached IngredientDbEntry', async () => {
    const onSelect = vi.fn()
    const { container } = await renderComponent('chi', { onSelect })
    const firstItem = dropdownOf(container)!.querySelector('div') as HTMLElement
    await act(async () => {
      firstItem.click()
    })
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect.mock.calls[0][0]).toEqual(SEED[0])
  })

  it('(d) typing a no-match name renders a Create option', async () => {
    const { container } = await renderComponent('Tahini')
    expect(dropdownOf(container)!.textContent).toContain('Create')
  })

  it('(d2) Create is offered next to partial matches', async () => {
    const { container } = await renderComponent('Chick')
    const dropdown = dropdownOf(container)!
    expect(dropdown.textContent).toContain('Chicken breast')
    expect(dropdown.querySelector('[data-testid="ingredient-create"]')).not.toBeNull()
  })

  it('(d3) Create is not offered when the typed name matches an ingredient exactly', async () => {
    const { container } = await renderComponent('chickpeas')
    const dropdown = dropdownOf(container)!
    expect(dropdown.textContent).toContain('Chickpeas')
    expect(dropdown.querySelector('[data-testid="ingredient-create"]')).toBeNull()
  })

  it('(e) Create then a unit POSTs the ingredient and calls onSelect with the saved entry', async () => {
    const server = installApi({ seed: { ingredients: SEED } })
    const onSelect = vi.fn()
    const onChange = vi.fn()
    const { container } = await renderComponent('Tahini', { onChange, onSelect })
    const picker = await openUnitPicker(container)
    onChange.mockClear() // drop the helper's simulated keystroke

    await act(async () => {
      unitButton(picker, 'tbsp').click()
    })
    await waitFor(() => expect(onSelect).toHaveBeenCalledOnce())

    // Clearing the input after creation would wipe the freshly selected ingredient
    expect(onChange).not.toHaveBeenCalled()
    expect(server.find('POST', '/api/ingredients')[0].body).toEqual({ name: 'Tahini', default_unit: 'tbsp', category: 'Other' })
    const entry = onSelect.mock.calls[0][0] as IngredientDbEntry
    expect(entry).toEqual({ id: 'srv-1', name: 'Tahini', default_unit: 'tbsp', category: 'Other' })
    expect(rendered!.client.getQueryData(queryKeys.ingredients)).toContainEqual(entry)
    expect(container.querySelector('[data-testid="unit-picker"]')).toBeNull()
  })

  it('(e2) shows a spinner and disables the units while the server saves, and selects nothing before it answers', async () => {
    const g = gate()
    installApi({
      seed: { ingredients: SEED },
      handler: async (call) => {
        if (call.method === 'POST') await g.wait
        return undefined
      },
    })
    const onSelect = vi.fn()
    const { container } = await renderComponent('Tahini', { onSelect })
    const picker = await openUnitPicker(container)
    await act(async () => {
      unitButton(picker, 'tbsp').click()
    })
    await waitFor(() => expect(container.querySelector('[data-testid="ingredient-saving"]')).not.toBeNull())
    expect(unitButton(picker, 'g').disabled).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()

    g.open()
    await waitFor(() => expect(onSelect).toHaveBeenCalledOnce())
    expect(container.querySelector('[data-testid="ingredient-saving"]')).toBeNull()
  })

  it('(e3) a 409 (name already exists) shows a message, keeps the picker open and selects nothing', async () => {
    installApi({
      seed: { ingredients: SEED },
      handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined),
    })
    const onSelect = vi.fn()
    const { container } = await renderComponent('Tahini', { onSelect })
    const picker = await openUnitPicker(container)
    await act(async () => {
      unitButton(picker, 'tbsp').click()
    })
    await waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('An ingredient with that name already exists.'))
    expect(onSelect).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="unit-picker"]')).not.toBeNull()
  })

  it('(f) Escape key closes dropdown without calling onSelect', async () => {
    const onSelect = vi.fn()
    const onChange = vi.fn()
    const { container } = await renderComponent('chi', { onChange, onSelect })
    expect(dropdownOf(container)).not.toBeNull()

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(dropdownOf(container)).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('(g) mousedown outside closes dropdown without clearing input', async () => {
    const onSelect = vi.fn()
    const onChange = vi.fn()
    const { container } = await renderComponent('chi', { onChange, onSelect })
    expect(dropdownOf(container)).not.toBeNull()

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(dropdownOf(container)).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalledWith('')
  })

  it('(f2) Escape when both pickers are closed is a no-op: onChange not called', async () => {
    const onChange = vi.fn()
    const onSelect = vi.fn()
    const { container } = await renderComponent('', { onChange, onSelect, typed: false })
    expect(dropdownOf(container)).toBeNull()

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('(h) Escape while the unit picker is open closes it without creating anything', async () => {
    const server = installApi({ seed: { ingredients: SEED } })
    const onSelect = vi.fn()
    const { container } = await renderComponent('Tahini', { onSelect })
    await openUnitPicker(container)

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(container.querySelector('[data-testid="unit-picker"]')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(server.calls).toHaveLength(0)
  })
})
```

Create `src/__tests__/RecipeDetail.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { act } from 'react'
import { RecipeDetail } from '../components/shared/RecipeDetail'
import { FLOUR, MILK, PANCAKES, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, type Rendered } from '../test/renderWithClient'

const SEED = { recipes: [PANCAKES], tags: [TAG_BREAKFAST], ingredients: [FLOUR, MILK] }

describe('RecipeDetail', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
  })

  const text = () => document.body.textContent ?? ''

  it('shows the recipe, its tags and its ingredients with units from the cached lists', () => {
    rendered = renderWithClient(<RecipeDetail recipeId="rec-pancakes" context="recipes" />, { seed: SEED })
    expect(text()).toContain('Pancakes')
    expect(text()).toContain('Breakfast')
    expect(text()).toContain('Flour')
    expect(text()).toContain('200 g')
    expect(text()).toContain('Milk')
    expect(text()).toContain('300 ml')
    expect(text()).toContain('Mix and fry.')
  })

  it('scales the quantities with the servings stepper', () => {
    rendered = renderWithClient(<RecipeDetail recipeId="rec-pancakes" context="recipes" />, { seed: SEED })
    const plus = document.body.querySelector('button[aria-label="Increase servings"]') as HTMLButtonElement
    act(() => plus.click())
    expect(text()).toContain('300 g')
    expect(text()).toContain('450 ml')
  })

  it('shows the placeholder when there is no such recipe', () => {
    rendered = renderWithClient(<RecipeDetail recipeId="nope" context="recipes" />, { seed: SEED })
    expect(text()).toContain('Select a recipe to see details')
  })
})
```

Replace `src/__tests__/AddEditRecipeModalImport.test.tsx`:

```tsx
// code/src/__tests__/AddEditRecipeModalImport.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { queryKeys } from '../api/queryKeys'
import { installApi } from '../test/fetchMock'
import { FLOUR } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { RecipeDraft } from '../services/recipeImport/mapToRecipe'
import type { Recipe } from '../types/recipes'

type SavedBody = { name: string; notes: string; ingredients: { ingredientId: string; quantity: number }[] }

describe('AddEditRecipeModal: import review mode', () => {
  const onClose = vi.fn()
  const flourId = FLOUR.id
  let rendered: Rendered
  let server: ReturnType<typeof installApi>
  const recipePosts = () => server.find('POST', '/api/recipes')
  const savedBody = () => recipePosts()[0].body as SavedBody

  function draft(over: Partial<RecipeDraft> = {}): RecipeDraft {
    return {
      name: 'Pancakes',
      servings: 4,
      notes: '1. Mix\n\nZdroj: [example.com](https://example.com/p)',
      sourceHost: 'example.com',
      rows: [
        { ingredientId: flourId, ingredientName: 'Flour', quantity: 200, unit: 'g', flagged: false, sourceText: '200 g flour' },
        { ingredientId: null, ingredientName: 'saffron', quantity: 2, unit: '', flagged: true, sourceText: '2 g saffron' },
      ],
      ...over,
    }
  }

  beforeEach(() => {
    onClose.mockReset()
    server = installApi({ seed: { ingredients: [FLOUR] } })
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  function renderImport(d: RecipeDraft) {
    rendered = renderWithClient(<AddEditRecipeModal mode="import" draft={d} onClose={onClose} />, {
      seed: { ingredients: [FLOUR] },
    })
  }
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const text = () => document.body.textContent ?? ''

  it('shows the banner, the title, and counts of unmatched and flagged rows', () => {
    renderImport(draft())
    expect(text()).toContain('Review imported recipe')
    expect(text()).toContain('Imported from example.com')
    expect(text()).toContain('1 ingredient needs matching')
    expect(text()).toContain('From page: 2 g saffron')
  })

  it('sends nothing before Save, and Discard saves nothing', () => {
    renderImport(draft())
    expect(server.calls).toHaveLength(0)
    act(() => button('Discard').click())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(server.calls).toHaveLength(0)
  })

  it('asks before dropping unmatched ingredients, and Go back keeps everything unsaved', () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient?')
    expect(server.calls).toHaveLength(0)

    act(() => button('Go back').click())
    expect(text()).not.toContain('Save without')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Save anyway saves the recipe with only the matched ingredient', async () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    await act(async () => button('Save anyway').click())

    await waitFor(() => expect(recipePosts()).toHaveLength(1))
    expect(savedBody().name).toBe('Pancakes')
    expect(savedBody().ingredients).toEqual([{ ingredientId: flourId, quantity: 200 }])
    expect(savedBody().notes).toContain('Zdroj: [example.com]')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(rendered.client.getQueryData<Recipe[]>(queryKeys.recipes)).toHaveLength(1)
  })

  it('saves directly, with no confirmation, when every row is matched', async () => {
    renderImport(draft({ rows: [draft().rows[0]] }))
    await act(async () => button('Save recipe').click())
    expect(text()).not.toContain('Save without')
    await waitFor(() => expect(recipePosts()).toHaveLength(1))
  })

  it('editing a flagged quantity clears its flag', () => {
    renderImport(
      draft({
        rows: [{ ingredientId: flourId, ingredientName: 'Flour', quantity: 0, unit: 'g', flagged: true, sourceText: '2 cup flour' }],
      }),
    )
    expect(text()).toContain('1 quantity to check')
    const qty = document.body.querySelector('input[aria-label="Quantity"]') as HTMLInputElement
    act(() => typeInto(qty, '250'))
    expect(text()).not.toContain('quantity to check')
  })

  const zeroRow = (over = {}) => ({
    ingredientId: flourId,
    ingredientName: 'Flour',
    quantity: 0,
    unit: 'g',
    flagged: true,
    sourceText: '2 cup flour',
    ...over,
  })
  const unboundRow = (name = 'saffron') => ({
    ingredientId: null,
    ingredientName: name,
    quantity: 2,
    unit: '',
    flagged: true,
    sourceText: `2 g ${name}`,
  })

  it('asks before saving a matched row at quantity 0, and does not save yet', async () => {
    renderImport(draft({ rows: [zeroRow()] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save 1 ingredient with quantity 0?')
    expect(recipePosts()).toHaveLength(0)
    await act(async () => button('Save anyway').click())
    await waitFor(() => expect(recipePosts()).toHaveLength(1))
    expect(savedBody().ingredients).toEqual([{ ingredientId: flourId, quantity: 0 }])
  })

  it('uses plural wording for the zero-quantity prompt', () => {
    renderImport(draft({ rows: [zeroRow(), zeroRow()] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save 2 ingredients with quantity 0?')
  })

  it('combines both kinds in one prompt', () => {
    renderImport(draft({ rows: [zeroRow(), unboundRow()] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient and with 1 at quantity 0?')
    expect(recipePosts()).toHaveLength(0)
  })

  it('drops the prompt, never showing "Save without 0", once the last issue is fixed', () => {
    renderImport(draft({ rows: [zeroRow()] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('with quantity 0?')
    const qty = document.body.querySelector('input[aria-label="Quantity"]') as HTMLInputElement
    act(() => typeInto(qty, '250'))
    expect(text()).not.toContain('Save without')
    expect(text()).not.toContain('quantity 0?')
    expect(button('Discard')).toBeDefined()
    expect(button('Save recipe')).toBeDefined()
  })

  it('removing the last unmatched row while the prompt is open never reads "Save without 0"', () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient?')
    const removes = document.body.querySelectorAll('button[aria-label="Remove ingredient"]')
    act(() => (removes[1] as HTMLButtonElement).click())
    expect(text()).not.toContain('Save without')
    expect(button('Save recipe')).toBeDefined()
  })

  it('selecting an ingredient for an unbound row clears its flag and the unmatched count', () => {
    renderImport(draft({ rows: [unboundRow('Flour')] }))
    expect(text()).toContain('1 ingredient needs matching')
    const ing = document.body.querySelector('input[placeholder="Ingredient…"]') as HTMLInputElement
    act(() => typeInto(ing, 'Flou'))
    const option = Array.from(document.body.querySelectorAll('[data-testid="ingredient-dropdown"] div')).find((d) =>
      d.textContent?.trim().startsWith('Flour'),
    ) as HTMLElement
    act(() => option.click())
    expect(text()).not.toContain('needs matching')
    expect(text()).not.toContain('From page:')
    expect(document.body.querySelector('.rf-flagged')).toBeNull()
  })

  it('uses plural wording in the banner', () => {
    renderImport(draft({ rows: [unboundRow('saffron'), unboundRow('cumin'), zeroRow(), zeroRow()] }))
    expect(text()).toContain('2 ingredients need matching')
    expect(text()).toContain('2 quantities to check')
  })

  it('leaves normal add mode unchanged', () => {
    rendered = renderWithClient(<AddEditRecipeModal mode="add" onClose={onClose} />, { seed: { ingredients: [FLOUR] } })
    expect(text()).toContain('New Recipe')
    expect(text()).not.toContain('Imported from')
    expect(button('Cancel')).toBeDefined()
    expect(button('Save')).toBeDefined()
  })
})
```

Replace `src/__tests__/AddEditRecipeModalImportAi.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { installApi } from '../test/fetchMock'
import { FLOUR } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { DraftRow, RecipeDraft } from '../services/recipeImport/mapToRecipe'
import type { Tag } from '../types/recipes'

type SavedBody = { ingredients: { ingredientId: string; quantity: number }[]; tagIds: string[] }

const TAG_SOUP: Tag = { id: 'tag-soup', name: 'Polievka', color: '#26A69A' }

describe('AddEditRecipeModal: import review with AI proposals', () => {
  const onClose = vi.fn()
  const flourId = FLOUR.id
  let rendered: Rendered
  let server: ReturnType<typeof installApi>

  const cabbage: DraftRow = {
    ingredientId: null,
    ingredientName: 'čínska kapusta',
    quantity: 300,
    unit: 'g',
    flagged: true,
    estimated: true,
    matchedBy: 'ai',
    sourceText: '1/3 čínskej kapusty',
    newIngredient: { name: 'čínska kapusta', default_unit: 'g', category: 'Produce' },
  }
  const flour = (): DraftRow => ({
    ingredientId: flourId,
    ingredientName: 'Flour',
    quantity: 100,
    unit: 'g',
    flagged: false,
    estimated: false,
    matchedBy: 'ai',
    sourceText: '100 g múky',
    newIngredient: null,
  })
  const draft = (over: Partial<RecipeDraft> = {}): RecipeDraft => ({
    name: 'Rezance',
    servings: 2,
    notes: '',
    sourceHost: 'example.com',
    rows: [cabbage, flour()],
    tagIds: [TAG_SOUP.id],
    newTags: ['krevety'],
    ...over,
  })

  beforeEach(() => {
    onClose.mockReset()
    server = installApi({ seed: { ingredients: [FLOUR], tags: [TAG_SOUP] } })
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  function renderDraft(d: RecipeDraft) {
    rendered = renderWithClient(<AddEditRecipeModal mode="import" draft={d} onClose={onClose} />, {
      seed: { ingredients: [FLOUR], tags: [TAG_SOUP] },
    })
  }
  const text = () => document.body.textContent ?? ''
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const posts = (path: string) => server.find('POST', path)
  const recipeBody = () => posts('/api/recipes')[0].body as SavedBody

  it('shows the hints and banner counts for new, AI-matched and estimated rows', () => {
    renderDraft(draft())
    expect(text()).toContain('New ingredient (g) · ≈ estimated · From page: 1/3 čínskej kapusty')
    expect(text()).toContain('Matched by AI · From page: 100 g múky')
    expect(text()).toContain('1 new ingredient will be created')
    expect(text()).toContain('1 quantity estimated')
  })

  it('creates nothing before Save, and Discard creates nothing', () => {
    renderDraft(draft())
    act(() => button('Discard').click())
    expect(server.calls).toHaveLength(0)
  })

  it('Save creates the new ingredient and the new tag first, then the recipe bound to their server ids', async () => {
    renderDraft(draft())
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(posts('/api/recipes')).toHaveLength(1))
    expect(text()).not.toContain('Save without')

    // The recipe is only sent once everything it points at exists
    expect(server.calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([
      '/api/ingredients',
      '/api/tags',
      '/api/recipes',
    ])
    expect(posts('/api/ingredients')[0].body).toEqual({ name: 'čínska kapusta', default_unit: 'g', category: 'Produce' })
    expect(posts('/api/tags')[0].body).toEqual({ name: 'krevety', color: '#9E9E9E' })
    expect(recipeBody().ingredients).toEqual([
      { ingredientId: 'srv-1', quantity: 300 },
      { ingredientId: flourId, quantity: 100 },
    ])
    expect(recipeBody().tagIds).toEqual([TAG_SOUP.id, 'srv-2'])
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('a deselected new tag is not created', async () => {
    renderDraft(draft())
    // the chip's text may sit in a nested element: take the deepest match, the click bubbles to the chip
    const chip = Array.from(document.body.querySelectorAll('*'))
      .filter((el) => el.textContent?.trim() === 'krevety (new)')
      .pop() as HTMLElement
    act(() => chip.click())
    expect(text()).not.toContain('krevety (new)')
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(posts('/api/recipes')).toHaveLength(1))
    expect(posts('/api/tags')).toHaveLength(0)
    expect(recipeBody().tagIds).toEqual([TAG_SOUP.id])
  })

  it('creates a new ingredient once when two rows propose it', async () => {
    renderDraft(draft({ rows: [cabbage, { ...cabbage, ingredientName: 'Čínska kapusta ' }] }))
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(posts('/api/recipes')).toHaveLength(1))
    expect(posts('/api/ingredients')).toHaveLength(1)
    const [first, second] = recipeBody().ingredients
    expect(first.ingredientId).toBe(second.ingredientId)
  })

  it('editing the estimated quantity clears the estimate hint', () => {
    renderDraft(draft())
    const qty = document.body.querySelector('input[aria-label="Quantity"]') as HTMLInputElement
    act(() => typeInto(qty, '250'))
    expect(text()).not.toContain('≈ estimated')
    expect(text()).not.toContain('quantity estimated')
  })

  it('typing in the name of a new-ingredient row cancels the creation', () => {
    renderDraft(draft())
    const nameInput = document.body.querySelector('.rf-ing-row input:not([type="number"])') as HTMLInputElement
    act(() => typeInto(nameInput, 'kapusta pekinská'))
    expect(text()).not.toContain('will be created')
    expect(text()).not.toContain('New ingredient (g)')
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient?')
    expect(server.calls).toHaveLength(0)
  })

  it('a new ingredient with quantity 0 asks before saving', () => {
    renderDraft(draft({ rows: [{ ...cabbage, quantity: 0, estimated: false }] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save 1 ingredient with quantity 0?')
    expect(server.calls).toHaveLength(0)
  })

  it('typing over an AI-matched row drops the "Matched by AI" label', () => {
    renderDraft(draft())
    const nameInputs = document.body.querySelectorAll<HTMLInputElement>('.rf-ing-row input:not([type="number"])')
    act(() => typeInto(nameInputs[1], 'Fl'))
    expect(text()).not.toContain('Matched by AI')
  })

  it('a proposal with an invalid unit is an ordinary unmatched row and is never created', async () => {
    const bad: DraftRow = {
      ...cabbage,
      estimated: false,
      newIngredient: { name: 'čínska kapusta', default_unit: 'cup' as never, category: 'Produce' },
    }
    renderDraft(draft({ rows: [bad, flour()] }))
    expect(text()).toContain('1 ingredient needs matching')
    expect(text()).not.toContain('will be created')
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save without 1 unmatched ingredient?')
    expect(server.calls).toHaveLength(0)
    await act(async () => button('Save anyway').click())
    await waitFor(() => expect(posts('/api/recipes')).toHaveLength(1))
    expect(posts('/api/ingredients')).toHaveLength(0)
    expect(recipeBody().ingredients).toEqual([{ ingredientId: flourId, quantity: 100 }])
  })
})
```

Create `src/__tests__/AddEditRecipeModalSave.test.tsx` (add and edit modes, the awaited tag form, error mapping, retry):

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { FLOUR, MILK, PANCAKES, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { DraftRow, RecipeDraft } from '../services/recipeImport/mapToRecipe'

const SEED = { ingredients: [FLOUR, MILK], tags: [TAG_BREAKFAST] }

describe('AddEditRecipeModal: saving', () => {
  const onClose = vi.fn()
  let rendered: Rendered

  beforeEach(() => {
    onClose.mockReset()
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  const text = () => document.body.textContent ?? ''
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const alertText = () => document.body.querySelector('[role="alert"]')?.textContent ?? ''
  const nameInput = () => document.body.querySelector('textarea[aria-label="Name"]') as HTMLTextAreaElement

  function renderAdd() {
    rendered = renderWithClient(<AddEditRecipeModal mode="add" onClose={onClose} />, { seed: SEED })
  }
  function renderEdit() {
    rendered = renderWithClient(<AddEditRecipeModal mode="edit" recipe={PANCAKES} onClose={onClose} />, { seed: SEED })
  }

  it('add: POSTs the recipe and closes after the server answered', async () => {
    const server = installApi({ seed: SEED })
    renderAdd()
    act(() => typeInto(nameInput(), 'Soup'))
    await act(async () => button('Save').click())
    await waitFor(() => expect(server.find('POST', '/api/recipes')).toHaveLength(1))
    expect(server.find('POST', '/api/recipes')[0].body).toEqual({
      emoji: '🍽️',
      name: 'Soup',
      servings: 2,
      tagIds: [],
      ingredients: [],
      notes: '',
    })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('add: a recipe without a name sends nothing', async () => {
    const server = installApi({ seed: SEED })
    renderAdd()
    await act(async () => button('Save').click())
    expect(server.calls).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('edit: PUTs /api/recipes/<id> with the full body and no createdAt', async () => {
    const server = installApi({ seed: { ...SEED, recipes: [PANCAKES] } })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(server.find('PUT', '/api/recipes/rec-pancakes')).toHaveLength(1))
    expect(server.find('PUT', '/api/recipes/rec-pancakes')[0].body).toEqual({
      emoji: '🥞',
      name: 'Pancakes',
      servings: 2,
      tagIds: ['tag-breakfast'],
      ingredients: [
        { ingredientId: 'ing-flour', quantity: 200 },
        { ingredientId: 'ing-milk', quantity: 300 },
      ],
      notes: 'Mix and fry.',
    })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('shows Saving… and disables the button while the request is in flight, and does not close early', async () => {
    const g = gate()
    installApi({
      seed: { ...SEED, recipes: [PANCAKES] },
      handler: async (call) => {
        if (call.method === 'PUT') await g.wait
        return undefined
      },
    })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(button('Saving…')).toBeDefined())
    expect(button('Saving…').disabled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    g.open()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('a 409 on the recipe says something it uses no longer exists, and keeps the modal open', async () => {
    installApi({
      seed: { ...SEED, recipes: [PANCAKES] },
      handler: (call) => (call.method === 'PUT' ? errorResponse(409, 'conflict') : undefined),
    })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(alertText()).toContain('Something this recipe uses no longer exists'))
    expect(onClose).not.toHaveBeenCalled()
    expect(button('Save').disabled).toBe(false)
  })

  it('a 422 shows the validation message', async () => {
    installApi({
      seed: { ...SEED, recipes: [PANCAKES] },
      handler: (call) => (call.method === 'PUT' ? errorResponse(422, 'invalid') : undefined),
    })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(alertText()).toContain('rejected'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a network failure shows the generic save error', async () => {
    installApi({
      seed: { ...SEED, recipes: [PANCAKES] },
      handler: (call) => {
        if (call.method === 'PUT') throw new TypeError('Failed to fetch')
        return undefined
      },
    })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(alertText()).toBe('Could not save — please try again.'))
    expect(onClose).not.toHaveBeenCalled()
  })

  async function openNewTagForm() {
    act(() => button('Choose tags (1)').click())
    act(() => button('New tag').click())
    const input = document.body.querySelector('input[aria-label="Tag name"]') as HTMLInputElement
    act(() => typeInto(input, 'Soup'))
  }

  it('new tag: waits for the server, then selects the saved tag', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method === 'POST' && call.path === '/api/tags') await g.wait
        return undefined
      },
    })
    renderAdd()
    await openNewTagForm()
    await act(async () => button('Add').click())
    await waitFor(() => expect(button('Adding…')).toBeDefined())
    expect(button('Adding…').disabled).toBe(true)
    g.open()
    await waitFor(() => expect(server.find('POST', '/api/tags')).toHaveLength(1))
    expect(server.find('POST', '/api/tags')[0].body).toEqual({ name: 'Soup', color: '#f07045' })
    // the form closes and the saved tag is shown as selected
    await waitFor(() => expect(document.body.querySelector('input[aria-label="Tag name"]')).toBeNull())
    expect(text()).toContain('Tags(1)')
  })

  it('new tag: a 409 says the name already exists and keeps the form open', async () => {
    installApi({
      seed: SEED,
      handler: (call) => (call.method === 'POST' && call.path === '/api/tags' ? errorResponse(409, 'conflict') : undefined),
    })
    renderAdd()
    await openNewTagForm()
    await act(async () => button('Add').click())
    await waitFor(() => expect(alertText()).toBe('A tag with that name already exists.'))
    expect(document.body.querySelector('input[aria-label="Tag name"]')).not.toBeNull()
  })

  const newRow: DraftRow = {
    ingredientId: null,
    ingredientName: 'tahini',
    quantity: 50,
    unit: 'g',
    flagged: false,
    sourceText: '50 g tahini',
    newIngredient: { name: 'tahini', default_unit: 'g', category: 'Other' },
  }
  const importDraft = (): RecipeDraft => ({ name: 'Hummus', servings: 2, notes: '', sourceHost: 'example.com', rows: [newRow] })
  function renderImport() {
    rendered = renderWithClient(<AddEditRecipeModal mode="import" draft={importDraft()} onClose={onClose} />, { seed: SEED })
  }

  it('a 409 while creating a new ingredient says the name exists and never sends the recipe', async () => {
    const server = installApi({
      seed: SEED,
      handler: (call) => (call.path === '/api/ingredients' && call.method === 'POST' ? errorResponse(409, 'conflict') : undefined),
    })
    renderImport()
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(alertText()).toBe('An ingredient with that name already exists.'))
    expect(server.find('POST', '/api/recipes')).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a retry after a failed recipe save does not create the new ingredient twice', async () => {
    let recipeAttempts = 0
    const server = installApi({
      seed: SEED,
      handler: (call) =>
        call.method === 'POST' && call.path === '/api/recipes' && ++recipeAttempts === 1 ? errorResponse(409, 'conflict') : undefined,
    })
    renderImport()
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(alertText()).toContain('no longer exists'))
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(server.find('POST', '/api/ingredients')).toHaveLength(1)
    expect(server.find('POST', '/api/recipes')).toHaveLength(2)
    const retryBody = server.find('POST', '/api/recipes')[1].body as { ingredients: { ingredientId: string }[] }
    expect(retryBody.ingredients[0].ingredientId).toBe('srv-1')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/IngredientAutocomplete.test.tsx src/__tests__/RecipeDetail.test.tsx src/__tests__/AddEditRecipeModalImport.test.tsx src/__tests__/AddEditRecipeModalImportAi.test.tsx src/__tests__/AddEditRecipeModalSave.test.tsx`
Expected: FAIL (the components still read localStorage and the Zustand store, so seeded caches are ignored and nothing is POSTed).

- [ ] **Step 3: Rewrite `src/components/shared/IngredientAutocomplete.tsx` (full file)**

```tsx
import { useState, useEffect, useMemo, useRef } from 'react'
import { IngredientDbEntry } from '../../types/ingredients'
import { useCreateIngredient, useIngredients } from '../../api/ingredients'
import { messageForError } from '../../api/client'
import { searchIngredients } from '../../utils/ingredientSearch'

const CANONICAL_UNITS = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp'] as const

interface Props {
  value: string
  onChange: (v: string) => void
  onSelect: (entry: IngredientDbEntry) => void
  placeholder?: string
}

export function IngredientAutocomplete({ value, onChange, onSelect, placeholder }: Props) {
  const ingredients = useIngredients()
  const createIngredient = useCreateIngredient()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const [createError, setCreateError] = useState('')
  // Dropdown opens only once the user has typed — not for a pre-filled value on mount
  const [typed, setTyped] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(
    () => (value.length >= 2 ? searchIngredients(ingredients, value) : []),
    [ingredients, value],
  )

  useEffect(() => {
    if (value.length >= 2) {
      setShowDropdown(typed)
      setShowUnitPicker(false)
    } else {
      setShowDropdown(false)
      setShowUnitPicker(false)
    }
    setCreateError('')
  }, [value, typed])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setShowUnitPicker(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showDropdown || showUnitPicker) {
          e.stopImmediatePropagation()
          setShowDropdown(false)
          setShowUnitPicker(false)
          onChange('')
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onChange, showDropdown, showUnitPicker])

  // Offer "Create" next to partial matches too, unless the typed name already exists exactly
  const typedName = value.trim().toLowerCase()
  const canCreate =
    typedName.length > 0 && !matches.some((m) => m.name.toLowerCase() === typedName)

  function handleSelect(entry: IngredientDbEntry) {
    onSelect(entry)
    setShowDropdown(false)
    setShowUnitPicker(false)
  }

  function handleCreate() {
    setShowDropdown(false)
    setCreateError('')
    setShowUnitPicker(true)
  }

  // The ingredient is saved on the server first; the row only gets it (with its server id) once that worked
  async function handleUnitSelect(unit: string) {
    setCreateError('')
    try {
      const entry = await createIngredient.mutateAsync({ name: value.trim(), default_unit: unit, category: 'Other' })
      onSelect(entry)
      setShowUnitPicker(false)
    } catch (err) {
      setCreateError(messageForError(err, 'ingredient'))
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="field"
        value={value}
        onChange={(e) => {
          setTyped(true)
          onChange(e.target.value)
        }}
        placeholder={placeholder}
      />

      {showDropdown && (
        <div
          data-testid="ingredient-dropdown"
          style={{
            position: 'absolute',
            zIndex: 100,
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-md)',
            maxHeight: '200px',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          {matches.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleSelect(entry)}
              style={{ padding: '8px 12px', cursor: 'pointer' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = ''
              }}
            >
              {entry.name}
            </div>
          ))}
          {canCreate && (
            <div
              data-testid="ingredient-create"
              onClick={handleCreate}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontStyle: 'italic',
                color: 'var(--text-mid)',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = ''
              }}
            >
              Create &ldquo;{value}&rdquo;
            </div>
          )}
        </div>
      )}

      {showUnitPicker && (
        <div
          data-testid="unit-picker"
          style={{
            position: 'absolute',
            zIndex: 100,
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-md)',
            padding: '12px',
            width: '100%',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
            Unit for &ldquo;{value.trim()}&rdquo;
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {CANONICAL_UNITS.map((unit) => (
              <button
                key={unit}
                type="button"
                disabled={createIngredient.isPending}
                onClick={() => handleUnitSelect(unit)}
                style={{
                  padding: '6px 12px',
                  cursor: createIngredient.isPending ? 'default' : 'pointer',
                  opacity: createIngredient.isPending ? 0.5 : 1,
                  border: 'none',
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {unit}
              </button>
            ))}
          </div>
          {createIngredient.isPending && (
            <div
              data-testid="ingredient-saving"
              role="status"
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: '2px solid var(--coral)',
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Saving…
            </div>
          )}
          {createError && (
            <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>
              {createError}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Edit `src/components/shared/RecipeDetail.tsx`**

Replace the two data imports. Before:

```tsx
import { useStore } from '../../store'
import { ingredientsDbService } from '../../services/ingredientsDbService'
import { IconButton } from '../ui/IconButton'
```

After:

```tsx
import { useRecipes } from '../../api/recipes'
import { useTags } from '../../api/tags'
import { useIngredients } from '../../api/ingredients'
import { IconButton } from '../ui/IconButton'
```

Replace the store reads at the top of the component (hooks must stay above the early `return`). Before:

```tsx
  const recipe = useStore((s) => s.recipes.find((r) => r.id === recipeId) ?? null)
  const tags = useStore((s) => s.tags)
  const [displayServings, setDisplayServings] = useState<number | null>(null)
```

After:

```tsx
  const recipes = useRecipes()
  const recipe = recipes.find((r) => r.id === recipeId) ?? null
  const tags = useTags()
  const allIngredients = useIngredients()
  const [displayServings, setDisplayServings] = useState<number | null>(null)
```

Remove the now-duplicate line below the early return. Before:

```tsx
  const allIngredients = ingredientsDbService.getAll()
  const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]))
```

After:

```tsx
  const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]))
```

- [ ] **Step 5: Edit `src/features/recipes/AddEditRecipeModal.tsx` (nine edits)**

Edit 1, imports. Before:

```tsx
import { Recipe } from '../../types/recipes'
import { recipeService } from './services/recipeService'
import { tagService } from './services/tagService'
import { useStore } from '../../store'
import { Modal } from '../../components/ui/Modal'
```

After:

```tsx
import { Recipe } from '../../types/recipes'
import { useTags, useCreateTag } from '../../api/tags'
import { useIngredients, useCreateIngredient } from '../../api/ingredients'
import { useSaveRecipe } from '../../api/recipes'
import { messageForError, type WriteKind } from '../../api/client'
import { Modal } from '../../components/ui/Modal'
```

Edit 2, remove the db service import. Before:

```tsx
import { IngredientDbEntry } from '../../types/ingredients'
import { ingredientsDbService } from '../../services/ingredientsDbService'
import type { RecipeDraft } from '../../services/recipeImport/mapToRecipe'
```

After:

```tsx
import { IngredientDbEntry } from '../../types/ingredients'
import type { RecipeDraft } from '../../services/recipeImport/mapToRecipe'
```

Edit 3, hooks and save state at the top of the component. Before:

```tsx
  const tags = useStore((s) => s.tags)
  const addRecipe = useStore((s) => s.addRecipe)
  const updateRecipe = useStore((s) => s.updateRecipe)
  const addTag = useStore((s) => s.addTag)

  const isImport = mode === 'import'
```

After:

```tsx
  const tags = useTags()
  const ingredients = useIngredients()
  const createTag = useCreateTag()
  const createIngredient = useCreateIngredient()
  const saveRecipe = useSaveRecipe()

  const isImport = mode === 'import'

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Names already created on the server by an earlier failed Save, so a retry reuses them instead of creating
  // them again (a second create would be a 409).
  const createdIngredientIds = useRef(new Map<string, string>())
  const createdTagIds = useRef(new Map<string, string>())
```

Edit 4, the rows initialiser. Before:

```tsx
    const db = ingredientsDbService.getAll()
    const dbMap = new Map(db.map((e) => [e.id, e]))
```

After:

```tsx
    const dbMap = new Map(ingredients.map((e) => [e.id, e]))
```

Edit 5, new-tag error state. Before:

```tsx
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
```

After:

```tsx
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [tagError, setTagError] = useState('')
```

Edit 6, `handleCreateTag` becomes awaited. Before:

```tsx
  function handleCreateTag() {
    if (!newTagName.trim()) return
    const tag = tagService.create(newTagName.trim(), newTagColor)
    addTag(tag)
    setSelectedTagIds((prev) => [...prev, tag.id])
    setNewTagName('')
    setNewTagColor(TAG_COLORS[0])
    setShowNewTag(false)
  }
```

After:

```tsx
  // The tag is saved first; it is only selected (with its server id) once that worked
  async function handleCreateTag() {
    const tagName = newTagName.trim()
    if (!tagName || createTag.isPending) return
    setTagError('')
    try {
      const tag = await createTag.mutateAsync({ name: tagName, color: newTagColor })
      setSelectedTagIds((prev) => [...prev, tag.id])
      setNewTagName('')
      setNewTagColor(TAG_COLORS[0])
      setShowNewTag(false)
    } catch (err) {
      setTagError(messageForError(err, 'tag'))
    }
  }
```

Edit 7, `handleSave` becomes async: dependencies first, the recipe last. Before (the whole function):

```tsx
  function handleSave(force: boolean) {
    if (!name.trim()) return
    if (isImport && gateCount > 0 && !force) {
      setConfirmingDrop(true)
      return
    }

    // Nothing is created before this point: new ingredients and tags only exist once the user saves
    const createdIdByName = new Map<string, string>()
    const savedRows = rows.map((r) => {
      if (r.ingredientId !== null || !r.newIngredient || !isNewRow(r)) return r
      const key = fold(r.newIngredient.name)
      let id = createdIdByName.get(key)
      if (!id) {
        id = ingredientsDbService.create(r.newIngredient.name, r.newIngredient.default_unit, r.newIngredient.category).id
        createdIdByName.set(key, id)
      }
      return { ...r, ingredientId: id }
    })
    const createdTagIds = pendingNewTags.map((tagName) => {
      const tag = tagService.create(tagName, NEW_TAG_COLOR)
      addTag(tag)
      return tag.id
    })

    const validIngredients = savedRows
      .filter((r) => r.ingredientId !== null)
      .map((r) => ({ ingredientId: r.ingredientId!, quantity: r.quantity }))

    const data = {
      emoji: emoji.trim().slice(0, 2) || '🍽️',
      name: name.trim(),
      servings: Math.max(1, servings),
      tagIds: [...selectedTagIds, ...createdTagIds],
      ingredients: validIngredients,
      notes: notes.trim(),
    }

    if (mode === 'add' || mode === 'import') {
      const created = recipeService.create(data)
      addRecipe(created)
    } else if (mode === 'edit' && recipe) {
      const updated = recipeService.update(recipe.id, data)
      updateRecipe(updated)
    }

    onClose()
  }
```

After:

```tsx
  async function handleSave(force: boolean) {
    if (!name.trim() || saving) return
    if (isImport && gateCount > 0 && !force) {
      setConfirmingDrop(true)
      return
    }

    setConfirmingDrop(false)
    setSaving(true)
    setSaveError('')
    // What is being written decides which 409 message applies
    let writing: WriteKind = 'ingredient'
    try {
      // Nothing is created before this point: new ingredients and tags only exist once the user saves.
      // They are created first, one at a time, and the recipe is sent only after every id it points at exists.
      const savedRows: IngredientRow[] = []
      for (const r of rows) {
        if (r.ingredientId !== null || !r.newIngredient || !isNewRow(r)) {
          savedRows.push(r)
          continue
        }
        const key = fold(r.newIngredient.name)
        let id = createdIngredientIds.current.get(key)
        if (!id) {
          const created = await createIngredient.mutateAsync({
            name: r.newIngredient.name,
            default_unit: r.newIngredient.default_unit,
            category: r.newIngredient.category,
          })
          id = created.id
          createdIngredientIds.current.set(key, id)
        }
        savedRows.push({ ...r, ingredientId: id })
      }

      writing = 'tag'
      const newTagIds: string[] = []
      for (const tagName of pendingNewTags) {
        let id = createdTagIds.current.get(tagName)
        if (!id) {
          const created = await createTag.mutateAsync({ name: tagName, color: NEW_TAG_COLOR })
          id = created.id
          createdTagIds.current.set(tagName, id)
        }
        newTagIds.push(id)
      }

      writing = 'recipe'
      const validIngredients = savedRows
        .filter((r) => r.ingredientId !== null)
        .map((r) => ({ ingredientId: r.ingredientId!, quantity: r.quantity }))

      const data = {
        emoji: emoji.trim().slice(0, 2) || '🍽️',
        name: name.trim(),
        servings: Math.max(1, servings),
        tagIds: [...selectedTagIds, ...newTagIds],
        ingredients: validIngredients,
        notes: notes.trim(),
      }

      await saveRecipe.mutateAsync({ id: mode === 'edit' ? recipe?.id : undefined, data })
      onClose()
    } catch (err) {
      setSaveError(messageForError(err, writing))
    } finally {
      setSaving(false)
    }
  }
```

Edit 8, the footer (disabled while saving, label, inline error). Before:

```tsx
  const footer = confirmingDrop && gateCount > 0 ? (
    <>
      <span style={{ flex: 1, alignSelf: 'center', fontSize: 12, color: 'var(--amber)' }}>
        {confirmText}
      </span>
      <Button intent="ghost" size="sm" onClick={() => setConfirmingDrop(false)} type="button">
        Go back
      </Button>
      <Button intent="coral" size="sm" onClick={() => handleSave(true)} type="button">
        Save anyway
      </Button>
    </>
  ) : (
    <>
      <Button intent="ghost" size="sm" onClick={onClose} type="button">
        {isImport ? 'Discard' : 'Cancel'}
      </Button>
      <Button intent="coral" size="sm" onClick={() => handleSave(false)} type="button">
        {isImport ? 'Save recipe' : 'Save'}
      </Button>
    </>
  )
```

After:

```tsx
  const footer = confirmingDrop && gateCount > 0 ? (
    <>
      <span style={{ flex: 1, alignSelf: 'center', fontSize: 12, color: 'var(--amber)' }}>
        {confirmText}
      </span>
      <Button intent="ghost" size="sm" onClick={() => setConfirmingDrop(false)} type="button">
        Go back
      </Button>
      <Button intent="coral" size="sm" onClick={() => handleSave(true)} type="button" disabled={saving}>
        Save anyway
      </Button>
    </>
  ) : (
    <>
      {saveError && (
        <span role="alert" style={{ flex: 1, alignSelf: 'center', fontSize: 12, color: 'var(--red)' }}>
          {saveError}
        </span>
      )}
      <Button intent="ghost" size="sm" onClick={onClose} type="button">
        {isImport ? 'Discard' : 'Cancel'}
      </Button>
      <Button intent="coral" size="sm" onClick={() => handleSave(false)} type="button" disabled={saving}>
        {saving ? 'Saving…' : isImport ? 'Save recipe' : 'Save'}
      </Button>
    </>
  )
```

Edit 9, the new-tag form buttons and error. Before:

```tsx
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button intent="coral" size="xs" type="button" onClick={handleCreateTag}>
                      Add
                    </Button>
                    <Button
                      intent="ghost"
                      size="xs"
                      type="button"
                      onClick={() => {
                        setShowNewTag(false)
                        setNewTagName('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
```

After:

```tsx
                  {tagError && (
                    <span role="alert" style={{ fontSize: 12, color: 'var(--red)' }}>
                      {tagError}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button intent="coral" size="xs" type="button" onClick={handleCreateTag} disabled={createTag.isPending}>
                      {createTag.isPending ? 'Adding…' : 'Add'}
                    </Button>
                    <Button
                      intent="ghost"
                      size="xs"
                      type="button"
                      onClick={() => {
                        setShowNewTag(false)
                        setNewTagName('')
                        setTagError('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
```

Check the `Button` component forwards `disabled` (it spreads native button props; `ImportRecipeModal` already uses `disabled` on it).

- [ ] **Step 6: Run the gate**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/IngredientAutocomplete.test.tsx src/__tests__/RecipeDetail.test.tsx src/__tests__/AddEditRecipeModalImport.test.tsx src/__tests__/AddEditRecipeModalImportAi.test.tsx src/__tests__/AddEditRecipeModalSave.test.tsx`
Expected: PASS.
Regression files: `src/__tests__/recipesFilter.test.ts src/__tests__/importRecipe.test.ts src/__tests__/ingredientsApi.test.tsx src/__tests__/tagsApi.test.tsx src/__tests__/recipesApi.test.tsx src/__tests__/apiClient.test.ts`. Then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json`.
Note for manual use: until Task 9 the app is mid-migration (the recipes page still reads the old store); do not judge the UI yet.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/IngredientAutocomplete.tsx src/components/shared/RecipeDetail.tsx src/features/recipes/AddEditRecipeModal.tsx src/__tests__/IngredientAutocomplete.test.tsx src/__tests__/RecipeDetail.test.tsx src/__tests__/AddEditRecipeModalImport.test.tsx src/__tests__/AddEditRecipeModalImportAi.test.tsx src/__tests__/AddEditRecipeModalSave.test.tsx
git commit -m "feat(recipes): recipe editing UI on the API (awaited ingredient, tag and recipe writes)" -- src/components/shared/IngredientAutocomplete.tsx src/components/shared/RecipeDetail.tsx src/features/recipes/AddEditRecipeModal.tsx src/__tests__/IngredientAutocomplete.test.tsx src/__tests__/RecipeDetail.test.tsx src/__tests__/AddEditRecipeModalImport.test.tsx src/__tests__/AddEditRecipeModalImportAi.test.tsx src/__tests__/AddEditRecipeModalSave.test.tsx
```

---

### Task 6: Recipes page (delete confirmation) and import

The recipes page reads the cached lists, deletes through an awaited confirmation that says planned meals go too, and deducts the pantry through the optimistic batch. `importRecipeFromUrl` stops reading localStorage: its caller passes the cached tags and ingredients.

Tests: REPLACED `importRecipe.test.ts` (its inputs were seeded through `tagService`/`ingredientsDbService`; the parsing and matching assertions are kept). UPDATED `ImportRecipeModal.test.tsx` (needs a `QueryClientProvider`). NEW `RecipesPage.test.tsx`.

**Files:**
- Modify: `src/services/recipeImport/importRecipe.ts` (full file below), `src/features/recipes/ImportRecipeModal.tsx`, `src/features/recipes/index.tsx`
- Test (replace): `src/__tests__/importRecipe.test.ts`
- Test (modify): `src/__tests__/ImportRecipeModal.test.tsx`
- Test (create): `src/__tests__/RecipesPage.test.tsx`

**Interfaces:**
- Consumes: `useRecipes()`, `useDeleteRecipe()` (`mutateAsync(id): Promise<void>`, `isPending`), `useTags()`, `useIngredients()`, `usePantry()`, `useBatchPantry()` (`mutate(deltas)`), `recipeDeltas(recipe): PantryDelta[]`, `useToastStore`, `messageForError(err, 'delete')`, `Modal`, `Button`.
- Produces: `importRecipeFromUrl(url: string, opts: { tags: Tag[]; ingredients: IngredientDbEntry[]; signal?: AbortSignal; onStage?: (stage: ImportStage) => void; deps?: Partial<ImportDeps> }): Promise<RecipeDraft>` (the two lists are new and required). `filterRecipes` stays exported from `features/recipes/index.tsx`.

- [ ] **Step 1: Write the failing tests**

Replace `src/__tests__/importRecipe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importRecipeFromUrl } from '../services/recipeImport/importRecipe'
import { settingsService } from '../services/settingsService'
import { ImportError, type FetchedPage, type ParsedRecipe } from '../services/recipeImport/types'
import type { IngredientDbEntry } from '../types/ingredients'
import type { Tag } from '../types/recipes'

const PAGE: FetchedPage = { source: 'jsonld', text: '{}' }
const PARSED: ParsedRecipe = {
  name: 'Pancakes',
  servings: 4,
  ingredients: [{ name: 'flour', quantity: 0.2, unit: 'kg' }],
  steps: ['Mix'],
}

const FLOUR: IngredientDbEntry = { id: 'ing-flour', name: 'Flour', default_unit: 'g', category: 'Pantry' }
const NUDLE: IngredientDbEntry = { id: 'ing-nudle', name: 'nudle ryžové', default_unit: 'g', category: 'Pantry & Dry Goods' }
const lists = (over: { tags?: Tag[]; ingredients?: IngredientDbEntry[] } = {}) => ({
  tags: [] as Tag[],
  ingredients: [FLOUR],
  ...over,
})

describe('importRecipeFromUrl', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsService.setGeminiKey('k')
  })

  it('fetches, parses with the saved key, maps onto the given ingredients, and reports stages in order', async () => {
    const stages: string[] = []
    const fetchPage = vi.fn().mockResolvedValue(PAGE)
    const parseRecipe = vi.fn().mockResolvedValue(PARSED)

    const draft = await importRecipeFromUrl(' https://example.com/p ', {
      ...lists(),
      onStage: (s) => stages.push(s),
      deps: { fetchPage, parseRecipe },
    })

    expect(stages).toEqual(['fetching', 'reading'])
    expect(fetchPage).toHaveBeenCalledWith('https://example.com/p', { signal: undefined })
    expect(parseRecipe).toHaveBeenCalledWith(PAGE, 'k', { signal: undefined, tagNames: [] })
    expect(draft.name).toBe('Pancakes')
    expect(draft.rows[0]).toMatchObject({ ingredientId: 'ing-flour', ingredientName: 'Flour', quantity: 200, unit: 'g', flagged: false })
    expect(draft.sourceHost).toBe('example.com')
  })

  it('fails with no_key before touching the network when no key is saved', async () => {
    settingsService.clearGeminiKey()
    const fetchPage = vi.fn()
    await expect(importRecipeFromUrl('https://example.com/', { ...lists(), deps: { fetchPage } })).rejects.toMatchObject({
      code: 'no_key',
    })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('fails with bad_url before touching the network for a malformed address', async () => {
    const fetchPage = vi.fn()
    await expect(importRecipeFromUrl('nope', { ...lists(), deps: { fetchPage } })).rejects.toMatchObject({ code: 'bad_url' })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('propagates errors from the fetch and parse steps', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new ImportError('blocked_host'))
    await expect(importRecipeFromUrl('https://example.com/', { ...lists(), deps: { fetchPage } })).rejects.toMatchObject({
      code: 'blocked_host',
    })

    const ok = vi.fn().mockResolvedValue(PAGE)
    const parseRecipe = vi.fn().mockRejectedValue(new ImportError('rate_limited'))
    await expect(
      importRecipeFromUrl('https://example.com/', { ...lists(), deps: { fetchPage: ok, parseRecipe } }),
    ).rejects.toMatchObject({ code: 'rate_limited' })
  })
})

describe('importRecipeFromUrl: matching call', () => {
  const unmatched: ParsedRecipe = {
    name: 'Rezance',
    servings: 2,
    steps: ['Mix'],
    ingredients: [{ name: 'ryžové rezance', quantity: 100, unit: 'g', line: '100 g ryžových rezancov' }],
  }
  const both = () => lists({ ingredients: [FLOUR, NUDLE] })

  beforeEach(() => {
    localStorage.clear()
    settingsService.setGeminiKey('k')
  })

  it('asks the model about unresolved rows, in a matching stage, and applies its answer', async () => {
    const stages: string[] = []
    const resolve = vi.fn().mockResolvedValue([{ index: 0, matchId: NUDLE.id, newIngredient: null, estimate: null }])
    const draft = await importRecipeFromUrl('https://example.com/p', {
      ...both(),
      onStage: (s) => stages.push(s),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
    })
    expect(stages).toEqual(['fetching', 'reading', 'matching'])
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve.mock.calls[0][0]).toBe('Rezance')
    expect(resolve.mock.calls[0][1]).toHaveLength(1)
    expect(draft.rows[0]).toMatchObject({ ingredientId: NUDLE.id, quantity: 100, matchedBy: 'ai' })
  })

  it('makes no second call when every row is resolved locally', async () => {
    const resolve = vi.fn()
    await importRecipeFromUrl('https://example.com/p', {
      ...both(),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(PARSED), resolve },
    })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('keeps the local draft when the second call fails', async () => {
    const resolve = vi.fn().mockRejectedValue(new ImportError('rate_limited'))
    const draft = await importRecipeFromUrl('https://example.com/p', {
      ...both(),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
    })
    expect(draft.rows[0].ingredientId).toBeNull()
    expect(draft.rows[0].flagged).toBe(true)
  })

  it('keeps the local draft and logs a warning when applying the answer throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const resolve = vi.fn().mockResolvedValue([null as never])
      const draft = await importRecipeFromUrl('https://example.com/p', {
        ...both(),
        deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
      })
      expect(draft.rows[0].ingredientId).toBeNull()
      expect(draft.rows[0].flagged).toBe(true)
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('does not log when the second call fails with an ImportError', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await importRecipeFromUrl('https://example.com/p', {
        ...both(),
        deps: {
          fetchPage: vi.fn().mockResolvedValue(PAGE),
          parseRecipe: vi.fn().mockResolvedValue(unmatched),
          resolve: vi.fn().mockRejectedValue(new ImportError('rate_limited')),
        },
      })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('stops when the user aborts during the second call', async () => {
    const resolve = vi.fn().mockRejectedValue(new ImportError('aborted'))
    await expect(
      importRecipeFromUrl('https://example.com/p', {
        ...both(),
        deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('sends the given tag names with the parse call and maps the suggested tags', async () => {
    const tag: Tag = { id: 'tag-soup', name: 'Polievka', color: '#26A69A' }
    const parseRecipe = vi.fn().mockResolvedValue({ ...PARSED, tags: ['polievka'], newTags: ['krevety'] })
    const draft = await importRecipeFromUrl('https://example.com/p', {
      ...lists({ tags: [tag] }),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe, resolve: vi.fn() },
    })
    expect(parseRecipe.mock.calls[0][2]).toMatchObject({ tagNames: ['Polievka'] })
    expect(draft.tagIds).toEqual([tag.id])
    expect(draft.newTags).toEqual(['krevety'])
  })
})
```

Modify `src/__tests__/ImportRecipeModal.test.tsx`. Replace the imports block's first lines, adding two imports. Before:

```tsx
import { MemoryRouter } from 'react-router-dom'
import { ImportRecipeModal } from '../features/recipes/ImportRecipeModal'
```

After:

```tsx
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ImportRecipeModal } from '../features/recipes/ImportRecipeModal'
import { makeTestClient } from '../test/renderWithClient'
import type { Seed } from '../test/seed'
import { FLOUR, TAG_BREAKFAST } from '../test/fixtures'
```

Replace `renderModal`. Before:

```tsx
  function renderModal() {
    act(() => {
      root.render(
        <MemoryRouter>
          <ImportRecipeModal onImported={onImported} onClose={onClose} />
        </MemoryRouter>,
      )
    })
  }
```

After:

```tsx
  function renderModal(seed: Seed = {}) {
    act(() => {
      root.render(
        <QueryClientProvider client={makeTestClient(seed)}>
          <MemoryRouter>
            <ImportRecipeModal onImported={onImported} onClose={onClose} />
          </MemoryRouter>
        </QueryClientProvider>,
      )
    })
  }
```

Add this test right after the existing `'hands the draft to onImported on success'` test:

```tsx
  it('passes the cached tags and ingredients to the import', async () => {
    settingsService.setGeminiKey('k')
    vi.mocked(importRecipeFromUrl).mockResolvedValue(DRAFT)
    renderModal({ ingredients: [FLOUR], tags: [TAG_BREAKFAST] })
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    await act(async () => button('Import').click())
    expect(importRecipeFromUrl).toHaveBeenCalledWith(
      'https://example.com/p',
      expect.objectContaining({ tags: [TAG_BREAKFAST], ingredients: [FLOUR] }),
    )
  })
```

Create `src/__tests__/RecipesPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import RecipesPage from '../features/recipes'
import { useStore } from '../store'
import { useToastStore } from '../store/toastStore'
import { queryKeys } from '../api/queryKeys'
import { errorResponse, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, MILK, PANCAKES, PANTRY_FLOUR, PANTRY_MILK, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, waitFor, type Rendered } from '../test/renderWithClient'
import type { Recipe } from '../types/recipes'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'

const SEED = {
  recipes: [PANCAKES],
  tags: [TAG_BREAKFAST],
  ingredients: [FLOUR, MILK],
  pantry: [PANTRY_FLOUR, PANTRY_MILK],
  mealPlan: [ENTRY_PANCAKES],
}

describe('RecipesPage', () => {
  let rendered: Rendered

  beforeEach(() => {
    useStore.setState({ selectedId: PANCAKES.id })
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useStore.setState({ selectedId: null })
    useToastStore.setState({ message: '' })
  })

  function renderPage() {
    rendered = renderWithClient(
      <MemoryRouter>
        <RecipesPage />
      </MemoryRouter>,
      { seed: SEED },
    )
  }
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  // The detail panel is rendered twice (desktop panel and mobile overlay): the first one is enough
  const detailButton = (aria: string) => document.body.querySelector(`button[aria-label="${aria}"]`) as HTMLButtonElement

  it('lists the cached recipes', () => {
    renderPage()
    expect(document.body.textContent).toContain('Pancakes')
  })

  it('the trash icon only asks, and says planned meals are removed too', () => {
    const server = installApi({ seed: SEED })
    renderPage()
    act(() => detailButton('Delete recipe').click())
    expect(document.body.textContent).toContain('Meals planned with this recipe are removed from the meal plan too.')
    expect(server.calls).toHaveLength(0)
    act(() => button('Cancel').click())
    expect(document.body.textContent).not.toContain('removed from the meal plan too')
    expect(server.calls).toHaveLength(0)
  })

  it('confirming deletes on the server, drops the recipe and its planned meals, and clears the selection', async () => {
    const server = installApi({ seed: SEED })
    renderPage()
    act(() => detailButton('Delete recipe').click())
    await act(async () => button('Delete').click())
    await waitFor(() => expect(server.find('DELETE', '/api/recipes/rec-pancakes')).toHaveLength(1))
    await waitFor(() => expect(rendered.client.getQueryData<Recipe[]>(queryKeys.recipes)).toEqual([]))
    expect(rendered.client.getQueryData<MealPlanEntry[]>(queryKeys.mealPlan)).toEqual([])
    expect(useStore.getState().selectedId).toBeNull()
    expect(document.body.textContent).not.toContain('removed from the meal plan too')
  })

  it('a failed delete keeps the recipe and toasts', async () => {
    installApi({
      seed: SEED,
      handler: (call) => (call.method === 'DELETE' ? errorResponse(500, 'server_error') : undefined),
    })
    renderPage()
    act(() => detailButton('Delete recipe').click())
    await act(async () => button('Delete').click())
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not delete — please try again.'))
    expect(rendered.client.getQueryData<Recipe[]>(queryKeys.recipes)).toEqual([PANCAKES])
    expect(useStore.getState().selectedId).toBe(PANCAKES.id)
  })

  it('Mark as cooked deducts the recipe from the pantry through the batch route', async () => {
    const server = installApi({ seed: SEED })
    renderPage()
    act(() => detailButton('Mark as cooked').click())
    await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({
      deltas: [
        { ingredientId: 'ing-flour', delta: -200 },
        { ingredientId: 'ing-milk', delta: -300 },
      ],
    })
    const pantry = rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry)!
    expect(pantry.map((p) => p.quantity)).toEqual([300, 0])
    expect(useStore.getState().selectedId).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/importRecipe.test.ts src/__tests__/ImportRecipeModal.test.tsx src/__tests__/RecipesPage.test.tsx`
Expected: FAIL (`importRecipeFromUrl` still reads localStorage and ignores `tags`/`ingredients`; the page still reads the Zustand store).

- [ ] **Step 3: Replace `src/services/recipeImport/importRecipe.ts` (full file)**

```ts
import type { IngredientDbEntry } from '../../types/ingredients'
import type { Tag } from '../../types/recipes'
import { settingsService } from '../settingsService'
import { assertHttpUrl, fetchPage } from './fetchPage'
import { parseRecipeWithGemini } from './geminiParse'
import { resolveWithGemini } from './geminiResolve'
import { mapToRecipe, type RecipeDraft } from './mapToRecipe'
import { applyResolutions, buildResolveItems } from './resolveRows'
import { ImportError } from './types'

export type ImportStage = 'fetching' | 'reading' | 'matching'

interface ImportDeps {
  fetchPage: typeof fetchPage
  parseRecipe: typeof parseRecipeWithGemini
  resolve: typeof resolveWithGemini
}

export async function importRecipeFromUrl(
  url: string,
  opts: {
    /** The cached tag and ingredient lists (the caller reads them with `useTags` / `useIngredients`). */
    tags: Tag[]
    ingredients: IngredientDbEntry[]
    signal?: AbortSignal
    onStage?: (stage: ImportStage) => void
    deps?: Partial<ImportDeps>
  },
): Promise<RecipeDraft> {
  const key = settingsService.getGeminiKey()
  if (!key) throw new ImportError('no_key')
  const clean = url.trim()
  assertHttpUrl(clean)

  opts.onStage?.('fetching')
  const page = await (opts.deps?.fetchPage ?? fetchPage)(clean, { signal: opts.signal })

  opts.onStage?.('reading')
  const { tags, ingredients: db } = opts
  const parsed = await (opts.deps?.parseRecipe ?? parseRecipeWithGemini)(page, key, {
    signal: opts.signal,
    tagNames: tags.map((t) => t.name),
  })

  const draft = mapToRecipe(parsed, db, clean, tags)

  // Call 2 only for the rows the local pass could not finish. Its failure never fails the import.
  const items = buildResolveItems(draft, parsed, db)
  if (items.length === 0) return draft

  opts.onStage?.('matching')
  try {
    const resolutions = await (opts.deps?.resolve ?? resolveWithGemini)(draft.name, items, key, {
      signal: opts.signal,
    })
    return applyResolutions(draft, parsed, resolutions, db)
  } catch (err) {
    if (err instanceof ImportError && err.code === 'aborted') throw err
    // An ImportError is an expected failure of call 2. Anything else is a bug in our own code: do not hide it.
    if (!(err instanceof ImportError)) console.warn('Import: the matching step failed, using the local result.', err)
    return draft
  }
}
```

- [ ] **Step 4: Edit `src/features/recipes/ImportRecipeModal.tsx`**

Add the two imports. Before:

```tsx
import { settingsService } from '../../services/settingsService'
import { importRecipeFromUrl, type ImportStage } from '../../services/recipeImport/importRecipe'
```

After:

```tsx
import { settingsService } from '../../services/settingsService'
import { useTags } from '../../api/tags'
import { useIngredients } from '../../api/ingredients'
import { importRecipeFromUrl, type ImportStage } from '../../services/recipeImport/importRecipe'
```

Read the lists at the top of the component. Before:

```tsx
  const hasKey = settingsService.hasGeminiKey()
  const [url, setUrl] = useState('')
```

After:

```tsx
  const hasKey = settingsService.hasGeminiKey()
  const tags = useTags()
  const ingredients = useIngredients()
  const [url, setUrl] = useState('')
```

Pass them to the import. Before:

```tsx
      const draft = await importRecipeFromUrl(url, { signal: controller.signal, onStage: setStage })
```

After:

```tsx
      const draft = await importRecipeFromUrl(url, { signal: controller.signal, onStage: setStage, tags, ingredients })
```

- [ ] **Step 5: Edit `src/features/recipes/index.tsx` (four edits)**

Edit 1, imports. Before:

```tsx
import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, Link2, Plus, Search } from 'lucide-react'
import { useStore } from '../../store'
import { recipeService } from './services/recipeService'
import { Recipe, Tag } from '../../types/recipes'
```

After:

```tsx
import { useState, useMemo } from 'react'
import { ChevronLeft, Link2, Plus, Search } from 'lucide-react'
import { useStore } from '../../store'
import { useToastStore } from '../../store/toastStore'
import { useRecipes, useDeleteRecipe } from '../../api/recipes'
import { useTags } from '../../api/tags'
import { usePantry, useBatchPantry, recipeDeltas } from '../../api/pantry'
import { messageForError } from '../../api/client'
import { Modal } from '../../components/ui/Modal'
import { Recipe, Tag } from '../../types/recipes'
```

Edit 2, the top of the component (store reads and the init effect). Before:

```tsx
export default function RecipesPage() {
  const recipes = useStore((s) => s.recipes)
  const tags = useStore((s) => s.tags)
  const pantryItems = useStore((s) => s.pantryItems)
  const selectedId = useStore((s) => s.selectedId)
  const selectRecipe = useStore((s) => s.selectRecipe)
  const removeRecipe = useStore((s) => s.removeRecipe)
  const initRecipes = useStore((s) => s.initRecipes)

  const batchUpdatePantry = useStore((s) => s.batchUpdatePantry)

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [addToWeekRecipeId, setAddToWeekRecipeId] = useState<string | null>(null)

  // Init recipes on mount if store is empty
  useEffect(() => {
    if (recipes.length === 0) {
      initRecipes()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

After:

```tsx
export default function RecipesPage() {
  const recipes = useRecipes()
  const tags = useTags()
  const pantryItems = usePantry()
  const selectedId = useStore((s) => s.selectedId)
  const selectRecipe = useStore((s) => s.selectRecipe)
  const deleteRecipe = useDeleteRecipe()
  const batchPantry = useBatchPantry()

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [addToWeekRecipeId, setAddToWeekRecipeId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
```

Edit 3, the delete and cooked handlers. Before:

```tsx
  function handleDelete() {
    if (!selectedId) return
    recipeService.delete(selectedId)
    removeRecipe(selectedId)
    setMobileDetailOpen(false)
  }

  function handleCooked() {
    if (!selectedId) return
    const recipe = recipes.find((r) => r.id === selectedId)
    if (!recipe) return
    try {
      batchUpdatePantry(recipe.ingredients.map((ing) => ({ ingredientId: ing.ingredientId, delta: -ing.quantity })))
    } catch { /* best-effort */ }
    selectRecipe(null)
    setMobileDetailOpen(false)
  }
```

After:

```tsx
  // The trash icon only asks; the recipe is deleted (awaited) once the user confirms
  function handleDelete() {
    if (!selectedId) return
    setConfirmDeleteId(selectedId)
  }

  async function confirmDelete() {
    const id = confirmDeleteId
    if (!id) return
    try {
      await deleteRecipe.mutateAsync(id)
      if (useStore.getState().selectedId === id) selectRecipe(null)
      setMobileDetailOpen(false)
    } catch (err) {
      useToastStore.getState().show(messageForError(err, 'delete'))
    } finally {
      setConfirmDeleteId(null)
    }
  }

  // Optimistic: the pantry shows the deduction at once; a failure rolls it back and toasts (see useBatchPantry)
  function handleCooked() {
    if (!selectedId) return
    const recipe = recipes.find((r) => r.id === selectedId)
    if (!recipe) return
    const deltas = recipeDeltas(recipe)
    if (deltas.length > 0) batchPantry.mutate(deltas)
    selectRecipe(null)
    setMobileDetailOpen(false)
  }
```

Edit 4, the confirmation dialog, inserted after the import-review modal and before the add-to-week modal. Before:

```tsx
      {modal.type === 'import' && (
        <AddEditRecipeModal mode="import" draft={modal.draft} onClose={() => setModal({ type: 'none' })} />
      )}
      {addToWeekRecipeId && (() => {
```

After:

```tsx
      {modal.type === 'import' && (
        <AddEditRecipeModal mode="import" draft={modal.draft} onClose={() => setModal({ type: 'none' })} />
      )}
      {confirmDeleteId && (
        <Modal
          isOpen
          onClose={() => setConfirmDeleteId(null)}
          title="Delete recipe"
          footer={
            <>
              <Button intent="ghost" size="sm" type="button" onClick={() => setConfirmDeleteId(null)} disabled={deleteRecipe.isPending}>
                Cancel
              </Button>
              <Button intent="danger" size="sm" type="button" onClick={confirmDelete} disabled={deleteRecipe.isPending}>
                {deleteRecipe.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: 'var(--text)' }}>
            Delete &ldquo;{recipes.find((r) => r.id === confirmDeleteId)?.name ?? 'this recipe'}&rdquo;? Meals planned
            with this recipe are removed from the meal plan too.
          </p>
        </Modal>
      )}
      {addToWeekRecipeId && (() => {
```

`Button` is already imported in this file.

- [ ] **Step 6: Run the gate**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/importRecipe.test.ts src/__tests__/ImportRecipeModal.test.tsx src/__tests__/RecipesPage.test.tsx`
Expected: PASS.
Regression files: `src/__tests__/recipesFilter.test.ts src/__tests__/mapToRecipe.test.ts src/__tests__/resolveRows.test.ts src/__tests__/ingredientMatch.test.ts src/__tests__/geminiParse.test.ts src/__tests__/geminiResolve.test.ts src/__tests__/fetchPage.test.ts src/__tests__/importRequest.test.ts src/__tests__/AddEditRecipeModalSave.test.tsx src/__tests__/SettingsPage.test.tsx`. Then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json`.

- [ ] **Step 7: Commit**

```bash
git add src/services/recipeImport/importRecipe.ts src/features/recipes/ImportRecipeModal.tsx src/features/recipes/index.tsx src/__tests__/importRecipe.test.ts src/__tests__/ImportRecipeModal.test.tsx src/__tests__/RecipesPage.test.tsx
git commit -m "feat(recipes): recipes page and import on the API, delete asks first" -- src/services/recipeImport/importRecipe.ts src/features/recipes/ImportRecipeModal.tsx src/features/recipes/index.tsx src/__tests__/importRecipe.test.ts src/__tests__/ImportRecipeModal.test.tsx src/__tests__/RecipesPage.test.tsx
```

---

### Task 7: Meal planner and AddToWeekModal

The planner grid, the recipe picker, the shared AddToWeekModal and the meal-plan overlay read the cached lists and write optimistically (add, remove, cooked toggle with its pantry deduction). Failures roll back and toast through the hooks of Task 4. The duplicate, unused `features/meal-planner/AddToWeekModal.tsx` is deleted (it imported the localStorage service). The shared AddToWeekModal rounds servings to an integer because the server only accepts integers (a 1.5 would be a 422 and roll back).

Tests: NEW `MealPlannerWrites.test.tsx`. `cookedPantryDeduction.test.ts` (Task 4) keeps testing `buildCookDeltas`, which stays exported from `MealPlanOverlay.tsx`.

**Files:**
- Modify: `src/features/meal-planner/index.tsx`, `src/features/meal-planner/RecipePickerModal.tsx`, `src/features/meal-planner/MealPlanOverlay.tsx` (full file below), `src/components/shared/AddToWeekModal.tsx`
- Delete: `src/features/meal-planner/AddToWeekModal.tsx` (`git rm`)
- Test (create): `src/__tests__/MealPlannerWrites.test.tsx`

**Interfaces:**
- Consumes: `useMealPlan(): MealPlanEntry[]`, `useAddMealEntry()` (`mutate(entry)`), `useRemoveMealEntry()` (`mutate(id)`), `newMealEntry(data): MealPlanEntry`, `useSetEntryCooked()` (`mutate({ entry, deltas, cooked })`, `isPending`), `useRecipes()`, `useTags()`, `usePantry()`, `PantryDelta`.
- Produces: unchanged public props for `RecipePickerModal({ date, slot, onClose })`, `AddToWeekModal({ recipeId, defaultServings, weekStart, onClose, onAfterConfirm? })`, `MealPlanOverlay({ entryId, weekStart, onClose })`, and `buildCookDeltas(recipe: Recipe, entry: Pick<MealPlanEntry, 'servings'>, newCooked: boolean): PantryDelta[]` (unchanged body).

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/MealPlannerWrites.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import MealPlannerPage from '../features/meal-planner'
import { RecipePickerModal } from '../features/meal-planner/RecipePickerModal'
import { MealPlanOverlay } from '../features/meal-planner/MealPlanOverlay'
import { AddToWeekModal } from '../components/shared/AddToWeekModal'
import { getDayDates, toDateStr } from '../features/meal-planner/utils/calendarUtils'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, MILK, PANCAKES, PANTRY_FLOUR, PANTRY_MILK, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'

const SEED = {
  recipes: [PANCAKES],
  tags: [TAG_BREAKFAST],
  ingredients: [FLOUR, MILK],
  pantry: [PANTRY_FLOUR, { ...PANTRY_MILK, quantity: 700 }],
  mealPlan: [ENTRY_PANCAKES],
}
const WEEK_START = new Date(2026, 9, 19) // Monday 2026-10-19, local time

describe('meal planner writes', () => {
  let rendered: Rendered
  const onClose = vi.fn()

  beforeEach(() => {
    onClose.mockReset()
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useToastStore.setState({ message: '' })
  })

  const entries = () => rendered.client.getQueryData<MealPlanEntry[]>(queryKeys.mealPlan) ?? []
  const pantry = () => rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []
  const byLabel = (aria: string) => document.body.querySelector(`button[aria-label="${aria}"]`) as HTMLButtonElement

  describe('RecipePickerModal', () => {
    function renderPicker() {
      rendered = renderWithClient(<RecipePickerModal date="2026-10-20" slot="dinner" onClose={onClose} />, {
        seed: { ...SEED, mealPlan: [] },
      })
    }
    const pickFirst = () => (document.body.querySelector('[data-testid="recipe-picker-item"]') as HTMLButtonElement).click()

    it('picking a recipe closes at once, shows the entry at once and POSTs it with its client id', async () => {
      const g = gate()
      const server = installApi({
        handler: async (call) => {
          if (call.method === 'POST') await g.wait
          return undefined
        },
      })
      renderPicker()
      await act(async () => pickFirst())
      expect(onClose).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(entries()).toHaveLength(1))
      const entry = entries()[0]
      expect(entry).toMatchObject({ date: '2026-10-20', slot: 'dinner', recipeId: 'rec-pancakes', servings: 2 })
      expect(entry.id).toMatch(/^[0-9a-f-]{36}$/)

      g.open()
      await waitFor(() => expect(server.find('POST', '/api/meal-plan')).toHaveLength(1))
      expect(server.find('POST', '/api/meal-plan')[0].body).toEqual(entry)
    })

    it('removes the entry again and toasts when the server refuses it', async () => {
      installApi({ handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
      renderPicker()
      await act(async () => pickFirst())
      await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
      expect(entries()).toEqual([])
    })
  })

  describe('AddToWeekModal', () => {
    it('POSTs the chosen day, slot and an integer number of servings', async () => {
      const server = installApi()
      const after = vi.fn()
      rendered = renderWithClient(
        <AddToWeekModal recipeId="rec-pancakes" defaultServings={2} weekStart={WEEK_START} onClose={onClose} onAfterConfirm={after} />,
        { seed: { ...SEED, mealPlan: [] } },
      )
      const radios = document.body.querySelectorAll<HTMLInputElement>('[data-testid="add-to-week-day-radio"]')
      act(() => radios[2].click())
      const select = document.body.querySelector('[data-testid="add-to-week-slot-select"]') as HTMLSelectElement
      act(() => {
        select.value = 'dinner'
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })
      const servings = document.body.querySelector('[data-testid="add-to-week-servings"]') as HTMLInputElement
      act(() => typeInto(servings, '2.6'))
      await act(async () => (document.body.querySelector('[data-testid="add-to-week-confirm"]') as HTMLButtonElement).click())

      await waitFor(() => expect(server.find('POST', '/api/meal-plan')).toHaveLength(1))
      expect(server.find('POST', '/api/meal-plan')[0].body).toEqual({
        id: expect.any(String),
        date: toDateStr(getDayDates(WEEK_START)[2]),
        slot: 'dinner',
        recipeId: 'rec-pancakes',
        servings: 3,
      })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(after).toHaveBeenCalledTimes(1)
    })
  })

  describe('MealPlanOverlay', () => {
    function renderOverlay(seed = SEED) {
      rendered = renderWithClient(<MealPlanOverlay entryId="mp-1" weekStart={WEEK_START} onClose={onClose} />, { seed })
    }

    it('Mark as cooked flags the entry, deducts the scaled recipe from the pantry, entry first then batch', async () => {
      const server = installApi({ seed: SEED })
      renderOverlay()
      act(() => byLabel('Mark as cooked').click())
      await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
      // 4 servings of a 2-serving recipe: x2
      expect(server.calls.filter((c) => c.method === 'PUT').map((c) => c.path)).toEqual(['/api/meal-plan/mp-1', '/api/pantry/batch'])
      expect(server.find('PUT', '/api/meal-plan/mp-1')[0].body).toEqual({ cooked: true })
      expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({
        deltas: [
          { ingredientId: 'ing-flour', delta: -400 },
          { ingredientId: 'ing-milk', delta: -600 },
        ],
      })
      expect(entries()[0].cooked).toBe(true)
      expect(pantry().map((p) => p.quantity)).toEqual([100, 100])
    })

    it('Unmark as cooked adds the ingredients back', async () => {
      const cooked = { ...SEED, mealPlan: [{ ...ENTRY_PANCAKES, cooked: true }] }
      const server = installApi({ seed: cooked })
      renderOverlay(cooked)
      act(() => byLabel('Unmark as cooked').click())
      await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
      expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({
        deltas: [
          { ingredientId: 'ing-flour', delta: 400 },
          { ingredientId: 'ing-milk', delta: 600 },
        ],
      })
      expect(entries()[0].cooked).toBe(false)
    })

    it('a failing pantry batch rolls the entry and the pantry back and toasts', async () => {
      installApi({
        seed: SEED,
        handler: (call) => (call.path === '/api/pantry/batch' ? errorResponse(500, 'server_error') : undefined),
      })
      renderOverlay()
      act(() => byLabel('Mark as cooked').click())
      await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
      expect(entries()).toEqual([ENTRY_PANCAKES])
      expect(pantry()).toEqual(SEED.pantry)
    })

    it('Remove from plan removes the entry at once, DELETEs it and closes', async () => {
      const server = installApi({ seed: SEED })
      renderOverlay()
      act(() => byLabel('Remove from plan').click())
      await waitFor(() => expect(server.find('DELETE', '/api/meal-plan/mp-1')).toHaveLength(1))
      expect(entries()).toEqual([])
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('MealPlannerPage', () => {
    const today = toDateStr(new Date())

    it('shows this week\'s planned recipes from the cache', () => {
      rendered = renderWithClient(<MealPlannerPage />, {
        seed: { ...SEED, mealPlan: [{ ...ENTRY_PANCAKES, date: today }] },
      })
      expect(document.body.querySelector('[data-testid="slot-item"]')?.textContent).toContain('Pancakes')
    })

    it('an entry whose recipe is gone can be removed (DELETE)', async () => {
      const server = installApi()
      rendered = renderWithClient(<MealPlannerPage />, {
        seed: { ...SEED, recipes: [], mealPlan: [{ ...ENTRY_PANCAKES, date: today }] },
      })
      const orphan = document.body.querySelector('[data-testid="slot-item-orphan"]')!
      expect(orphan.textContent).toContain('Recipe removed')
      await act(async () => (orphan.querySelector('button') as HTMLButtonElement).click())
      await waitFor(() => expect(server.find('DELETE', '/api/meal-plan/mp-1')).toHaveLength(1))
      expect(entries()).toEqual([])
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/MealPlannerWrites.test.tsx`
Expected: FAIL (the components still read the Zustand store and localStorage).

- [ ] **Step 3: Edit `src/features/meal-planner/index.tsx`**

Imports. Before:

```tsx
import React, { useState, useEffect, useMemo } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../../store'
```

After:

```tsx
import React, { useState, useMemo } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMealPlan, useRemoveMealEntry } from '../../api/mealPlan'
import { useRecipes } from '../../api/recipes'
```

Remove the service import. Before:

```tsx
import { MealPlanOverlay } from './MealPlanOverlay'
import { remove } from './services/mealPlanService'
```

After:

```tsx
import { MealPlanOverlay } from './MealPlanOverlay'
```

Head of the component. Before:

```tsx
export default function MealPlannerPage() {
  const entries = useStore((s) => s.entries)
  const initMealPlan = useStore((s) => s.initMealPlan)
  const removeEntry = useStore((s) => s.removeEntry)

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [pickerSlot, setPickerSlot] = useState<{ date: string; slot: 'breakfast' | 'lunch' | 'dinner' } | null>(null)
  const [overlayEntry, setOverlayEntry] = useState<{ id: string } | null>(null)

  useEffect(() => {
    if (entries.length === 0) initMealPlan()
  }, [])

  const storeRecipes = useStore((s) => s.recipes)
  const recipeMap = useMemo(
    () => new Map(storeRecipes.map((r) => [r.id, r])),
    [storeRecipes]
  )
```

After:

```tsx
export default function MealPlannerPage() {
  const entries = useMealPlan()
  const recipes = useRecipes()
  const removeEntry = useRemoveMealEntry()

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))
  const [pickerSlot, setPickerSlot] = useState<{ date: string; slot: 'breakfast' | 'lunch' | 'dinner' } | null>(null)
  const [overlayEntry, setOverlayEntry] = useState<{ id: string } | null>(null)

  const recipeMap = useMemo(
    () => new Map(recipes.map((r) => [r.id, r])),
    [recipes]
  )
```

Orphan removal. Before:

```tsx
  function handleRemoveOrphan(id: string) {
    removeEntry(id)
    remove(id)
  }
```

After:

```tsx
  // The server deletes a recipe's meal-plan entries with it, so this is only a safety net for stale caches
  function handleRemoveOrphan(id: string) {
    removeEntry.mutate(id)
  }
```

- [ ] **Step 4: Edit `src/features/meal-planner/RecipePickerModal.tsx`**

Imports. Before:

```tsx
import { useStore } from '../../store'
import { Modal } from '../../components/ui/Modal'
import { create } from './services/mealPlanService'
import type { MealPlanEntry } from '../../types/mealPlan'
import { searchMatches } from '../../utils/search'
```

After:

```tsx
import { useRecipes } from '../../api/recipes'
import { useTags } from '../../api/tags'
import { useAddMealEntry, newMealEntry } from '../../api/mealPlan'
import { Modal } from '../../components/ui/Modal'
import { searchMatches } from '../../utils/search'
```

Head. Before:

```tsx
  const recipes = useStore((s) => s.recipes)
  const tags = useStore((s) => s.tags)
  const addEntry = useStore((s) => s.addEntry)
  const [query, setQuery] = useState('')
```

After:

```tsx
  const recipes = useRecipes()
  const tags = useTags()
  const addEntry = useAddMealEntry()
  const [query, setQuery] = useState('')
```

Select handler. Before:

```tsx
  function handleSelect(recipe: (typeof recipes)[0]) {
    const entry: MealPlanEntry = {
      id: crypto.randomUUID(),
      date,
      slot,
      recipeId: recipe.id,
      servings: recipe.servings,
    }
    addEntry(entry)
    create(entry)
    onClose()
  }
```

After:

```tsx
  // Optimistic: the entry shows in the grid at once; a failed save removes it again and toasts
  function handleSelect(recipe: (typeof recipes)[0]) {
    addEntry.mutate(newMealEntry({ date, slot, recipeId: recipe.id, servings: recipe.servings }))
    onClose()
  }
```

- [ ] **Step 5: Edit `src/components/shared/AddToWeekModal.tsx`**

Imports. Before:

```tsx
import { useStore } from '../../store'
import { create } from '../../features/meal-planner/services/mealPlanService'
import { getDayDates, toDateStr, DAYS } from '../../features/meal-planner/utils/calendarUtils'
```

After:

```tsx
import { useAddMealEntry, newMealEntry } from '../../api/mealPlan'
import { getDayDates, toDateStr, DAYS } from '../../features/meal-planner/utils/calendarUtils'
```

Head. Before: `  const addEntry = useStore((s) => s.addEntry)`. After: `  const addEntry = useAddMealEntry()`.

Confirm handler. Before:

```tsx
  function handleConfirm() {
    const entry: MealPlanEntry = {
      id: crypto.randomUUID(),
      date: selectedDate,
      slot: selectedSlot,
      recipeId,
      servings,
    }
    addEntry(entry)
    create(entry)
    onClose()
    onAfterConfirm?.()
  }
```

After:

```tsx
  // Optimistic: the entry shows in the planner at once; a failed save removes it again and toasts
  function handleConfirm() {
    addEntry.mutate(newMealEntry({ date: selectedDate, slot: selectedSlot, recipeId, servings }))
    onClose()
    onAfterConfirm?.()
  }
```

Servings must be an integer for the server. Before:

```tsx
            onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
```

After:

```tsx
            onChange={(e) => setServings(Math.max(1, Math.round(Number(e.target.value))))}
```

(`MealPlanEntry` is still imported and used for the slot type.)

- [ ] **Step 6: Replace `src/features/meal-planner/MealPlanOverlay.tsx` (full file)**

```tsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMealPlan, useRemoveMealEntry } from '../../api/mealPlan'
import { useRecipes } from '../../api/recipes'
import { usePantry } from '../../api/pantry'
import { useSetEntryCooked } from '../../api/cooking'
import { RecipeDetail } from '../../components/shared/RecipeDetail'
import { computeAvailability } from '../cook-now/utils/cookNowUtils'
import { AddToWeekModal } from '../../components/shared/AddToWeekModal'
import { AddEditRecipeModal } from '../recipes/AddEditRecipeModal'
import type { Recipe } from '../../types/recipes'
import type { MealPlanEntry } from '../../types/mealPlan'

export function buildCookDeltas(
  recipe: Recipe,
  entry: Pick<MealPlanEntry, 'servings'>,
  newCooked: boolean
): { ingredientId: string; delta: number }[] {
  const scale = recipe.servings > 0 ? entry.servings / recipe.servings : 1
  return recipe.ingredients.map((ing) => ({
    ingredientId: ing.ingredientId,
    delta: newCooked ? -(ing.quantity * scale) : ing.quantity * scale,
  }))
}

interface Props {
  entryId: string
  weekStart: Date
  onClose: () => void
}

export function MealPlanOverlay({ entryId, weekStart, onClose }: Props) {
  const entries = useMealPlan()
  const entry = entries.find((e) => e.id === entryId)
  const recipes = useRecipes()
  const pantryItems = usePantry()
  const removeEntry = useRemoveMealEntry()
  const setCooked = useSetEntryCooked()
  const [editOpen, setEditOpen] = useState(false)
  const [addToWeekOpen, setAddToWeekOpen] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !editOpen && !addToWeekOpen) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, editOpen, addToWeekOpen])

  // Close overlay if entry is removed from the plan elsewhere
  useEffect(() => {
    if (!entry) onClose()
  }, [entry, onClose])

  const recipe = recipes.find((r) => r.id === entry?.recipeId)
  const avail = recipe && entry
    ? computeAvailability(recipe, { servings: entry.servings }, pantryItems)
    : null

  // Optimistic: gone from the plan at once; a failed delete brings it back and toasts
  function handleRemove() {
    if (!entry) return
    removeEntry.mutate(entry.id)
    onClose()
  }

  // Optimistic: the entry and the pantry change at once; a failed save rolls both back and toasts
  function handleToggleCooked() {
    if (!entry || setCooked.isPending) return
    const cooked = !entry.cooked
    const deltas = recipe ? buildCookDeltas(recipe, entry, cooked) : []
    setCooked.mutate({ entry, deltas, cooked })
  }

  return createPortal(
    <div style={{ position: 'relative' }}>
      <div
        data-testid="meal-plan-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          padding: '16px',
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-md)',
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 'var(--radius)',
          }}
        >
          <RecipeDetail
            recipeId={entry?.recipeId ?? null}
            context="meal-planner"
            onEdit={() => setEditOpen(true)}
            onAddToWeek={() => setAddToWeekOpen(true)}
            onRemoveFromPlan={handleRemove}
            onCooked={handleToggleCooked}
            isCooked={!!entry?.cooked}
            isCooking={setCooked.isPending}
            ingredientAvailability={avail?.ingredientAvailability}
          />
        </div>
      </div>

      {editOpen && recipe && (
        <AddEditRecipeModal
          mode="edit"
          recipe={recipe}
          onClose={() => setEditOpen(false)}
        />
      )}

      {addToWeekOpen && entry && (
        <AddToWeekModal
          recipeId={entry.recipeId}
          defaultServings={entry.servings}
          weekStart={weekStart}
          onClose={() => setAddToWeekOpen(false)}
        />
      )}
    </div>,
    document.body
  )
}
```

- [ ] **Step 7: Delete the unused duplicate modal**

Run: `cd /data/shopping-list/code && git rm src/features/meal-planner/AddToWeekModal.tsx`
(Nothing imports it: `grep -rn "meal-planner/AddToWeekModal\|from './AddToWeekModal'" src` returns nothing.)

- [ ] **Step 8: Run the gate**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/MealPlannerWrites.test.tsx src/__tests__/cookedPantryDeduction.test.ts`
Expected: PASS.
Regression files: `src/__tests__/calendarUtils.test.ts src/__tests__/mealPlanApi.test.tsx src/__tests__/cookingApi.test.tsx src/__tests__/AddEditRecipeModalSave.test.tsx src/__tests__/RecipesPage.test.tsx src/__tests__/RecipeDetail.test.tsx`. Then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json`.

- [ ] **Step 9: Commit**

```bash
git add src/features/meal-planner/index.tsx src/features/meal-planner/RecipePickerModal.tsx src/features/meal-planner/MealPlanOverlay.tsx src/components/shared/AddToWeekModal.tsx src/__tests__/MealPlannerWrites.test.tsx
git commit -m "feat(meal-planner): planner, picker, overlay and add-to-week on the API" -- src/features/meal-planner/index.tsx src/features/meal-planner/RecipePickerModal.tsx src/features/meal-planner/MealPlanOverlay.tsx src/features/meal-planner/AddToWeekModal.tsx src/components/shared/AddToWeekModal.tsx src/__tests__/MealPlannerWrites.test.tsx
```

---

### Task 8: Pantry page, Cook Now and Shopping List

The last three consumers switch to the hooks. The pantry quantity edit and delete are optimistic; adding a pantry item is optimistic too with a client id (the add modal still awaits it with `mutateAsync` to show an inline error; a 409 here means that ingredient is already in the pantry). Cooking from Cook Now deducts through the batch route. The shopping list keeps its local checked state; checking an item adds it to the pantry (create or batch delta) and a failed write un-checks the item again.

Tests: NEW `PantryPage.test.tsx`, `ShoppingListPage.test.tsx`, `CookNowPage.test.tsx`. The pantry page, Cook Now and the shopping list had no component tests; the pure selector tests (`cookNowSelector`, `shoppingListSelector`) stay unchanged in this task.

**Files:**
- Modify: `src/features/pantry/index.tsx`, `src/features/cook-now/index.tsx`, `src/features/shopping-list/index.tsx`
- Test (create): `src/__tests__/PantryPage.test.tsx`, `src/__tests__/ShoppingListPage.test.tsx`, `src/__tests__/CookNowPage.test.tsx`

**Interfaces:**
- Consumes: `usePantry()`, `useAddPantryItem()` (`mutate`/`mutateAsync(item: PantryItem)`), `useUpdatePantryItem()` (`mutate`/`mutateAsync({ id, patch })`), `useDeletePantryItem()` (`mutate(id)`), `useBatchPantry()` (`mutate(deltas, { onError? })`), `newPantryItem`, `recipeDeltas`, `useIngredients()`, `useRecipes()`, `useTags()`, `useMealPlan()`.
- Produces: unchanged page default exports; `stockBarColor` stays exported from the pantry page.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/PantryPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import PantryPage from '../features/pantry'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, installApi } from '../test/fetchMock'
import { FLOUR, MILK, PANTRY_FLOUR, PANTRY_MILK } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'

const SEED = { ingredients: [FLOUR, MILK], pantry: [PANTRY_FLOUR, PANTRY_MILK] }

describe('PantryPage', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useToastStore.setState({ message: '' })
  })

  const pantry = () => rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []
  const text = () => document.body.textContent ?? ''
  const byTestId = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const render = (seed = SEED) => {
    rendered = renderWithClient(<PantryPage />, { seed })
  }

  it('lists the cached pantry with ingredient names and units', () => {
    render()
    expect(text()).toContain('Flour')
    expect(text()).toContain('500 g')
    expect(text()).toContain('Milk')
    expect(text()).toContain('100 ml')
  })

  it('editing a quantity applies it at once and PUTs the patch', async () => {
    const server = installApi({ seed: SEED })
    render()
    act(() => byTestId('pantry-row').click())
    act(() => typeInto(byTestId('pantry-edit-qty') as HTMLInputElement, '250'))
    act(() => typeInto(byTestId('pantry-edit-max') as HTMLInputElement, '2000'))
    act(() => byTestId('pantry-save-btn').click())
    expect(document.body.querySelector('[data-testid="pantry-row-editing"]')).toBeNull()
    await waitFor(() => expect(pantry()[0]).toMatchObject({ quantity: 250, maxStock: 2000 }))
    await waitFor(() => expect(server.find('PUT', '/api/pantry/pan-flour')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/pan-flour')[0].body).toEqual({ quantity: 250, maxStock: 2000 })
  })

  it('a failed save puts the old quantity back and toasts', async () => {
    installApi({ seed: SEED, handler: (call) => (call.method === 'PUT' ? errorResponse(500, 'server_error') : undefined) })
    render()
    act(() => byTestId('pantry-row').click())
    act(() => typeInto(byTestId('pantry-edit-qty') as HTMLInputElement, '250'))
    act(() => byTestId('pantry-save-btn').click())
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(pantry()[0].quantity).toBe(500)
  })

  it('Delete removes the item at once and DELETEs it', async () => {
    const server = installApi({ seed: SEED })
    render()
    act(() => byTestId('pantry-row').click())
    act(() => byTestId('pantry-delete-btn').click())
    await waitFor(() => expect(server.find('DELETE', '/api/pantry/pan-flour')).toHaveLength(1))
    expect(pantry().map((p) => p.id)).toEqual(['pan-milk'])
  })

  async function addViaModal(name: string, search: string, qty: string) {
    act(() => byTestId('pantry-add-button').click())
    const input = document.body.querySelector('input[placeholder="Search ingredient…"]') as HTMLInputElement
    act(() => typeInto(input, search))
    const option = Array.from(document.body.querySelectorAll('[data-testid="ingredient-dropdown"] div')).find((d) =>
      d.textContent?.trim().startsWith(name),
    ) as HTMLElement
    act(() => option.click())
    act(() => typeInto(document.body.querySelector('#pantry-add-qty') as HTMLInputElement, qty))
    await act(async () => button('Save').click())
  }

  it('adding a new ingredient POSTs it with a client id and the default max stock', async () => {
    const server = installApi({ seed: { ...SEED, pantry: [PANTRY_FLOUR] } })
    render({ ...SEED, pantry: [PANTRY_FLOUR] })
    await addViaModal('Milk', 'Mil', '2')
    await waitFor(() => expect(server.find('POST', '/api/pantry')).toHaveLength(1))
    expect(server.find('POST', '/api/pantry')[0].body).toEqual({
      id: expect.any(String),
      ingredientId: 'ing-milk',
      quantity: 2,
      maxStock: 6,
    })
    await waitFor(() => expect(text()).not.toContain('Add Pantry Item'))
    expect(pantry().map((p) => p.ingredientId)).toEqual(['ing-flour', 'ing-milk'])
  })

  it('adding an ingredient that is already in the pantry adds to its quantity (PUT, no second row)', async () => {
    const server = installApi({ seed: SEED })
    render()
    await addViaModal('Flour', 'Flo', '50')
    await waitFor(() => expect(server.find('PUT', '/api/pantry/pan-flour')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/pan-flour')[0].body).toEqual({ quantity: 550 })
    expect(server.find('POST', '/api/pantry')).toHaveLength(0)
  })

  it('a failed add shows an inline error and keeps the modal open', async () => {
    installApi({
      seed: { ...SEED, pantry: [] },
      handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined),
    })
    render({ ...SEED, pantry: [] })
    await addViaModal('Milk', 'Mil', '2')
    await waitFor(() => expect(text()).toContain('Could not save — please try again.'))
    expect(text()).toContain('Add Pantry Item')
    expect(pantry()).toEqual([])
  })
})
```

Create `src/__tests__/ShoppingListPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import ShoppingListPage from '../features/shopping-list'
import { toDateStr } from '../features/meal-planner/utils/calendarUtils'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, MILK, PANCAKES } from '../test/fixtures'
import { renderWithClient, waitFor, type Rendered } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'

// Two servings of the two-serving pancakes: 200 g flour and 300 ml milk, nothing in the pantry
const SEED = {
  recipes: [PANCAKES],
  ingredients: [FLOUR, MILK],
  mealPlan: [{ ...ENTRY_PANCAKES, date: toDateStr(new Date()), servings: 2 }],
  pantry: [] as PantryItem[],
}

describe('ShoppingListPage', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useToastStore.setState({ message: '' })
  })

  const text = () => document.body.textContent ?? ''
  const pantry = () => rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []
  const item = (name: string) =>
    Array.from(document.body.querySelectorAll('[data-testid="shopping-list-item"]')).find((el) =>
      el.textContent?.includes(name),
    ) as HTMLElement
  const progress = () => document.body.querySelector('[data-testid="shopping-list-progress"]')?.textContent ?? ''

  it('lists what is missing for the planned meals', () => {
    rendered = renderWithClient(<ShoppingListPage />, { seed: SEED })
    expect(text()).toContain('Flour')
    expect(text()).toContain('200 g')
    expect(text()).toContain('Milk')
    expect(text()).toContain('300 ml')
    expect(progress()).toContain('0 / 2 checked')
  })

  it('checking an item not in the pantry creates the pantry item (client id) and keeps the row visible', async () => {
    const server = installApi({ seed: SEED })
    rendered = renderWithClient(<ShoppingListPage />, { seed: SEED })
    act(() => item('Flour').click())
    expect(progress()).toContain('1 / 2 checked')
    await waitFor(() => expect(server.find('POST', '/api/pantry')).toHaveLength(1))
    expect(pantry()).toHaveLength(1)
    expect(server.find('POST', '/api/pantry')[0].body).toEqual({
      id: expect.any(String),
      ingredientId: 'ing-flour',
      quantity: 200,
      maxStock: 600,
    })
    expect(progress()).toContain('1 / 2 checked')
  })

  it('un-checking takes the quantity out of the pantry again through the batch route', async () => {
    const server = installApi({ seed: SEED })
    rendered = renderWithClient(<ShoppingListPage />, { seed: SEED })
    act(() => item('Flour').click())
    await waitFor(() => expect(server.find('POST', '/api/pantry')).toHaveLength(1))
    act(() => item('Flour').click())
    await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({ deltas: [{ ingredientId: 'ing-flour', delta: -200 }] })
    await waitFor(() => expect(progress()).toContain('0 / 2 checked'))
  })

  it('a failed pantry write un-checks the item again and toasts', async () => {
    installApi({ seed: SEED, handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined) })
    rendered = renderWithClient(<ShoppingListPage />, { seed: SEED })
    act(() => item('Flour').click())
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    await waitFor(() => expect(progress()).toContain('0 / 2 checked'))
    expect(pantry()).toEqual([])
  })
})
```

Create `src/__tests__/CookNowPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import CookNowPage from '../features/cook-now'
import { queryKeys } from '../api/queryKeys'
import { installApi } from '../test/fetchMock'
import { FLOUR, MILK, PANCAKES, PANTRY_FLOUR, PANTRY_MILK, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, waitFor, type Rendered } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'

const SEED = {
  recipes: [PANCAKES],
  tags: [TAG_BREAKFAST],
  ingredients: [FLOUR, MILK],
  pantry: [PANTRY_FLOUR, { ...PANTRY_MILK, quantity: 500 }],
}

describe('CookNowPage', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  const text = () => document.body.textContent ?? ''

  it('lists the recipes the pantry can cover', () => {
    rendered = renderWithClient(<CookNowPage />, { seed: SEED })
    expect(text()).toContain('Pancakes')
  })

  it('Mark as cooked deducts the recipe from the pantry through the batch route and clears the selection', async () => {
    const server = installApi({ seed: SEED })
    rendered = renderWithClient(<CookNowPage />, { seed: SEED })
    const row = Array.from(document.body.querySelectorAll('span')).find((s) => s.textContent === 'Pancakes') as HTMLElement
    act(() => row.click())
    const cooked = document.body.querySelector('button[aria-label="Mark as cooked"]') as HTMLButtonElement
    act(() => cooked.click())
    await waitFor(() => expect(server.find('PUT', '/api/pantry/batch')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/batch')[0].body).toEqual({
      deltas: [
        { ingredientId: 'ing-flour', delta: -200 },
        { ingredientId: 'ing-milk', delta: -300 },
      ],
    })
    expect(rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry)?.map((p) => p.quantity)).toEqual([300, 200])
    expect(text()).toContain('Select a recipe to see details')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/PantryPage.test.tsx src/__tests__/ShoppingListPage.test.tsx src/__tests__/CookNowPage.test.tsx`
Expected: FAIL (the pages still read the Zustand store and localStorage).

- [ ] **Step 3: Edit `src/features/pantry/index.tsx` (five edits)**

Edit 1, imports. Before:

```tsx
import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../../store'
import { ingredientsDbService } from '../../services/ingredientsDbService'
import { IngredientAutocomplete } from '../../components/shared/IngredientAutocomplete'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { SavingIndicator } from '../../components/ui/SavingIndicator'
import { Toast } from '../../components/ui/Toast'
import type { IngredientDbEntry } from '../../types/ingredients'
```

After:

```tsx
import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useIngredients } from '../../api/ingredients'
import {
  newPantryItem,
  useAddPantryItem,
  useDeletePantryItem,
  usePantry,
  useUpdatePantryItem,
} from '../../api/pantry'
import { IngredientAutocomplete } from '../../components/shared/IngredientAutocomplete'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { IngredientDbEntry } from '../../types/ingredients'
```

Edit 2, the top of `PantryPage`. Before:

```tsx
export default function PantryPage() {
  const pantryItems = useStore((s) => s.pantryItems)
  const addPantryItem = useStore((s) => s.addPantryItem)
  const updatePantryItem = useStore((s) => s.updatePantryItem)
  const deletePantryItem = useStore((s) => s.deletePantryItem)

  const ingredientsDb = useMemo(() => ingredientsDbService.getAll(), [])
  const ingMap = useMemo(
    () => new Map(ingredientsDb.map((i) => [i.id, i])),
    [ingredientsDb]
  )

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editMaxStock, setEditMaxStock] = useState('')
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
```

After:

```tsx
export default function PantryPage() {
  const pantryItems = usePantry()
  const addItem = useAddPantryItem()
  const updateItem = useUpdatePantryItem()
  const deleteItem = useDeletePantryItem()

  const ingredientsDb = useIngredients()
  const ingMap = useMemo(
    () => new Map(ingredientsDb.map((i) => [i.id, i])),
    [ingredientsDb]
  )

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editMaxStock, setEditMaxStock] = useState('')
```

Edit 3, the three handlers. Before:

```tsx
  async function handleSave(id: string) {
    const qty = parseFloat(editQty)
    const max = parseFloat(editMaxStock)
    if (isNaN(qty) || qty < 0 || isNaN(max) || max <= 0) return
    setSaving(true)
    try {
      updatePantryItem(id, { quantity: qty, maxStock: max })
      setEditingId(null)
    } catch (err: unknown) {
      setToastMsg(err instanceof Error ? err.message : 'Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      deletePantryItem(id)
      setEditingId(null)
    } catch (err: unknown) {
      setToastMsg(err instanceof Error ? err.message : 'Could not delete — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(ingredientId: string, quantity: number) {
    setSaving(true)
    try {
      const existing = pantryItems.find((p) => p.ingredientId === ingredientId)
      if (existing) {
        updatePantryItem(existing.id, { quantity: existing.quantity + quantity })
      } else {
        addPantryItem({ ingredientId, quantity })
      }
    } finally {
      setSaving(false)
    }
  }
```

After:

```tsx
  // Optimistic: the row shows the new numbers at once; a failed save puts the old ones back and toasts
  function handleSave(id: string) {
    const qty = parseFloat(editQty)
    const max = parseFloat(editMaxStock)
    if (isNaN(qty) || qty < 0 || isNaN(max) || max <= 0) return
    updateItem.mutate({ id, patch: { quantity: qty, maxStock: max } })
    setEditingId(null)
  }

  function handleDelete(id: string) {
    deleteItem.mutate(id)
    setEditingId(null)
  }

  // The add modal waits for the answer (it shows "Saving…" and an inline error), the list updates at once.
  // The pantry has one row per ingredient (the server enforces it), so an existing ingredient gets its quantity raised.
  async function handleAdd(ingredientId: string, quantity: number) {
    const existing = pantryItems.find((p) => p.ingredientId === ingredientId)
    if (existing) {
      await updateItem.mutateAsync({ id: existing.id, patch: { quantity: existing.quantity + quantity } })
    } else {
      await addItem.mutateAsync(newPantryItem({ ingredientId, quantity }))
    }
  }
```

Edit 4, drop the local indicator and toast (the AppShell hosts both after Task 9). Before:

```tsx
    <div className="page">
      <SavingIndicator visible={saving} />
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg('')} />}

      <div className="page-header">
```

After:

```tsx
    <div className="page">
      <div className="page-header">
```

Edit 5, the three edit-row buttons no longer need `disabled={saving}` (each of these is a separate small edit; the `AddItemModal` component has its own `saving` state and keeps its `disabled={saving}` lines). Before / after:

```tsx
                      disabled={saving}
                      data-testid="pantry-save-btn"
```
becomes
```tsx
                      data-testid="pantry-save-btn"
```

```tsx
                      disabled={saving}
                      data-testid="pantry-cancel-btn"
```
becomes
```tsx
                      data-testid="pantry-cancel-btn"
```

```tsx
                      disabled={saving}
                      data-testid="pantry-delete-btn"
```
becomes
```tsx
                      data-testid="pantry-delete-btn"
```

- [ ] **Step 4: Edit `src/features/cook-now/index.tsx` (three edits)**

Edit 1, imports. Before:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useStore } from '../../store'
```

After:

```tsx
import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useRecipes } from '../../api/recipes'
import { useTags } from '../../api/tags'
import { usePantry, useBatchPantry, recipeDeltas } from '../../api/pantry'
```

Edit 2, the top of the component. Before:

```tsx
  const recipes = useStore((s) => s.recipes)
  const tags = useStore((s) => s.tags)
  const pantryItems = useStore((s) => s.pantryItems)
  const batchUpdatePantry = useStore((s) => s.batchUpdatePantry)
  const initPantry = useStore((s) => s.initPantry)
```

After:

```tsx
  const recipes = useRecipes()
  const tags = useTags()
  const pantryItems = usePantry()
  const batchPantry = useBatchPantry()
```

and remove the init effect. Before:

```tsx
  useEffect(() => { initPantry() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const weekStart = getWeekStart(new Date())
```

After:

```tsx
  const weekStart = getWeekStart(new Date())
```

Edit 3, the cooked handler. Before:

```tsx
    try {
      batchUpdatePantry(recipe.ingredients.map((ing) => ({ ingredientId: ing.ingredientId, delta: -ing.quantity })))
    } catch { /* best-effort */ }
    setSelectedId(null)
```

After:

```tsx
    // Optimistic: the pantry shows the deduction at once; a failure rolls it back and toasts (see useBatchPantry)
    const deltas = recipeDeltas(recipe)
    if (deltas.length > 0) batchPantry.mutate(deltas)
    setSelectedId(null)
```

- [ ] **Step 5: Edit `src/features/shopping-list/index.tsx` (four edits)**

Edit 1, imports. Before:

```tsx
import { useState, useMemo } from 'react'
import { useStore } from '../../store'
import { Button } from '../../components/ui/Button'
import { ingredientsDbService } from '../../services/ingredientsDbService'
```

After:

```tsx
import { useState, useMemo } from 'react'
import { useMealPlan } from '../../api/mealPlan'
import { useRecipes } from '../../api/recipes'
import { useIngredients } from '../../api/ingredients'
import { newPantryItem, useAddPantryItem, useBatchPantry, usePantry } from '../../api/pantry'
import { Button } from '../../components/ui/Button'
```

Edit 2, the top of the component. Before:

```tsx
  const entries = useStore((s) => s.entries)
  const recipes = useStore((s) => s.recipes)
  const pantryItems = useStore((s) => s.pantryItems)
  const batchUpdatePantry = useStore((s) => s.batchUpdatePantry)
  const addPantryItem = useStore((s) => s.addPantryItem)
```

After:

```tsx
  const entries = useMealPlan()
  const recipes = useRecipes()
  const pantryItems = usePantry()
  const batchPantry = useBatchPantry()
  const addPantryItem = useAddPantryItem()
```

Edit 3, the ingredient list. Before:

```tsx
  const ingredientsDb = useMemo(() => ingredientsDbService.getAll(), [])
```

After:

```tsx
  const ingredientsDb = useIngredients()
```

Edit 4, the toggle. Before:

```tsx
  function toggleChecked(item: ShoppingItem) {
    const { ingredientId, quantity } = item
    const isChecked = checkedSnapshots.has(ingredientId)

    if (isChecked) {
      setCheckedSnapshots((prev) => { const m = new Map(prev); m.delete(ingredientId); return m })
      try {
        batchUpdatePantry([{ ingredientId, delta: -quantity }])
      } catch { /* best-effort pantry reversal */ }
    } else {
      setCheckedSnapshots((prev) => new Map([...prev, [ingredientId, item]]))
      const hasPantryEntry = pantryItems.some((p) => p.ingredientId === ingredientId)
      try {
        if (!hasPantryEntry) {
          addPantryItem({ ingredientId, quantity })
        } else {
          batchUpdatePantry([{ ingredientId, delta: quantity }])
        }
      } catch {
        setCheckedSnapshots((prev) => { const m = new Map(prev); m.delete(ingredientId); return m })
      }
    }
  }
```

After:

```tsx
  function toggleChecked(item: ShoppingItem) {
    const { ingredientId, quantity } = item
    const isChecked = checkedSnapshots.has(ingredientId)
    const uncheck = () =>
      setCheckedSnapshots((prev) => {
        const m = new Map(prev)
        m.delete(ingredientId)
        return m
      })

    if (isChecked) {
      uncheck()
      // Best-effort pantry reversal: a failure rolls the pantry back and toasts (see useBatchPantry)
      batchPantry.mutate([{ ingredientId, delta: -quantity }])
    } else {
      setCheckedSnapshots((prev) => new Map([...prev, [ingredientId, item]]))
      const hasPantryEntry = pantryItems.some((p) => p.ingredientId === ingredientId)
      // Optimistic pantry write; when it fails the pantry rolls back (and toasts) and the item is un-checked again
      if (!hasPantryEntry) {
        addPantryItem.mutate(newPantryItem({ ingredientId, quantity }), { onError: uncheck })
      } else {
        batchPantry.mutate([{ ingredientId, delta: quantity }], { onError: uncheck })
      }
    }
  }
```

(`useMemo` is still used elsewhere in this file, so the `react` import stays as is.)

- [ ] **Step 6: Run the gate**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/PantryPage.test.tsx src/__tests__/ShoppingListPage.test.tsx src/__tests__/CookNowPage.test.tsx`
Expected: PASS.
Regression files: `src/__tests__/stockBarColor.test.ts src/__tests__/cookNowSelector.test.ts src/__tests__/cookNowUtils.test.ts src/__tests__/shoppingListSelector.test.ts src/__tests__/pantryApi.test.tsx src/__tests__/IngredientAutocomplete.test.tsx src/__tests__/MealPlannerWrites.test.tsx`. Then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json`.
(Every page and modal now reads server state; nothing but `selectedId` still reads the Zustand data slices, so only the old store and services remain to delete.)

- [ ] **Step 7: Commit**

```bash
git add src/features/pantry/index.tsx src/features/cook-now/index.tsx src/features/shopping-list/index.tsx src/__tests__/PantryPage.test.tsx src/__tests__/ShoppingListPage.test.tsx src/__tests__/CookNowPage.test.tsx
git commit -m "feat: pantry page, cook now and shopping list on the API" -- src/features/pantry/index.tsx src/features/cook-now/index.tsx src/features/shopping-list/index.tsx src/__tests__/PantryPage.test.tsx src/__tests__/ShoppingListPage.test.tsx src/__tests__/CookNowPage.test.tsx
```

---

### Task 9: AppShell gate, global toast and saving indicator, `main.tsx`

`AppShell` stops initialising the store and becomes the gate: pages render only after the five lists have loaded; one loader until then; if a list fails (and nothing is loaded yet) one full-screen "Can't reach the server" panel with Retry. Later refetch failures are silent (the data is already there). It also hosts the global `ToastHost` and a `SavingIndicator` that shows while any mutation is in flight. `main.tsx` provides the `QueryClient` and drops `importCookbookIfNeeded()` (the server seeds the data).

Tests: NEW `AppShell.test.tsx`. `cookbookImport.test.ts` still passes in this task (the file is deleted in Task 10).

**Files:**
- Create: `src/components/shared/ServerGate.tsx`
- Modify (full rewrite): `src/AppShell.tsx`, `src/main.tsx`
- Test (create): `src/__tests__/AppShell.test.tsx`

**Interfaces:**
- Consumes: `recipesQueryOptions`, `tagsQueryOptions`, `ingredientsQueryOptions`, `pantryQueryOptions`, `mealPlanQueryOptions` (each a `queryOptions` value), `makeQueryClient()`, `ToastHost`, `SavingIndicator({ visible: boolean })`, `Button`.
- Produces: `GateLoader(): JSX.Element` (`role="status"`), `ServerErrorPanel({ onRetry }: { onRetry: () => void }): JSX.Element` (`role="alert"`, text "Can't reach the server", a `Retry` button); `AppShell` default export (route layout element, unchanged use in `App.tsx`).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/AppShell.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppShell from '../AppShell'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, MILK, PANCAKES, PANTRY_FLOUR, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, waitFor, type Rendered } from '../test/renderWithClient'

const LISTS = {
  recipes: [PANCAKES],
  tags: [TAG_BREAKFAST],
  ingredients: [FLOUR, MILK],
  pantry: [PANTRY_FLOUR],
  mealPlan: [ENTRY_PANCAKES],
}

function shell() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AppShell gate', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useToastStore.setState({ message: '' })
  })

  const text = () => document.body.textContent ?? ''
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

  it('shows one loader until all five lists have loaded, then the page', async () => {
    const g = gate()
    const server = installApi({
      seed: LISTS,
      handler: async (call) => {
        if (call.path === '/api/recipes') await g.wait
        return undefined
      },
    })
    rendered = renderWithClient(shell(), { seed: null })
    await waitFor(() => expect(server.calls.length).toBeGreaterThanOrEqual(5))
    expect(document.body.querySelector('[role="status"]')).not.toBeNull()
    expect(text()).not.toContain('page content')

    g.open()
    await waitFor(() => expect(text()).toContain('page content'))
    expect(document.body.querySelector('[role="status"]')).toBeNull()
    expect(server.calls.filter((c) => c.method === 'GET').map((c) => c.path).sort()).toEqual([
      '/api/ingredients',
      '/api/meal-plan',
      '/api/pantry',
      '/api/recipes',
      '/api/tags',
    ])
  })

  it('shows one "can\'t reach the server" panel when a list fails, and Retry loads the app once the server is back', async () => {
    let healthy = false
    installApi({
      seed: LISTS,
      handler: (call) => (!healthy && call.path === '/api/tags' ? errorResponse(500, 'server_error') : undefined),
    })
    rendered = renderWithClient(shell(), { seed: null })
    await waitFor(() => expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("Can't reach the server"))
    expect(text()).not.toContain('page content')

    healthy = true
    await act(async () => button('Retry').click())
    await waitFor(() => expect(text()).toContain('page content'))
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
  })

  it('a later refetch that fails is silent: the page and the cached data stay', async () => {
    let failing = false
    installApi({
      seed: LISTS,
      handler: (call) => (failing && call.path === '/api/tags' ? errorResponse(500, 'server_error') : undefined),
    })
    rendered = renderWithClient(shell(), { seed: null })
    await waitFor(() => expect(text()).toContain('page content'))

    failing = true
    await act(async () => {
      await rendered.client.refetchQueries({ queryKey: queryKeys.tags })
    })
    expect(text()).toContain('page content')
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
    expect(rendered.client.getQueryData(queryKeys.tags)).toEqual([TAG_BREAKFAST])
  })

  it('hosts the global toast', async () => {
    installApi({ seed: LISTS })
    rendered = renderWithClient(shell(), { seed: null })
    await waitFor(() => expect(text()).toContain('page content'))
    act(() => useToastStore.getState().show('Could not save — please try again.'))
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('Could not save — please try again.')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/AppShell.test.tsx`
Expected: FAIL (`AppShell` still initialises the store and renders the pages immediately; no `role="status"` loader).

- [ ] **Step 3: Create `src/components/shared/ServerGate.tsx`**

```tsx
import { Button } from '../ui/Button'

/** The one loader shown while the first load of the five lists is running. */
export function GateLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--text-dim)',
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '3px solid var(--coral)',
          borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite',
        }}
      />
      <span style={{ fontSize: 14 }}>Loading…</span>
    </div>
  )
}

/** Full-screen panel shown when the first load failed. */
export function ServerErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
      }}
    >
      <span style={{ fontSize: 48 }}>🔌</span>
      <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
        {"Can't reach the server"}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-mid)', textAlign: 'center', maxWidth: 320 }}>
        Check your connection and try again. Nothing you saved has been lost.
      </p>
      <Button intent="coral" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Replace `src/AppShell.tsx` (full file)**

```tsx
import { Outlet } from 'react-router-dom'
import { useIsMutating, useQueries } from '@tanstack/react-query'
import Sidebar from './components/nav/Sidebar'
import BottomNav from './components/nav/BottomNav'
import SettingsGear from './components/nav/SettingsGear'
import { SavingIndicator } from './components/ui/SavingIndicator'
import { ToastHost } from './components/ui/ToastHost'
import { GateLoader, ServerErrorPanel } from './components/shared/ServerGate'
import { recipesQueryOptions } from './api/recipes'
import { tagsQueryOptions } from './api/tags'
import { ingredientsQueryOptions } from './api/ingredients'
import { pantryQueryOptions } from './api/pantry'
import { mealPlanQueryOptions } from './api/mealPlan'

export default function AppShell() {
  // The gate: nothing below renders before all five lists are in the cache. Pages and modals then assume their
  // data exists. Once loaded, background refetches (and their failures) are silent.
  const lists = useQueries({
    queries: [recipesQueryOptions, tagsQueryOptions, ingredientsQueryOptions, pantryQueryOptions, mealPlanQueryOptions],
  })
  const writing = useIsMutating() > 0

  const loaded = lists.every((q) => q.data !== undefined)
  const failed = !loaded && lists.some((q) => q.isError)

  function retry() {
    for (const q of lists) if (q.isError) void q.refetch()
  }

  return (
    <>
      <SavingIndicator visible={writing} />
      <ToastHost />
      {!loaded ? (
        failed ? (
          <ServerErrorPanel onRetry={retry} />
        ) : (
          <GateLoader />
        )
      ) : (
        <div className="app">
          <Sidebar />
          <main
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <SettingsGear />
            <Outlet />
          </main>
          <BottomNav />
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 5: Replace `src/main.tsx` (full file)**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './styles/tokens.css'
import App from './App'
import { makeQueryClient } from './api/queryClient'

const queryClient = makeQueryClient()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('No #root element found')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 6: Run the gate**

Run: `cd /data/shopping-list/code && npx vitest run src/__tests__/AppShell.test.tsx`
Expected: PASS.
Regression files: `src/__tests__/toastHost.test.tsx src/__tests__/testHelpers.test.tsx src/__tests__/SettingsPage.test.tsx src/__tests__/cookbookImport.test.ts`. Then `npm run lint` and `npx tsc --noEmit -p tsconfig.app.json`.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/ServerGate.tsx src/AppShell.tsx src/main.tsx src/__tests__/AppShell.test.tsx
git commit -m "feat: AppShell loads the five lists behind a gate, global toast and saving indicator" -- src/components/shared/ServerGate.tsx src/AppShell.tsx src/main.tsx src/__tests__/AppShell.test.tsx
```

---

### Task 10: Delete the localStorage code, shrink Zustand, final sweep and manual E2E checklist

Nothing reads the old services or the data slices any more, so they and their tests go. Zustand keeps UI state only (`selectedId`, `selectRecipe`); the toast message lives in its own small store from Task 4. The whole suite, lint, type-check and a production build must pass, then the manual check against the real API (this is the first step that needs the Task 1 environment).

Tests REPLACED by the hook tests of Tasks 3 to 8 (deleted here): `recipeService`, `pantryService`, `mealPlanService`, `mealPlanPersistence`, `ingredientsDbService`, `tagService`, `cookbookImport` (the server seeds the data now), `recipesSlice`, `mealPlannerSliceMutations`. Kept untouched: every selector, import-parsing and settings test. Edited: `cookNowSelector.test.ts` and `shoppingListSelector.test.ts` (only a dead `vi.mock` of the deleted service is removed). New: `uiStore.test.ts`.

**Files:**
- Delete (`git rm`): `src/features/recipes/services/recipeService.ts`, `src/features/recipes/services/tagService.ts`, `src/features/meal-planner/services/mealPlanService.ts`, `src/features/pantry/services/pantryService.ts`, `src/services/ingredientsDbService.ts`, `src/data/cookbookImport.ts`, `src/store/recipesSlice.ts`, `src/store/mealPlannerSlice.ts`, `src/store/pantrySlice.ts`, and the nine test files listed above
- Modify (full rewrite): `src/store/index.ts`
- Modify: `src/services/recipeImport/types.ts` (one comment), `src/__tests__/cookNowSelector.test.ts`, `src/__tests__/shoppingListSelector.test.ts`
- Test (create): `src/__tests__/uiStore.test.ts`
- Keep: `src/data/cookbookSeed.json` and `src/data/csv/*` (the PHP seeder reads them)

**Interfaces:**
- Consumes: all of Tasks 2 to 9.
- Produces: `useStore` (Zustand) with exactly `{ selectedId: string | null; selectRecipe(id: string | null): void }` (type `UiStore`).

- [ ] **Step 1: Prove nothing still depends on the old code**

Run from `/data/shopping-list/code`:

```bash
grep -rn "useStore" src --include=*.ts --include=*.tsx | grep -v __tests__ | grep -v "src/store/"
```

Expected: only `src/features/recipes/index.tsx` (reads `selectedId` and `selectRecipe`; it also calls `useStore.getState().selectedId`).

```bash
grep -rln "ingredientsDbService\|tagService\|recipeService\|pantryService\|mealPlanService\|cookbookImport\|initRecipes\|initPantry\|initMealPlan" src
```

Expected: only the files this task deletes or edits (the three old services, `cookbookImport.ts`, the three slices, the nine old tests, the two selector tests with the dead `vi.mock`, `recipeImport/types.ts` with a comment). If any other file appears, stop and fix that consumer first.

- [ ] **Step 2: Write the failing UI-store test**

Create `src/__tests__/uiStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store'

describe('UI store', () => {
  beforeEach(() => {
    useStore.setState({ selectedId: null })
  })

  it('starts with nothing selected', () => {
    expect(useStore.getState().selectedId).toBeNull()
  })

  it('selectRecipe selects and clears', () => {
    useStore.getState().selectRecipe('r-1')
    expect(useStore.getState().selectedId).toBe('r-1')
    useStore.getState().selectRecipe(null)
    expect(useStore.getState().selectedId).toBeNull()
  })

  it('holds UI state only: server data lives in TanStack Query', () => {
    expect(Object.keys(useStore.getState()).sort()).toEqual(['selectRecipe', 'selectedId'])
  })
})
```

Run: `npx vitest run src/__tests__/uiStore.test.ts`
Expected: FAIL on the last test (the store still carries `recipes`, `tags`, `entries`, `pantryItems` and the `init*` actions).

- [ ] **Step 3: Shrink the store**

Replace `src/store/index.ts` (full file):

```ts
import { create } from 'zustand'

/**
 * UI state only. Server data (recipes, tags, ingredients, pantry, meal plan) lives in TanStack Query (`src/api`);
 * the global toast message lives in `toastStore.ts`.
 */
export interface UiStore {
  selectedId: string | null
  selectRecipe: (id: string | null) => void
}

export const useStore = create<UiStore>()((set) => ({
  selectedId: null,
  selectRecipe: (id) => set({ selectedId: id }),
}))
```

- [ ] **Step 4: Delete the old code and its tests**

```bash
git rm src/features/recipes/services/recipeService.ts src/features/recipes/services/tagService.ts src/features/meal-planner/services/mealPlanService.ts src/features/pantry/services/pantryService.ts src/services/ingredientsDbService.ts src/data/cookbookImport.ts src/store/recipesSlice.ts src/store/mealPlannerSlice.ts src/store/pantrySlice.ts src/__tests__/recipeService.test.ts src/__tests__/tagService.test.ts src/__tests__/mealPlanService.test.ts src/__tests__/mealPlanPersistence.test.ts src/__tests__/pantryService.test.ts src/__tests__/ingredientsDbService.test.ts src/__tests__/cookbookImport.test.ts src/__tests__/recipesSlice.test.ts src/__tests__/mealPlannerSliceMutations.test.ts
```

- [ ] **Step 5: Edit the leftovers**

`src/__tests__/cookNowSelector.test.ts`, import line. Before:

```ts
import { describe, it, expect, vi } from 'vitest'
```

After:

```ts
import { describe, it, expect } from 'vitest'
```

and delete this block (it mocks the deleted service and is not needed by the selector):

```ts
vi.mock('../features/meal-planner/services/mealPlanService', () => ({
  getAll: () => [],
  create: vi.fn(),
  remove: vi.fn(),
}))

```

`src/__tests__/shoppingListSelector.test.ts`: the same two edits (`import { describe, it, expect, vi } from 'vitest'` becomes `import { describe, it, expect } from 'vitest'`, and the identical `vi.mock('../features/meal-planner/services/mealPlanService', ...)` block is deleted).

`src/services/recipeImport/types.ts` line 71. Before:

```ts
// Units a stored ingredient can use (the same set ingredientsDbService accepts) and the shopping-list categories.
```

After:

```ts
// Units a stored ingredient can use (the same set the ingredients API accepts) and the shopping-list categories.
```

- [ ] **Step 6: Verify the sweep**

```bash
grep -rn "ingredientsDbService\|tagService\|recipeService\|pantryService\|mealPlanService\|cookbookImport\|initRecipes\|initPantry\|initMealPlan\|slist_cookbook" src
grep -rn "slist_" src
```

Expected: the first command prints nothing. The second prints only the Gemini key (`slist_gemini_key` in `src/services/settingsService.ts` and `src/__tests__/settingsService.test.ts`).

Also confirm nothing forbidden changed: `git status --short public design-v1 design-v2 ../design-v1 ../design-v2` prints nothing (run from `code/`; adjust paths if needed).

- [ ] **Step 7: Run the final gate, the whole suite**

```bash
cd /data/shopping-list/code
timeout 600 npx vitest run > /tmp/vitest-full.txt 2>&1; tail -40 /tmp/vitest-full.txt
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: every test file passes (give the shell tool a 10 minute timeout; the log is in `/tmp/vitest-full.txt`); lint has 0 errors; the type-check exits 0; the build succeeds (it writes `dist/`, which is git-ignored; run `git status --short` afterwards and make sure no build output is staged). If the container was rebuilt (Task 1), also run `npm run test:php`.

- [ ] **Step 8: Commit**

```bash
git add src/store/index.ts src/services/recipeImport/types.ts src/__tests__/cookNowSelector.test.ts src/__tests__/shoppingListSelector.test.ts src/__tests__/uiStore.test.ts
git commit -m "refactor: remove the localStorage services and data slices, Zustand keeps UI state only" -- src/store/index.ts src/services/recipeImport/types.ts src/__tests__/cookNowSelector.test.ts src/__tests__/shoppingListSelector.test.ts src/__tests__/uiStore.test.ts src/features/recipes/services/recipeService.ts src/features/recipes/services/tagService.ts src/features/meal-planner/services/mealPlanService.ts src/features/pantry/services/pantryService.ts src/services/ingredientsDbService.ts src/data/cookbookImport.ts src/store/recipesSlice.ts src/store/mealPlannerSlice.ts src/store/pantrySlice.ts src/__tests__/recipeService.test.ts src/__tests__/tagService.test.ts src/__tests__/mealPlanService.test.ts src/__tests__/mealPlanPersistence.test.ts src/__tests__/pantryService.test.ts src/__tests__/ingredientsDbService.test.ts src/__tests__/cookbookImport.test.ts src/__tests__/recipesSlice.test.ts src/__tests__/mealPlannerSliceMutations.test.ts
```

- [ ] **Step 9: Manual end-to-end check against the real API (needs the rebuilt container from Task 1, or its documented fallback)**

The executor cannot tick these without a running API; if the API environment is not available, report this step as pending for the user. In `/data/shopping-list/code` (database migrated and seeded, see the Task 1 checklist), start `npm run api` in one terminal and `npm run dev` in another, open the Vite URL, and check:

1. Gate: stop `npm run api`, reload: one full-screen "Can't reach the server" panel with Retry. Start the API, press Retry: the app loads.
2. Seed data: Recipes lists the seeded cookbook; Pantry and Meal Planner start empty; no browser storage other than the Gemini key is used.
3. Ingredients: New recipe, type an unknown name, "Create", choose a unit: a short spinner, then the row is bound. `curl -s localhost:8080/api/ingredients | grep -c <name>` finds it. Create the same name from a second tab: the unit picker shows "An ingredient with that name already exists."
4. Tags: create a tag in the recipe form (saved before it is selected); the same name again shows "A tag with that name already exists."
5. Recipes: create, edit and save (Save shows "Saving…"), reload: the changes persist and the original `createdAt` ordering is kept. Delete asks for confirmation and says planned meals are removed too; after confirming and reloading, the recipe and its planned meals are gone.
6. Pantry: add an item, change its quantity, delete one; reload: persisted. Adding an ingredient that is already in the pantry raises its quantity instead of adding a row.
7. Meal plan: add through a slot's picker and through a recipe's "Add to week"; remove one; reload: persisted.
8. Cooking: open a planned meal and press the check icon: the pantry drops by the scaled recipe quantities (clamped at 0) and the meal shows as cooked; reload: both persisted; press it again: the pantry gets the quantities back. Cook Now and the Recipes page "mark as cooked" deduct the recipe once through the pantry batch.
9. Shopping list: checking an item adds it to the pantry; un-checking removes it; "Clear checked" only clears the local checks.
10. Import: put a Gemini key in Settings, import a URL, review, Save: new ingredients and tags are created first, then the recipe, all visible after reload.
11. Failure handling: stop the API and edit a pantry quantity: the number reverts and a toast "Could not save" appears; try saving a recipe: the modal stays open with the inline error. Start the API again and retry: it saves, and ingredients created by the failed attempt are not duplicated.
12. `mariadb -h127.0.0.1 -umeal_planner -pmeal_planner meal_planner -e "select count(*) from recipes; select count(*) from pantry_items; select count(*) from meal_plan_entries"` agrees with what the UI shows.

---

## Self-Review

Done after writing the plan, against `docs/superpowers/specs/2026-10-19-frontend-on-backend-design.md`.

**1. Spec coverage (requirement to task)**

| Spec requirement | Task |
|---|---|
| Dev environment: apt PHP, drop the pdo_mysql build, keep `db` and the phpunit download, `npm run api` unchanged, fallback image | 1 |
| `src/api/client.ts`: fetch wrapper reusing `timedFetch`, relative `/api`, typed `ApiError` with status and server code | 2 |
| One flat query key per resource; hooks `useRecipes`, `useTags`, `useIngredients`, `usePantry`, `useMealPlan` | 2 (keys), 3 (ingredients, tags, recipes), 4 (pantry, meal plan) |
| Zustand keeps UI state only; `recipes`, `tags`, `entries`, `pantryItems` and all `init*` actions leave the store; five localStorage services deleted | 10 (store shrunk, services deleted); consumers switched in 5 to 9 |
| Unchanged: selectors, `settingsService`, local checked state | Global Constraints; no task edits them (10 only drops a dead mock from two selector tests) |
| App-level gate, one loader, one "can't reach the server" panel with Retry, later refetches silent, "empty array means not loaded" checks removed | 9 (gate); the checks are removed in 6 (recipes page), 7 (planner), 8 (cook-now), 9 (AppShell) |
| Optimistic with rollback and toast: pantry quantity and delete, mark-cooked deductions via `PUT /api/pantry/batch`, meal-plan add, move, remove, cooked toggle; `SavingIndicator` while a write is in flight | 4 (hooks, toast store), 6/7/8 (consumers), 9 (global indicator and toast host) |
| Awaited: create ingredient (autocomplete spinner returns the saved entry), create tag, recipe save and delete, import; recipe save only after new ingredients and tags exist | 3 (hooks), 5 (autocomplete, modal ordering), 6 (delete, import) |
| Error mapping: 409 recipe = something it references is gone; 409 tag/ingredient = name exists; 422 = validation message; network = generic | 2 (`messageForError`), 5 (modal and autocomplete), tested in 2 and 5 |
| `IngredientAutocomplete` synchronous search over the cache; `importRecipe.ts`, `RecipeDetail`, `AddEditRecipeModal`, pantry page, shopping list read the cached list | 3 (`searchIngredients`), 5, 6, 8 |
| `importCookbookIfNeeded()`, `cookbookImport.ts`, `slist_cookbook_imported` deleted; `cookbookSeed.json` stays | 9 (call removed), 10 (file and test deleted) |
| Testing: hooks and `ApiError` with mocked fetch; component tests with a fresh `QueryClient`; localStorage-asserting tests replaced; selector and import-parsing tests kept; cooked-deduction semantics re-expressed over the batch mutation | 2 to 9 (new tests), 4 (`cookedPantryDeduction`), 10 (deletions) |
| Gates: `npm test`, `npm run lint`, `npm run test:php` | every task (vitest files, lint, type-check); `test:php` in Task 1 checklist and Task 10 |
| Cycle A ends with the manual check (create, edit, delete each resource, reload, cooked deductions hit the pantry) | 10, Step 9 |
| Known server behaviours: pantry UNIQUE(ingredient), recipe delete cascades silently (confirmation says so), `createdAt` untouched on update, client or server ids | 8 (merge into existing pantry row), 3 and 6 (cascade in the cache, confirmation text), 3 (no `createdAt` in the PUT, tested), 4 and 7 (client ids) |
| Cycle B items (deploy, host check, doc rewrites, parked backend fixes) | Deliberately not in this plan |

No spec requirement was left without a task.

**2. Placeholder scan.** The plan was searched for `TBD`, `TODO`, "implement later", "fill in", "similar to task", "appropriate error", "add validation" and "handle edge": no matches. Every code step carries real code; edits to existing large files give exact before and after blocks.

**3. Type and name consistency.** Checked by counting every shared name across the tasks (defined once, used with the same spelling): `useIngredients`, `useCreateIngredient`, `useTags`, `useCreateTag`, `useRecipes`, `useSaveRecipe`, `useDeleteRecipe`, `usePantry`, `useAddPantryItem`, `useUpdatePantryItem`, `useDeletePantryItem`, `useBatchPantry`, `useMealPlan`, `useAddMealEntry`, `useUpdateMealEntry`, `useRemoveMealEntry`, `useSetEntryCooked`, `newPantryItem`, `newMealEntry`, `recipeDeltas`, `applyPantryDeltas`, `searchIngredients`, `optimisticUpdate`, `failOptimistic`, `replaceById`, `messageForError`, `makeQueryClient`, `makeTestClient`, `renderWithClient`, `renderHookWithClient`, `installApi`, `waitFor`, `typeInto`, `gate`. The mutation input shapes match between the hooks and their callers: `useSaveRecipe` takes `{ id?, data }`, `useUpdatePantryItem` and `useUpdateMealEntry` take `{ id, patch }`, `useBatchPantry` takes `PantryDelta[]`, `useSetEntryCooked` takes `{ entry, deltas, cooked }`. Query keys are the same constants everywhere (`queryKeys.mealPlan` is `['meal-plan']`). The ordering invariant "an edit never removes the last use of an import without removing the import" was checked task by task because `noUnusedLocals` makes it a type error.

**Open points and assumptions for the user to confirm**

- The devcontainer change uses a new `.devcontainer/Dockerfile` (apt install as root, then back to `claude-user`) and points the compose `app` service at it, because the container user probably has no sudo. It assumes a Debian-based base image and PHP 8.2 or newer from apt (the `phpunit-11.phar` needs 8.2). `composer` is added to the apt list because removing the php feature removes its `installComposer` step.
- `package.json` has no Testing Library, so component tests use `createRoot` + `act` with the helpers in `src/test/`. No new test dependency is added.
- Creating a pantry item is optimistic with a client UUID (like the old slice), not awaited; the add modal still awaits it with `mutateAsync` to show an inline error, and a 409 (ingredient already in the pantry) rolls back with a toast. The spec only listed quantity and delete as optimistic.
- A failed optimistic write shows its message through one global toast (`toastStore` + `ToastHost` in `AppShell`) instead of per-page toasts, and one global `SavingIndicator` replaces the per-page ones.
- The recipe delete confirmation did not exist before; Task 6 adds a confirm dialog, which is also where the "planned meals are removed too" text lives.
- `useUpdateMealEntry` (the "move" write) is provided and tested but no UI moves entries today.
- Marking a meal cooked sends two requests (entry, then pantry batch). If the batch fails the entry is set back with a best-effort third request; a crash between the two requests could leave them out of step (the backend has no combined endpoint). No backend change is required for the plan; a single transactional "cook" endpoint would be the clean fix if this ever matters.
- The shared `AddToWeekModal` now rounds servings to an integer (the server rejects 1.5); the unused duplicate `features/meal-planner/AddToWeekModal.tsx` is deleted.







