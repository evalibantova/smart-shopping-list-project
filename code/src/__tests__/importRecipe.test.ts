import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importRecipeFromUrl } from '../services/recipeImport/importRecipe'
import { settingsService } from '../services/settingsService'
import { ImportError, type FetchedPage, type ParsedRecipe } from '../services/recipeImport/types'
import type { IngredientDbEntry } from '../types/ingredients'
import type { Tag } from '../types/recipes'

const PAGE: FetchedPage = { source: 'jsonld', text: '{}' }
const PARSED: ParsedRecipe = {
  name: 'Pancakes',
  servings: 4,
  ingredients: [{ name: 'flour', quantity: 0.2, unit: 'kg' }],
  steps: ['Mix'],
}

const FLOUR: IngredientDbEntry = { id: 'ing-flour', name: 'Flour', default_unit: 'g', category: 'Pantry' }
const NUDLE: IngredientDbEntry = { id: 'ing-nudle', name: 'nudle ryžové', default_unit: 'g', category: 'Pantry & Dry Goods' }
const lists = (over: { tags?: Tag[]; ingredients?: IngredientDbEntry[] } = {}) => ({
  tags: [] as Tag[],
  ingredients: [FLOUR],
  ...over,
})

describe('importRecipeFromUrl', () => {
  beforeEach(() => {
    localStorage.clear()
    settingsService.setGeminiKey('k')
  })

  it('fetches, parses with the saved key, maps onto the given ingredients, and reports stages in order', async () => {
    const stages: string[] = []
    const fetchPage = vi.fn().mockResolvedValue(PAGE)
    const parseRecipe = vi.fn().mockResolvedValue(PARSED)

    const draft = await importRecipeFromUrl(' https://example.com/p ', {
      ...lists(),
      onStage: (s) => stages.push(s),
      deps: { fetchPage, parseRecipe },
    })

    expect(stages).toEqual(['fetching', 'reading'])
    expect(fetchPage).toHaveBeenCalledWith('https://example.com/p', { signal: undefined })
    expect(parseRecipe).toHaveBeenCalledWith(PAGE, 'k', { signal: undefined, tagNames: [] })
    expect(draft.name).toBe('Pancakes')
    expect(draft.rows[0]).toMatchObject({ ingredientId: 'ing-flour', ingredientName: 'Flour', quantity: 200, unit: 'g', flagged: false })
    expect(draft.sourceHost).toBe('example.com')
  })

  it('fails with no_key before touching the network when no key is saved', async () => {
    settingsService.clearGeminiKey()
    const fetchPage = vi.fn()
    await expect(importRecipeFromUrl('https://example.com/', { ...lists(), deps: { fetchPage } })).rejects.toMatchObject({
      code: 'no_key',
    })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('fails with bad_url before touching the network for a malformed address', async () => {
    const fetchPage = vi.fn()
    await expect(importRecipeFromUrl('nope', { ...lists(), deps: { fetchPage } })).rejects.toMatchObject({ code: 'bad_url' })
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('propagates errors from the fetch and parse steps', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new ImportError('blocked_host'))
    await expect(importRecipeFromUrl('https://example.com/', { ...lists(), deps: { fetchPage } })).rejects.toMatchObject({
      code: 'blocked_host',
    })

    const ok = vi.fn().mockResolvedValue(PAGE)
    const parseRecipe = vi.fn().mockRejectedValue(new ImportError('rate_limited'))
    await expect(
      importRecipeFromUrl('https://example.com/', { ...lists(), deps: { fetchPage: ok, parseRecipe } }),
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
  const both = () => lists({ ingredients: [FLOUR, NUDLE] })

  beforeEach(() => {
    localStorage.clear()
    settingsService.setGeminiKey('k')
  })

  it('asks the model about unresolved rows, in a matching stage, and applies its answer', async () => {
    const stages: string[] = []
    const resolve = vi.fn().mockResolvedValue([{ index: 0, matchId: NUDLE.id, newIngredient: null, estimate: null }])
    const draft = await importRecipeFromUrl('https://example.com/p', {
      ...both(),
      onStage: (s) => stages.push(s),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
    })
    expect(stages).toEqual(['fetching', 'reading', 'matching'])
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(resolve.mock.calls[0][0]).toBe('Rezance')
    expect(resolve.mock.calls[0][1]).toHaveLength(1)
    expect(draft.rows[0]).toMatchObject({ ingredientId: NUDLE.id, quantity: 100, matchedBy: 'ai' })
  })

  it('makes no second call when every row is resolved locally', async () => {
    const resolve = vi.fn()
    await importRecipeFromUrl('https://example.com/p', {
      ...both(),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(PARSED), resolve },
    })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('keeps the local draft when the second call fails', async () => {
    const resolve = vi.fn().mockRejectedValue(new ImportError('rate_limited'))
    const draft = await importRecipeFromUrl('https://example.com/p', {
      ...both(),
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
        ...both(),
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
        ...both(),
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
        ...both(),
        deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe: vi.fn().mockResolvedValue(unmatched), resolve },
      }),
    ).rejects.toMatchObject({ code: 'aborted' })
  })

  it('sends the given tag names with the parse call and maps the suggested tags', async () => {
    const tag: Tag = { id: 'tag-soup', name: 'Polievka', color: '#26A69A' }
    const parseRecipe = vi.fn().mockResolvedValue({ ...PARSED, tags: ['polievka'], newTags: ['krevety'] })
    const draft = await importRecipeFromUrl('https://example.com/p', {
      ...lists({ tags: [tag] }),
      deps: { fetchPage: vi.fn().mockResolvedValue(PAGE), parseRecipe, resolve: vi.fn() },
    })
    expect(parseRecipe.mock.calls[0][2]).toMatchObject({ tagNames: ['Polievka'] })
    expect(draft.tagIds).toEqual([tag.id])
    expect(draft.newTags).toEqual(['krevety'])
  })
})
