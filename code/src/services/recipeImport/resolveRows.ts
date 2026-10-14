// code/src/services/recipeImport/resolveRows.ts
import type { IngredientDbEntry } from '../../types/ingredients'
import { fold, matchIngredient, shortlist } from './ingredientMatch'
import { convertQuantity, type DraftRow, type RecipeDraft } from './mapToRecipe'
import type {
  NewIngredientProposal,
  ParsedIngredient,
  ParsedRecipe,
  Resolution,
  ResolveCandidate,
  ResolveItem,
} from './types'

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

function resolveUnmatched(
  row: DraftRow,
  ing: ParsedIngredient,
  res: Resolution,
  db: IngredientDbEntry[],
  seen: Map<string, NewIngredientProposal>,
): DraftRow {
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
    // A repeat of a new ingredient reuses the first proposal (unit and category). The model's estimate was
    // given in this row's own proposed unit, so it only counts when that unit is the one we kept.
    const proposal = seen.get(fold(n.name)) ?? n
    seen.set(fold(n.name), proposal)
    return withQuantity(
      {
        ...row,
        ingredientId: null,
        ingredientName: proposal.name,
        unit: proposal.default_unit,
        newIngredient: proposal,
        matchedBy: 'ai',
      },
      ing,
      proposal.default_unit === n.default_unit ? res.estimate : null,
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
  const seen = new Map<string, NewIngredientProposal>()
  const rows = draft.rows.map((row, index) => {
    const res = byIndex.get(index)
    const ing = parsed.ingredients[index]
    if (!res || !ing) return row
    if (row.ingredientId !== null) {
      return row.flagged && res.estimate !== null
        ? { ...row, quantity: round2(res.estimate), estimated: true, flagged: true }
        : row
    }
    return resolveUnmatched(row, ing, res, db, seen)
  })
  return { ...draft, rows }
}
