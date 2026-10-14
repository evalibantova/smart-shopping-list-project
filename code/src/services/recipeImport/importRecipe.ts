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
