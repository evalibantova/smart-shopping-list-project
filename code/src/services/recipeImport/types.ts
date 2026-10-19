// code/src/services/recipeImport/types.ts
export const IMPORT_UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'pcs', 'cloves'] as const
export type ImportUnit = (typeof IMPORT_UNITS)[number]

export interface ParsedIngredient {
  name: string
  quantity: number | null
  unit: ImportUnit | null
  /** The ingredient line exactly as written on the page. */
  line?: string
}

export interface ParsedRecipe {
  name: string
  servings: number | null
  ingredients: ParsedIngredient[]
  steps: string[]
  tags?: string[]
  newTags?: string[]
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
  | 'model_unavailable'
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
  model_unavailable: "This Gemini model is not available any more. The app's GEMINI_MODEL needs updating.",
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

// Units a stored ingredient can use (the same set the ingredients API accepts) and the shopping-list categories.
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
