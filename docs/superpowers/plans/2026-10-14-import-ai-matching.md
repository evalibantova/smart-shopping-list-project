# Import Phase 2 (model-assisted matching, new ingredients, estimates, tags) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Import from URL bind ingredients the way a person would (synonyms, word order, new ingredients, estimated amounts) and propose tags, while keeping every change visible in the review form until the user presses Save.

**Architecture:** Call 1 (the existing parse request) also returns each ingredient's original `line` and tag suggestions. A local pass (`mapToRecipe`, Phase 1 matcher) resolves what it can. Call 2 (new, small, only when rows remain unresolved) asks Gemini to pick among local candidates, propose a new ingredient, or estimate an amount. A pure `applyResolutions` merges the answer into the draft. The review form shows new ingredients, estimates, AI-picked rows and new tags, and creates them only on Save. Call 2 failing never fails the import.

**Tech Stack:** React 19, TypeScript, Vitest (jsdom), Zustand; Gemini `generateContent` called from the browser (existing client).

**Spec:** `docs/superpowers/specs/2026-10-14-import-ai-matching-design.md`

## Global Constraints

- No hardcoded synonym, ingredient or unit-translation lists anywhere; understanding comes from the Phase 1 word-set matcher and from the model.
- Nothing is created or saved before the user presses Save in review mode: new ingredients (`ingredientsDbService.create`) and new tags (`tagService.create` + store `addTag`) are created inside `handleSave` only. Discard and closing create nothing.
- Call 2 never blocks the import: any error except a user abort (`ImportError` code `aborted`) leaves the local draft in place. Call 1 keeps its current error behavior.
- The Gemini key goes only in the `x-goog-api-key` header; never in a URL, log line or error message. Database ids are never sent to Gemini: call 2 labels candidates with letters (A, B, ...) and the app maps letters back to ids.
- Stored ingredient units are only `g`, `ml`, `kg`, `l`, `pcs`, `cloves`, `tbsp`, `tsp`; categories are `Produce`, `Fish & Seafood`, `Meat`, `Dairy`, `Pantry & Dry Goods`, `Other` (unknown category becomes `Other`). Parse-side units (`IMPORT_UNITS`) additionally contain `cup`.
- New `DraftRow` / `RecipeDraft` / `ParsedIngredient` / `ParsedRecipe` fields are optional so existing code and tests keep compiling.
- New tags get the neutral colour `#9E9E9E`; at most 3 new tags are proposed per recipe.
- Commands run from `/data/code`. Tests: `npx vitest run <file>`. Types: `npx tsc -b`. Lint: `npm run lint` (5 pre-existing warnings are fine; no new ones). Baseline at plan start: 29 test files, 239 tests, all passing.
- Commit style: `feat(import): ...` / `fix(import): ...` / `docs: ...`. Never push. Never `git add -A`: the working tree has unrelated changes (`.claude/settings.local.json`, untracked `bugs/`). Add files by name.
- Skip screenshots and visual checks (the user asked to skip them). Do not edit `design-v1/` or `design-v2/`.
- Several test files set `IS_REACT_ACT_ENVIRONMENT = true` with a short comment to silence act() warnings; do the same in new component test files.

## File Structure

| File | Responsibility |
|---|---|
| `code/src/services/recipeImport/types.ts` (modify) | New shared types: units/categories, `NewIngredientProposal`, `ResolveItem`, `Resolution`; optional `line`, `tags`, `newTags` |
| `code/src/services/recipeImport/geminiParse.ts` (modify) | Export `callGemini`/`CallOptions`; call 1 gains `line`, tag names, `tags`/`newTags` |
| `code/src/services/recipeImport/geminiResolve.ts` (new) | Call 2: prompt, schema, validation, `resolveWithGemini` |
| `code/src/services/recipeImport/mapToRecipe.ts` (modify) | Tag mapping, `line` as source text, optional draft fields |
| `code/src/services/recipeImport/resolveRows.ts` (new) | Pure: `buildResolveItems`, `applyResolutions` |
| `code/src/services/recipeImport/importRecipe.ts` (modify) | Orchestrates call 1, local pass, optional call 2 |
| `code/src/features/recipes/ImportRecipeModal.tsx` (modify) | Stage label for call 2 |
| `code/src/features/recipes/AddEditRecipeModal.tsx` (modify) | Review form: new ingredients, estimates, AI hints, tags; create on Save |
| `docs/FUNCTIONALITY.md` (modify) | Document the behavior |

---

### Task 1: Types and call 2 (`geminiResolve.ts`)

**Files:**
- Modify: `code/src/services/recipeImport/types.ts` (append)
- Modify: `code/src/services/recipeImport/geminiParse.ts` (export two names)
- Create: `code/src/services/recipeImport/geminiResolve.ts`
- Test: `code/src/__tests__/geminiResolve.test.ts`

**Interfaces:**
- Produces (`types.ts`): `INGREDIENT_UNITS`, `type IngredientUnit`, `INGREDIENT_CATEGORIES`, `interface NewIngredientProposal { name: string; default_unit: IngredientUnit; category: string }`, `interface ResolveCandidate { id: string; name: string; default_unit: string }`, `interface ResolveItem { index: number; line: string; candidates: ResolveCandidate[]; locked: boolean }`, `interface Resolution { index: number; matchId: string | null; newIngredient: NewIngredientProposal | null; estimate: number | null }`.
- Produces (`geminiParse.ts`): `export interface CallOptions { signal?: AbortSignal; fetchImpl?: typeof fetch }` and `export async function callGemini(key: string, body: object, opts: CallOptions): Promise<unknown>` (unchanged behavior, now exported).
- Produces (`geminiResolve.ts`): `buildResolvePrompt(recipeName: string, items: ResolveItem[]): string`, `buildResolveRequest(prompt: string): object`, `toResolutions(raw: unknown, items: ResolveItem[]): Resolution[]`, `resolveWithGemini(recipeName: string, items: ResolveItem[], key: string, opts?: CallOptions): Promise<Resolution[]>`.

- [ ] **Step 1: Add the shared types**

Append to `code/src/services/recipeImport/types.ts` (after the `ImportError` class):

```ts
// Units a stored ingredient can use (the same set ingredientsDbService accepts) and the shopping-list categories.
export const INGREDIENT_UNITS = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp'] as const
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number]
export const INGREDIENT_CATEGORIES = [
  'Produce',
  'Fish & Seafood',
  'Meat',
  'Dairy',
  'Pantry & Dry Goods',
  'Other',
] as const

/** An ingredient the model proposes to add to the database. Created only when the user saves the recipe. */
export interface NewIngredientProposal {
  name: string
  default_unit: IngredientUnit
  category: string
}

/** A database ingredient offered to the model as a possible match. */
export interface ResolveCandidate {
  id: string
  name: string
  default_unit: string
}

/** One ingredient row the local pass could not finish. `locked` rows are already matched and only need an estimate. */
export interface ResolveItem {
  index: number
  line: string
  candidates: ResolveCandidate[]
  locked: boolean
}

export interface Resolution {
  index: number
  matchId: string | null
  newIngredient: NewIngredientProposal | null
  estimate: number | null
}
```

- [ ] **Step 2: Export `callGemini` and `CallOptions`**

In `code/src/services/recipeImport/geminiParse.ts` change `interface CallOptions {` to `export interface CallOptions {` and `async function callGemini(` to `export async function callGemini(`. Nothing else changes.

- [ ] **Step 3: Write the failing test**

```ts
// code/src/__tests__/geminiResolve.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  buildResolvePrompt,
  buildResolveRequest,
  resolveWithGemini,
  toResolutions,
} from '../services/recipeImport/geminiResolve'
import type { ImportError, ResolveItem } from '../services/recipeImport/types'

const KEY = 'secret-key-123'

const ITEMS: ResolveItem[] = [
  {
    index: 0,
    line: '1/3 čínskej kapusty',
    locked: false,
    candidates: [
      { id: 'id-kapusta', name: 'kapusta', default_unit: 'g' },
      { id: 'id-kysla', name: 'kapusta kyslá', default_unit: 'g' },
    ],
  },
  {
    index: 2,
    line: '100 g ryžových rezancov',
    locked: false,
    candidates: [{ id: 'id-nudle', name: 'nudle ryžové', default_unit: 'g' }],
  },
  {
    index: 3,
    line: 'morskú/himalájsku soľ',
    locked: true,
    candidates: [{ id: 'id-sol', name: 'soľ', default_unit: 'tsp' }],
  },
]

const NEW_CABBAGE = { name: 'čínska kapusta', default_unit: 'g', category: 'Produce' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
function geminiText(text: string): Response {
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] })
}
function geminiOk(payload: unknown): Response {
  return geminiText(JSON.stringify(payload))
}
async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as ImportError).code
  }
  return 'none'
}

describe('buildResolvePrompt', () => {
  const prompt = buildResolvePrompt('Ryžové rezance', ITEMS)

  it('names the recipe and lists each line with lettered candidates', () => {
    expect(prompt).toContain('Ryžové rezance')
    expect(prompt).toContain('1/3 čínskej kapusty')
    expect(prompt).toContain('"A kapusta (g)"')
    expect(prompt).toContain('"B kapusta kyslá (g)"')
    expect(prompt).toContain('"A nudle ryžové (g)"')
  })

  it('never sends database ids', () => {
    for (const id of ['id-kapusta', 'id-kysla', 'id-nudle', 'id-sol']) expect(prompt).not.toContain(id)
  })

  it('marks locked rows', () => {
    expect(prompt).toContain('"locked":true')
    expect(prompt).toContain('"locked":false')
  })
})

describe('buildResolveRequest', () => {
  it('asks for JSON with an array schema and no randomness', () => {
    const req = buildResolveRequest('p') as {
      generationConfig: { temperature: number; responseMimeType: string; responseSchema: { type: string } }
    }
    expect(req.generationConfig.temperature).toBe(0)
    expect(req.generationConfig.responseMimeType).toBe('application/json')
    expect(req.generationConfig.responseSchema.type).toBe('ARRAY')
  })
})

describe('toResolutions', () => {
  it('maps candidate letters back to ids and keeps valid proposals and estimates', () => {
    const out = toResolutions(
      [
        { i: 0, match: null, newIngredient: NEW_CABBAGE, estimate: 300 },
        { i: 2, match: 'A', newIngredient: null, estimate: null },
        { i: 3, match: null, newIngredient: NEW_CABBAGE, estimate: 0.5 },
      ],
      ITEMS,
    )
    expect(out).toEqual([
      { index: 0, matchId: null, newIngredient: NEW_CABBAGE, estimate: 300 },
      { index: 2, matchId: 'id-nudle', newIngredient: null, estimate: null },
      // locked row: forced to its own candidate, proposal dropped
      { index: 3, matchId: 'id-sol', newIngredient: null, estimate: 0.5 },
    ])
  })

  it('ignores letters that were not offered', () => {
    const out = toResolutions(
      [
        { i: 0, match: 'Z', newIngredient: null, estimate: null },
        { i: 2, match: 'C', newIngredient: null, estimate: null },
      ],
      ITEMS,
    )
    expect(out.map((r) => r.matchId)).toEqual([null, null])
  })

  it('drops a proposal with an invalid unit and corrects an unknown category', () => {
    const out = toResolutions(
      [
        { i: 0, match: null, newIngredient: { ...NEW_CABBAGE, default_unit: 'cup' }, estimate: null },
        { i: 2, match: null, newIngredient: { ...NEW_CABBAGE, category: 'Spices' }, estimate: null },
      ],
      ITEMS,
    )
    expect(out[0].newIngredient).toBeNull()
    expect(out[1].newIngredient).toEqual({ name: 'čínska kapusta', default_unit: 'g', category: 'Other' })
  })

  it('ignores bad estimates, unknown row numbers and duplicate rows; a non-array gives nothing', () => {
    const out = toResolutions(
      [
        { i: 0, match: null, newIngredient: null, estimate: -1 },
        { i: 0, match: null, newIngredient: NEW_CABBAGE, estimate: 5 },
        { i: 2, match: null, newIngredient: null, estimate: 'lots' },
        { i: 9, match: 'A', newIngredient: null, estimate: 1 },
        'junk',
      ],
      ITEMS,
    )
    expect(out).toEqual([
      { index: 0, matchId: null, newIngredient: null, estimate: null },
      { index: 2, matchId: null, newIngredient: null, estimate: null },
    ])
    expect(toResolutions({ nope: true }, ITEMS)).toEqual([])
  })
})

describe('resolveWithGemini', () => {
  it('makes no request when there is nothing to resolve', async () => {
    const fetchImpl = vi.fn()
    expect(await resolveWithGemini('R', [], KEY, { fetchImpl })).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('sends the key in the header only and returns validated resolutions', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk([{ i: 2, match: 'A', newIngredient: null, estimate: null }]))
    const out = await resolveWithGemini('R', ITEMS, KEY, { fetchImpl })
    expect(out).toEqual([{ index: 2, matchId: 'id-nudle', newIngredient: null, estimate: null }])
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain(KEY)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY)
  })

  it('retries once on a malformed reply, then gives up quietly', async () => {
    const bad = vi.fn().mockImplementation(async () => geminiText('not json'))
    expect(await resolveWithGemini('R', ITEMS, KEY, { fetchImpl: bad })).toEqual([])
    expect(bad).toHaveBeenCalledTimes(2)

    const recovers = vi
      .fn()
      .mockResolvedValueOnce(geminiText('not json'))
      .mockResolvedValueOnce(geminiOk([{ i: 2, match: 'A', newIngredient: null, estimate: null }]))
    expect(await resolveWithGemini('R', ITEMS, KEY, { fetchImpl: recovers })).toHaveLength(1)
  })

  it('lets HTTP errors surface as ImportError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'x' } }, 429))
    expect(await codeOf(resolveWithGemini('R', ITEMS, KEY, { fetchImpl }))).toBe('rate_limited')
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/__tests__/geminiResolve.test.ts`
Expected: FAIL, cannot resolve `../services/recipeImport/geminiResolve`.

- [ ] **Step 5: Implement `geminiResolve.ts`**

```ts
// code/src/services/recipeImport/geminiResolve.ts
import { callGemini, extractGeminiText, type CallOptions } from './geminiParse'
import {
  INGREDIENT_CATEGORIES,
  INGREDIENT_UNITS,
  type IngredientUnit,
  type NewIngredientProposal,
  type Resolution,
  type ResolveItem,
} from './types'

// Candidates are labelled with letters so the request stays small and never carries database ids.
const LETTERS = 'ABCDEFGH'

const RESOLVE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      i: { type: 'INTEGER' },
      match: { type: 'STRING', nullable: true },
      newIngredient: {
        type: 'OBJECT',
        nullable: true,
        properties: {
          name: { type: 'STRING' },
          default_unit: { type: 'STRING', enum: [...INGREDIENT_UNITS] },
          category: { type: 'STRING', enum: [...INGREDIENT_CATEGORIES] },
        },
        required: ['name', 'default_unit', 'category'],
      },
      estimate: { type: 'NUMBER', nullable: true },
    },
    required: ['i', 'match', 'newIngredient', 'estimate'],
  },
}

export function buildResolvePrompt(recipeName: string, items: ResolveItem[]): string {
  const lines = items.map((item) =>
    JSON.stringify({
      i: item.index,
      line: item.line,
      locked: item.locked,
      candidates: item.candidates.map((c, n) => `${LETTERS[n]} ${c.name} (${c.default_unit})`),
    }),
  )
  return [
    `Recipe: "${recipeName}". Resolve each ingredient line against the known ingredients (candidates).`,
    'For every item return i (copy the number), match, newIngredient and estimate.',
    '- match: the letter of the candidate that is the same ingredient, or null. Synonyms and a different word order count ("ryžové rezance" = "nudle ryžové"). A different variety is NOT a match ("čínska kapusta" is not "kapusta").',
    '- newIngredient: only when match is null, otherwise null: name in nominative singular in the recipe language; default_unit is the unit this ingredient is usually measured in (g, ml, kg, l, pcs, cloves, tbsp or tsp); category is one of Produce, Fish & Seafood, Meat, Dairy, Pantry & Dry Goods, Other.',
    "- estimate: only when the line's amount cannot be converted exactly into the default unit of the matched or new ingredient (for example 1/3 of a cabbage in g, salt to taste, a pinch): your best estimate as a number in that default unit; otherwise null.",
    '- locked true means the ingredient is already matched: use match "A", newIngredient null, and give only an estimate if needed.',
    'Items:',
    ...lines,
  ].join('\n')
}

export function buildResolveRequest(prompt: string): object {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: RESOLVE_SCHEMA,
    },
  }
}

function candidateId(item: ResolveItem, letter: unknown): string | null {
  if (typeof letter !== 'string') return null
  const l = letter.trim().toUpperCase()
  if (l.length !== 1) return null
  const n = LETTERS.indexOf(l)
  return n >= 0 && n < item.candidates.length ? item.candidates[n].id : null
}

function toNewIngredient(raw: unknown): NewIngredientProposal | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  const unit = r.default_unit
  if (!name || typeof unit !== 'string' || !(INGREDIENT_UNITS as readonly string[]).includes(unit)) return null
  const category =
    typeof r.category === 'string' && (INGREDIENT_CATEGORIES as readonly string[]).includes(r.category)
      ? r.category
      : 'Other'
  return { name, default_unit: unit as IngredientUnit, category }
}

/** Validate the model's reply: only offered letters, valid units, sane estimates; locked rows keep their own candidate. */
export function toResolutions(raw: unknown, items: ResolveItem[]): Resolution[] {
  if (!Array.isArray(raw)) return []
  const byIndex = new Map(items.map((item) => [item.index, item]))
  const seen = new Set<number>()
  const out: Resolution[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    const item = typeof e.i === 'number' ? byIndex.get(e.i) : undefined
    if (!item || seen.has(item.index)) continue
    seen.add(item.index)
    out.push({
      index: item.index,
      matchId: item.locked ? (item.candidates[0]?.id ?? null) : candidateId(item, e.match),
      newIngredient: item.locked ? null : toNewIngredient(e.newIngredient),
      estimate: typeof e.estimate === 'number' && Number.isFinite(e.estimate) && e.estimate > 0 ? e.estimate : null,
    })
  }
  return out
}

/** Call 2. HTTP and network errors surface as ImportError; a reply that stays malformed gives no resolutions. */
export async function resolveWithGemini(
  recipeName: string,
  items: ResolveItem[],
  key: string,
  opts: CallOptions = {},
): Promise<Resolution[]> {
  if (items.length === 0) return []
  const body = buildResolveRequest(buildResolvePrompt(recipeName, items))

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
    if (Array.isArray(raw)) return toResolutions(raw, items)
  }
  return []
}
```

- [ ] **Step 6: Run it to verify it passes, then types and lint**

Run: `npx vitest run src/__tests__/geminiResolve.test.ts && npx tsc -b && npm run lint`
Expected: PASS; no type errors; lint 0 errors.

- [ ] **Step 7: Commit**

```bash
cd /data
git add code/src/services/recipeImport/types.ts code/src/services/recipeImport/geminiParse.ts code/src/services/recipeImport/geminiResolve.ts code/src/__tests__/geminiResolve.test.ts
git commit -m "feat(import): add the resolve call for unmatched ingredients"
```

---

### Task 2: Tags and original lines in call 1, and tag mapping

**Files:**
- Modify: `code/src/services/recipeImport/types.ts` (optional fields)
- Modify: `code/src/services/recipeImport/geminiParse.ts`
- Modify: `code/src/services/recipeImport/mapToRecipe.ts`
- Test: `code/src/__tests__/geminiParse.test.ts` (extend), `code/src/__tests__/mapToRecipe.test.ts` (extend)

**Interfaces:**
- Consumes: `fold` from `ingredientMatch.ts`; `Tag` from `code/src/types/recipes.ts` (`{ id, name, color }`).
- Produces: `ParsedIngredient.line?: string`; `ParsedRecipe.tags?: string[]`, `ParsedRecipe.newTags?: string[]`; `buildPrompt(page, tagNames?: string[])`; `parseRecipeWithGemini(page, key, opts?: CallOptions & { tagNames?: string[] })`; `mapTags(parsed, tags)`; `mapToRecipe(parsed, db, sourceUrl, tags?: Tag[])`; `RecipeDraft.tagIds?: string[]`, `RecipeDraft.newTags?: string[]`. When an ingredient has a `line`, `DraftRow.sourceText` is that line.

- [ ] **Step 1: Write the failing tests**

Append to `code/src/__tests__/geminiParse.test.ts` (reuse the helpers already in that file: `geminiOk`, `GOOD`, `PAGE`, `KEY`; add `toParsedRecipe`/`buildPrompt`/`buildGeminiRequest`/`parseRecipeWithGemini` to its imports if missing):

```ts
describe('call 1: original lines and tags', () => {
  it('asks for the original ingredient line and only mentions tags when names are given', () => {
    const without = buildPrompt(PAGE)
    expect(without).toContain('exactly as written on the page')
    expect(without).not.toContain('newTags')

    const withTags = buildPrompt(PAGE, ['Polievka', 'bravčové'])
    expect(withTags).toContain('Polievka, bravčové')
    expect(withTags).toContain('newTags')
  })

  it('has line, tags and newTags in the response schema', () => {
    type Schema = {
      generationConfig: {
        responseSchema: {
          properties: {
            ingredients: { items: { properties: Record<string, unknown> } }
            tags: { type: string }
            newTags: { type: string }
          }
        }
      }
    }
    const schema = (buildGeminiRequest('p') as Schema).generationConfig.responseSchema
    expect(schema.properties.ingredients.items.properties.line).toBeDefined()
    expect(schema.properties.tags.type).toBe('ARRAY')
    expect(schema.properties.newTags.type).toBe('ARRAY')
  })

  it('keeps line, tags and newTags from the reply, trimmed and limited to strings', () => {
    const parsed = toParsedRecipe({
      name: 'X',
      servings: 2,
      ingredients: [
        { name: 'mrkva', quantity: 1, unit: 'pcs', line: ' 1 veľkú mrkvu ' },
        { name: 'soľ', quantity: null, unit: null },
      ],
      steps: ['Mix'],
      tags: [' Polievka ', '', 5, 'bravčové'],
      newTags: ['krevety'],
    })
    expect(parsed?.ingredients[0].line).toBe('1 veľkú mrkvu')
    expect(parsed?.ingredients[1].line).toBeUndefined()
    expect(parsed?.tags).toEqual(['Polievka', 'bravčové'])
    expect(parsed?.newTags).toEqual(['krevety'])
  })

  it('puts the tag names into the request when parsing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(GOOD))
    await parseRecipeWithGemini(PAGE, KEY, { fetchImpl, tagNames: ['Polievka', 'Dezert'] })
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
    expect(body.contents[0].parts[0].text).toContain('Polievka, Dezert')
  })
})
```

Append to `code/src/__tests__/mapToRecipe.test.ts` (reuse its `db`, `recipe()` and `URL` helpers; import `mapTags` and the `Tag` type if missing):

```ts
describe('mapToRecipe: tags and original lines', () => {
  const tags: Tag[] = [
    { id: 't-soup', name: 'Polievka', color: '#26A69A' },
    { id: 't-pork', name: 'bravčové', color: '#E57373' },
  ]

  it('maps tag names to existing ids ignoring case and accents, and lists unknown ones as new', () => {
    expect(mapTags({ tags: ['polievka', 'BRAVCOVE'], newTags: ['krevety'] }, tags)).toEqual({
      tagIds: ['t-soup', 't-pork'],
      newTags: ['krevety'],
    })
  })

  it('treats a "new" tag that already exists as the existing tag, and removes duplicates', () => {
    expect(mapTags({ tags: ['Polievka'], newTags: ['polievka', 'krevety', 'Krevety'] }, tags)).toEqual({
      tagIds: ['t-soup'],
      newTags: ['krevety'],
    })
  })

  it('proposes at most 3 new tags and tolerates missing lists', () => {
    expect(mapTags({ newTags: ['a1', 'b2', 'c3', 'd4'] }, tags).newTags).toEqual(['a1', 'b2', 'c3'])
    expect(mapTags({}, tags)).toEqual({ tagIds: [], newTags: [] })
  })

  it('puts the tags on the draft and uses the original line as the source text', () => {
    const draft = mapToRecipe(
      recipe([{ name: 'mrkva', quantity: 1, unit: 'pcs', line: '1 veľkú mrkvu' }], { tags: ['Polievka'], newTags: ['krevety'] }),
      db,
      URL,
      tags,
    )
    expect(draft.tagIds).toEqual(['t-soup'])
    expect(draft.newTags).toEqual(['krevety'])
    expect(draft.rows[0].sourceText).toBe('1 veľkú mrkvu')
  })

  it('keeps working without a tag list', () => {
    const draft = mapToRecipe(recipe([]), db, URL)
    expect(draft.tagIds).toEqual([])
    expect(draft.newTags).toEqual([])
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/__tests__/geminiParse.test.ts src/__tests__/mapToRecipe.test.ts`
Expected: the new tests FAIL (missing `line`, `tags`, `mapTags`); existing tests still pass.

- [ ] **Step 3: Extend the types**

In `types.ts` add `line?: string` to `ParsedIngredient` (`/** The ingredient line exactly as written on the page. */`), and `tags?: string[]` and `newTags?: string[]` to `ParsedRecipe`.

- [ ] **Step 4: Extend call 1 in `geminiParse.ts`**

1. In `RESPONSE_SCHEMA` add `line: { type: 'STRING' }` to the ingredient item `properties` and put `'line'` at the end of that item's `required` array; add to the top-level `properties`:
   ```ts
   tags: { type: 'ARRAY', items: { type: 'STRING' } },
   newTags: { type: 'ARRAY', items: { type: 'STRING' } },
   ```
   (leave the top-level `required` list unchanged).
2. Replace `buildPrompt` with this (every existing rule line is kept, in the same order; the `line` rule and the optional tag rules are new):
   ```ts
   export function buildPrompt(page: FetchedPage, tagNames: string[] = []): string {
     const kind = page.source === 'jsonld' ? 'schema.org Recipe JSON-LD' : 'page text'
     const tagRules =
       tagNames.length > 0
         ? [
             `- tags: up to 3 names copied exactly from this list that fit the recipe: ${tagNames.join(', ')}.`,
             '- newTags: up to 2 more short tags (a main ingredient or a dish type), only if none of the listed tags fits; otherwise an empty list.',
           ]
         : []
     return [
       `Extract the recipe from this ${kind}.`,
       'Rules:',
       "- Write the name, ingredient names and steps in the recipe's own language.",
       '- ingredient name: singular base form only, no quantity, no preparation notes.',
       '- unit: one of the allowed values. Size or adjective words after a number (large, small, big, spring, fresh; e.g. veľkú, väčších, jarnú) are NOT units.',
       '- Countable items (one carrot, 12 shrimp, "ks") use pcs; a garlic strúčik/clove is cloves; Slovak/Czech "lyžica" is tbsp, "lyžička" is tsp.',
       '- quantity: a number; write fractions as decimals (1/3 becomes 0.33, 1/2 becomes 0.5). null only when the line has no amount at all (salt to taste) or gives a range (2-3).',
       '- If the unit is something the allowed list cannot express (for example oz, lb, cups of a countable item), keep the number and set unit to null; do not drop the number.',
       '- steps: the method as short steps, in order.',
       '- servings: a number, or null if not stated.',
       "- line: each ingredient's line exactly as written on the page.",
       ...tagRules,
       '',
       page.text,
     ].join('\n')
   }
   ```
3. In `toParsedRecipe`: when pushing an ingredient add `...(typeof i.line === 'string' && i.line.trim() !== '' ? { line: i.line.trim() } : {})`; and compute
   ```ts
   const strings = (v: unknown): string[] =>
     Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()).slice(0, 5) : []
   ```
   returning `{ name: r.name.trim(), servings, ingredients, steps, ...(tags.length > 0 ? { tags } : {}), ...(newTags.length > 0 ? { newTags } : {}) }` where `const tags = strings(r.tags)` and `const newTags = strings(r.newTags)`. The keys are left out when empty so replies without tags still equal the plain `{ name, servings, ingredients, steps }` shape that the existing tests compare against.
4. `parseRecipeWithGemini(page, key, opts: CallOptions & { tagNames?: string[] } = {})` builds the body with `buildGeminiRequest(buildPrompt(page, opts.tagNames ?? []))` (the `opts` object is still passed to `callGemini` unchanged).

- [ ] **Step 5: Map tags and the original line in `mapToRecipe.ts`**

1. Imports: `import type { Tag } from '../../types/recipes'` and `import { fold, matchIngredient } from './ingredientMatch'`.
2. Add to `RecipeDraft`: `tagIds?: string[]` and `newTags?: string[]`.
3. Add and export:
   ```ts
   const MAX_NEW_TAGS = 3

   /** Existing tag names (ignoring case and accents) become ids; unknown names are proposed as new tags. */
   export function mapTags(
     parsed: Pick<ParsedRecipe, 'tags' | 'newTags'>,
     tags: Tag[],
   ): { tagIds: string[]; newTags: string[] } {
     const byFold = new Map(tags.map((t) => [fold(t.name), t.id]))
     const tagIds: string[] = []
     const newTags: string[] = []
     const seen = new Set<string>()
     for (const raw of [...(parsed.tags ?? []), ...(parsed.newTags ?? [])]) {
       const name = raw.trim()
       const key = fold(name)
       if (!key || seen.has(key)) continue
       seen.add(key)
       const id = byFold.get(key)
       if (id) tagIds.push(id)
       else if (newTags.length < MAX_NEW_TAGS) newTags.push(name)
     }
     return { tagIds, newTags }
   }
   ```
4. `sourceTextOf(ing)` returns `ing.line?.trim() || [ing.quantity, ing.unit, ing.name].filter(...).join(' ')` (keep the old expression as the fallback).
5. `mapToRecipe(parsed, db, sourceUrl, tags: Tag[] = [])`: the returned object also spreads `...mapTags(parsed, tags)`.

- [ ] **Step 6: Run the tests, types and lint**

Run: `npx vitest run src/__tests__/geminiParse.test.ts src/__tests__/mapToRecipe.test.ts && npx tsc -b && npm run lint`
Expected: PASS, including every earlier test in both files.

- [ ] **Step 7: Commit**

```bash
cd /data
git add code/src/services/recipeImport/types.ts code/src/services/recipeImport/geminiParse.ts code/src/services/recipeImport/mapToRecipe.ts code/src/__tests__/geminiParse.test.ts code/src/__tests__/mapToRecipe.test.ts
git commit -m "feat(import): suggest tags and keep the original ingredient lines"
```

---

### Task 3: Resolving rows (`resolveRows.ts`)

**Files:**
- Modify: `code/src/services/recipeImport/mapToRecipe.ts` (optional `DraftRow` fields)
- Create: `code/src/services/recipeImport/resolveRows.ts`
- Test: `code/src/__tests__/resolveRows.test.ts`

**Interfaces:**
- Consumes: `shortlist`, `matchIngredient` (`ingredientMatch.ts`); `convertQuantity`, `RecipeDraft`, `DraftRow`, `mapToRecipe` (`mapToRecipe.ts`); `ParsedRecipe`, `ResolveItem`, `Resolution`, `NewIngredientProposal` (`types.ts`).
- Produces: `DraftRow.matchedBy?: 'local' | 'ai'`, `DraftRow.estimated?: boolean`, `DraftRow.newIngredient?: NewIngredientProposal | null` (`mapToRecipe` now sets `matchedBy: 'local'` on matched rows, and `estimated: false`, `newIngredient: null` on every row); `buildResolveItems(draft, parsed, db): ResolveItem[]`; `applyResolutions(draft, parsed, resolutions, db): RecipeDraft`.

Rules: rows map 1:1 to `parsed.ingredients` by index. `buildResolveItems` returns an item for every row with a non-empty name and no ingredient (candidates = `shortlist(name, db, 5)`), and a locked item for every matched row that is flagged (its single candidate is its own ingredient). `applyResolutions`: for a locked row, an estimate sets quantity, `estimated: true`, `flagged: true`; for an unmatched row, a valid `matchId` (it must exist in `db`) binds the ingredient, otherwise a proposed new ingredient that the local matcher can already bind to an existing ingredient binds to it, otherwise the row becomes a new-ingredient row (`ingredientId: null`, `ingredientName` = proposed name, `unit` = proposed unit, `newIngredient` set); in both cases `matchedBy: 'ai'`, and quantity is the deterministic conversion of the parsed quantity and unit when possible (`flagged: false`), else the estimate (`estimated: true`, `flagged: true`), else 0 flagged. A row without a usable resolution is returned unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// code/src/__tests__/resolveRows.test.ts
import { describe, it, expect } from 'vitest'
import { mapToRecipe } from '../services/recipeImport/mapToRecipe'
import { applyResolutions, buildResolveItems } from '../services/recipeImport/resolveRows'
import type { ParsedRecipe, Resolution } from '../services/recipeImport/types'
import type { IngredientDbEntry } from '../types/ingredients'

const db: IngredientDbEntry[] = [
  { id: 'kapusta', name: 'kapusta', default_unit: 'g', category: 'Produce' },
  { id: 'kysla', name: 'kapusta kyslá', default_unit: 'g', category: 'Pantry & Dry Goods' },
  { id: 'nudle', name: 'nudle ryžové', default_unit: 'g', category: 'Pantry & Dry Goods' },
  { id: 'sol', name: 'soľ', default_unit: 'tsp', category: 'Pantry & Dry Goods' },
  { id: 'olej', name: 'olej', default_unit: 'ml', category: 'Pantry & Dry Goods' },
  { id: 'mrkva', name: 'mrkva', default_unit: 'pcs', category: 'Produce' },
]
const URL = 'https://example.com/r'

const parsed: ParsedRecipe = {
  name: 'Rezance',
  servings: 2,
  steps: ['Mix'],
  ingredients: [
    { name: 'čínska kapusta', quantity: 0.33, unit: null, line: '1/3 čínskej kapusty' }, // 0 unmatched
    { name: 'mrkva', quantity: 1, unit: 'pcs', line: '1 veľkú mrkvu' }, // 1 matched, converted
    { name: 'ryžové rezance', quantity: 100, unit: 'g', line: '100 g ryžových rezancov' }, // 2 unmatched
    { name: 'soľ', quantity: null, unit: null, line: 'morskú/himalájsku soľ' }, // 3 matched, no amount
    { name: 'olivový olej', quantity: 3, unit: 'tbsp', line: '3 lyžice olivového oleja' }, // 4 unmatched
    { name: '', quantity: 1, unit: 'pcs' }, // 5 would be dropped upstream; guard for empty names
  ],
}
const draft = () => mapToRecipe({ ...parsed, ingredients: parsed.ingredients.slice(0, 5) }, db, URL)
const NEW_CABBAGE = { name: 'čínska kapusta', default_unit: 'g' as const, category: 'Produce' }

describe('buildResolveItems', () => {
  it('asks about unmatched rows and flagged matched rows, with the original lines', () => {
    const items = buildResolveItems(draft(), parsed, db)
    expect(items.map((i) => i.index)).toEqual([0, 2, 3, 4])
    expect(items[0].line).toBe('1/3 čínskej kapusty')
    expect(items[0].locked).toBe(false)
    expect(items[0].candidates.map((c) => c.name)).toEqual(['kapusta', 'kapusta kyslá'])
  })

  it('locks a matched row that only needs an estimate, with its own ingredient as the single candidate', () => {
    const sol = buildResolveItems(draft(), parsed, db).find((i) => i.index === 3)!
    expect(sol.locked).toBe(true)
    expect(sol.candidates).toEqual([{ id: 'sol', name: 'soľ', default_unit: 'tsp' }])
  })

  it('leaves out rows that are matched and converted, and rows without a name', () => {
    const d = mapToRecipe(parsed, db, URL)
    const indexes = buildResolveItems(d, parsed, db).map((i) => i.index)
    expect(indexes).not.toContain(1)
    expect(indexes).not.toContain(5)
  })

  it('caps the candidates at 5', () => {
    const many: IngredientDbEntry[] = Array.from({ length: 9 }, (_, n) => ({
      id: `k${n}`,
      name: `kapusta ${n}`,
      default_unit: 'g',
      category: 'Produce',
    }))
    const d = mapToRecipe({ ...parsed, ingredients: [parsed.ingredients[0]] }, many, URL)
    expect(buildResolveItems(d, { ...parsed, ingredients: [parsed.ingredients[0]] }, many)[0].candidates).toHaveLength(5)
  })
})

describe('applyResolutions', () => {
  const res = (r: Partial<Resolution> & { index: number }): Resolution => ({
    matchId: null,
    newIngredient: null,
    estimate: null,
    ...r,
  })

  it('binds a valid model pick and converts the parsed quantity into its unit', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 2, matchId: 'nudle' })], db)
    expect(out.rows[2]).toMatchObject({
      ingredientId: 'nudle',
      ingredientName: 'nudle ryžové',
      quantity: 100,
      unit: 'g',
      flagged: false,
      matchedBy: 'ai',
    })
  })

  it('converts units into the picked ingredient (3 tbsp of an ml ingredient is 45)', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 4, matchId: 'olej' })], db)
    expect(out.rows[4]).toMatchObject({ ingredientId: 'olej', quantity: 45, unit: 'ml', flagged: false })
  })

  it('turns a proposed new ingredient into a new-ingredient row, using the estimate when conversion is impossible', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 0, newIngredient: NEW_CABBAGE, estimate: 300 })], db)
    expect(out.rows[0]).toMatchObject({
      ingredientId: null,
      ingredientName: 'čínska kapusta',
      unit: 'g',
      quantity: 300,
      estimated: true,
      flagged: true,
      matchedBy: 'ai',
      newIngredient: NEW_CABBAGE,
    })
  })

  it('binds a proposed new ingredient to an existing one when the local matcher already knows it', () => {
    const out = applyResolutions(
      draft(),
      parsed,
      [res({ index: 0, newIngredient: { name: 'Kapusta', default_unit: 'g', category: 'Produce' }, estimate: 400 })],
      db,
    )
    expect(out.rows[0].ingredientId).toBe('kapusta')
    expect(out.rows[0].newIngredient ?? null).toBeNull()
    expect(out.rows[0]).toMatchObject({ quantity: 400, estimated: true })
  })

  it('gives a locked row its estimate and keeps its binding', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 3, matchId: 'sol', estimate: 0.5 })], db)
    expect(out.rows[3]).toMatchObject({ ingredientId: 'sol', quantity: 0.5, estimated: true, flagged: true })
  })

  it('flags a row with no usable amount at quantity 0', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 2, matchId: 'nudle' })], db)
    const noAmount = applyResolutions(
      draft(),
      { ...parsed, ingredients: parsed.ingredients.map((i, n) => (n === 2 ? { ...i, quantity: null, unit: null } : i)) },
      [res({ index: 2, matchId: 'nudle' })],
      db,
    )
    expect(out.rows[2].quantity).toBe(100)
    expect(noAmount.rows[2]).toMatchObject({ quantity: 0, flagged: true, estimated: false })
  })

  it('leaves rows unchanged when there is no usable resolution', () => {
    const before = draft()
    const out = applyResolutions(
      before,
      parsed,
      [res({ index: 0 }), res({ index: 2, matchId: 'not-in-db' }), res({ index: 99, matchId: 'nudle' })],
      db,
    )
    expect(out.rows).toEqual(before.rows)
  })

  it('does not change the rows it was not asked about, or the rest of the draft', () => {
    const before = draft()
    const out = applyResolutions(before, parsed, [res({ index: 2, matchId: 'nudle' })], db)
    expect(out.rows[1]).toEqual(before.rows[1])
    expect(out.name).toBe(before.name)
    expect(out.notes).toBe(before.notes)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/resolveRows.test.ts`
Expected: FAIL, cannot resolve `../services/recipeImport/resolveRows`.

- [ ] **Step 3: Extend `DraftRow` and set the defaults in `mapToRecipe`**

In `mapToRecipe.ts` import `type NewIngredientProposal` from `./types`, add to `DraftRow`:

```ts
  /** Who bound the ingredient: the local matcher or the model. Unset for unmatched rows. */
  matchedBy?: 'local' | 'ai'
  /** True when the quantity is the model's estimate, not a conversion. */
  estimated?: boolean
  /** A proposed ingredient to create on Save; the row has no ingredientId until then. */
  newIngredient?: NewIngredientProposal | null
```

and replace the `rows` computation in `mapToRecipe` with this (the only differences are the new fields):

```ts
  const rows: DraftRow[] = parsed.ingredients.map((ing) => {
    const sourceText = sourceTextOf(ing)
    const entry = matchIngredient(ing.name, db)
    if (!entry) {
      return {
        ingredientId: null,
        ingredientName: ing.name.trim(),
        quantity: Math.max(0, ing.quantity ?? 0),
        unit: '',
        flagged: true,
        sourceText,
        estimated: false,
        newIngredient: null,
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
      matchedBy: 'local' as const,
      estimated: false,
      newIngredient: null,
    }
  })
```

- [ ] **Step 4: Implement `resolveRows.ts`**

```ts
// code/src/services/recipeImport/resolveRows.ts
import type { IngredientDbEntry } from '../../types/ingredients'
import { matchIngredient, shortlist } from './ingredientMatch'
import { convertQuantity, type DraftRow, type RecipeDraft } from './mapToRecipe'
import type { ParsedIngredient, ParsedRecipe, Resolution, ResolveCandidate, ResolveItem } from './types'

const MAX_CANDIDATES = 5

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function candidateOf(entry: IngredientDbEntry): ResolveCandidate {
  return { id: entry.id, name: entry.name, default_unit: entry.default_unit }
}

/** Rows the local pass could not finish: unmatched rows, and matched rows whose quantity needs an estimate. */
export function buildResolveItems(draft: RecipeDraft, parsed: ParsedRecipe, db: IngredientDbEntry[]): ResolveItem[] {
  const items: ResolveItem[] = []
  draft.rows.forEach((row, index) => {
    const line = parsed.ingredients[index]?.line ?? row.sourceText
    if (row.ingredientId === null) {
      if (row.ingredientName.trim() === '') return
      const candidates = shortlist(row.ingredientName, db, MAX_CANDIDATES).map(({ entry }) => candidateOf(entry))
      items.push({ index, line, locked: false, candidates })
    } else if (row.flagged) {
      const entry = db.find((e) => e.id === row.ingredientId)
      if (entry) items.push({ index, line, locked: true, candidates: [candidateOf(entry)] })
    }
  })
  return items
}

/** Deterministic conversion first, then the model's estimate, otherwise 0 flagged. */
function withQuantity(row: DraftRow, ing: ParsedIngredient, estimate: number | null): DraftRow {
  const converted = ing.quantity !== null && ing.quantity > 0 ? convertQuantity(ing.quantity, ing.unit, row.unit) : null
  if (converted !== null) return { ...row, quantity: converted, flagged: false, estimated: false }
  if (estimate !== null) return { ...row, quantity: round2(estimate), flagged: true, estimated: true }
  return { ...row, quantity: 0, flagged: true, estimated: false }
}

function resolveUnmatched(row: DraftRow, ing: ParsedIngredient, res: Resolution, db: IngredientDbEntry[]): DraftRow {
  const entry =
    (res.matchId ? db.find((e) => e.id === res.matchId) : undefined) ??
    (res.newIngredient ? matchIngredient(res.newIngredient.name, db) : undefined)
  if (entry) {
    return withQuantity(
      {
        ...row,
        ingredientId: entry.id,
        ingredientName: entry.name,
        unit: entry.default_unit,
        newIngredient: null,
        matchedBy: 'ai',
      },
      ing,
      res.estimate,
    )
  }
  if (res.newIngredient) {
    const n = res.newIngredient
    return withQuantity(
      { ...row, ingredientId: null, ingredientName: n.name, unit: n.default_unit, newIngredient: n, matchedBy: 'ai' },
      ing,
      res.estimate,
    )
  }
  return row
}

export function applyResolutions(
  draft: RecipeDraft,
  parsed: ParsedRecipe,
  resolutions: Resolution[],
  db: IngredientDbEntry[],
): RecipeDraft {
  const byIndex = new Map(resolutions.map((r) => [r.index, r]))
  const rows = draft.rows.map((row, index) => {
    const res = byIndex.get(index)
    const ing = parsed.ingredients[index]
    if (!res || !ing) return row
    if (row.ingredientId !== null) {
      return res.estimate !== null ? { ...row, quantity: round2(res.estimate), estimated: true, flagged: true } : row
    }
    return resolveUnmatched(row, ing, res, db)
  })
  return { ...draft, rows }
}
```

- [ ] **Step 5: Run the tests, types and lint**

Run: `npx vitest run src/__tests__/resolveRows.test.ts src/__tests__/mapToRecipe.test.ts && npx tsc -b && npm run lint`
Expected: PASS. If an earlier `mapToRecipe` test compares a whole row with `toEqual` and now fails only because of the new fields (`estimated`, `newIngredient`, `matchedBy`), update that assertion to `toMatchObject` and say so in the report.

- [ ] **Step 6: Commit**

```bash
cd /data
git add code/src/services/recipeImport/mapToRecipe.ts code/src/services/recipeImport/resolveRows.ts code/src/__tests__/resolveRows.test.ts code/src/__tests__/mapToRecipe.test.ts
git commit -m "feat(import): resolve unmatched rows with model picks, new ingredients and estimates"
```

---

### Task 4: Orchestrator (two calls) and the progress label

**Files:**
- Modify: `code/src/services/recipeImport/importRecipe.ts`
- Modify: `code/src/features/recipes/ImportRecipeModal.tsx` (stage label only)
- Test: `code/src/__tests__/importRecipe.test.ts` (extend and adjust)

**Interfaces:**
- Consumes: `parseRecipeWithGemini(page, key, { signal, tagNames })`, `resolveWithGemini`, `buildResolveItems`, `applyResolutions`, `mapToRecipe(parsed, db, url, tags)`, `tagService.getAll()` (`code/src/features/recipes/services/tagService.ts`).
- Produces: `type ImportStage = 'fetching' | 'reading' | 'matching'`; `ImportDeps` gains `resolve: typeof resolveWithGemini`. `importRecipeFromUrl` flow: fetch, parse with the tag names, local `mapToRecipe`, and only if `buildResolveItems` is non-empty: stage `'matching'`, call 2, `applyResolutions`. Any error from call 2 except `ImportError` code `aborted` returns the local draft.

- [ ] **Step 1: Adjust and extend the tests**

In `code/src/__tests__/importRecipe.test.ts`: the existing assertion `expect(parseRecipe).toHaveBeenCalledWith(PAGE, 'k', { signal: undefined })` becomes `{ signal: undefined, tagNames: [] }`. Add (import `tagService`, `ImportError`, `type ResolveItem`/`Resolution` as needed):

```ts
describe('importRecipeFromUrl: matching call', () => {
  const unmatched: ParsedRecipe = {
    name: 'Rezance',
    servings: 2,
    steps: ['Mix'],
    ingredients: [{ name: 'ryžové rezance', quantity: 100, unit: 'g', line: '100 g ryžových rezancov' }],
  }

  beforeEach(() => {
    ingredientsDbService.create('nudle ryžové', 'g', 'Pantry & Dry Goods')
  })

  it('asks the model about unresolved rows, in a matching stage, and applies its answer', async () => {
    const nudleId = ingredientsDbService.getAll().find((e) => e.name === 'nudle ryžové')!.id
    const stages: string[] = []
    const resolve = vi.fn().mockResolvedValue([{ index: 0, matchId: nudleId, newIngredient: null, estimate: null }])
    const draft = await importRecipeFromUrl('https://example.com/p', {
      onStage: (s) => stages.push(s),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
    })
    expect(stages).toEqual(['fetching', 'reading', 'matching'])
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve.mock.calls[0][0]).toBe('Rezance')
    expect(resolve.mock.calls[0][1]).toHaveLength(1)
    expect(draft.rows[0]).toMatchObject({ ingredientId: nudleId, quantity: 100, matchedBy: 'ai' })
  })

  it('makes no second call when every row is resolved locally', async () => {
    const resolve = vi.fn()
    await importRecipeFromUrl('https://example.com/p', {
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(PARSED), resolve },
    })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('keeps the local draft when the second call fails', async () => {
    const resolve = vi.fn().mockRejectedValue(new ImportError('rate_limited'))
    const draft = await importRecipeFromUrl('https://example.com/p', {
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
    })
    expect(draft.rows[0].ingredientId).toBeNull()
    expect(draft.rows[0].flagged).toBe(true)
  })

  it('stops when the user aborts during the second call', async () => {
    const resolve = vi.fn().mockRejectedValue(new ImportError('aborted'))
    await expect(
      importRecipeFromUrl('https://example.com/p', {
        deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('sends the existing tag names with the parse call and maps the suggested tags', async () => {
    const tag = tagService.create('Polievka', '#26A69A')
    const parseRecipe = vi.fn().mockResolvedValue({ ...PARSED, tags: ['polievka'], newTags: ['krevety'] })
    const draft = await importRecipeFromUrl('https://example.com/p', {
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe, resolve: vi.fn() },
    })
    expect(parseRecipe.mock.calls[0][2]).toMatchObject({ tagNames: ['Polievka'] })
    expect(draft.tagIds).toEqual([tag.id])
    expect(draft.newTags).toEqual(['krevety'])
  })
})
```

(`beforeEach` in the file already clears `localStorage`, sets the key and creates `Flour`; reuse the file's existing `PAGE` and `PARSED` fixtures. Import `tagService` from `../features/recipes/services/tagService`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/importRecipe.test.ts`
Expected: FAIL (no `resolve` dep, no `matching` stage, no tag names).

- [ ] **Step 3: Implement the orchestrator**

```ts
// code/src/services/recipeImport/importRecipe.ts
import { tagService } from '../../features/recipes/services/tagService'
import { ingredientsDbService } from '../ingredientsDbService'
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
  opts: { signal?: AbortSignal; onStage?: (stage: ImportStage) => void; deps?: Partial<ImportDeps> } = {},
): Promise<RecipeDraft> {
  const key = settingsService.getGeminiKey()
  if (!key) throw new ImportError('no_key')
  const clean = url.trim()
  assertHttpUrl(clean)

  opts.onStage?.('fetching')
  const page = await (opts.deps?.fetchPage ?? fetchPage)(clean, { signal: opts.signal })

  opts.onStage?.('reading')
  const tags = tagService.getAll()
  const parsed = await (opts.deps?.parseRecipe ?? parseRecipeWithGemini)(page, key, {
    signal: opts.signal,
    tagNames: tags.map((t) => t.name),
  })

  const db = ingredientsDbService.getAll()
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
    return draft
  }
}
```

In `ImportRecipeModal.tsx` add `matching: 'Matching ingredients…',` to `STAGE_LABEL`.

- [ ] **Step 4: Run the tests, types and lint, then the whole suite**

Run: `npx vitest run src/__tests__/importRecipe.test.ts src/__tests__/ImportRecipeModal.test.tsx && npx tsc -b && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /data
git add code/src/services/recipeImport/importRecipe.ts code/src/features/recipes/ImportRecipeModal.tsx code/src/__tests__/importRecipe.test.ts
git commit -m "feat(import): resolve unmatched rows in a second call and propose tags"
```

---

### Task 5: Review form: new ingredients, estimates, AI hints and tags

**Files:**
- Modify: `code/src/features/recipes/AddEditRecipeModal.tsx`
- Test: `code/src/__tests__/AddEditRecipeModalImportAi.test.tsx` (new)

**Interfaces:**
- Consumes: `RecipeDraft` / `DraftRow` (with `matchedBy`, `estimated`, `newIngredient`, `tagIds`, `newTags`), `NewIngredientProposal`, `fold` from `ingredientMatch.ts`, `ingredientsDbService.create(name, unit, category)`, `tagService.create(name, color)`, store `addTag`.
- Produces (behavior, import mode only):
  - Rows: a row with `newIngredient` set and no `ingredientId` is a "new ingredient row": it is not counted as unmatched; its unit shows the proposed unit; typing in its name field or picking another ingredient cancels the creation (`newIngredient: null`).
  - Hint line under the name: parts joined with ` · `, in this order: `New ingredient (<unit>)` when `newIngredient`; `Matched by AI` when `matchedBy === 'ai'` and bound; `≈ estimated` when `estimated`; `From page: <sourceText>` when `sourceText` and (the row is unmatched, flagged, or has any of the previous parts). The plain unmatched/flagged case therefore stays exactly `From page: <sourceText>`.
  - Quantity field is amber (`rf-flagged`) when the row is flagged or estimated and bound or new; editing the quantity clears `flagged` and `estimated`.
  - Banner adds `N new ingredient(s) will be created.` and `N quantity/quantities estimated.` (the existing unmatched and "to check" lines stay; "to check" counts flagged rows that are not estimated).
  - The save gate counts zero-quantity rows among bound AND new-ingredient rows; new ingredients never trigger the confirmation by themselves.
  - Tags: initial selection is `draft.tagIds`; `draft.newTags` appear as chips named `<name> (new)` (grey `#9E9E9E`) that the user removes by clicking.
  - Save (after the gate): creates each distinct new ingredient once (de-duplicated by `fold(name)`), binds the rows to the created ids, creates each remaining pending new tag with colour `#9E9E9E` through `tagService.create` and the store's `addTag`, then creates the recipe with `tagIds = selected + created`. Discard and closing create nothing.

- [ ] **Step 1: Write the failing test**

```tsx
// code/src/__tests__/AddEditRecipeModalImportAi.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { ingredientsDbService } from '../services/ingredientsDbService'
import { tagService } from '../features/recipes/services/tagService'
import { useStore } from '../store'
import type { DraftRow, RecipeDraft } from '../services/recipeImport/mapToRecipe'

// React testing needs this flag to run act() without warnings
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('AddEditRecipeModal: import review with AI proposals', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>
  let flourId: string
  let soupTagId: string
  const onClose = vi.fn()

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
    tagIds: [soupTagId],
    newTags: ['krevety'],
    ...over,
  })

  beforeEach(() => {
    localStorage.clear()
    onClose.mockReset()
    useStore.setState({ recipes: [], tags: [] })
    flourId = ingredientsDbService.create('Flour', 'g', 'Pantry & Dry Goods').id
    soupTagId = tagService.create('Polievka', '#26A69A').id
    useStore.setState({ tags: tagService.getAll() })
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

  function renderDraft(d: RecipeDraft) {
    act(() => {
      root.render(<AddEditRecipeModal mode="import" draft={d} onClose={onClose} />)
    })
  }
  const text = () => document.body.textContent ?? ''
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const dbNames = () => ingredientsDbService.getAll().map((e) => e.name)

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
    expect(dbNames()).toEqual(['Flour'])
    expect(tagService.getAll().map((t) => t.name)).toEqual(['Polievka'])
    expect(localStorage.getItem('slist_recipes')).toBeNull()
  })

  it('Save creates the new ingredient and the new tag, and binds the recipe to them', () => {
    renderDraft(draft())
    act(() => button('Save recipe').click())
    expect(text()).not.toContain('Save without')

    const created = ingredientsDbService.getAll().find((e) => e.name === 'čínska kapusta')!
    expect(created).toMatchObject({ default_unit: 'g', category: 'Produce' })
    const newTag = tagService.getAll().find((t) => t.name === 'krevety')!
    expect(newTag.color).toBe('#9E9E9E')

    const saved = useStore.getState().recipes[0]
    expect(saved.ingredients).toEqual([
      { ingredientId: created.id, quantity: 300 },
      { ingredientId: flourId, quantity: 100 },
    ])
    expect(saved.tagIds).toEqual([soupTagId, newTag.id])
    expect(useStore.getState().tags.map((t) => t.name)).toContain('krevety')
  })

  it('a deselected new tag is not created', () => {
    renderDraft(draft())
    // the chip's text may sit in a nested element: take the deepest match, the click bubbles to the chip
    const chip = Array.from(document.body.querySelectorAll('*'))
      .filter((el) => el.textContent?.trim() === 'krevety (new)')
      .pop() as HTMLElement
    act(() => chip.click())
    expect(text()).not.toContain('krevety (new)')
    act(() => button('Save recipe').click())
    expect(tagService.getAll().map((t) => t.name)).toEqual(['Polievka'])
  })

  it('creates a new ingredient once when two rows propose it', () => {
    renderDraft(draft({ rows: [cabbage, { ...cabbage, ingredientName: 'Čínska kapusta ' }] }))
    act(() => button('Save recipe').click())
    expect(dbNames().filter((n) => n.toLowerCase().startsWith('čínska'))).toHaveLength(1)
    const saved = useStore.getState().recipes[0]
    expect(saved.ingredients[0].ingredientId).toBe(saved.ingredients[1].ingredientId)
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
    expect(dbNames()).toEqual(['Flour'])
  })

  it('a new ingredient with quantity 0 asks before saving', () => {
    renderDraft(draft({ rows: [{ ...cabbage, quantity: 0, estimated: false }] }))
    act(() => button('Save recipe').click())
    expect(text()).toContain('Save 1 ingredient with quantity 0?')
    expect(dbNames()).toEqual(['Flour'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/AddEditRecipeModalImportAi.test.tsx`
Expected: FAIL (no new-ingredient rows, hints, tag chips or creation yet). The existing `AddEditRecipeModalImport.test.tsx` must still pass unchanged at every later step.

- [ ] **Step 3: Implement the form changes in `AddEditRecipeModal.tsx`**

Read the current file first; make these edits and keep everything else as it is.

1. Imports: `import type { NewIngredientProposal } from '../../services/recipeImport/types'` and `import { fold } from '../../services/recipeImport/ingredientMatch'`.
2. Add `const NEW_TAG_COLOR = '#9E9E9E'` next to `TAG_COLORS`.
3. `IngredientRow` gains `matchedBy?: 'local' | 'ai'`, `estimated?: boolean`, `newIngredient?: NewIngredientProposal | null` (the draft rows already spread into rows with `...r`).
4. State: `selectedTagIds` initial `recipe?.tagIds ?? draft?.tagIds ?? []`; add `const [pendingNewTags, setPendingNewTags] = useState<string[]>(draft?.newTags ?? [])`.
5. Handlers: `handleIngredientSelect` also sets `newIngredient: null, estimated: false`; `handleIngredientChange` also sets `newIngredient: null, estimated: false`; `handleQuantityChange` sets `flagged: false, estimated: false`.
6. Derived values (replace the existing four lines):
   ```ts
   const isNewRow = (r: IngredientRow) => r.ingredientId === null && !!r.newIngredient
   const unboundCount = rows.filter((r) => r.ingredientName.trim() !== '' && r.ingredientId === null && !r.newIngredient).length
   const newIngredientCount = rows.filter(isNewRow).length
   const estimatedCount = rows.filter((r) => r.estimated && (r.ingredientId !== null || isNewRow(r))).length
   const flaggedCount = rows.filter((r) => r.flagged && !r.estimated && (r.ingredientId !== null || isNewRow(r))).length
   const zeroQtyCount = rows.filter((r) => (r.ingredientId !== null || isNewRow(r)) && !(r.quantity > 0)).length
   const gateCount = unboundCount + zeroQtyCount
   ```
7. `handleSave(force)`: after the gate, before building `data`:
   ```ts
   const createdIdByName = new Map<string, string>()
   const savedRows = rows.map((r) => {
     if (r.ingredientId !== null || !r.newIngredient) return r
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
   ```
   then `validIngredients` is built from `savedRows` (not `rows`), and `tagIds: [...selectedTagIds, ...createdTagIds]`. These creations run only on this path, never for Discard or closing.
8. Banner (inside the existing `rf-import-banner`): after the existing two lines add
   ```tsx
   {newIngredientCount > 0 && (
     <div>{newIngredientCount} new {plural(newIngredientCount, 'ingredient', 'ingredients')} will be created.</div>
   )}
   {estimatedCount > 0 && (
     <div>{estimatedCount} {plural(estimatedCount, 'quantity', 'quantities')} estimated.</div>
   )}
   ```
9. Tag chips: in the "selected tags" area, after the `selectedTags.map(...)` chips (and also when there are no selected tags), render the pending new tags:
   ```tsx
   {pendingNewTags.map((tagName) => (
     <TagChip
       key={`new-${tagName}`}
       name={`${tagName} (new)`}
       color={NEW_TAG_COLOR}
       selected
       onClick={() => setPendingNewTags((prev) => prev.filter((n) => n !== tagName))}
     />
   ))}
   ```
   and change the empty-state test from `selectedTags.length === 0` to `selectedTags.length === 0 && pendingNewTags.length === 0`; include `pendingNewTags.length` in the "Tags (N)" count.
10. Rows: compute per row
    ```tsx
    const newRow = isNewRow(row)
    const unlinked = row.ingredientName.trim() !== '' && row.ingredientId === null && !newRow
    const flagged = (row.flagged === true || row.estimated === true) && (row.ingredientId !== null || newRow)
    const hintParts = [
      newRow ? `New ingredient (${row.newIngredient!.default_unit})` : null,
      row.matchedBy === 'ai' && row.ingredientId !== null ? 'Matched by AI' : null,
      row.estimated ? '≈ estimated' : null,
    ].filter((p): p is string => p !== null)
    if (row.sourceText && (unlinked || flagged || hintParts.length > 0)) hintParts.push(`From page: ${row.sourceText}`)
    ```
    render `{hintParts.length > 0 && <div className="rf-ing-hint">{hintParts.join(' · ')}</div>}` in place of the old hint, and keep the `rf-unlinked` / `rf-flagged` class logic using these `unlinked` / `flagged` values.

- [ ] **Step 4: Run the tests, types and lint, then the whole suite**

Run: `npx vitest run src/__tests__/AddEditRecipeModalImportAi.test.tsx src/__tests__/AddEditRecipeModalImport.test.tsx && npx tsc -b && npm run lint && npx vitest run`
Expected: PASS everywhere; the whole suite stays green.

- [ ] **Step 5: Commit**

```bash
cd /data
git add code/src/features/recipes/AddEditRecipeModal.tsx code/src/__tests__/AddEditRecipeModalImportAi.test.tsx
git commit -m "feat(recipes): review new ingredients, estimates and tags before saving an import"
```

---

### Task 6: Docs

**Files:**
- Modify: `docs/FUNCTIONALITY.md`

- [ ] **Step 1: Update the "Import from URL" section**

Read `docs/FUNCTIONALITY.md` (it uses CRLF line endings: preserve them and check `git diff --stat` stays proportionate). In the "Import from URL" section add a paragraph (adapt wording to the section's style):

> **How ingredients are matched.** After the page is parsed, the app first matches ingredient names locally (word sets, any order, accents and small endings ignored; a partial overlap never binds). For rows it could not finish, a second small request asks Gemini to pick among local candidates (synonyms count), propose a new ingredient with a unit and category, or estimate an amount that cannot be converted exactly (for example 1/3 of a cabbage in grams). If that second request fails, the locally matched draft is used.
>
> **In the review form:** rows picked by the model say "Matched by AI"; proposed new ingredients show "New ingredient (unit)" and are created only when you press Save; estimated amounts are amber and say "≈ estimated" (editing clears the flag); suggested tags are preselected, and new tags appear marked "(new)" and can be removed by clicking them. Discard creates nothing.

- [ ] **Step 2: Commit**

```bash
cd /data
git add docs/FUNCTIONALITY.md
git commit -m "docs: describe model-assisted matching, new ingredients, estimates and tags"
```

---

## Acceptance (after deploy, done by the user)

Re-import `https://fitshaker.sk/zdrava-vecera-len-za-20-minut-ryzove-rezance-s-krevetami-a-zeleninou` and check each line (expected results in brackets): 1 veľkú mrkvu (1 pcs mrkva), 1 jarnú cibuľku (1 pcs cibuľa jarná), 4 strúčiky cesnaku (4 cloves cesnak), 1/3 čínskej kapusty (new ingredient "čínska kapusta", about 300 g, marked estimated), 3 lyžice olivového oleja (olej olivový, 45 ml), 1 lyžicu sójovej omáčky (omáčka sójová, 15 ml), 1 lyžičku kari korenia (new or matched, 1 tsp), 1 lyžičku mletého čili (1 tsp), 100 g ryžových rezancov (nudle ryžové, 100 g), morskú/himalájsku soľ (soľ, small estimated amount), 12 ks väčších kreviet (12 pcs krevety, new ingredient). Also check that suggested tags look right, that Discard leaves the ingredient list and tags untouched, and that a quick second import of the same page does not create duplicates. If the model's reply is cut off or rejected, the draft falls back to the local result; tell the assistant what you saw so the response schema or token limit can be adjusted.
