# Import Recipe From URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a recipe page URL, have Gemini parse it cheaply, and review the prefilled recipe form before anything is saved. Includes a Settings page where the user stores their Gemini key.

**Architecture:** A standalone PHP endpoint (`code/public/api/fetch-recipe.php`, shipped inside `dist/`) fetches the page safely and returns a trimmed payload: the schema.org Recipe JSON-LD, or capped page text. The browser calls Gemini directly with the user's own key (header only), maps the structured result onto `ingredients_db` locally, and opens the existing recipe modal in a new `import` review mode.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (jsdom), Zustand, react-router-dom 7, lucide-react; PHP 8.1+ with curl, dom and mbstring, plus PHPUnit as a dev-only tool (a single downloaded `phpunit.phar`, no Composer).

**Spec:** `docs/superpowers/specs/2026-10-13-import-recipe-from-url-design.md`

## Global Constraints

- The Gemini key goes only in the `x-goog-api-key` request header. Never in a URL, a log line or an error message.
- The Gemini model is one constant, `GEMINI_MODEL`, in `code/src/services/recipeImport/geminiParse.ts`.
- `ingredients_db` is never sent to Gemini. Name matching and unit conversion happen locally.
- Nothing is written to the store or `localStorage` until the user presses Save in review mode.
- Recipe quantities are always in the ingredient's `default_unit`. Valid units: `g`, `ml`, `kg`, `l`, `pcs`, `cloves`, `tbsp`, `tsp`. The parse-side unit list (`IMPORT_UNITS` in Task 3) additionally contains `cup`, which `mapToRecipe` converts into the default units, so `cup` is intentionally not in the stored-unit list.
- Endpoint rules: `http` and `https` only, ports 80 and 443 only, reject private, loopback and link-local IPs (re-checked after every redirect, at most 3), 10 s timeout, 2 MB cap, HTML content types only. Error codes: `bad_url`, `blocked_host`, `fetch_failed`, `too_large`, `no_content`.
- Text fallback is capped at 6000 characters. JSON-LD is sent compacted (name, yield, ingredients, flattened steps only).
- PHP must run on 8.1 in production. No Composer anywhere: the endpoint uses plain `require_once`, and PHPUnit runs from a single `phpunit.phar` (gitignored). `phpunit.phar`, `phpunit.xml` and `api-tests/` sit outside `public/`, so the manual FTP upload of `dist/` never includes them.
- Settings entry: gear link pinned at the bottom of the desktop sidebar; on mobile a gear at the LEFT of the page header, just before the title (not a sixth bottom-bar item; user decision during execution).
- Do not edit `design-v1/` or `design-v2/`.
- Commands run from `/data/code` unless stated. Tests: `npx vitest run <file>`. Lint: `npm run lint`. Types: `npx tsc -b`.
- Commit style follows the repo: `feat(scope): …`, `test(scope): …`, `docs: …`. Never push, and never `git add -A` (the working tree has unrelated changes: `.claude/settings.local.json`, `_bmad/`).

---

## File Structure

| File | Responsibility |
|---|---|
| `code/src/services/settingsService.ts` (new) | Read, save and clear the Gemini key in `localStorage` |
| `code/src/services/recipeImport/types.ts` (new) | Shared types, `ImportError`, user-facing error messages |
| `code/src/services/recipeImport/request.ts` (new) | `timedFetch`: fetch with timeout and user abort, mapped to `ImportError` |
| `code/src/services/recipeImport/geminiParse.ts` (new) | Build the Gemini request, call it, validate the reply, `testGeminiKey` |
| `code/src/services/recipeImport/fetchPage.ts` (new) | Call the PHP endpoint |
| `code/src/services/recipeImport/mapToRecipe.ts` (new) | Pure: parsed recipe to a form draft (name match, unit conversion, notes) |
| `code/src/services/recipeImport/importRecipe.ts` (new) | Orchestrates fetch, parse and map |
| `code/src/features/settings/index.tsx` (new) | Settings page |
| `code/src/components/nav/SettingsGear.tsx` (new) | Mobile gear link |
| `code/src/features/recipes/ImportRecipeModal.tsx` (new) | URL dialog |
| `code/src/features/recipes/AddEditRecipeModal.tsx` (modify) | New `import` review mode |
| `code/src/features/recipes/index.tsx` (modify) | Import button and modal wiring |
| `code/public/api/fetch-recipe.php` + `code/public/api/src/*.php` (new) | The endpoint |
| `code/api-tests/*Test.php`, `code/api-tests/bootstrap.php`, `code/phpunit.xml` (new) | PHP tests, dev-only, run with a downloaded `phpunit.phar` |

---

### Task 1: Live Gemini spike (manual gate)

Confirms the endpoint, model and browser CORS before building on them. Google's docs now lead with a newer "Interactions" API. This plan uses the long-standing `generateContent` endpoint and keeps its request and response shape in two small functions in Task 3 (`buildGeminiRequest`, `extractGeminiText`), so changing the shape later touches only those.

**Files:** none committed, except a short result note appended to the spec.

**Produces:** a confirmed `GEMINI_MODEL` string, a confirmed request and response shape, and a measured token count.

- [ ] **Step 1: Get a throwaway key**

Eva creates a throwaway key at https://aistudio.google.com/apikey. Delete it after the spike.

- [ ] **Step 2: Run the call from the browser**

Run `npm run dev` in `/data/code`, open the app, open DevTools, paste this into the console (replace the key), and run it:

```js
const KEY = 'PASTE_THROWAWAY_KEY'
const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Extract the recipe. Pancakes: 200 g flour, 2 eggs, 300 ml milk. Mix, then fry.' }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          ingredients: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                quantity: { type: 'NUMBER', nullable: true },
                unit: { type: 'STRING', nullable: true },
              },
              required: ['name'],
            },
          },
        },
        required: ['name', 'ingredients'],
      },
    },
  }),
})
console.log(res.status, JSON.stringify(await res.json(), null, 2))
```

- [ ] **Step 3: Check the outcome**

Expected: status `200`, JSON text at `candidates[0].content.parts[0].text`, and `usageMetadata.promptTokenCount` / `candidatesTokenCount` present.

- CORS error in the console: stop. Tell Eva. Fall back to the spec's alternative (the server makes the Gemini call), which changes Tasks 3 and 6.
- `404` or "model not found": pick the cheapest current Flash-Lite model from https://ai.google.dev/gemini-api/docs/models and https://ai.google.dev/gemini-api/docs/pricing, re-run, and use that string for `GEMINI_MODEL` in Task 3.
- `generateContent` rejected as removed: use the Interactions API shape from https://ai.google.dev/api/interactions-api instead. Only `buildGeminiRequest`, `extractGeminiText` and the endpoint constant change in Task 3.
- `400` about `responseSchema` or `nullable`: adjust `RESPONSE_SCHEMA` in Task 3 to what the API accepts.

- [ ] **Step 4: Check the host's PHP (manual, via your normal FTP)**

The endpoint is useless if the shared host cannot run it, so find out now. Create `host-check.php` locally with this content and upload it to the site root (the same place as `index.html`) with your FTP client:

```php
<?php
echo 'PHP ' . PHP_VERSION . "\n";
foreach (['curl', 'dom', 'mbstring', 'iconv'] as $ext) {
    echo $ext . ': ' . (extension_loaded($ext) ? 'yes' : 'NO') . "\n";
}
$c = curl_init('https://example.com/');
curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
curl_exec($c);
echo 'outbound https: ' . curl_getinfo($c, CURLINFO_RESPONSE_CODE) . "\n";
```

Open `https://shopping.chillimuffin.com/host-check.php` (log in with the basic auth) and read the output. **Delete `host-check.php` from the host immediately afterwards.**

Expected: PHP 8.1 or newer, all four extensions `yes`, `outbound https: 200`.

- PHP older than 8.1, a missing extension, or `outbound https: 0`: stop and tell Eva. The endpoint cannot run on this host as designed (options: a different host, or raising the PHP version in the host's control panel).

- [ ] **Step 5: Record the result in the spec and commit**

Append this to the "Testing" section of `docs/superpowers/specs/2026-10-13-import-recipe-from-url-design.md`, filled in with the real values:

```markdown
**Spike result (2026-10-13):** host PHP `<version>` with `<extensions ok / missing>` and outbound `<ok / blocked>`, model `<model>`, endpoint `<generateContent or interactions>`, browser CORS `<works / blocked>`, sample call `<N>` prompt tokens and `<N>` output tokens.
```

```bash
cd /data
git add docs/superpowers/specs/2026-10-13-import-recipe-from-url-design.md
git commit -m "docs: record Gemini spike result for recipe import"
```

---

### Task 2: settingsService

**Files:**
- Create: `code/src/services/settingsService.ts`
- Test: `code/src/__tests__/settingsService.test.ts`

**Interfaces:**
- Produces: `settingsService.getGeminiKey(): string` (empty string when unset), `.setGeminiKey(key: string): void` (trims, empty removes), `.clearGeminiKey(): void`, `.hasGeminiKey(): boolean`.

Note: `cookbookImport.ts` wipes only its named `RESET_KEYS`, so the new `slist_gemini_key` entry survives a seed re-import.

- [ ] **Step 1: Write the failing test**

```ts
// code/src/__tests__/settingsService.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { settingsService } from '../services/settingsService'

describe('settingsService — Gemini key', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty string when no key is saved', () => {
    expect(settingsService.getGeminiKey()).toBe('')
    expect(settingsService.hasGeminiKey()).toBe(false)
  })

  it('saves the key trimmed and reads it back', () => {
    settingsService.setGeminiKey('  abc123  ')
    expect(settingsService.getGeminiKey()).toBe('abc123')
    expect(settingsService.hasGeminiKey()).toBe(true)
  })

  it('saving an empty or whitespace key removes it', () => {
    settingsService.setGeminiKey('abc123')
    settingsService.setGeminiKey('   ')
    expect(settingsService.getGeminiKey()).toBe('')
    expect(localStorage.getItem('slist_gemini_key')).toBeNull()
  })

  it('clearGeminiKey removes the stored key', () => {
    settingsService.setGeminiKey('abc123')
    settingsService.clearGeminiKey()
    expect(settingsService.hasGeminiKey()).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/settingsService.test.ts`
Expected: FAIL, cannot resolve `../services/settingsService`.

- [ ] **Step 3: Implement**

```ts
// code/src/services/settingsService.ts
const GEMINI_KEY = 'slist_gemini_key'

function getGeminiKey(): string {
  return localStorage.getItem(GEMINI_KEY) ?? ''
}

export const settingsService = {
  getGeminiKey,

  setGeminiKey(key: string): void {
    const trimmed = key.trim()
    if (trimmed) localStorage.setItem(GEMINI_KEY, trimmed)
    else localStorage.removeItem(GEMINI_KEY)
  },

  clearGeminiKey(): void {
    localStorage.removeItem(GEMINI_KEY)
  },

  hasGeminiKey(): boolean {
    return getGeminiKey() !== ''
  },
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/__tests__/settingsService.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /data
git add code/src/services/settingsService.ts code/src/__tests__/settingsService.test.ts
git commit -m "feat(settings): add settingsService for the Gemini key"
```

---

### Task 3: Import types, timed fetch, and the Gemini client

**Files:**
- Create: `code/src/services/recipeImport/types.ts`
- Create: `code/src/services/recipeImport/request.ts`
- Create: `code/src/services/recipeImport/geminiParse.ts`
- Test: `code/src/__tests__/geminiParse.test.ts`
- Test: `code/src/__tests__/importRequest.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `IMPORT_UNITS`, `type ImportUnit`
  - `interface ParsedIngredient { name: string; quantity: number | null; unit: ImportUnit | null }`
  - `interface ParsedRecipe { name: string; servings: number | null; ingredients: ParsedIngredient[]; steps: string[] }`
  - `interface FetchedPage { source: 'jsonld' | 'text'; text: string }`
  - `type ImportErrorCode`, `IMPORT_ERROR_MESSAGES: Record<ImportErrorCode, string>`, `class ImportError extends Error { readonly code: ImportErrorCode }`
- Produces (`request.ts`): `timedFetch(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number, userSignal?: AbortSignal): Promise<Response>`. It throws `ImportError('aborted' | 'timeout' | 'network')`.
- Produces (`geminiParse.ts`): `GEMINI_MODEL`, `buildPrompt(page)`, `buildGeminiRequest(prompt)`, `extractGeminiText(json)`, `toParsedRecipe(raw)`, `parseRecipeWithGemini(page, key, opts?)`, `testGeminiKey(key, opts?)`, where `opts` is `{ signal?: AbortSignal; fetchImpl?: typeof fetch }`.

- [ ] **Step 1: Write `types.ts`** (no test needed, it is declarations plus static strings that later tests exercise)

```ts
// code/src/services/recipeImport/types.ts
export const IMPORT_UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pcs', 'cloves'] as const
export type ImportUnit = (typeof IMPORT_UNITS)[number]

export interface ParsedIngredient {
  name: string
  quantity: number | null
  unit: ImportUnit | null
}

export interface ParsedRecipe {
  name: string
  servings: number | null
  ingredients: ParsedIngredient[]
  steps: string[]
}

export interface FetchedPage {
  source: 'jsonld' | 'text'
  text: string
}

export type ImportErrorCode =
  | 'bad_url'
  | 'blocked_host'
  | 'fetch_failed'
  | 'too_large'
  | 'no_content'
  | 'no_key'
  | 'key_rejected'
  | 'rate_limited'
  | 'gemini_error'
  | 'no_recipe'
  | 'network'
  | 'timeout'
  | 'aborted'

// Static strings only: an error message must never contain the API key.
export const IMPORT_ERROR_MESSAGES: Record<ImportErrorCode, string> = {
  bad_url: 'That does not look like a web address. Use one starting with http:// or https://.',
  blocked_host: 'That address is not allowed.',
  fetch_failed: "Couldn't reach that page.",
  too_large: 'That page is too large to import.',
  no_content: "Couldn't find any readable content on that page.",
  no_key: 'Add your Gemini key in Settings first.',
  key_rejected: 'Gemini rejected the key. Check it in Settings.',
  rate_limited: 'Gemini rate limit reached, try again in a minute.',
  gemini_error: 'Gemini returned an error. Try again later.',
  no_recipe: "Couldn't find a recipe on that page.",
  network: "Couldn't reach the server. Check your connection.",
  timeout: 'That took too long. Try again.',
  aborted: 'Import cancelled.',
}

export class ImportError extends Error {
  readonly code: ImportErrorCode

  constructor(code: ImportErrorCode) {
    super(IMPORT_ERROR_MESSAGES[code])
    this.name = 'ImportError'
    this.code = code
  }
}
```

- [ ] **Step 2: Write the failing `timedFetch` test**

```ts
// code/src/__tests__/importRequest.test.ts
import { describe, it, expect, vi } from 'vitest'
import { timedFetch } from '../services/recipeImport/request'
import type { ImportError } from '../services/recipeImport/types'

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as ImportError).code
  }
  return 'none'
}

// A fetch that only settles when its signal aborts
const hangingFetch = ((_url: string, init: RequestInit) =>
  new Promise((_resolve, reject) => {
    // Like real fetch, reject at once when the signal is already aborted
    if (init.signal!.aborted) reject(new DOMException('aborted', 'AbortError'))
    init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
  })) as unknown as typeof fetch

describe('timedFetch', () => {
  it('returns the response when fetch succeeds', async () => {
    const res = new Response('ok')
    const fetchImpl = vi.fn().mockResolvedValue(res)
    await expect(timedFetch(fetchImpl, 'https://x.test', {}, 1000)).resolves.toBe(res)
  })

  it('maps a rejected fetch to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await codeOf(timedFetch(fetchImpl, 'https://x.test', {}, 1000))).toBe('network')
  })

  it('maps its own timeout to timeout', async () => {
    expect(await codeOf(timedFetch(hangingFetch, 'https://x.test', {}, 5))).toBe('timeout')
  })

  it('maps a user abort to aborted', async () => {
    const controller = new AbortController()
    const p = timedFetch(hangingFetch, 'https://x.test', {}, 1000, controller.signal)
    controller.abort()
    expect(await codeOf(p)).toBe('aborted')
  })

  it('maps an already-aborted user signal to aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await codeOf(timedFetch(hangingFetch, 'https://x.test', {}, 1000, controller.signal))).toBe('aborted')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/__tests__/importRequest.test.ts`
Expected: FAIL, cannot resolve `../services/recipeImport/request`.

- [ ] **Step 4: Implement `request.ts`**

```ts
// code/src/services/recipeImport/request.ts
import { ImportError } from './types'

/**
 * fetch() with a timeout and an optional user abort signal.
 * The timeout covers the wait for response headers only.
 */
export async function timedFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  userSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  if (userSignal?.aborted) controller.abort()
  userSignal?.addEventListener('abort', onAbort, { once: true })

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } catch {
    if (userSignal?.aborted) throw new ImportError('aborted')
    if (timedOut) throw new ImportError('timeout')
    throw new ImportError('network')
  } finally {
    clearTimeout(timer)
    userSignal?.removeEventListener('abort', onAbort)
  }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/__tests__/importRequest.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Write the failing Gemini client test**

```ts
// code/src/__tests__/geminiParse.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  GEMINI_MODEL,
  buildGeminiRequest,
  buildPrompt,
  parseRecipeWithGemini,
  testGeminiKey,
  toParsedRecipe,
} from '../services/recipeImport/geminiParse'
import type { FetchedPage, ImportError } from '../services/recipeImport/types'

const KEY = 'secret-key-123'
const PAGE: FetchedPage = { source: 'jsonld', text: '{"name":"Pancakes"}' }
const GOOD = {
  name: 'Pancakes',
  servings: 4,
  ingredients: [{ name: 'flour', quantity: 200, unit: 'g' }],
  steps: ['Mix', 'Fry'],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
function geminiOk(payload: unknown): Response {
  return jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
}
function geminiText(text: string): Response {
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] })
}
async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as ImportError).code
  }
  return 'none'
}

describe('parseRecipeWithGemini', () => {
  it('sends the key in the header, never in the URL, with the schema', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(GOOD))
    await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(GEMINI_MODEL)
    expect(url).not.toContain(KEY)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY)
    const body = JSON.parse(init.body as string)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toBeDefined()
  })

  it('returns the parsed recipe', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(GOOD))
    expect(await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })).toEqual(GOOD)
  })

  it.each([
    [429, 'rate_limited'],
    [403, 'key_rejected'],
    [401, 'key_rejected'],
    [500, 'gemini_error'],
  ])('maps HTTP %i to %s', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'x' } }, status))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe(code)
  })

  it('maps a 400 about the API key to key_rejected', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe('key_rejected')
  })

  it('maps a network failure to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe('network')
  })

  it('maps a user abort to aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl, signal: controller.signal }))).toBe('aborted')
  })

  it('retries once on malformed JSON and then succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(geminiText('not json')).mockResolvedValueOnce(geminiOk(GOOD))
    expect(await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })).toEqual(GOOD)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('gives up with no_recipe after two malformed replies', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => geminiText('not json'))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe('no_recipe')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns no_recipe without retrying when there are no ingredients and no steps', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(geminiOk({ name: 'Nothing', servings: null, ingredients: [], steps: [] }))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe('no_recipe')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('never puts the key in an error message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: KEY } }, 403))
    try {
      await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })
    } catch (e) {
      expect((e as Error).message).not.toContain(KEY)
    }
  })
})

describe('toParsedRecipe', () => {
  it('drops ingredients without a name and coerces bad quantity and unit to null', () => {
    const parsed = toParsedRecipe({
      name: 'X',
      servings: 'four',
      ingredients: [
        { name: '  ', quantity: 1, unit: 'g' },
        { name: 'salt', quantity: '2', unit: 'handful' },
        { name: 'flour', quantity: 200, unit: 'g' },
      ],
      steps: ['Mix', '', 5],
    })
    expect(parsed).toEqual({
      name: 'X',
      servings: null,
      ingredients: [
        { name: 'salt', quantity: null, unit: null },
        { name: 'flour', quantity: 200, unit: 'g' },
      ],
      steps: ['Mix'],
    })
  })

  it('returns null for the wrong shape', () => {
    expect(toParsedRecipe(null)).toBeNull()
    expect(toParsedRecipe({ name: 'X', ingredients: 'nope', steps: [] })).toBeNull()
    expect(toParsedRecipe({ ingredients: [], steps: [] })).toBeNull()
  })
})

describe('buildPrompt and buildGeminiRequest', () => {
  it('puts the page text last and names the source kind', () => {
    const prompt = buildPrompt({ source: 'text', text: 'PAGE BODY' })
    expect(prompt).toContain('page text')
    expect(prompt.endsWith('PAGE BODY')).toBe(true)
    expect(buildPrompt(PAGE)).toContain('JSON-LD')
  })

  it('uses temperature 0 and a bounded output', () => {
    const req = buildGeminiRequest('hi') as { generationConfig: { temperature: number; maxOutputTokens: number } }
    expect(req.generationConfig.temperature).toBe(0)
    expect(req.generationConfig.maxOutputTokens).toBeLessThanOrEqual(2048)
  })
})

describe('testGeminiKey', () => {
  it('resolves when Gemini answers 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiText('ok'))
    await expect(testGeminiKey(KEY, { fetchImpl })).resolves.toBeUndefined()
  })

  it('rejects with key_rejected on 403', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'x' } }, 403))
    expect(await codeOf(testGeminiKey(KEY, { fetchImpl }))).toBe('key_rejected')
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/__tests__/geminiParse.test.ts`
Expected: FAIL, cannot resolve `../services/recipeImport/geminiParse`.

- [ ] **Step 8: Implement `geminiParse.ts`**

If Task 1 changed the model, endpoint or request or response shape, adjust `GEMINI_MODEL`, `ENDPOINT`, `RESPONSE_SCHEMA`, `buildGeminiRequest` and `extractGeminiText` accordingly. Nothing else in this file should need to change.

```ts
// code/src/services/recipeImport/geminiParse.ts
import { timedFetch } from './request'
import {
  IMPORT_UNITS,
  ImportError,
  type FetchedPage,
  type ImportUnit,
  type ParsedIngredient,
  type ParsedRecipe,
} from './types'

// Cheapest current Flash-Lite tier that accepts new users. gemini-2.5-flash-lite now returns 404
// ("no longer available to new users"). gemini-3.1-flash-lite is listed as cheaper on Google's pricing page.
// The request shape (generateContent) is still to be confirmed with this model by a live call.
export const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 30_000

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    servings: { type: 'NUMBER', nullable: true },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity: { type: 'NUMBER', nullable: true },
          unit: { type: 'STRING', enum: [...IMPORT_UNITS], nullable: true },
        },
        required: ['name', 'quantity', 'unit'],
      },
    },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['name', 'servings', 'ingredients', 'steps'],
}

interface CallOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

export function buildPrompt(page: FetchedPage): string {
  const kind = page.source === 'jsonld' ? 'schema.org Recipe JSON-LD' : 'page text'
  return [
    `Extract the recipe from this ${kind}.`,
    'Rules:',
    "- Write the name, ingredient names and steps in the recipe's own language.",
    '- ingredient name: singular base form only, no quantity, no preparation notes.',
    '- unit: one of the allowed values, or null if the line has no unit.',
    '- quantity: a number, or null if it is missing, a range (2-3) or vague (a pinch).',
    '- steps: the method as short steps, in order.',
    '- servings: a number, or null if not stated.',
    '',
    page.text,
  ].join('\n')
}

export function buildGeminiRequest(prompt: string): object {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  }
}

export function extractGeminiText(json: unknown): string | null {
  const text = (json as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })?.candidates?.[0]
    ?.content?.parts?.[0]?.text
  return typeof text === 'string' ? text : null
}

function isUnit(value: unknown): value is ImportUnit {
  return typeof value === 'string' && (IMPORT_UNITS as readonly string[]).includes(value)
}

export function toParsedRecipe(raw: unknown): ParsedRecipe | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.name !== 'string' || !Array.isArray(r.ingredients) || !Array.isArray(r.steps)) return null

  const ingredients: ParsedIngredient[] = []
  for (const item of r.ingredients) {
    if (typeof item !== 'object' || item === null) continue
    const i = item as Record<string, unknown>
    if (typeof i.name !== 'string' || i.name.trim() === '') continue
    ingredients.push({
      name: i.name.trim(),
      quantity: typeof i.quantity === 'number' && Number.isFinite(i.quantity) ? i.quantity : null,
      unit: isUnit(i.unit) ? i.unit : null,
    })
  }

  const steps = r.steps.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim())
  const servings = typeof r.servings === 'number' && Number.isFinite(r.servings) && r.servings > 0 ? r.servings : null

  return { name: r.name.trim(), servings, ingredients, steps }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } }
    return String(body?.error?.message ?? '')
  } catch {
    return ''
  }
}

async function callGemini(key: string, body: object, opts: CallOptions): Promise<unknown> {
  const res = await timedFetch(
    opts.fetchImpl ?? fetch,
    `${ENDPOINT}/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    },
    TIMEOUT_MS,
    opts.signal,
  )
  if (res.status === 429) throw new ImportError('rate_limited')
  if (res.status === 401 || res.status === 403) throw new ImportError('key_rejected')
  if (!res.ok) {
    if (res.status === 400 && /api key/i.test(await errorMessage(res))) throw new ImportError('key_rejected')
    throw new ImportError('gemini_error')
  }
  try {
    return await res.json()
  } catch {
    throw new ImportError('gemini_error')
  }
}

export async function parseRecipeWithGemini(
  page: FetchedPage,
  key: string,
  opts: CallOptions = {},
): Promise<ParsedRecipe> {
  const body = buildGeminiRequest(buildPrompt(page))

  // One automatic retry when the reply is not valid JSON of the expected shape.
  for (let attempt = 0; attempt < 2; attempt++) {
    const json = await callGemini(key, body, opts)
    const text = extractGeminiText(json)
    let raw: unknown = null
    if (text) {
      try {
        raw = JSON.parse(text)
      } catch {
        raw = null
      }
    }
    const parsed = toParsedRecipe(raw)
    if (parsed) {
      if (parsed.ingredients.length === 0 && parsed.steps.length === 0) throw new ImportError('no_recipe')
      return parsed
    }
  }
  throw new ImportError('no_recipe')
}

/** One minimal call that costs a few tokens. Throws ImportError when the key does not work. */
export async function testGeminiKey(key: string, opts: CallOptions = {}): Promise<void> {
  await callGemini(
    key,
    { contents: [{ parts: [{ text: 'ok' }] }], generationConfig: { maxOutputTokens: 1 } },
    opts,
  )
}
```

- [ ] **Step 9: Run both test files to verify they pass**

Run: `npx vitest run src/__tests__/geminiParse.test.ts src/__tests__/importRequest.test.ts`
Expected: PASS.

- [ ] **Step 10: Typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
cd /data
git add code/src/services/recipeImport/types.ts code/src/services/recipeImport/request.ts code/src/services/recipeImport/geminiParse.ts code/src/__tests__/geminiParse.test.ts code/src/__tests__/importRequest.test.ts
git commit -m "feat(import): add Gemini client with timeout, error mapping and schema"
```

---

### Task 4: Settings page and navigation

**Files:**
- Create: `code/src/features/settings/index.tsx`
- Create: `code/src/components/nav/SettingsGear.tsx`
- Modify: `code/src/App.tsx`
- Modify: `code/src/components/nav/Sidebar.tsx`
- Modify: `code/src/AppShell.tsx`
- Modify: `code/src/styles/tokens.css`
- Test: `code/src/__tests__/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `settingsService` (Task 2), `testGeminiKey` and `ImportError` (Task 3).
- Produces: default export `SettingsPage` (route `/settings`); default export `SettingsGear`. CSS classes `.settings-gear` and `.settings-back`.

- [ ] **Step 1: Write the failing test**

```tsx
// code/src/__tests__/SettingsPage.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../features/settings'
import SettingsGear from '../components/nav/SettingsGear'
import { settingsService } from '../services/settingsService'
import { ImportError } from '../services/recipeImport/types'
import { testGeminiKey } from '../services/recipeImport/geminiParse'

vi.mock('../services/recipeImport/geminiParse', () => ({ testGeminiKey: vi.fn() }))

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Settings page and gear', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>

  beforeEach(() => {
    localStorage.clear()
    vi.mocked(testGeminiKey).mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  // The key makes React mount a fresh router per path (initialEntries is only read on mount)
  function renderAt(path: string, ui: ReactNode) {
    act(() => {
      root.render(
        <MemoryRouter key={path} initialEntries={[path]}>
          {ui}
        </MemoryRouter>,
      )
    })
  }

  const input = () => container.querySelector('#gemini-key') as HTMLInputElement
  const button = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

  it('shows a saved key masked and toggles visibility', () => {
    settingsService.setGeminiKey('abc')
    renderAt('/settings', <SettingsPage />)
    expect(input().value).toBe('abc')
    expect(input().type).toBe('password')
    act(() => (container.querySelector('[aria-label="Show key"]') as HTMLButtonElement).click())
    expect(input().type).toBe('text')
  })

  it('Save persists the key and Clear removes it', () => {
    renderAt('/settings', <SettingsPage />)
    act(() => typeInto(input(), '  newkey  '))
    act(() => button('Save').click())
    expect(settingsService.getGeminiKey()).toBe('newkey')
    expect(container.textContent).toContain('Saved')

    act(() => button('Clear').click())
    expect(settingsService.hasGeminiKey()).toBe(false)
    expect(input().value).toBe('')
  })

  it('Test key is disabled while the field is empty', () => {
    renderAt('/settings', <SettingsPage />)
    expect(button('Test key').disabled).toBe(true)
  })

  it('Test key reports success', async () => {
    vi.mocked(testGeminiKey).mockResolvedValue(undefined)
    renderAt('/settings', <SettingsPage />)
    act(() => typeInto(input(), 'abc'))
    await act(async () => button('Test key').click())
    expect(testGeminiKey).toHaveBeenCalledWith('abc')
    expect(container.textContent).toContain('Key works')
  })

  it('Test key shows the error message on failure', async () => {
    vi.mocked(testGeminiKey).mockRejectedValue(new ImportError('key_rejected'))
    renderAt('/settings', <SettingsPage />)
    act(() => typeInto(input(), 'bad'))
    await act(async () => button('Test key').click())
    expect(container.textContent).toContain('Gemini rejected the key')
  })

  it('the gear links to /settings on other pages and is hidden on /settings', () => {
    renderAt('/recipes', <SettingsGear />)
    expect(container.querySelector('a[href="/settings"]')).not.toBeNull()
    renderAt('/settings', <SettingsGear />)
    expect(container.querySelector('a[href="/settings"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/SettingsPage.test.tsx`
Expected: FAIL, cannot resolve `../features/settings`.

- [ ] **Step 3: Implement the Settings page**

```tsx
// code/src/features/settings/index.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { settingsService } from '../../services/settingsService'
import { testGeminiKey } from '../../services/recipeImport/geminiParse'
import { ImportError } from '../../services/recipeImport/types'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'

type Status =
  | { kind: 'none' }
  | { kind: 'saved' }
  | { kind: 'cleared' }
  | { kind: 'testing' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

const STATUS_TEXT: Record<Exclude<Status['kind'], 'error' | 'none'>, string> = {
  saved: 'Saved.',
  cleared: 'Key removed.',
  testing: 'Testing…',
  ok: 'Key works.',
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [value, setValue] = useState(() => settingsService.getGeminiKey())
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'none' })

  function handleSave() {
    settingsService.setGeminiKey(value)
    setValue(value.trim())
    setStatus({ kind: 'saved' })
  }

  function handleClear() {
    settingsService.clearGeminiKey()
    setValue('')
    setStatus({ kind: 'cleared' })
  }

  async function handleTest() {
    setStatus({ kind: 'testing' })
    try {
      await testGeminiKey(value.trim())
      setStatus({ kind: 'ok' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ImportError ? err.message : 'Test failed.' })
    }
  }

  const statusText = status.kind === 'none' ? '' : status.kind === 'error' ? status.message : STATUS_TEXT[status.kind]

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton className="settings-back" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft size={20} />
          </IconButton>
          <h1>Settings</h1>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="form-label" htmlFor="gemini-key">
          Gemini API key
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            id="gemini-key"
            type={visible ? 'text' : 'password'}
            className="field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your key"
          />
          <IconButton
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide key' : 'Show key'}
            style={{ width: 32, height: 32 }}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </IconButton>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button intent="coral" size="sm" type="button" onClick={handleSave}>
            Save
          </Button>
          <Button
            intent="secondary"
            size="sm"
            type="button"
            onClick={handleTest}
            disabled={!value.trim() || status.kind === 'testing'}
          >
            Test key
          </Button>
          <Button intent="ghost" size="sm" type="button" onClick={handleClear}>
            Clear
          </Button>
        </div>

        <p
          role="status"
          style={{ fontSize: 13, minHeight: 18, color: status.kind === 'error' ? 'var(--red)' : 'var(--text-mid)' }}
        >
          {statusText}
        </p>

        <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          The key is used to read recipes from web pages (Import from URL). Get one at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>
          . It stays in this browser and is sent only to Google. In AI Studio, restrict the key to this site's address
          (HTTP referrer) and set a low quota.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement the gear**

```tsx
// code/src/components/nav/SettingsGear.tsx
import { Link, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'

/** Mobile entry to Settings: sits in the page header area. Hidden on desktop by CSS (the sidebar has the link). */
export default function SettingsGear() {
  const { pathname } = useLocation()
  if (pathname === '/settings') return null
  return (
    <Link to="/settings" className="settings-gear" aria-label="Settings">
      <Settings size={20} />
    </Link>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/SettingsPage.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Wire route, sidebar, shell and CSS**

In `code/src/App.tsx` add the import and route:

```tsx
import SettingsPage from './features/settings'
// …
        <Route path="/cook-now" element={<CookNowPage />} />
        <Route path="/settings" element={<SettingsPage />} />
```

In `code/src/components/nav/Sidebar.tsx` add `import { Settings } from 'lucide-react'` and insert this between the closing `</ul>` and the footer `<div>`:

```tsx
      <NavLink
        to="/settings"
        style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: 500,
          textDecoration: 'none',
          color: isActive ? 'var(--nav-text-active)' : 'var(--nav-text-inactive)',
          background: isActive ? 'var(--coral)' : 'transparent',
        })}
      >
        <Settings size={20} strokeWidth={2} />
        Settings
      </NavLink>
```

In `code/src/AppShell.tsx` import `SettingsGear from './components/nav/SettingsGear'`, add `position: 'relative'` to the `<main>` style object, and render the gear before the outlet:

```tsx
        <SettingsGear />
        <Outlet />
```

Append to `code/src/styles/tokens.css` (the `!important` on `.settings-back` is needed because `IconButton` sets `display` inline):

```css
/* Settings entry: gear in the page header on mobile (desktop uses the sidebar link) */
.settings-gear {
  display: none;
}

.settings-back {
  display: none !important;
}

@media (max-width: 767px) {
  .settings-gear {
    position: absolute;
    top: 14px;
    inset-inline-end: max(12px, env(safe-area-inset-right, 0px));
    z-index: 5;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
    border-radius: var(--radius);
  }

  .settings-back {
    display: inline-flex !important;
  }

  /* Keep header actions clear of the gear */
  .page-header {
    padding-inline-end: max(52px, calc(env(safe-area-inset-right, 0px) + 52px));
  }
}
```

- [ ] **Step 7: Typecheck, lint, and full test run**

Run: `npx tsc -b && npm run lint && npx vitest run`
Expected: all green.

- [ ] **Step 8: Visual check at 360 px and desktop**

Use the `screenshot` skill (or run `npm run dev` and check by hand) on `/recipes`, `/meal-planner`, `/cook-now` and `/settings` at 360 px wide and at desktop width.

Expected: the sidebar shows Settings above the footer on desktop. On mobile, the gear sits at the right end of each header, aligned with the header buttons, and does not overlap them. `/settings` shows a back chevron on mobile and none on desktop.

If the Cook Now or Meal Planner header overflows at 360 px, add `padding-inline-start: 16px;` to the same mobile `.page-header` rule rather than removing the gear.

- [ ] **Step 9: Commit**

```bash
cd /data
git add code/src/features/settings code/src/components/nav/SettingsGear.tsx code/src/App.tsx code/src/components/nav/Sidebar.tsx code/src/AppShell.tsx code/src/styles/tokens.css code/src/__tests__/SettingsPage.test.tsx
git commit -m "feat(settings): add Settings page with Gemini key and nav entries"
```

---

### Task 5: mapToRecipe (pure mapping, matching and conversion)

**Files:**
- Create: `code/src/services/recipeImport/mapToRecipe.ts`
- Test: `code/src/__tests__/mapToRecipe.test.ts`

**Interfaces:**
- Consumes: `ParsedRecipe`, `ImportUnit` (Task 3); `IngredientDbEntry` from `code/src/types/ingredients.ts`.
- Produces:
  - `interface DraftRow { ingredientId: string | null; ingredientName: string; quantity: number; unit: string; flagged: boolean; sourceText: string }`
  - `interface RecipeDraft { name: string; servings: number; rows: DraftRow[]; notes: string; sourceHost: string }`
  - `mapToRecipe(parsed: ParsedRecipe, db: IngredientDbEntry[], sourceUrl: string): RecipeDraft`
  - `convertQuantity(quantity: number, from: string | null, to: string): number | null`
  - `buildNotes(steps: string[], sourceUrl: string): string`
  - `hostOf(url: string): string`

Rules (from the spec): a row whose name matches but whose quantity can't be converted keeps its ingredient, gets `quantity 0` and `flagged: true`. A row whose name doesn't match stays unbound (`ingredientId: null`, `unit: ''`), keeps the parsed quantity as-is and is flagged. `sourceText` always carries the original line, so the review UI can show "From page: 200 g flour".

- [ ] **Step 1: Write the failing test**

```ts
// code/src/__tests__/mapToRecipe.test.ts
import { describe, it, expect } from 'vitest'
import { buildNotes, convertQuantity, mapToRecipe } from '../services/recipeImport/mapToRecipe'
import type { ParsedRecipe } from '../services/recipeImport/types'
import type { IngredientDbEntry } from '../types/ingredients'

const db: IngredientDbEntry[] = [
  { id: 'flour', name: 'Múka', default_unit: 'g', category: 'Pantry' },
  { id: 'milk', name: 'Mlieko', default_unit: 'ml', category: 'Dairy' },
  { id: 'egg', name: 'Vajce', default_unit: 'pcs', category: 'Dairy' },
  { id: 'oil', name: 'Olej', default_unit: 'tbsp', category: 'Pantry' },
  { id: 'garlic', name: 'Cesnak', default_unit: 'cloves', category: 'Veg' },
  { id: 'carrot', name: 'Carrot', default_unit: 'g', category: 'Veg' },
  { id: 'tomato', name: 'Tomato', default_unit: 'g', category: 'Veg' },
]

function recipe(ingredients: ParsedRecipe['ingredients'], over: Partial<ParsedRecipe> = {}): ParsedRecipe {
  return { name: 'Test', servings: 4, ingredients, steps: ['Mix', 'Bake'], ...over }
}
const URL = 'https://www.example.com/recipes/test'

describe('mapToRecipe — name matching', () => {
  it('matches ignoring case and diacritics', () => {
    const { rows } = mapToRecipe(
      recipe([
        { name: 'muka', quantity: 100, unit: 'g' },
        { name: 'MLIEKO', quantity: 100, unit: 'ml' },
      ]),
      db,
      URL,
    )
    expect(rows.map((r) => r.ingredientId)).toEqual(['flour', 'milk'])
    expect(rows[0].ingredientName).toBe('Múka')
  })

  it('matches simple plurals', () => {
    const { rows } = mapToRecipe(
      recipe([
        { name: 'carrots', quantity: 100, unit: 'g' },
        { name: 'tomatoes', quantity: 200, unit: 'g' },
      ]),
      db,
      URL,
    )
    expect(rows.map((r) => r.ingredientId)).toEqual(['carrot', 'tomato'])
  })

  it('leaves an unmatched name unbound, keeps the parsed quantity, and flags it', () => {
    const { rows } = mapToRecipe(recipe([{ name: 'saffron', quantity: 2, unit: 'g' }]), db, URL)
    expect(rows[0]).toMatchObject({
      ingredientId: null,
      ingredientName: 'saffron',
      quantity: 2,
      unit: '',
      flagged: true,
      sourceText: '2 g saffron',
    })
  })
})

describe('mapToRecipe — quantities', () => {
  it('converts kg to g and l to ml', () => {
    const { rows } = mapToRecipe(
      recipe([
        { name: 'múka', quantity: 0.5, unit: 'kg' },
        { name: 'mlieko', quantity: 1.5, unit: 'l' },
      ]),
      db,
      URL,
    )
    expect(rows.map((r) => r.quantity)).toEqual([500, 1500])
    expect(rows.every((r) => !r.flagged)).toBe(true)
    expect(rows.map((r) => r.unit)).toEqual(['g', 'ml'])
  })

  it('converts cups, tsp and ml into the default unit when the dimension matches', () => {
    expect(convertQuantity(1, 'cup', 'ml')).toBe(240)
    expect(convertQuantity(3, 'tsp', 'tbsp')).toBe(1)
    expect(convertQuantity(30, 'ml', 'tbsp')).toBe(2)
    expect(convertQuantity(2, 'tbsp', 'tbsp')).toBe(2)
  })

  it('refuses impossible conversions: volume to mass, and unlike counts', () => {
    expect(convertQuantity(2, 'cup', 'g')).toBeNull()
    expect(convertQuantity(2, 'pcs', 'cloves')).toBeNull()
    expect(convertQuantity(2, 'g', 'pcs')).toBeNull()
  })

  it('treats a missing unit as pieces only when the default unit is pcs', () => {
    expect(convertQuantity(2, null, 'pcs')).toBe(2)
    expect(convertQuantity(2, null, 'g')).toBeNull()
  })

  it('flags a bound row whose conversion is impossible and sets its quantity to 0', () => {
    const { rows } = mapToRecipe(recipe([{ name: 'múka', quantity: 2, unit: 'cup' }]), db, URL)
    expect(rows[0]).toMatchObject({ ingredientId: 'flour', quantity: 0, unit: 'g', flagged: true })
    expect(rows[0].sourceText).toBe('2 cup múka')
  })

  it('flags null, zero and negative quantities instead of guessing', () => {
    const { rows } = mapToRecipe(
      recipe([
        { name: 'múka', quantity: null, unit: 'g' },
        { name: 'mlieko', quantity: 0, unit: 'ml' },
        { name: 'vajce', quantity: -1, unit: 'pcs' },
      ]),
      db,
      URL,
    )
    expect(rows.every((r) => r.flagged && r.quantity === 0)).toBe(true)
  })

  it('keeps a unit-less count for a pcs ingredient without flagging', () => {
    const { rows } = mapToRecipe(recipe([{ name: 'vajce', quantity: 2, unit: null }]), db, URL)
    expect(rows[0]).toMatchObject({ quantity: 2, unit: 'pcs', flagged: false })
  })
})

describe('mapToRecipe — servings, notes and host', () => {
  it('defaults servings to 2 when missing or below 1, and rounds otherwise', () => {
    expect(mapToRecipe(recipe([], { servings: null }), db, URL).servings).toBe(2)
    expect(mapToRecipe(recipe([], { servings: 0.5 }), db, URL).servings).toBe(2)
    expect(mapToRecipe(recipe([], { servings: 4 }), db, URL).servings).toBe(4)
    expect(mapToRecipe(recipe([], { servings: 3.6 }), db, URL).servings).toBe(4)
  })

  it('builds numbered steps plus a source link, and exposes the host', () => {
    const draft = mapToRecipe(recipe([]), db, URL)
    expect(draft.notes).toBe('1. Mix\n2. Bake\n\nZdroj: [example.com](https://www.example.com/recipes/test)')
    expect(draft.sourceHost).toBe('example.com')
  })

  it('writes only the source line when there are no steps, and nothing for a bad URL', () => {
    expect(buildNotes([], URL)).toBe('Zdroj: [example.com](https://www.example.com/recipes/test)')
    expect(buildNotes(['Mix'], 'not a url')).toBe('1. Mix')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/mapToRecipe.test.ts`
Expected: FAIL, cannot resolve `../services/recipeImport/mapToRecipe`.

- [ ] **Step 3: Implement**

```ts
// code/src/services/recipeImport/mapToRecipe.ts
import type { IngredientDbEntry } from '../../types/ingredients'
import type { ParsedIngredient, ParsedRecipe } from './types'

export interface DraftRow {
  ingredientId: string | null
  ingredientName: string
  quantity: number
  unit: string
  /** True when the user should check this row (unmatched name or unconvertible quantity). */
  flagged: boolean
  /** The original line from the page, shown as a hint in review. */
  sourceText: string
}

export interface RecipeDraft {
  name: string
  servings: number
  rows: DraftRow[]
  notes: string
  sourceHost: string
}

type Dimension = 'mass' | 'volume' | 'count'

const UNIT_INFO: Record<string, { dim: Dimension; factor: number }> = {
  g: { dim: 'mass', factor: 1 },
  kg: { dim: 'mass', factor: 1000 },
  ml: { dim: 'volume', factor: 1 },
  l: { dim: 'volume', factor: 1000 },
  tsp: { dim: 'volume', factor: 5 },
  tbsp: { dim: 'volume', factor: 15 },
  cup: { dim: 'volume', factor: 240 },
  pcs: { dim: 'count', factor: 1 },
  cloves: { dim: 'count', factor: 1 },
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Convert into the ingredient's default unit, or null when that is not possible. */
export function convertQuantity(quantity: number, from: string | null, to: string): number | null {
  if (from === null) return to === 'pcs' ? round2(quantity) : null
  if (from === to) return round2(quantity)
  const a = UNIT_INFO[from]
  const b = UNIT_INFO[to]
  // Counts (pcs, cloves) are never interchangeable with each other.
  if (!a || !b || a.dim !== b.dim || a.dim === 'count') return null
  return round2((quantity * a.factor) / b.factor)
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** The folded name plus simple plural-stripped variants ("carrots" → "carrot", "tomatoes" → "tomato"). */
function keysFor(name: string): string[] {
  const f = fold(name)
  const keys = [f]
  if (f.length > 3 && f.endsWith('es')) keys.push(f.slice(0, -2))
  if (f.length > 3 && f.endsWith('s')) keys.push(f.slice(0, -1))
  return keys
}

function buildIndex(db: IngredientDbEntry[]) {
  const exact = new Map<string, IngredientDbEntry>()
  const loose = new Map<string, IngredientDbEntry>()
  for (const entry of db) {
    const [first, ...rest] = keysFor(entry.name)
    if (!exact.has(first)) exact.set(first, entry)
    for (const key of rest) if (!loose.has(key)) loose.set(key, entry)
  }
  return {
    find(name: string): IngredientDbEntry | undefined {
      const keys = keysFor(name)
      return exact.get(keys[0]) ?? keys.map((k) => exact.get(k) ?? loose.get(k)).find((e) => e !== undefined)
    },
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function buildNotes(steps: string[], sourceUrl: string): string {
  const method = steps.map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')
  const host = hostOf(sourceUrl)
  const source = host ? `Zdroj: [${host}](${sourceUrl})` : ''
  return [method, source].filter(Boolean).join('\n\n')
}

function sourceTextOf(ing: ParsedIngredient): string {
  return [ing.quantity, ing.unit, ing.name].filter((part) => part !== null && part !== '').join(' ')
}

export function mapToRecipe(parsed: ParsedRecipe, db: IngredientDbEntry[], sourceUrl: string): RecipeDraft {
  const index = buildIndex(db)

  const rows: DraftRow[] = parsed.ingredients.map((ing) => {
    const sourceText = sourceTextOf(ing)
    const entry = index.find(ing.name)
    if (!entry) {
      return {
        ingredientId: null,
        ingredientName: ing.name.trim(),
        quantity: Math.max(0, ing.quantity ?? 0),
        unit: '',
        flagged: true,
        sourceText,
      }
    }
    const converted =
      ing.quantity !== null && ing.quantity > 0 ? convertQuantity(ing.quantity, ing.unit, entry.default_unit) : null
    return {
      ingredientId: entry.id,
      ingredientName: entry.name,
      quantity: converted ?? 0,
      unit: entry.default_unit,
      flagged: converted === null,
      sourceText,
    }
  })

  return {
    name: parsed.name.trim(),
    servings: parsed.servings !== null && parsed.servings >= 1 ? Math.round(parsed.servings) : 2,
    rows,
    notes: buildNotes(parsed.steps, sourceUrl),
    sourceHost: hostOf(sourceUrl),
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/__tests__/mapToRecipe.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx tsc -b && npm run lint`

```bash
cd /data
git add code/src/services/recipeImport/mapToRecipe.ts code/src/__tests__/mapToRecipe.test.ts
git commit -m "feat(import): map parsed recipes onto ingredients_db with unit conversion"
```

---

### Task 6: PHP endpoint and the page fetcher client

**Files:**
- Create: `code/public/api/fetch-recipe.php`
- Create: `code/public/api/src/FetchError.php`, `UrlGuard.php`, `PageFetcher.php`, `RecipeExtractor.php`
- Create: `code/public/api/src/.htaccess`
- Create: `code/phpunit.xml`, `code/api-tests/bootstrap.php`
- Modify: `.gitignore` (add `code/phpunit.phar`)
- Create: `code/api-tests/UrlGuardTest.php`, `PageFetcherTest.php`, `RecipeExtractorTest.php`
- Create: `code/src/services/recipeImport/fetchPage.ts`
- Modify: `code/vite.config.ts`, `code/package.json`
- Test: `code/src/__tests__/fetchPage.test.ts`

**Interfaces:**
- Produces (HTTP): `GET /api/fetch-recipe.php?url=<encoded>` returns `200 { source: 'jsonld' | 'text', text: string }`, or `4xx/5xx { error: 'bad_url' | 'blocked_host' | 'fetch_failed' | 'too_large' | 'no_content' }`.
- Produces (PHP, namespace `MealPlanner\Api`):
  - `FetchError(string $errorCode)` with `->errorCode` and `->httpStatus(): int`.
  - `UrlGuard::check(string $url, ?callable $resolver = null): array{scheme,host,port,ip}`, `UrlGuard::isPublicIp(string): bool`.
  - `PageFetcher::__construct(?callable $transport = null, ?callable $resolver = null)`, `->fetch(string $url): string` (UTF-8 HTML). A transport is `callable(string $url, array $target): array{status:int, headers:array<string,string>, body:string}` with lowercase header names.
  - `RecipeExtractor::extract(string $html): array{source:string,text:string}`, `RecipeExtractor::TEXT_LIMIT = 6000`.
- Produces (TS): `fetchPage(url, opts?: { signal?: AbortSignal; fetchImpl?: typeof fetch }): Promise<FetchedPage>`, `assertHttpUrl(url: string): void`.

**Prerequisite (manual, once).** This environment has no PHP. Install PHP 8.1+ with the curl, dom, mbstring and iconv extensions, for example on Debian/Ubuntu/WSL: `sudo apt-get install -y php-cli php-curl php-xml php-mbstring`. Verify with `php -v`. No Composer is needed. Without PHP the PHP steps below cannot run. The TypeScript half of this task (Steps 12–14) can still be done.

- [ ] **Step 1: Dev tooling (no Composer)**

```xml
<!-- code/phpunit.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<phpunit bootstrap="api-tests/bootstrap.php" colors="true" cacheDirectory=".phpunit.cache">
  <testsuites>
    <testsuite name="api">
      <directory>api-tests</directory>
    </testsuite>
  </testsuites>
</phpunit>
```

```php
<?php
// code/api-tests/bootstrap.php
// The endpoint has no autoloader (no Composer on the server), so tests load the files the same way it does.
declare(strict_types=1);

foreach (['FetchError', 'UrlGuard', 'PageFetcher', 'RecipeExtractor'] as $class) {
    require_once __DIR__ . '/../public/api/src/' . $class . '.php';
}
```

Add this line to `/data/.gitignore` under "PHP cache": `code/phpunit.phar`

Download PHPUnit 10 (it supports PHP 8.1; PHPUnit 11 needs 8.2), once:

```bash
cd /data/code
curl -Lo phpunit.phar https://phar.phpunit.de/phpunit-10.phar
php phpunit.phar --version
```

Expected: `PHPUnit 10.x.x by Sebastian Bergmann and contributors.`

- [ ] **Step 2: `FetchError`**

```php
<?php
// code/public/api/src/FetchError.php
declare(strict_types=1);

namespace MealPlanner\Api;

final class FetchError extends \RuntimeException
{
    private const STATUS = [
        'bad_url' => 400,
        'blocked_host' => 403,
        'fetch_failed' => 502,
        'too_large' => 413,
        'no_content' => 422,
    ];

    public function __construct(public readonly string $errorCode)
    {
        parent::__construct($errorCode);
    }

    public function httpStatus(): int
    {
        return self::STATUS[$this->errorCode] ?? 502;
    }
}
```

- [ ] **Step 3: Write the failing `UrlGuard` test**

```php
<?php
// code/api-tests/UrlGuardTest.php
declare(strict_types=1);

use MealPlanner\Api\FetchError;
use MealPlanner\Api\UrlGuard;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class UrlGuardTest extends TestCase
{
    public static function blockedUrls(): array
    {
        return [
            'loopback' => ['http://127.0.0.1/'],
            'private 10' => ['http://10.1.2.3/'],
            'private 192.168' => ['http://192.168.0.5/x'],
            'private 172.16' => ['http://172.16.0.1/'],
            'link-local metadata' => ['http://169.254.169.254/latest/meta-data'],
            'localhost name' => ['http://localhost/'],
            'localhost subdomain' => ['http://app.localhost/'],
            'zero address' => ['http://0.0.0.0/'],
            'ipv6 loopback' => ['http://[::1]/'],
            'ipv4-mapped loopback' => ['http://[::ffff:127.0.0.1]/'],
            'odd port' => ['http://8.8.8.8:22/'],
        ];
    }

    #[DataProvider('blockedUrls')]
    public function testBlocksPrivateAndOddTargets(string $url): void
    {
        try {
            UrlGuard::check($url);
            $this->fail('expected FetchError');
        } catch (FetchError $e) {
            $this->assertSame('blocked_host', $e->errorCode);
        }
    }

    public static function badUrls(): array
    {
        return [
            'ftp' => ['ftp://example.com/'],
            'file' => ['file:///etc/passwd'],
            'javascript' => ['javascript:alert(1)'],
            'not a url' => ['not a url'],
            'empty' => [''],
            'credentials' => ['http://user:pw@example.com/'],
        ];
    }

    #[DataProvider('badUrls')]
    public function testRejectsNonHttpOrMalformedUrls(string $url): void
    {
        try {
            UrlGuard::check($url);
            $this->fail('expected FetchError');
        } catch (FetchError $e) {
            $this->assertSame('bad_url', $e->errorCode);
        }
    }

    public function testAcceptsAPublicIpLiteral(): void
    {
        $target = UrlGuard::check('https://8.8.8.8/x');
        $this->assertSame(['scheme' => 'https', 'host' => '8.8.8.8', 'port' => 443, 'ip' => '8.8.8.8'], $target);
    }

    public function testBlocksAHostnameThatResolvesToAPrivateIp(): void
    {
        $this->expectException(FetchError::class);
        UrlGuard::check('http://evil.example/', fn (string $host): array => ['10.0.0.1']);
    }

    public function testBlocksWhenAnyResolvedIpIsPrivate(): void
    {
        $this->expectException(FetchError::class);
        UrlGuard::check('http://mixed.example/', fn (string $host): array => ['93.184.216.34', '127.0.0.1']);
    }

    public function testAcceptsAHostnameThatResolvesToAPublicIp(): void
    {
        $target = UrlGuard::check('http://good.example/', fn (string $host): array => ['93.184.216.34']);
        $this->assertSame('93.184.216.34', $target['ip']);
        $this->assertSame(80, $target['port']);
    }

    public function testFailsWhenTheHostDoesNotResolve(): void
    {
        try {
            UrlGuard::check('http://nowhere.example/', fn (string $host): array => []);
            $this->fail('expected FetchError');
        } catch (FetchError $e) {
            $this->assertSame('fetch_failed', $e->errorCode);
        }
    }
}
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd /data/code && php phpunit.phar api-tests/UrlGuardTest.php`
Expected: FAIL, class `MealPlanner\Api\UrlGuard` not found.

- [ ] **Step 5: Implement `UrlGuard`**

```php
<?php
// code/public/api/src/UrlGuard.php
declare(strict_types=1);

namespace MealPlanner\Api;

final class UrlGuard
{
    /**
     * Validate a URL and resolve its host to public IPs only.
     *
     * @param null|callable(string): list<string> $resolver host -> IPs (injectable for tests)
     * @return array{scheme: string, host: string, port: int, ip: string}
     */
    public static function check(string $url, ?callable $resolver = null): array
    {
        $parts = parse_url(trim($url));
        if ($parts === false || !isset($parts['scheme'], $parts['host'])) {
            throw new FetchError('bad_url');
        }

        $scheme = strtolower($parts['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            throw new FetchError('bad_url');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new FetchError('bad_url');
        }

        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);
        if ($port !== 80 && $port !== 443) {
            throw new FetchError('blocked_host');
        }

        $host = strtolower(trim($parts['host'], '[]'));
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost')) {
            throw new FetchError('blocked_host');
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) !== false
            ? [$host]
            : ($resolver ?? [self::class, 'resolve'])($host);
        if ($ips === []) {
            throw new FetchError('fetch_failed');
        }
        foreach ($ips as $ip) {
            if (!self::isPublicIp($ip)) {
                throw new FetchError('blocked_host');
            }
        }

        return ['scheme' => $scheme, 'host' => $host, 'port' => $port, 'ip' => $ips[0]];
    }

    public static function isPublicIp(string $ip): bool
    {
        // ::ffff:a.b.c.d is IPv4 in disguise: judge the embedded address. Hex forms are refused.
        if (stripos($ip, '::ffff:') === 0) {
            $v4 = substr($ip, 7);
            return filter_var($v4, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false && self::isPublicIp($v4);
        }

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }

    /** @return list<string> IPv4 first, then IPv6 */
    public static function resolve(string $host): array
    {
        $ips = gethostbynamel($host) ?: [];
        $records = @dns_get_record($host, DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $record) {
                if (isset($record['ipv6'])) {
                    $ips[] = $record['ipv6'];
                }
            }
        }

        return array_values($ips);
    }
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `cd /data/code && php phpunit.phar api-tests/UrlGuardTest.php`
Expected: OK (all data-provider cases pass).

- [ ] **Step 7: Write the failing `PageFetcher` test**

```php
<?php
// code/api-tests/PageFetcherTest.php
declare(strict_types=1);

use MealPlanner\Api\FetchError;
use MealPlanner\Api\PageFetcher;
use PHPUnit\Framework\TestCase;

final class PageFetcherTest extends TestCase
{
    private static function resolver(): callable
    {
        return fn (string $host): array => $host === 'internal.example' ? ['10.0.0.5'] : ['93.184.216.34'];
    }

    private static function html(string $body = '<html><body>hi</body></html>', string $type = 'text/html; charset=utf-8'): array
    {
        return ['status' => 200, 'headers' => ['content-type' => $type], 'body' => $body];
    }

    private function code(callable $fn): string
    {
        try {
            $fn();
        } catch (FetchError $e) {
            return $e->errorCode;
        }
        return 'none';
    }

    public function testReturnsTheBody(): void
    {
        $fetcher = new PageFetcher(fn (string $url, array $t): array => self::html(), self::resolver());
        $this->assertSame('<html><body>hi</body></html>', $fetcher->fetch('http://good.example/a'));
    }

    public function testConvertsLatin2ToUtf8(): void
    {
        $body = iconv('UTF-8', 'ISO-8859-2', '<html><body>Múka</body></html>');
        $fetcher = new PageFetcher(
            fn (string $url, array $t): array => self::html($body, 'text/html; charset=iso-8859-2'),
            self::resolver(),
        );
        $this->assertStringContainsString('Múka', $fetcher->fetch('http://good.example/'));
    }

    public function testFollowsAbsoluteAndRelativeRedirects(): void
    {
        $urls = [];
        $transport = function (string $url, array $t) use (&$urls): array {
            $urls[] = $url;
            return match (count($urls)) {
                1 => ['status' => 301, 'headers' => ['location' => 'https://good.example/b/c'], 'body' => ''],
                2 => ['status' => 302, 'headers' => ['location' => 'd'], 'body' => ''],
                default => self::html(),
            };
        };
        (new PageFetcher($transport, self::resolver()))->fetch('http://good.example/a');
        $this->assertSame(['http://good.example/a', 'https://good.example/b/c', 'https://good.example/b/d'], $urls);
    }

    public function testBlocksARedirectToAPrivateIpLiteral(): void
    {
        $calls = 0;
        $transport = function (string $url, array $t) use (&$calls): array {
            $calls++;
            return ['status' => 302, 'headers' => ['location' => 'http://127.0.0.1/admin'], 'body' => ''];
        };
        $code = $this->code(fn () => (new PageFetcher($transport, self::resolver()))->fetch('http://good.example/'));
        $this->assertSame('blocked_host', $code);
        $this->assertSame(1, $calls, 'the private target must never be requested');
    }

    public function testBlocksARedirectToAHostnameThatResolvesPrivate(): void
    {
        $transport = fn (string $url, array $t): array => [
            'status' => 302,
            'headers' => ['location' => 'http://internal.example/'],
            'body' => '',
        ];
        $code = $this->code(fn () => (new PageFetcher($transport, self::resolver()))->fetch('http://good.example/'));
        $this->assertSame('blocked_host', $code);
    }

    public function testGivesUpAfterThreeRedirects(): void
    {
        $calls = 0;
        $transport = function (string $url, array $t) use (&$calls): array {
            $calls++;
            return ['status' => 302, 'headers' => ['location' => 'http://good.example/next'], 'body' => ''];
        };
        $code = $this->code(fn () => (new PageFetcher($transport, self::resolver()))->fetch('http://good.example/'));
        $this->assertSame('fetch_failed', $code);
        $this->assertSame(4, $calls);
    }

    public function testRejectsNonHtmlAndHttpErrors(): void
    {
        $json = new PageFetcher(fn (string $u, array $t): array => self::html('{}', 'application/json'), self::resolver());
        $this->assertSame('fetch_failed', $this->code(fn () => $json->fetch('http://good.example/')));

        $notFound = new PageFetcher(
            fn (string $u, array $t): array => ['status' => 404, 'headers' => ['content-type' => 'text/html'], 'body' => 'x'],
            self::resolver(),
        );
        $this->assertSame('fetch_failed', $this->code(fn () => $notFound->fetch('http://good.example/')));
    }

    public function testRejectsAnOversizeBody(): void
    {
        $big = str_repeat('a', PageFetcher::MAX_BYTES + 1);
        $fetcher = new PageFetcher(fn (string $u, array $t): array => self::html($big), self::resolver());
        $this->assertSame('too_large', $this->code(fn () => $fetcher->fetch('http://good.example/')));
    }
}
```

- [ ] **Step 8: Run it to verify it fails**

Run: `cd /data/code && php phpunit.phar api-tests/PageFetcherTest.php`
Expected: FAIL, class `MealPlanner\Api\PageFetcher` not found.

- [ ] **Step 9: Implement `PageFetcher`**

```php
<?php
// code/public/api/src/PageFetcher.php
declare(strict_types=1);

namespace MealPlanner\Api;

final class PageFetcher
{
    public const MAX_BYTES = 2_097_152;
    public const MAX_REDIRECTS = 3;

    /** @var callable(string, array): array{status: int, headers: array<string, string>, body: string} */
    private $transport;
    /** @var null|callable(string): list<string> */
    private $resolver;

    /**
     * @param null|callable $transport (url, UrlGuard target) -> status/headers/body; defaults to curl
     * @param null|callable $resolver  host -> IPs; defaults to DNS
     */
    public function __construct(?callable $transport = null, ?callable $resolver = null)
    {
        $this->transport = $transport ?? [self::class, 'curlTransport'];
        $this->resolver = $resolver;
    }

    /** Fetch a page and return its HTML as UTF-8. Every hop, including redirects, goes through UrlGuard. */
    public function fetch(string $url): string
    {
        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            $target = UrlGuard::check($url, $this->resolver);
            $res = ($this->transport)($url, $target);

            if (in_array($res['status'], [301, 302, 303, 307, 308], true)) {
                $location = $res['headers']['location'] ?? '';
                if ($location === '') {
                    throw new FetchError('fetch_failed');
                }
                $url = self::resolveLocation($url, $location);
                continue;
            }

            if ($res['status'] < 200 || $res['status'] >= 300) {
                throw new FetchError('fetch_failed');
            }
            $type = strtolower($res['headers']['content-type'] ?? '');
            if (!str_contains($type, 'text/html') && !str_contains($type, 'application/xhtml')) {
                throw new FetchError('fetch_failed');
            }
            if (strlen($res['body']) > self::MAX_BYTES) {
                throw new FetchError('too_large');
            }

            return self::toUtf8($res['body'], $type);
        }

        throw new FetchError('fetch_failed'); // too many redirects
    }

    /** Default transport. Pins the connection to the IP UrlGuard validated (no DNS rebinding). */
    public static function curlTransport(string $url, array $target): array
    {
        $headers = [];
        $body = '';
        $tooLarge = false;
        $ip = str_contains($target['ip'], ':') ? '[' . $target['ip'] . ']' : $target['ip'];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_RESOLVE => [$target['host'] . ':' . $target['port'] . ':' . $ip],
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; MealPlannerImport/1.0)',
            CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml'],
            CURLOPT_HEADERFUNCTION => function ($c, string $line) use (&$headers): int {
                $pos = strpos($line, ':');
                if ($pos !== false) {
                    $headers[strtolower(trim(substr($line, 0, $pos)))] = trim(substr($line, $pos + 1));
                }
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => function ($c, string $chunk) use (&$body, &$tooLarge): int {
                $body .= $chunk;
                if (strlen($body) > self::MAX_BYTES) {
                    $tooLarge = true;
                    return 0; // abort the transfer
                }
                return strlen($chunk);
            },
        ]);
        $ok = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($tooLarge) {
            throw new FetchError('too_large');
        }
        if ($ok === false) {
            throw new FetchError('fetch_failed');
        }

        return ['status' => $status, 'headers' => $headers, 'body' => $body];
    }

    private static function resolveLocation(string $base, string $location): string
    {
        if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $location) === 1) {
            return $location; // absolute: UrlGuard will reject non-http schemes
        }
        $p = parse_url($base);
        $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
        if (str_starts_with($location, '//')) {
            return $p['scheme'] . ':' . $location;
        }
        if (str_starts_with($location, '/')) {
            return $origin . $location;
        }
        $dir = rtrim(dirname($p['path'] ?? '/'), '/');

        return $origin . $dir . '/' . $location;
    }

    private static function toUtf8(string $body, string $contentType): string
    {
        $charset = null;
        if (preg_match('/charset=([\w-]+)/i', $contentType, $m) === 1) {
            $charset = $m[1];
        } elseif (preg_match('/<meta[^>]+charset=["\']?([\w-]+)/i', substr($body, 0, 4096), $m) === 1) {
            $charset = $m[1];
        }

        try {
            if ($charset === null) {
                $charset = mb_detect_encoding($body, ['UTF-8', 'ISO-8859-2'], true) ?: 'UTF-8';
            }
            if (in_array(strtolower($charset), ['utf-8', 'utf8'], true)) {
                return $body;
            }
            $out = mb_convert_encoding($body, 'UTF-8', $charset);

            return is_string($out) ? $out : $body;
        } catch (\ValueError) {
            // mbstring does not know this charset name (for example windows-1250): try iconv
            $out = @iconv($charset ?? 'UTF-8', 'UTF-8//IGNORE', $body);

            return is_string($out) ? $out : $body;
        }
    }
}
```

- [ ] **Step 10: Run it to verify it passes**

Run: `cd /data/code && php phpunit.phar api-tests/PageFetcherTest.php`
Expected: OK.

- [ ] **Step 11: `RecipeExtractor` test, then implementation**

```php
<?php
// code/api-tests/RecipeExtractorTest.php
declare(strict_types=1);

use MealPlanner\Api\FetchError;
use MealPlanner\Api\RecipeExtractor;
use PHPUnit\Framework\TestCase;

final class RecipeExtractorTest extends TestCase
{
    private static function page(string $ldJson = '', string $body = '<p>x</p>'): string
    {
        $ld = $ldJson === '' ? '' : '<script type="application/ld+json">' . $ldJson . '</script>';
        return '<html><head>' . $ld . '</head><body>' . $body . '</body></html>';
    }

    private static function recipeOf(array $result): array
    {
        return json_decode($result['text'], true, 512, JSON_THROW_ON_ERROR);
    }

    public function testExtractsABareRecipeAndKeepsOnlyTheUsefulKeys(): void
    {
        $ld = '{"@context":"https://schema.org","@type":"Recipe","name":"Pancakes","recipeYield":"4",'
            . '"image":"x.jpg","description":"Long text","recipeIngredient":["200 g flour","2 eggs"],'
            . '"recipeInstructions":"Mix.<br>Fry."}';
        $result = RecipeExtractor::extract(self::page($ld));

        $this->assertSame('jsonld', $result['source']);
        $recipe = self::recipeOf($result);
        $this->assertSame('Pancakes', $recipe['name']);
        $this->assertSame(['200 g flour', '2 eggs'], $recipe['recipeIngredient']);
        $this->assertSame(['Mix.Fry.'], $recipe['recipeInstructions']);
        $this->assertArrayNotHasKey('image', $recipe);
        $this->assertArrayNotHasKey('description', $recipe);
    }

    public function testFindsARecipeInsideAGraph(): void
    {
        $ld = '{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Blog"},'
            . '{"@type":"Recipe","name":"Soup","recipeIngredient":["1 onion"]}]}';
        $recipe = self::recipeOf(RecipeExtractor::extract(self::page($ld)));
        $this->assertSame('Soup', $recipe['name']);
    }

    public function testAcceptsATypeArray(): void
    {
        $ld = '{"@type":["Recipe","NewsArticle"],"name":"Stew","recipeIngredient":["1 pot"]}';
        $this->assertSame('Stew', self::recipeOf(RecipeExtractor::extract(self::page($ld)))['name']);
    }

    public function testFlattensHowToStepsAndSectionsWithoutLeakingTypes(): void
    {
        $ld = '{"@type":"Recipe","name":"Bread","recipeInstructions":['
            . '{"@type":"HowToSection","name":"Dough","itemListElement":['
            . '{"@type":"HowToStep","text":"Knead."},{"@type":"HowToStep","text":"Rest."}]},'
            . '{"@type":"HowToStep","text":"Bake."}]}';
        $recipe = self::recipeOf(RecipeExtractor::extract(self::page($ld)));
        $this->assertSame(['Knead.', 'Rest.', 'Bake.'], $recipe['recipeInstructions']);
    }

    public function testKeepsUnicodeUnescaped(): void
    {
        $ld = '{"@type":"Recipe","name":"Múčnik","recipeIngredient":["200 g múky"]}';
        $this->assertStringContainsString('Múčnik', RecipeExtractor::extract(self::page($ld))['text']);
    }

    public function testFallsBackToTextWhenJsonLdIsBrokenOrHasNoRecipe(): void
    {
        $result = RecipeExtractor::extract(self::page('{not json', '<main>Real content here</main>'));
        $this->assertSame('text', $result['source']);
        $this->assertSame('Real content here', $result['text']);
    }

    public function testTextFallbackStripsNoiseCollapsesWhitespaceAndPrefersMain(): void
    {
        $html = '<html><body><nav>Menu Home</nav><header>Logo</header>'
            . '<main><h1>Soup</h1>   <p>Boil   water.</p><script>evil()</script></main>'
            . '<aside>Ads</aside><footer>Copyright</footer></body></html>';
        $result = RecipeExtractor::extract($html);
        $this->assertSame('text', $result['source']);
        $this->assertSame('Soup Boil water.', $result['text']);
    }

    public function testTextFallbackUsesTheBodyWhenThereIsNoMainOrArticle(): void
    {
        $result = RecipeExtractor::extract('<html><body><nav>Menu</nav><div>Boil water.</div></body></html>');
        $this->assertSame('Boil water.', $result['text']);
    }

    public function testTextFallbackIsCapped(): void
    {
        $result = RecipeExtractor::extract('<html><body><main>' . str_repeat('word ', 5000) . '</main></body></html>');
        $this->assertLessThanOrEqual(RecipeExtractor::TEXT_LIMIT, mb_strlen($result['text']));
    }

    public function testThrowsNoContentWhenNothingIsReadable(): void
    {
        try {
            RecipeExtractor::extract('<html><body><script>x()</script><nav>Menu</nav></body></html>');
            $this->fail('expected FetchError');
        } catch (FetchError $e) {
            $this->assertSame('no_content', $e->errorCode);
        }
    }
}
```

Run (expect FAIL, class not found): `cd /data/code && php phpunit.phar api-tests/RecipeExtractorTest.php`

```php
<?php
// code/public/api/src/RecipeExtractor.php
declare(strict_types=1);

namespace MealPlanner\Api;

final class RecipeExtractor
{
    public const TEXT_LIMIT = 6000;

    private const NOISE = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript', 'form', 'svg', 'iframe', 'button', 'template'];

    /**
     * Prefer the page's schema.org Recipe JSON-LD (compacted); otherwise return capped visible text.
     *
     * @return array{source: string, text: string}
     */
    public static function extract(string $html): array
    {
        $doc = self::load($html);

        $recipe = self::findJsonLdRecipe($doc);
        if ($recipe !== null) {
            return [
                'source' => 'jsonld',
                'text' => json_encode(self::compact($recipe), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ];
        }

        $text = self::visibleText($doc);
        if ($text === '') {
            throw new FetchError('no_content');
        }

        return ['source' => 'text', 'text' => $text];
    }

    private static function load(string $html): \DOMDocument
    {
        $doc = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return $doc;
    }

    private static function findJsonLdRecipe(\DOMDocument $doc): ?array
    {
        $nodes = (new \DOMXPath($doc))->query('//script[@type="application/ld+json"]');
        foreach ($nodes ?: [] as $node) {
            $data = json_decode(trim($node->textContent), true);
            if (!is_array($data)) {
                continue;
            }
            $found = self::searchRecipe($data);
            if ($found !== null) {
                return $found;
            }
        }

        return null;
    }

    private static function searchRecipe(array $node): ?array
    {
        $type = $node['@type'] ?? null;
        $types = is_array($type) ? $type : [$type];
        if (in_array('Recipe', $types, true)) {
            return $node;
        }
        foreach ($node as $child) {
            if (is_array($child)) {
                $found = self::searchRecipe($child);
                if ($found !== null) {
                    return $found;
                }
            }
        }

        return null;
    }

    private static function compact(array $recipe): array
    {
        $out = [];
        foreach (['name', 'recipeYield'] as $key) {
            if (isset($recipe[$key])) {
                $out[$key] = $recipe[$key];
            }
        }
        if (isset($recipe['recipeIngredient'])) {
            $out['recipeIngredient'] = array_values((array) $recipe['recipeIngredient']);
        }
        if (isset($recipe['recipeInstructions'])) {
            $steps = self::flattenInstructions($recipe['recipeInstructions']);
            $out['recipeInstructions'] = array_values(array_filter($steps, fn (string $s): bool => $s !== ''));
        }

        return $out;
    }

    /** @return list<string> */
    private static function flattenInstructions(mixed $node): array
    {
        if (is_string($node)) {
            return [trim(strip_tags($node))];
        }
        if (!is_array($node)) {
            return [];
        }
        if (isset($node['text']) && is_string($node['text'])) {
            return [trim(strip_tags($node['text']))];
        }
        if (isset($node['itemListElement'])) {
            return self::flattenInstructions($node['itemListElement']);
        }
        if (!array_is_list($node)) {
            return [];
        }
        $steps = [];
        foreach ($node as $item) {
            $steps = [...$steps, ...self::flattenInstructions($item)];
        }

        return $steps;
    }

    private static function visibleText(\DOMDocument $doc): string
    {
        $xpath = new \DOMXPath($doc);
        foreach (self::NOISE as $tag) {
            $elements = $xpath->query('//' . $tag);
            foreach ($elements ? iterator_to_array($elements) : [] as $element) {
                $element->parentNode?->removeChild($element);
            }
        }

        $root = $xpath->query('//main')->item(0)
            ?? $xpath->query('//article')->item(0)
            ?? $doc->getElementsByTagName('body')->item(0);
        if ($root === null) {
            return '';
        }

        $text = preg_replace('/\s+/u', ' ', $root->textContent) ?? '';

        return mb_substr(trim($text), 0, self::TEXT_LIMIT);
    }
}
```

Run: `cd /data/code && php phpunit.phar`
Expected: OK, the whole PHP suite passes.

- [ ] **Step 12: The front controller and server hardening**

```php
<?php
// code/public/api/fetch-recipe.php
declare(strict_types=1);

require_once __DIR__ . '/src/FetchError.php';
require_once __DIR__ . '/src/UrlGuard.php';
require_once __DIR__ . '/src/PageFetcher.php';
require_once __DIR__ . '/src/RecipeExtractor.php';

use MealPlanner\Api\FetchError;
use MealPlanner\Api\PageFetcher;
use MealPlanner\Api\RecipeExtractor;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'bad_url']);
    exit;
}

try {
    $html = (new PageFetcher())->fetch((string) ($_GET['url'] ?? ''));
    echo json_encode(
        RecipeExtractor::extract($html),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
    );
} catch (FetchError $e) {
    http_response_code($e->httpStatus());
    echo json_encode(['error' => $e->errorCode]);
} catch (\Throwable) {
    http_response_code(502);
    echo json_encode(['error' => 'fetch_failed']);
}
```

```apache
# code/public/api/src/.htaccess
# The classes here are loaded by fetch-recipe.php; they must not be reachable directly.
Require all denied
```

- [ ] **Step 13: Dev wiring**

In `code/package.json` add to `scripts`:

```json
    "api": "php -S localhost:8080 -t public",
    "test:php": "php phpunit.phar",
```

In `code/vite.config.ts` add a `server` block next to `build`:

```ts
  server: {
    // `npm run api` serves public/api/*.php locally
    proxy: { '/api': 'http://localhost:8080' },
  },
```

Smoke test (two terminals, from `/data/code`): run `npm run api`, then:

```bash
curl -s "http://localhost:8080/api/fetch-recipe.php?url=http://127.0.0.1/"
curl -s "http://localhost:8080/api/fetch-recipe.php?url=ftp://example.com/"
curl -s "http://localhost:8080/api/fetch-recipe.php?url=https://www.bbcgoodfood.com/recipes/easy-pancakes-recipe" | head -c 600
```

Expected: `{"error":"blocked_host"}`, then `{"error":"bad_url"}`, then JSON starting `{"source":"jsonld","text":"{\"name\":…` (the last needs internet access).

- [ ] **Step 14: Write the failing `fetchPage` test**

```ts
// code/src/__tests__/fetchPage.test.ts
import { describe, it, expect, vi } from 'vitest'
import { assertHttpUrl, fetchPage } from '../services/recipeImport/fetchPage'
import type { ImportError } from '../services/recipeImport/types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as ImportError).code
  }
  return 'none'
}

describe('assertHttpUrl', () => {
  it('accepts http and https', () => {
    expect(() => assertHttpUrl('https://a.test/x')).not.toThrow()
    expect(() => assertHttpUrl(' http://a.test ')).not.toThrow()
  })

  it.each(['', 'not a url', 'ftp://a.test', 'javascript:alert(1)'])('rejects %j as bad_url', (url) => {
    try {
      assertHttpUrl(url)
      throw new Error('expected a throw')
    } catch (e) {
      expect((e as ImportError).code).toBe('bad_url')
    }
  })
})

describe('fetchPage', () => {
  it('calls the endpoint with the encoded URL and returns the page', async () => {
    const page = { source: 'jsonld', text: '{"name":"X"}' }
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(page))
    expect(await fetchPage('https://a.test/r?x=1&y=2', { fetchImpl })).toEqual(page)
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/fetch-recipe.php?url=' + encodeURIComponent('https://a.test/r?x=1&y=2'))
  })

  it.each([
    [400, 'bad_url'],
    [403, 'blocked_host'],
    [413, 'too_large'],
    [422, 'no_content'],
    [502, 'fetch_failed'],
  ])('maps endpoint error %i to %s', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: code }, status))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl }))).toBe(code)
  })

  it('treats an unknown error body, or a non-JSON failure, as fetch_failed', async () => {
    const odd = vi.fn().mockResolvedValue(jsonResponse({ error: 'weird' }, 500))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl: odd }))).toBe('fetch_failed')
    const html = vi.fn().mockResolvedValue(new Response('<html>500</html>', { status: 500 }))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl: html }))).toBe('fetch_failed')
  })

  it('rejects a malformed success body as fetch_failed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ nope: true }))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl }))).toBe('fetch_failed')
  })

  it('never calls the endpoint for a bad URL', async () => {
    const fetchImpl = vi.fn()
    expect(await codeOf(fetchPage('nope', { fetchImpl }))).toBe('bad_url')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps a network failure to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await codeOf(fetchPage('https://a.test/', { fetchImpl }))).toBe('network')
  })
})
```

- [ ] **Step 15: Run it to verify it fails**

Run: `npx vitest run src/__tests__/fetchPage.test.ts`
Expected: FAIL, cannot resolve `../services/recipeImport/fetchPage`.

- [ ] **Step 16: Implement `fetchPage.ts`**

```ts
// code/src/services/recipeImport/fetchPage.ts
import { timedFetch } from './request'
import { ImportError, type FetchedPage, type ImportErrorCode } from './types'

const ENDPOINT = '/api/fetch-recipe.php'
const TIMEOUT_MS = 20_000
const SERVER_CODES: ImportErrorCode[] = ['bad_url', 'blocked_host', 'fetch_failed', 'too_large', 'no_content']

export function assertHttpUrl(url: string): void {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return
  } catch {
    // fall through
  }
  throw new ImportError('bad_url')
}

function isFetchedPage(body: unknown): body is FetchedPage {
  const b = body as Partial<FetchedPage> | null
  return !!b && (b.source === 'jsonld' || b.source === 'text') && typeof b.text === 'string'
}

function errorCodeFrom(body: unknown): ImportErrorCode {
  const code = (body as { error?: unknown } | null)?.error
  return SERVER_CODES.find((c) => c === code) ?? 'fetch_failed'
}

export async function fetchPage(
  url: string,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<FetchedPage> {
  assertHttpUrl(url)
  const res = await timedFetch(
    opts.fetchImpl ?? fetch,
    `${ENDPOINT}?url=${encodeURIComponent(url.trim())}`,
    {},
    TIMEOUT_MS,
    opts.signal,
  )

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) throw new ImportError(errorCodeFrom(body))
  if (!isFetchedPage(body)) throw new ImportError('fetch_failed')
  return body
}
```

- [ ] **Step 17: Run it to verify it passes, then the whole suite**

Run: `npx vitest run src/__tests__/fetchPage.test.ts && npx tsc -b && npm run lint`
Expected: PASS and no errors.

- [ ] **Step 18: Commit**

```bash
cd /data
git add .gitignore code/public/api code/api-tests code/phpunit.xml code/package.json code/vite.config.ts code/src/services/recipeImport/fetchPage.ts code/src/__tests__/fetchPage.test.ts
git commit -m "feat(import): add PHP fetch endpoint with SSRF guard and the fetchPage client"
```

(If PHP was unavailable and Steps 1–13 were skipped, commit only the TypeScript files and say so in the commit body: "PHP endpoint pending: no PHP in this environment".)

---

### Task 7: Review mode in the recipe modal

**Files:**
- Modify: `code/src/features/recipes/AddEditRecipeModal.tsx`
- Modify: `code/src/styles/tokens.css`
- Test: `code/src/__tests__/AddEditRecipeModalImport.test.tsx`

**Interfaces:**
- Consumes: `RecipeDraft`, `DraftRow` (Task 5).
- Produces: `AddEditRecipeModal` props become `{ mode: 'add' | 'edit' | 'import'; recipe?: Recipe; draft?: RecipeDraft; onClose: () => void }`. In `import` mode: title "Review imported recipe"; banner; footer buttons **Discard** and **Save recipe**; saving with unbound named rows asks "Save without N unmatched ingredient(s)?" with **Go back** and **Save anyway**.

- [ ] **Step 1: Write the failing test**

```tsx
// code/src/__tests__/AddEditRecipeModalImport.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { ingredientsDbService } from '../services/ingredientsDbService'
import { useStore } from '../store'
import type { RecipeDraft } from '../services/recipeImport/mapToRecipe'

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('AddEditRecipeModal — import review mode', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>
  let flourId: string
  const onClose = vi.fn()

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
    localStorage.clear()
    onClose.mockReset()
    useStore.setState({ recipes: [], tags: [] })
    flourId = ingredientsDbService.create('Flour', 'g', 'Pantry').id
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ''
  })

  function renderImport(d: RecipeDraft) {
    act(() => {
      root.render(<AddEditRecipeModal mode="import" draft={d} onClose={onClose} />)
    })
  }
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

  it('shows the banner, the title, and counts of unmatched and flagged rows', () => {
    renderImport(draft())
    const text = document.body.textContent ?? ''
    expect(text).toContain('Review imported recipe')
    expect(text).toContain('Imported from example.com')
    expect(text).toContain('1 ingredient needs matching')
    expect(text).toContain('From page: 2 g saffron')
  })

  it('writes nothing before Save, and Discard saves nothing', () => {
    renderImport(draft())
    expect(localStorage.getItem('slist_recipes')).toBeNull()
    act(() => button('Discard').click())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('slist_recipes')).toBeNull()
    expect(useStore.getState().recipes).toHaveLength(0)
  })

  it('asks before dropping unmatched ingredients, and Go back keeps everything unsaved', () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    expect(document.body.textContent).toContain('Save without 1 unmatched ingredient?')
    expect(localStorage.getItem('slist_recipes')).toBeNull()

    act(() => button('Go back').click())
    expect(document.body.textContent).not.toContain('Save without')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Save anyway saves the recipe with only the matched ingredient', () => {
    renderImport(draft())
    act(() => button('Save recipe').click())
    act(() => button('Save anyway').click())

    const saved = useStore.getState().recipes
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Pancakes')
    expect(saved[0].ingredients).toEqual([{ ingredientId: flourId, quantity: 200 }])
    expect(saved[0].notes).toContain('Zdroj: [example.com]')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('saves directly, with no confirmation, when every row is matched', () => {
    renderImport(draft({ rows: [draft().rows[0]] }))
    act(() => button('Save recipe').click())
    expect(document.body.textContent).not.toContain('Save without')
    expect(useStore.getState().recipes).toHaveLength(1)
  })

  it('editing a flagged quantity clears its flag', () => {
    renderImport(
      draft({
        rows: [{ ingredientId: flourId, ingredientName: 'Flour', quantity: 0, unit: 'g', flagged: true, sourceText: '2 cup flour' }],
      }),
    )
    expect(document.body.textContent).toContain('1 quantity to check')
    const qty = document.body.querySelector('input[aria-label="Quantity"]') as HTMLInputElement
    act(() => typeInto(qty, '250'))
    expect(document.body.textContent).not.toContain('quantity to check')
  })

  it('leaves normal add mode unchanged', () => {
    act(() => {
      root.render(<AddEditRecipeModal mode="add" onClose={onClose} />)
    })
    const text = document.body.textContent ?? ''
    expect(text).toContain('New Recipe')
    expect(text).not.toContain('Imported from')
    expect(button('Cancel')).toBeDefined()
    expect(button('Save')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/AddEditRecipeModalImport.test.tsx`
Expected: FAIL, the `import` mode and `draft` prop do not exist yet (TypeScript or assertion failures).

- [ ] **Step 3: Modify `AddEditRecipeModal.tsx`**

Make these edits, in order.

(a) Imports: add

```tsx
import type { RecipeDraft } from '../../services/recipeImport/mapToRecipe'
```

(b) `IngredientRow` and props:

```tsx
interface IngredientRow {
  rowId: string
  ingredientId: string | null
  ingredientName: string
  quantity: number
  unit: string
  /** Import review: quantity or match needs the user's attention. */
  flagged?: boolean
  /** Import review: the original line from the page. */
  sourceText?: string
}

interface AddEditRecipeModalProps {
  mode: 'add' | 'edit' | 'import'
  recipe?: Recipe
  draft?: RecipeDraft
  onClose: () => void
}
```

(c) Signature and initial state: change the signature to `({ mode, recipe, draft, onClose }: AddEditRecipeModalProps)`, then:

```tsx
  const isImport = mode === 'import'

  const [emoji, setEmoji] = useState(recipe?.emoji ?? '')
  const [name, setName] = useState(recipe?.name ?? draft?.name ?? '')
  const [servings, setServings] = useState(recipe?.servings ?? draft?.servings ?? 2)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(recipe?.tagIds ?? [])
  const [notes, setNotes] = useState(recipe?.notes ?? draft?.notes ?? '')
  const [confirmingDrop, setConfirmingDrop] = useState(false)
```

and at the start of the `rows` initializer, before the existing `if (!recipe || …)` check:

```tsx
    if (draft && draft.rows.length > 0) {
      return draft.rows.map((r) => ({ rowId: crypto.randomUUID(), ...r }))
    }
```

(d) Clear the flag when the user fixes a row. In `handleIngredientSelect` use `{ ...row, ingredientId: entry.id, ingredientName: entry.name, unit: entry.default_unit, flagged: false }`. In `handleQuantityChange` use `{ ...row, quantity: value, flagged: false }`.

(e) Derived counts, placed just before `handleSave`:

```tsx
  const unboundCount = rows.filter((r) => r.ingredientName.trim() !== '' && r.ingredientId === null).length
  const flaggedCount = rows.filter((r) => r.flagged && r.ingredientId !== null).length
```

(f) `handleSave`: change the signature and add the confirmation gate, and treat `import` like `add`:

```tsx
  function handleSave(force: boolean) {
    if (!name.trim()) return
    if (isImport && unboundCount > 0 && !force) {
      setConfirmingDrop(true)
      return
    }

    const validIngredients = rows
      .filter((r) => r.ingredientId !== null)
      .map((r) => ({ ingredientId: r.ingredientId!, quantity: r.quantity }))

    const data = {
      emoji: emoji.trim().slice(0, 2) || '🍽️',
      name: name.trim(),
      servings: Math.max(1, servings),
      tagIds: selectedTagIds,
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

(g) Title and footer:

```tsx
  const title = mode === 'edit' ? 'Edit Recipe' : mode === 'import' ? 'Review imported recipe' : 'New Recipe'

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

  const footer = confirmingDrop ? (
    <>
      <span style={{ flex: 1, alignSelf: 'center', fontSize: 12, color: 'var(--amber)' }}>
        Save without {unboundCount} unmatched {plural(unboundCount, 'ingredient', 'ingredients')}?
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

(h) Banner: first child inside the body `<div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>`:

```tsx
        {isImport && draft && (
          <div className="rf-import-banner" role="status">
            <strong>Imported from {draft.sourceHost || 'the web'}.</strong> Check everything, then save.
            {unboundCount > 0 && (
              <div>
                {unboundCount} {plural(unboundCount, 'ingredient needs', 'ingredients need')} matching.
              </div>
            )}
            {flaggedCount > 0 && (
              <div>
                {flaggedCount} {plural(flaggedCount, 'quantity', 'quantities')} to check.
              </div>
            )}
          </div>
        )}
```

(i) Rows: replace the row's opening `className` and the first-cell `div`:

```tsx
              const unlinked = row.ingredientName.trim() !== '' && row.ingredientId === null
              const flagged = row.flagged === true && row.ingredientId !== null
              return (
                <div
                  key={row.rowId}
                  className={`rf-ing-row${unlinked ? ' rf-unlinked' : ''}${flagged ? ' rf-flagged' : ''}`}
                >
                  <div style={{ minWidth: 0 }}>
                    <IngredientAutocomplete
                      value={row.ingredientName}
                      onChange={(v) => handleIngredientChange(idx, v)}
                      onSelect={(entry) => handleIngredientSelect(idx, entry)}
                      placeholder="Ingredient…"
                    />
                    {row.sourceText && (unlinked || flagged) && (
                      <div className="rf-ing-hint">From page: {row.sourceText}</div>
                    )}
                  </div>
```

(The rest of the row, quantity and remove button, is unchanged.)

- [ ] **Step 4: Add the CSS**

Insert in `code/src/styles/tokens.css` right after the `.rf-ing-row.rf-unlinked .field:focus` rule:

```css
/* Import review: a bound row whose quantity needs checking */
.rf-ing-row.rf-flagged .qty-unit input {
  background: var(--amber-pale);
  border-bottom: 2px solid var(--amber);
}

.rf-ing-hint {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-dim);
}

.rf-import-banner {
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--amber-pale);
  color: var(--text-mid);
  font-size: 13px;
  line-height: 1.5;
}
```

- [ ] **Step 5: Run the new test, then the whole suite**

Run: `npx vitest run src/__tests__/AddEditRecipeModalImport.test.tsx && npx tsc -b && npm run lint && npx vitest run`
Expected: all PASS. No existing test regresses: `add` and `edit` behave as before.

- [ ] **Step 6: Commit**

```bash
cd /data
git add code/src/features/recipes/AddEditRecipeModal.tsx code/src/styles/tokens.css code/src/__tests__/AddEditRecipeModalImport.test.tsx
git commit -m "feat(recipes): add import review mode with explicit save confirmation"
```

---

### Task 8: Import dialog, orchestrator and the Recipes button

**Files:**
- Create: `code/src/services/recipeImport/importRecipe.ts`
- Create: `code/src/features/recipes/ImportRecipeModal.tsx`
- Modify: `code/src/features/recipes/index.tsx`
- Modify: `code/src/styles/tokens.css`
- Test: `code/src/__tests__/importRecipe.test.ts`
- Test: `code/src/__tests__/ImportRecipeModal.test.tsx`

**Interfaces:**
- Consumes: `fetchPage`, `assertHttpUrl` (Task 6), `parseRecipeWithGemini` (Task 3), `mapToRecipe`, `RecipeDraft` (Task 5), `settingsService` (Task 2), `ingredientsDbService`, `ImportError`.
- Produces: `importRecipeFromUrl(url, opts?: { signal?; onStage?; deps? }): Promise<RecipeDraft>`, `type ImportStage = 'fetching' | 'reading'`, `ImportRecipeModal` props `{ onImported: (draft: RecipeDraft) => void; onClose: () => void }`.

- [ ] **Step 1: Write the failing orchestrator test**

```ts
// code/src/__tests__/importRecipe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importRecipeFromUrl } from '../services/recipeImport/importRecipe'
import { settingsService } from '../services/settingsService'
import { ingredientsDbService } from '../services/ingredientsDbService'
import { ImportError, type FetchedPage, type ParsedRecipe } from '../services/recipeImport/types'

const PAGE: FetchedPage = { source: 'jsonld', text: '{}' }
const PARSED: ParsedRecipe = {
  name: 'Pancakes',
  servings: 4,
  ingredients: [{ name: 'flour', quantity: 0.2, unit: 'kg' }],
  steps: ['Mix'],
}

describe('importRecipeFromUrl', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsService.setGeminiKey('k')
    ingredientsDbService.create('Flour', 'g', 'Pantry')
  })

  it('fetches, parses with the saved key, maps onto ingredients_db, and reports stages in order', async () => {
    const stages: string[] = []
    const fetchPage = vi.fn().mockResolvedValue(PAGE)
    const parseRecipe = vi.fn().mockResolvedValue(PARSED)

    const draft = await importRecipeFromUrl(' https://example.com/p ', {
      onStage: (s) => stages.push(s),
      deps: { fetchPage, parseRecipe },
    })

    expect(stages).toEqual(['fetching', 'reading'])
    expect(fetchPage).toHaveBeenCalledWith('https://example.com/p', { signal: undefined })
    expect(parseRecipe).toHaveBeenCalledWith(PAGE, 'k', { signal: undefined })
    expect(draft.name).toBe('Pancakes')
    expect(draft.rows[0]).toMatchObject({ ingredientName: 'Flour', quantity: 200, unit: 'g', flagged: false })
    expect(draft.sourceHost).toBe('example.com')
  })

  it('fails with no_key before touching the network when no key is saved', async () => {
    settingsService.clearGeminiKey()
    const fetchPage = vi.fn()
    await expect(importRecipeFromUrl('https://example.com/', { deps: { fetchPage } })).rejects.toMatchObject({
      code: 'no_key',
    })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('fails with bad_url before touching the network for a malformed address', async () => {
    const fetchPage = vi.fn()
    await expect(importRecipeFromUrl('nope', { deps: { fetchPage } })).rejects.toMatchObject({ code: 'bad_url' })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('propagates errors from the fetch and parse steps', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new ImportError('blocked_host'))
    await expect(importRecipeFromUrl('https://example.com/', { deps: { fetchPage } })).rejects.toMatchObject({
      code: 'blocked_host',
    })

    const ok = vi.fn().mockResolvedValue(PAGE)
    const parseRecipe = vi.fn().mockRejectedValue(new ImportError('rate_limited'))
    await expect(
      importRecipeFromUrl('https://example.com/', { deps: { fetchPage: ok, parseRecipe } }),
    ).rejects.toMatchObject({ code: 'rate_limited' })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/importRecipe.test.ts`
Expected: FAIL, cannot resolve `../services/recipeImport/importRecipe`.

- [ ] **Step 3: Implement the orchestrator**

```ts
// code/src/services/recipeImport/importRecipe.ts
import { ingredientsDbService } from '../ingredientsDbService'
import { settingsService } from '../settingsService'
import { assertHttpUrl, fetchPage } from './fetchPage'
import { parseRecipeWithGemini } from './geminiParse'
import { mapToRecipe, type RecipeDraft } from './mapToRecipe'
import { ImportError } from './types'

export type ImportStage = 'fetching' | 'reading'

interface ImportDeps {
  fetchPage: typeof fetchPage
  parseRecipe: typeof parseRecipeWithGemini
}

export async function importRecipeFromUrl(
  url: string,
  opts: { signal?: AbortSignal; onStage?: (stage: ImportStage) => void; deps?: Partial<ImportDeps> } = {},
): Promise<RecipeDraft> {
  const key = settingsService.getGeminiKey()
  if (!key) throw new ImportError('no_key')
  const clean = url.trim()
  assertHttpUrl(clean)

  opts.onStage?.('fetching')
  const page = await (opts.deps?.fetchPage ?? fetchPage)(clean, { signal: opts.signal })

  opts.onStage?.('reading')
  const parsed = await (opts.deps?.parseRecipe ?? parseRecipeWithGemini)(page, key, { signal: opts.signal })

  return mapToRecipe(parsed, ingredientsDbService.getAll(), clean)
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/__tests__/importRecipe.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing dialog test**

```tsx
// code/src/__tests__/ImportRecipeModal.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ImportRecipeModal } from '../features/recipes/ImportRecipeModal'
import { settingsService } from '../services/settingsService'
import { importRecipeFromUrl } from '../services/recipeImport/importRecipe'
import { ImportError } from '../services/recipeImport/types'
import type { RecipeDraft } from '../services/recipeImport/mapToRecipe'

vi.mock('../services/recipeImport/importRecipe', () => ({ importRecipeFromUrl: vi.fn() }))

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const DRAFT: RecipeDraft = { name: 'X', servings: 2, rows: [], notes: '', sourceHost: 'example.com' }

describe('ImportRecipeModal', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>
  const onImported = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    vi.mocked(importRecipeFromUrl).mockReset()
    onImported.mockReset()
    onClose.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ''
  })

  function renderModal() {
    act(() => {
      root.render(
        <MemoryRouter>
          <ImportRecipeModal onImported={onImported} onClose={onClose} />
        </MemoryRouter>,
      )
    })
  }
  const urlInput = () => document.body.querySelector('input[type="url"]') as HTMLInputElement
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

  it('without a key it points to Settings and keeps Import disabled', () => {
    renderModal()
    expect(document.body.querySelector('a[href="/settings"]')).not.toBeNull()
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    expect(button('Import').disabled).toBe(true)
  })

  it('with a key, Import is enabled only once a URL is typed', () => {
    settingsService.setGeminiKey('k')
    renderModal()
    expect(button('Import').disabled).toBe(true)
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    expect(button('Import').disabled).toBe(false)
  })

  it('hands the draft to onImported on success', async () => {
    settingsService.setGeminiKey('k')
    vi.mocked(importRecipeFromUrl).mockResolvedValue(DRAFT)
    renderModal()
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    await act(async () => button('Import').click())
    expect(importRecipeFromUrl).toHaveBeenCalledWith('https://example.com/p', expect.anything())
    expect(onImported).toHaveBeenCalledWith(DRAFT)
  })

  it('shows the error and re-enables Import on failure', async () => {
    settingsService.setGeminiKey('k')
    vi.mocked(importRecipeFromUrl).mockRejectedValue(new ImportError('no_recipe'))
    renderModal()
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    await act(async () => button('Import').click())
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("Couldn't find a recipe")
    expect(button('Import').disabled).toBe(false)
    expect(onImported).not.toHaveBeenCalled()
  })

  it('Cancel aborts the request and closes', async () => {
    settingsService.setGeminiKey('k')
    let signal: AbortSignal | undefined
    vi.mocked(importRecipeFromUrl).mockImplementation((_url, opts) => {
      signal = opts?.signal
      return new Promise<RecipeDraft>(() => {})
    })
    renderModal()
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    await act(async () => button('Import').click())
    await act(async () => button('Cancel').click())
    expect(signal?.aborted).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/__tests__/ImportRecipeModal.test.tsx`
Expected: FAIL, cannot resolve `../features/recipes/ImportRecipeModal`.

- [ ] **Step 7: Implement the dialog**

While the request is in flight the Import button shows the stage ("Fetching page…", "Reading recipe…"), so its label changes. The tests above click it before that, by its idle label.

```tsx
// code/src/features/recipes/ImportRecipeModal.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { settingsService } from '../../services/settingsService'
import { importRecipeFromUrl, type ImportStage } from '../../services/recipeImport/importRecipe'
import { ImportError } from '../../services/recipeImport/types'
import type { RecipeDraft } from '../../services/recipeImport/mapToRecipe'

interface Props {
  onImported: (draft: RecipeDraft) => void
  onClose: () => void
}

const STAGE_LABEL: Record<ImportStage, string> = {
  fetching: 'Fetching page…',
  reading: 'Reading recipe…',
}

export function ImportRecipeModal({ onImported, onClose }: Props) {
  const hasKey = settingsService.hasGeminiKey()
  const [url, setUrl] = useState('')
  const [stage, setStage] = useState<ImportStage | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const working = stage !== null
  const canImport = hasKey && url.trim() !== '' && !working

  // Cancel, Escape and the backdrop all abort any request in flight before closing
  function handleCancel() {
    abortRef.current?.abort()
    onClose()
  }
  // Unmounting for any other reason (route change) aborts too
  useEffect(() => () => abortRef.current?.abort(), [])

  async function handleImport() {
    if (!canImport) return
    const controller = new AbortController()
    abortRef.current = controller
    setError('')
    setStage('fetching')
    try {
      const draft = await importRecipeFromUrl(url, { signal: controller.signal, onStage: setStage })
      onImported(draft)
    } catch (err) {
      if (err instanceof ImportError && err.code === 'aborted') return
      setError(err instanceof ImportError ? err.message : 'Something went wrong. Try again.')
      setStage(null)
    }
  }

  const footer = (
    <>
      <Button intent="ghost" size="sm" type="button" onClick={handleCancel}>
        Cancel
      </Button>
      <Button intent="coral" size="sm" type="button" onClick={handleImport} disabled={!canImport}>
        {stage ? STAGE_LABEL[stage] : 'Import'}
      </Button>
    </>
  )

  return (
    <Modal isOpen onClose={handleCancel} title="Import from URL" footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!hasKey && (
          <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>
            Add your Gemini key in <Link to="/settings">Settings</Link> to import recipes.
          </p>
        )}
        <div>
          <label className="form-label" htmlFor="import-url">
            Recipe page address
          </label>
          <input
            id="import-url"
            type="url"
            className="field"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleImport()
            }}
            placeholder="https://…"
            disabled={working}
            autoFocus
          />
        </div>
        {error && (
          <p role="alert" style={{ fontSize: 13, color: 'var(--red)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run src/__tests__/ImportRecipeModal.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 9: Wire it into the Recipes page**

In `code/src/features/recipes/index.tsx`:

(a) Imports: change the lucide import to `import { ChevronLeft, Link2, Plus, Search } from 'lucide-react'`, and add:

```tsx
import { ImportRecipeModal } from './ImportRecipeModal'
import type { RecipeDraft } from '../../services/recipeImport/mapToRecipe'
```

(b) Extend `ModalState`:

```tsx
type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; recipe: Recipe }
  | { type: 'importUrl' }
  | { type: 'import'; draft: RecipeDraft }
```

(c) Replace the lone header button with a group:

```tsx
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            intent="secondary"
            size="sm"
            aria-label="Import recipe from URL"
            onClick={() => setModal({ type: 'importUrl' })}
          >
            <Link2 size={14} />
            <span className="hide-mobile">Import from URL</span>
          </Button>
          <Button
            intent="primary"
            size="sm"
            style={{ paddingInline: '1.25rem' }}
            onClick={() => setModal({ type: 'add' })}
          >
            <Plus size={14} />
            Add recipe
          </Button>
        </div>
```

(d) Render the two new modals next to the existing add and edit ones:

```tsx
      {modal.type === 'importUrl' && (
        <ImportRecipeModal
          onClose={() => setModal({ type: 'none' })}
          onImported={(draft) => setModal({ type: 'import', draft })}
        />
      )}
      {modal.type === 'import' && (
        <AddEditRecipeModal mode="import" draft={modal.draft} onClose={() => setModal({ type: 'none' })} />
      )}
```

(e) Append to `code/src/styles/tokens.css`:

```css
/* Text shown from tablet width up; icon-only below that to keep headers from overflowing */
.hide-mobile {
  display: none;
}

@media (min-width: 768px) {
  .hide-mobile {
    display: inline;
  }
}
```

- [ ] **Step 10: Typecheck, lint, full suite**

Run: `npx tsc -b && npm run lint && npx vitest run`
Expected: all green.

- [ ] **Step 11: Visual check**

With the `screenshot` skill (or by hand), open `/recipes` at 360 px and desktop width.

Expected: the header shows an icon-only Import button, Add recipe and the gear on mobile with no overflow. On desktop it shows "Import from URL" and "Add recipe".

- [ ] **Step 12: Commit**

```bash
cd /data
git add code/src/services/recipeImport/importRecipe.ts code/src/features/recipes/ImportRecipeModal.tsx code/src/features/recipes/index.tsx code/src/styles/tokens.css code/src/__tests__/importRecipe.test.ts code/src/__tests__/ImportRecipeModal.test.tsx
git commit -m "feat(recipes): add Import from URL dialog and wire it to the review form"
```

---

### Task 9: Docs

**Files:**
- Modify: `docs/FUNCTIONALITY.md`, `docs/DESIGN.md`, `docs/BACKEND-STACK.md`, `docs/ALPHA-DEPLOY.md`, `docs/FUTURE-FEATURES.md`, `AGENTS.md`

- [ ] **Step 1: `docs/FUNCTIONALITY.md`**

Read the file, then:

- In **Navigation** add after the Pages list: "**Settings** is not one of the five pages. On desktop it is a gear link pinned at the bottom of the sidebar; on mobile it is a gear icon at the right end of the page header."
- In **Recipes**, after the "Recipe Form (modal)" section, add:

```markdown
### Import from URL

An **Import from URL** button sits beside **Add recipe** in the Recipes header (icon only on mobile). The user pastes a recipe page address. A small PHP endpoint (`api/fetch-recipe.php`) fetches the page and returns the schema.org Recipe JSON-LD, or the page's visible text when there is none. The browser then asks Gemini, with the user's own key, to extract name, servings, ingredients and steps. Ingredient names are matched to `ingredients_db` locally, and quantities are converted into each ingredient's `default_unit` where the units are compatible (g/kg, ml/l, tsp/tbsp/cup, same-kind counts).

The result opens the recipe form in **review mode**: a banner "Imported from {host}. Check everything, then save." Nothing is saved until **Save recipe**. **Discard** (or closing) saves nothing. Rows whose name did not match an ingredient are amber and show the original line ("From page: 2 g saffron"). Rows whose quantity could not be converted are flagged. Saving with unmatched ingredients asks "Save without N unmatched ingredients?" instead of silently dropping them.

Needs a Gemini key (see Settings). Errors are shown in the dialog: no key, bad or blocked address, page unreachable or too large, no recipe found, Gemini rate limit or rejected key.
```

- Add a new numbered section at the end, matching the file's numbering:

```markdown
## Settings

Route `/settings`. Holds the **Gemini API key** used by Import from URL: a masked field with show/hide, **Save**, **Test key** (one minimal Gemini call) and **Clear**. The key is stored in `localStorage` (`slist_gemini_key`) and is sent only to Google, in the `x-goog-api-key` header. Help text recommends restricting the key by HTTP referrer and setting a low quota in Google AI Studio.
```

- [ ] **Step 2: `docs/DESIGN.md`**

Under §5 "Mobile navigation" add: "The Settings entry is not in the bottom bar. A gear (`.settings-gear`, 32 px, absolutely positioned top-right of `<main>`) sits at the right end of the page header on mobile; `.page-header` gets extra end padding below 768 px to keep actions clear of it. On the Settings page the gear is replaced by a back chevron (`.settings-back`)." Under §6 "Modals" add: "**Import review banner** (`.rf-import-banner`): amber-pale block at the top of the recipe form in import mode. Flagged ingredient rows use `.rf-flagged` (amber quantity field); unmatched rows reuse `.rf-unlinked`; `.rf-ing-hint` shows the original line from the page."

- [ ] **Step 3: `docs/BACKEND-STACK.md`**

Add a section:

```markdown
## Recipe import endpoint (first server code)

`code/public/api/fetch-recipe.php` is a standalone PHP file, not part of the Slim app. It ships inside `dist/` because it lives in `public/`. It needs PHP 8.1+ with curl, dom and mbstring, and uses plain `require_once` (no Composer anywhere in the project). It holds no state and no secrets: the Gemini key stays in the user's browser. Safety rules: http(s) on ports 80 and 443 only, private and loopback IPs refused and re-checked on every redirect (the connection is pinned to the validated IP), 10 s timeout, 2 MB cap. `phpunit.xml`, `api-tests/` and the downloaded `phpunit.phar` are dev-only and live outside `public/`, so they are never uploaded; fetch the phar as described in the implementation plan, then run `npm run test:php` in `code/`. Use `npm run api` plus `npm run dev` for local work.
```

- [ ] **Step 4: `docs/ALPHA-DEPLOY.md`**

Read it first, then add these to the tracker:

- A note: "`dist/api/` (from `code/public/api/`) is uploaded with the rest of `dist/` by the same manual FTP upload. The host needs PHP 8.1+ with curl, dom, mbstring and iconv, and outbound HTTPS from PHP (checked in the plan's Task 1). Without PHP the app works as before; only Import from URL fails with 'Couldn't reach that page'."
- A reminder that FTP clients often skip dotfiles: `dist/api/src/.htaccess` must be uploaded, and `dist/.htaccess` as before.
- A post-upload checklist row, to repeat after every rebuild and upload (the `.htpasswd` re-creation row already there belongs with it):
  1. Open `https://shopping.chillimuffin.com/api/fetch-recipe.php?url=ftp://x` (log in with the basic auth). Expected: `{"error":"bad_url"}`. This proves PHP runs and the endpoint arrived.
  2. Open `https://shopping.chillimuffin.com/api/src/UrlGuard.php`. Expected: 403. This proves the `src/.htaccess` arrived.
  3. Open `https://shopping.chillimuffin.com/api/fetch-recipe.php?url=https://example.com/`. Expected: `{"error":"no_content"}` or a `source` JSON. This proves outbound fetching works from the host.

- [ ] **Step 5: `docs/FUTURE-FEATURES.md`**

Remove the "Import recipe from URL" bullet (now built). Leave the rest of the file unchanged.

- [ ] **Step 6: `AGENTS.md`**

In the file tree add:

```
├── code/public/api/                 # PHP endpoint for Import from URL (fetch-recipe.php + src/)
├── code/api-tests/                  # PHPUnit tests for the endpoint (dev-only)
```

and under `docs/`:

```
    └── superpowers/                 # Specs and plans written with the superpowers workflow
```

- [ ] **Step 7: Commit**

```bash
cd /data
git add docs/FUNCTIONALITY.md docs/DESIGN.md docs/BACKEND-STACK.md docs/ALPHA-DEPLOY.md docs/FUTURE-FEATURES.md AGENTS.md
git commit -m "docs: document recipe import, Settings and the PHP endpoint"
```

---

### Task 10: Full verification and a real end-to-end run

**Files:** none.

- [ ] **Step 1: Everything automated**

Run from `/data/code`: `npx tsc -b && npm run lint && npx vitest run && npm run build`
Expected: all green. `dist/api/fetch-recipe.php` and `dist/api/src/*.php` exist, and `dist/api/src/.htaccess` exists (`ls -la dist/api dist/api/src`).

Then, if PHP is installed: `npm run test:php`
Expected: all PHPUnit tests pass. If PHP is not installed, say so in the final report; the endpoint is then untested.

- [ ] **Step 2: Real run, JSON-LD site**

Terminal 1: `npm run api`. Terminal 2: `npm run dev`. In the app: Settings, paste the real key, **Test key** shows "Key works." Recipes, **Import from URL**, paste a recipe from a site with JSON-LD (for example a BBC Good Food recipe).

Expected: the review form opens with the name, servings, ingredient rows, and numbered notes ending in a `Zdroj:` link; the banner shows the counts. Nothing is in the recipe list yet. Press Save recipe, confirm the recipe appears. Check the browser's Network tab: the Gemini request URL has no key, and carries `x-goog-api-key` as a header.

- [ ] **Step 3: Real run, no-JSON-LD and Slovak sites**

Repeat with a Slovak recipe site and with a page that has no JSON-LD.

Expected: either a reasonable draft, or the message "Couldn't find a recipe on that page". Note the token counts from the Gemini response (Network tab, `usageMetadata`) and compare them with the spike.

- [ ] **Step 4: Failure paths by hand**

Try: no key saved (dialog points to Settings), `http://localhost/`, `ftp://x`, a made-up domain, a wrong key (key rejected message), Cancel during the request, and Discard in review.

Expected: each shows the matching plain message and saves nothing.

- [ ] **Step 5: Finish**

Use `superpowers:finishing-a-development-branch` to decide on merge, PR or cleanup for `run/4-superpowers`. Do not push without Eva's say-so.
