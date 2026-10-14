// code/src/__tests__/geminiParse.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  GEMINI_MODEL,
  buildGeminiRequest,
  buildPrompt,
  parseRecipeWithGemini,
  testGeminiKey,
  toParsedRecipe,
} from '../services/recipeImport/geminiParse'
import type { FetchedPage, ImportError } from '../services/recipeImport/types'

const KEY = 'secret-key-123'
const PAGE: FetchedPage = { source: 'jsonld', text: '{"name":"Pancakes"}' }
const GOOD = {
  name: 'Pancakes',
  servings: 4,
  ingredients: [{ name: 'flour', quantity: 200, unit: 'g' }],
  steps: ['Mix', 'Fry'],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
function geminiOk(payload: unknown): Response {
  return jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
}
function geminiText(text: string): Response {
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] })
}
async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
  } catch (e) {
    return (e as ImportError).code
  }
  return 'none'
}

describe('parseRecipeWithGemini', () => {
  it('sends the key in the header, never in the URL, with the schema', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(GOOD))
    await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(GEMINI_MODEL)
    expect(url).not.toContain(KEY)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY)
    const body = JSON.parse(init.body as string)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toBeDefined()
  })

  it('returns the parsed recipe', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(GOOD))
    expect(await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })).toEqual(GOOD)
  })

  it.each([
    [429, 'rate_limited'],
    [403, 'key_rejected'],
    [401, 'key_rejected'],
    [404, 'model_unavailable'],
    [500, 'gemini_error'],
  ])('maps HTTP %i to %s', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'x' } }, status))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe(code)
  })

  it('uses a static model_unavailable message that never contains the key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: KEY } }, 404))
    let caught: unknown
    try {
      await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })
    } catch (e) {
      caught = e
    }
    expect((caught as ImportError).code).toBe('model_unavailable')
    expect((caught as Error).message).toContain('GEMINI_MODEL')
    expect((caught as Error).message).not.toContain(KEY)
  })

  it('maps a 400 about the API key to key_rejected', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe('key_rejected')
  })

  it('maps a network failure to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe('network')
  })

  it('maps a user abort to aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl, signal: controller.signal }))).toBe('aborted')
  })

  it('retries once on malformed JSON and then succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(geminiText('not json')).mockResolvedValueOnce(geminiOk(GOOD))
    expect(await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })).toEqual(GOOD)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('gives up with no_recipe after two malformed replies', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => geminiText('not json'))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe('no_recipe')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns no_recipe without retrying when there are no ingredients and no steps', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(geminiOk({ name: 'Nothing', servings: null, ingredients: [], steps: [] }))
    expect(await codeOf(parseRecipeWithGemini(PAGE, KEY, { fetchImpl }))).toBe('no_recipe')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('never puts the key in an error message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: KEY } }, 403))
    try {
      await parseRecipeWithGemini(PAGE, KEY, { fetchImpl })
    } catch (e) {
      expect((e as Error).message).not.toContain(KEY)
    }
  })
})

describe('toParsedRecipe', () => {
  it('drops ingredients without a name and coerces bad quantity and unit to null', () => {
    const parsed = toParsedRecipe({
      name: 'X',
      servings: 'four',
      ingredients: [
        { name: '  ', quantity: 1, unit: 'g' },
        { name: 'salt', quantity: '2', unit: 'handful' },
        { name: 'flour', quantity: 200, unit: 'g' },
      ],
      steps: ['Mix', '', 5],
    })
    expect(parsed).toEqual({
      name: 'X',
      servings: null,
      ingredients: [
        { name: 'salt', quantity: null, unit: null },
        { name: 'flour', quantity: 200, unit: 'g' },
      ],
      steps: ['Mix'],
    })
  })

  it('returns null for the wrong shape', () => {
    expect(toParsedRecipe(null)).toBeNull()
    expect(toParsedRecipe({ name: 'X', ingredients: 'nope', steps: [] })).toBeNull()
    expect(toParsedRecipe({ ingredients: [], steps: [] })).toBeNull()
  })
})

describe('buildPrompt and buildGeminiRequest', () => {
  it('puts the page text last and names the source kind', () => {
    const prompt = buildPrompt({ source: 'text', text: 'PAGE BODY' })
    expect(prompt).toContain('page text')
    expect(prompt.endsWith('PAGE BODY')).toBe(true)
    expect(buildPrompt(PAGE)).toContain('JSON-LD')
  })

  it('guides units and quantities without telling the model to drop them', () => {
    const prompt = buildPrompt(PAGE)
    expect(prompt).not.toContain('not in the allowed list')
    expect(prompt).toContain('pcs')
    expect(prompt).toContain('lyžica')
    expect(prompt).toContain('tbsp')
    expect(prompt).toContain('decimals')
    expect(prompt).toContain('NOT units')
  })

  it('uses temperature 0 and a bounded output', () => {
    const req = buildGeminiRequest('hi') as { generationConfig: { temperature: number; maxOutputTokens: number } }
    expect(req.generationConfig.temperature).toBe(0)
    expect(req.generationConfig.maxOutputTokens).toBeLessThanOrEqual(4096)
    expect(req.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4096)
  })
})

describe('testGeminiKey', () => {
  it('resolves when Gemini answers 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiText('ok'))
    await expect(testGeminiKey(KEY, { fetchImpl })).resolves.toBeUndefined()
  })

  it('rejects with key_rejected on 403', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'x' } }, 403))
    expect(await codeOf(testGeminiKey(KEY, { fetchImpl }))).toBe('key_rejected')
  })
})

describe('call 1: original lines and tags', () => {
  it('asks for the original ingredient line and only mentions tags when names are given', () => {
    const without = buildPrompt(PAGE)
    expect(without).toContain('exactly as written on the page')
    expect(without).not.toContain('newTags')

    const withTags = buildPrompt(PAGE, ['Polievka', 'bravčové'])
    expect(withTags).toContain('Polievka, bravčové')
    expect(withTags).toContain('newTags')
  })

  it('has line, tags and newTags in the response schema', () => {
    type Schema = {
      generationConfig: {
        responseSchema: {
          properties: {
            ingredients: { items: { properties: Record<string, unknown> } }
            tags: { type: string }
            newTags: { type: string }
          }
        }
      }
    }
    const schema = (buildGeminiRequest('p') as Schema).generationConfig.responseSchema
    expect(schema.properties.ingredients.items.properties.line).toBeDefined()
    expect(schema.properties.tags.type).toBe('ARRAY')
    expect(schema.properties.newTags.type).toBe('ARRAY')
  })

  it('keeps line, tags and newTags from the reply, trimmed and limited to strings', () => {
    const parsed = toParsedRecipe({
      name: 'X',
      servings: 2,
      ingredients: [
        { name: 'mrkva', quantity: 1, unit: 'pcs', line: ' 1 veľkú mrkvu ' },
        { name: 'soľ', quantity: null, unit: null },
      ],
      steps: ['Mix'],
      tags: [' Polievka ', '', 5, 'bravčové'],
      newTags: ['krevety'],
    })
    expect(parsed?.ingredients[0].line).toBe('1 veľkú mrkvu')
    expect(parsed?.ingredients[1].line).toBeUndefined()
    expect(parsed?.tags).toEqual(['Polievka', 'bravčové'])
    expect(parsed?.newTags).toEqual(['krevety'])
  })

  it('puts the tag names into the request when parsing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk(GOOD))
    await parseRecipeWithGemini(PAGE, KEY, { fetchImpl, tagNames: ['Polievka', 'Dezert'] })
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
    expect(body.contents[0].parts[0].text).toContain('Polievka, Dezert')
  })
})
