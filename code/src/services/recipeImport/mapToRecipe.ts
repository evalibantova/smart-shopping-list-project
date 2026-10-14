import type { IngredientDbEntry } from '../../types/ingredients'
import type { Tag } from '../../types/recipes'
import { fold, matchIngredient } from './ingredientMatch'
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
  tagIds?: string[]
  newTags?: string[]
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
  let result: number | null = null

  if (from === null) {
    // Unit-less quantities can only be pcs
    result = to === 'pcs' ? round2(quantity) : null
  } else if (from === to) {
    // Same unit: just round
    result = round2(quantity)
  } else {
    // Cross-unit conversion: check compatibility
    const a = UNIT_INFO[from]
    const b = UNIT_INFO[to]
    // Counts (pcs, cloves) are never interchangeable with each other.
    if (!a || !b || a.dim !== b.dim || a.dim === 'count') return null
    result = round2((quantity * a.factor) / b.factor)
  }

  // Treat a rounded result <= 0 as not convertible.
  return result !== null && result > 0 ? result : null
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** The link target: the parsed (already percent-encoded) href, with parentheses encoded so they cannot end the link. */
function linkTarget(sourceUrl: string): string | null {
  try {
    return new URL(sourceUrl).href.replace(/\(/g, '%28').replace(/\)/g, '%29')
  } catch {
    return null
  }
}

export function buildNotes(steps: string[], sourceUrl: string): string {
  // Gemini sometimes numbers the steps itself; strip that so notes never read "1. 1. Mix"
  const method = steps.map((s, i) => `${i + 1}. ${s.replace(/^\s*\d+\s*[.)]\s*/, '').trim()}`).join('\n')
  const host = hostOf(sourceUrl)
  const target = linkTarget(sourceUrl)
  const source = host && target ? `Zdroj: [${host}](${target})` : ''
  return [method, source].filter(Boolean).join('\n\n')
}

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

function sourceTextOf(ing: ParsedIngredient): string {
  return (
    ing.line?.trim() || [ing.quantity, ing.unit, ing.name].filter((part) => part !== null && part !== '').join(' ')
  )
}

export function mapToRecipe(
  parsed: ParsedRecipe,
  db: IngredientDbEntry[],
  sourceUrl: string,
  tags: Tag[] = [],
): RecipeDraft {
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
    ...mapTags(parsed, tags),
  }
}
