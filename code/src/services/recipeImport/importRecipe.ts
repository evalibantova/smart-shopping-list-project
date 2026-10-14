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
    // An ImportError is an expected failure of call 2. Anything else is a bug in our own code: do not hide it.
    if (!(err instanceof ImportError)) console.warn('Import: the matching step failed, using the local result.', err)
    return draft
  }
}
