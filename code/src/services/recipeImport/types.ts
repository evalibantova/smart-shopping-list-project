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
