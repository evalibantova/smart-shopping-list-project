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
  if (from === to) {
    const result = round2(quantity)
    return result > 0 ? result : null
  }
  const a = UNIT_INFO[from]
  const b = UNIT_INFO[to]
  // Counts (pcs, cloves) are never interchangeable with each other.
  if (!a || !b || a.dim !== b.dim || a.dim === 'count') return null
  const converted = round2((quantity * a.factor) / b.factor)
  // Treat a rounded result <= 0 as not convertible.
  return converted > 0 ? converted : null
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
