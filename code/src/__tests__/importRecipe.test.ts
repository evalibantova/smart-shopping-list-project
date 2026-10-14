import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importRecipeFromUrl } from '../services/recipeImport/importRecipe'
import { settingsService } from '../services/settingsService'
import { ingredientsDbService } from '../services/ingredientsDbService'
import { tagService } from '../features/recipes/services/tagService'
import { ImportError,type FetchedPage, type ParsedRecipe } from '../services/recipeImport/types'

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
    expect(parseRecipe).toHaveBeenCalledWith(PAGE, 'k', { signal: undefined, tagNames: [] })
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

describe('importRecipeFromUrl: matching call', () => {
  const unmatched: ParsedRecipe = {
    name: 'Rezance',
    servings: 2,
    steps: ['Mix'],
    ingredients: [{ name: 'ryžové rezance', quantity: 100, unit: 'g', line: '100 g ryžových rezancov' }],
  }

  beforeEach(() => {
    localStorage.clear()
    settingsService.setGeminiKey('k')
    ingredientsDbService.create('Flour', 'g', 'Pantry')
    ingredientsDbService.create('nudle ryžové', 'g', 'Pantry & Dry Goods')
  })

  it('asks the model about unresolved rows, in a matching stage, and applies its answer', async () => {
    const nudleId = ingredientsDbService.getAll().find((e) => e.name === 'nudle ryžové')!.id
    const stages: string[] = []
    const resolve = vi.fn().mockResolvedValue([{ index: 0, matchId: nudleId, newIngredient: null, estimate: null }])
    const draft = await importRecipeFromUrl('https://example.com/p', {
      onStage: (s) => stages.push(s),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
    })
    expect(stages).toEqual(['fetching', 'reading', 'matching'])
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve.mock.calls[0][0]).toBe('Rezance')
    expect(resolve.mock.calls[0][1]).toHaveLength(1)
    expect(draft.rows[0]).toMatchObject({ ingredientId: nudleId, quantity: 100, matchedBy: 'ai' })
  })

  it('makes no second call when every row is resolved locally', async () => {
    const resolve = vi.fn()
    await importRecipeFromUrl('https://example.com/p', {
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(PARSED), resolve },
    })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('keeps the local draft when the second call fails', async () => {
    const resolve = vi.fn().mockRejectedValue(new ImportError('rate_limited'))
    const draft = await importRecipeFromUrl('https://example.com/p', {
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
    })
    expect(draft.rows[0].ingredientId).toBeNull()
    expect(draft.rows[0].flagged).toBe(true)
  })

  it('keeps the local draft and logs a warning when applying the answer throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const resolve = vi.fn().mockResolvedValue([null as never])
      const draft = await importRecipeFromUrl('https://example.com/p', {
        deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
      })
      expect(draft.rows[0].ingredientId).toBeNull()
      expect(draft.rows[0].flagged).toBe(true)
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('does not log when the second call fails with an ImportError', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await importRecipeFromUrl('https://example.com/p', {
        deps: {
          fetchPage: vi.fn().mockResolvedValue(PAGE),
          parseRecipe: vi.fn().mockResolvedValue(unmatched),
          resolve: vi.fn().mockRejectedValue(new ImportError('rate_limited')),
        },
      })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('stops when the user aborts during the second call', async () => {
    const resolve = vi.fn().mockRejectedValue(new ImportError('aborted'))
    await expect(
      importRecipeFromUrl('https://example.com/p', {
        deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('sends the existing tag names with the parse call and maps the suggested tags', async () => {
    const tag = tagService.create('Polievka', '#26A69A')
    const parseRecipe = vi.fn().mockResolvedValue({ ...PARSED, tags: ['polievka'], newTags: ['krevety'] })
    const draft = await importRecipeFromUrl('https://example.com/p', {
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe, resolve: vi.fn() },
    })
    expect(parseRecipe.mock.calls[0][2]).toMatchObject({ tagNames: ['Polievka'] })
    expect(draft.tagIds).toEqual([tag.id])
    expect(draft.newTags).toEqual(['krevety'])
  })
})
