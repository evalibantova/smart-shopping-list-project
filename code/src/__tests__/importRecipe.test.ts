import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importRecipeFromUrl } from '../services/recipeImport/importRecipe'
import { settingsService } from '../services/settingsService'
import { ingredientsDbService } from '../services/ingredientsDbService'
import { ImportError, type FetchedPage, type ParsedRecipe } from '../services/recipeImport/types'

const PAGE: FetchedPage = { source: 'jsonld', text: '{}' }
const PARSED: ParsedRecipe = {
  name: 'Pancakes',
  servings: 4,
  ingredients: [{ name: 'flour', quantity: 0.2, unit: 'kg' }],
  steps: ['Mix'],
}

describe('importRecipeFromUrl', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsService.setGeminiKey('k')
    ingredientsDbService.create('Flour', 'g', 'Pantry')
  })

  it('fetches, parses with the saved key, maps onto ingredients_db, and reports stages in order', async () => {
    const stages: string[] = []
    const fetchPage = vi.fn().mockResolvedValue(PAGE)
    const parseRecipe = vi.fn().mockResolvedValue(PARSED)

    const draft = await importRecipeFromUrl(' https://example.com/p ', {
      onStage: (s) => stages.push(s),
      deps: { fetchPage, parseRecipe },
    })

    expect(stages).toEqual(['fetching', 'reading'])
    expect(fetchPage).toHaveBeenCalledWith('https://example.com/p', { signal: undefined })
    expect(parseRecipe).toHaveBeenCalledWith(PAGE, 'k', { signal: undefined })
    expect(draft.name).toBe('Pancakes')
    expect(draft.rows[0]).toMatchObject({ ingredientName: 'Flour', quantity: 200, unit: 'g', flagged: false })
    expect(draft.sourceHost).toBe('example.com')
  })

  it('fails with no_key before touching the network when no key is saved', async () => {
    settingsService.clearGeminiKey()
    const fetchPage = vi.fn()
    await expect(importRecipeFromUrl('https://example.com/', { deps: { fetchPage } })).rejects.toMatchObject({
      code: 'no_key',
    })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('fails with bad_url before touching the network for a malformed address', async () => {
    const fetchPage = vi.fn()
    await expect(importRecipeFromUrl('nope', { deps: { fetchPage } })).rejects.toMatchObject({ code: 'bad_url' })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('propagates errors from the fetch and parse steps', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new ImportError('blocked_host'))
    await expect(importRecipeFromUrl('https://example.com/', { deps: { fetchPage } })).rejects.toMatchObject({
      code: 'blocked_host',
    })

    const ok = vi.fn().mockResolvedValue(PAGE)
    const parseRecipe = vi.fn().mockRejectedValue(new ImportError('rate_limited'))
    await expect(
      importRecipeFromUrl('https://example.com/', { deps: { fetchPage: ok, parseRecipe } }),
    ).rejects.toMatchObject({ code: 'rate_limited' })
  })
})
