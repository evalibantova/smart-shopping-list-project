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
    '- unit: one of the allowed values. Size or adjective words after a number (large, small, big, spring, fresh; e.g. veľkú, väčších, jarnú) are NOT units.',
    '- Countable items (one carrot, 12 shrimp, "ks") use pcs; a garlic strúčik/clove is cloves; Slovak/Czech "lyžica" is tbsp, "lyžička" is tsp.',
    '- quantity: a number; write fractions as decimals (1/3 becomes 0.33, 1/2 becomes 0.5). null only when the line has no amount at all (salt to taste) or gives a range (2-3).',
    '- If the unit is something the allowed list cannot express (for example oz, lb, cups of a countable item), keep the number and set unit to null; do not drop the number.',
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
  if (res.status === 404) throw new ImportError('model_unavailable')
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
