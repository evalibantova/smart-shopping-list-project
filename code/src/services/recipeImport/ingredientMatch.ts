import type { IngredientDbEntry } from '../../types/ingredients'

export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Folded words of a name: anything that is not a letter or digit separates tokens. */
export function tokens(name: string): string[] {
  return fold(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
}

/** Equal, or differing only by a short ending (cibulka/cibula, carrot/carrots). Inputs are folded tokens. */
export function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 2) return false
  let prefix = 0
  const max = Math.min(a.length, b.length)
  while (prefix < max && a[prefix] === b[prefix]) prefix++
  return prefix >= Math.max(4, max - 2)
}

export interface Candidate {
  entry: IngredientDbEntry
  score: number
}

function scoreTokens(q: string[], e: string[]): number {
  if (q.length === 0 || e.length === 0) return 0
  const used = new Set<number>()
  let paired = 0
  for (const qt of q) {
    const i = e.findIndex((et, idx) => !used.has(idx) && tokensMatch(qt, et))
    if (i !== -1) {
      used.add(i)
      paired++
    }
  }
  return paired / Math.max(q.length, e.length)
}

/** Entries sharing at least one word with the name, best first (score, then fewer words, then db order). */
export function shortlist(name: string, db: IngredientDbEntry[], k = 5): Candidate[] {
  const q = tokens(name)
  return db
    .map((entry, index) => {
      const et = tokens(entry.name)
      return { entry, index, size: et.length, score: scoreTokens(q, et) }
    })
    .filter((c) => c.score > 0)
    .sort((x, y) => y.score - x.score || x.size - y.size || x.index - y.index)
    .slice(0, k)
    .map(({ entry, score }) => ({ entry, score }))
}

/** An entry only when every word matches (any order, fuzzy endings); never for partial overlap. */
export function matchIngredient(name: string, db: IngredientDbEntry[]): IngredientDbEntry | undefined {
  const full = shortlist(name, db, db.length).filter((c) => c.score === 1)
  if (full.length === 0) return undefined
  const folded = fold(name)
  return (full.find((c) => fold(c.entry.name) === folded) ?? full[0]).entry
}
