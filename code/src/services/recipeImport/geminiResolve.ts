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
// Names created from model output stay short, so one bad reply cannot put a paragraph into the database.
const MAX_NAME_LENGTH = 60

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
    `Recipe: ${JSON.stringify(recipeName)}. Resolve each ingredient line against the known ingredients (candidates).`,
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
      maxOutputTokens: 4096,
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
  if (!name || name.length > MAX_NAME_LENGTH || typeof unit !== 'string' || !(INGREDIENT_UNITS as readonly string[]).includes(unit)) return null
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
