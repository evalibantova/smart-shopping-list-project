import { describe, it, expect } from 'vitest'
import { buildNotes, convertQuantity, mapTags, mapToRecipe } from '../services/recipeImport/mapToRecipe'
import type { ParsedRecipe } from '../services/recipeImport/types'
import type { IngredientDbEntry } from '../types/ingredients'
import type { Tag } from '../types/recipes'

const db: IngredientDbEntry[] = [
  { id: 'flour', name: 'Múka', default_unit: 'g', category: 'Pantry' },
  { id: 'milk', name: 'Mlieko', default_unit: 'ml', category: 'Dairy' },
  { id: 'egg', name: 'Vajce', default_unit: 'pcs', category: 'Dairy' },
  { id: 'oil', name: 'Olej', default_unit: 'tbsp', category: 'Pantry' },
  { id: 'garlic', name: 'Cesnak', default_unit: 'cloves', category: 'Veg' },
  { id: 'carrot', name: 'Carrot', default_unit: 'g', category: 'Veg' },
  { id: 'tomato', name: 'Tomato', default_unit: 'g', category: 'Veg' },
]

function recipe(ingredients: ParsedRecipe['ingredients'], over: Partial<ParsedRecipe> = {}): ParsedRecipe {
  return { name: 'Test', servings: 4, ingredients, steps: ['Mix', 'Bake'], ...over }
}
const URL = 'https://www.example.com/recipes/test'

describe('mapToRecipe — name matching', () => {
  it('matches ignoring case and diacritics', () => {
    const { rows } = mapToRecipe(
      recipe([
        { name: 'muka', quantity: 100, unit: 'g' },
        { name: 'MLIEKO', quantity: 100, unit: 'ml' },
      ]),
      db,
      URL,
    )
    expect(rows.map((r) => r.ingredientId)).toEqual(['flour', 'milk'])
    expect(rows[0].ingredientName).toBe('Múka')
  })

  it('matches simple plurals', () => {
    const { rows } = mapToRecipe(
      recipe([
        { name: 'carrots', quantity: 100, unit: 'g' },
        { name: 'tomatoes', quantity: 200, unit: 'g' },
      ]),
      db,
      URL,
    )
    expect(rows.map((r) => r.ingredientId)).toEqual(['carrot', 'tomato'])
  })

  it('binds a reordered name with an ending change to its entry and default unit', () => {
    const d: IngredientDbEntry[] = [{ id: 'spring', name: 'cibuľa jarná', default_unit: 'pcs', category: 'Veg' }]
    const { rows } = mapToRecipe(recipe([{ name: 'jarná cibuľka', quantity: 1, unit: 'pcs' }]), d, URL)
    expect(rows[0]).toMatchObject({ ingredientId: 'spring', unit: 'pcs', quantity: 1, flagged: false })
  })

  it('binds "olivový olej" to "olej olivový" and converts tbsp to ml', () => {
    const d: IngredientDbEntry[] = [{ id: 'olive', name: 'olej olivový', default_unit: 'ml', category: 'Pantry' }]
    const { rows } = mapToRecipe(recipe([{ name: 'olivový olej', quantity: 3, unit: 'tbsp' }]), d, URL)
    expect(rows[0]).toMatchObject({ ingredientId: 'olive', unit: 'ml', quantity: 45, flagged: false })
  })

  it('keeps "čínska kapusta" unbound and flagged', () => {
    const d: IngredientDbEntry[] = [
      { id: 'cab', name: 'kapusta', default_unit: 'g', category: 'Veg' },
      { id: 'sour', name: 'kapusta kyslá', default_unit: 'g', category: 'Veg' },
    ]
    const { rows } = mapToRecipe(recipe([{ name: 'čínska kapusta', quantity: 0.33, unit: 'pcs' }]), d, URL)
    expect(rows[0]).toMatchObject({ ingredientId: null, flagged: true })
  })

  it('leaves an unmatched name unbound, keeps the parsed quantity, and flags it', () => {
    const { rows } = mapToRecipe(recipe([{ name: 'saffron', quantity: 2, unit: 'g' }]), db, URL)
    expect(rows[0]).toMatchObject({
      ingredientId: null,
      ingredientName: 'saffron',
      quantity: 2,
      unit: '',
      flagged: true,
      sourceText: '2 g saffron',
    })
  })
})

describe('mapToRecipe — quantities', () => {
  it('converts kg to g and l to ml', () => {
    const { rows } = mapToRecipe(
      recipe([
        { name: 'múka', quantity: 0.5, unit: 'kg' },
        { name: 'mlieko', quantity: 1.5, unit: 'l' },
      ]),
      db,
      URL,
    )
    expect(rows.map((r) => r.quantity)).toEqual([500, 1500])
    expect(rows.every((r) => !r.flagged)).toBe(true)
    expect(rows.map((r) => r.unit)).toEqual(['g', 'ml'])
  })

  it('converts cups, tsp and ml into the default unit when the dimension matches', () => {
    expect(convertQuantity(1, 'cup', 'ml')).toBe(240)
    expect(convertQuantity(3, 'tsp', 'tbsp')).toBe(1)
    expect(convertQuantity(30, 'ml', 'tbsp')).toBe(2)
    expect(convertQuantity(2, 'tbsp', 'tbsp')).toBe(2)
  })

  it('refuses impossible conversions: volume to mass, and unlike counts', () => {
    expect(convertQuantity(2, 'cup', 'g')).toBeNull()
    expect(convertQuantity(2, 'pcs', 'cloves')).toBeNull()
    expect(convertQuantity(2, 'g', 'pcs')).toBeNull()
  })

  it('treats a rounded result <= 0 as unconvertible', () => {
    // Same unit: 0.004 g rounds to 0
    expect(convertQuantity(0.004, 'g', 'g')).toBeNull()
    // Downward conversion: 0.0001 g to kg rounds to 0
    expect(convertQuantity(0.0001, 'g', 'kg')).toBeNull()
    // But normal small values do convert: 0.001 kg to g = 1 g
    expect(convertQuantity(0.001, 'kg', 'g')).toBe(1)
    // And 0.01 g to kg = 0.00001 kg, which rounds to 0.00
    expect(convertQuantity(0.01, 'g', 'kg')).toBeNull()
  })

  it('treats a missing unit as pieces only when the default unit is pcs', () => {
    expect(convertQuantity(2, null, 'pcs')).toBe(2)
    expect(convertQuantity(2, null, 'g')).toBeNull()
  })

  it('flags a unit-less tiny quantity for pcs ingredients', () => {
    // Tiny quantity rounds to 0
    expect(convertQuantity(0.004, null, 'pcs')).toBeNull()
    // Normal quantity still works
    expect(convertQuantity(2, null, 'pcs')).toBe(2)
  })

  it('flags a bound row whose conversion is impossible and sets its quantity to 0', () => {
    const { rows } = mapToRecipe(recipe([{ name: 'múka', quantity: 2, unit: 'cup' }]), db, URL)
    expect(rows[0]).toMatchObject({ ingredientId: 'flour', quantity: 0, unit: 'g', flagged: true })
    expect(rows[0].sourceText).toBe('2 cup múka')
  })

  it('flags null, zero and negative quantities instead of guessing', () => {
    const { rows } = mapToRecipe(
      recipe([
        { name: 'múka', quantity: null, unit: 'g' },
        { name: 'mlieko', quantity: 0, unit: 'ml' },
        { name: 'vajce', quantity: -1, unit: 'pcs' },
      ]),
      db,
      URL,
    )
    expect(rows.every((r) => r.flagged && r.quantity === 0)).toBe(true)
  })

  it('keeps a unit-less count for a pcs ingredient without flagging', () => {
    const { rows } = mapToRecipe(recipe([{ name: 'vajce', quantity: 2, unit: null }]), db, URL)
    expect(rows[0]).toMatchObject({ quantity: 2, unit: 'pcs', flagged: false })
  })

  it('flags a bound row whose quantity rounds to 0 and sets its quantity to 0', () => {
    const { rows } = mapToRecipe(recipe([{ name: 'múka', quantity: 0.004, unit: 'g' }]), db, URL)
    expect(rows[0]).toMatchObject({ ingredientId: 'flour', quantity: 0, unit: 'g', flagged: true })
  })

  it('flags a unit-less tiny quantity for a pcs ingredient and sets quantity to 0', () => {
    const { rows } = mapToRecipe(recipe([{ name: 'vajce', quantity: 0.004, unit: null }]), db, URL)
    expect(rows[0]).toMatchObject({ ingredientId: 'egg', quantity: 0, unit: 'pcs', flagged: true })
  })
})

describe('mapToRecipe — servings, notes and host', () => {
  it('defaults servings to 2 when missing or below 1, and rounds otherwise', () => {
    expect(mapToRecipe(recipe([], { servings: null }), db, URL).servings).toBe(2)
    expect(mapToRecipe(recipe([], { servings: 0.5 }), db, URL).servings).toBe(2)
    expect(mapToRecipe(recipe([], { servings: 4 }), db, URL).servings).toBe(4)
    expect(mapToRecipe(recipe([], { servings: 3.6 }), db, URL).servings).toBe(4)
  })

  it('builds numbered steps plus a source link, and exposes the host', () => {
    const draft = mapToRecipe(recipe([]), db, URL)
    expect(draft.notes).toBe('1. Mix\n2. Bake\n\nZdroj: [example.com](https://www.example.com/recipes/test)')
    expect(draft.sourceHost).toBe('example.com')
  })

  it('writes only the source line when there are no steps, and nothing for a bad URL', () => {
    expect(buildNotes([], URL)).toBe('Zdroj: [example.com](https://www.example.com/recipes/test)')
    expect(buildNotes(['Mix'], 'not a url')).toBe('1. Mix')
  })

  it('builds a single well-formed link when the URL has parentheses and spaces', () => {
    expect(buildNotes([], 'https://example.com/a_(b) c')).toBe(
      'Zdroj: [example.com](https://example.com/a_%28b%29%20c)',
    )
    expect(buildNotes([], 'https://example.com/a_(b)')).toBe('Zdroj: [example.com](https://example.com/a_%28b%29)')
  })

  it('cannot inject a second line through an encoded or raw newline in the URL', () => {
    expect(buildNotes([], 'https://example.com/a%0A%0Ainjected').split('\n')).toHaveLength(1)
    expect(buildNotes([], 'https://example.com/a\n\ninjected').split('\n')).toHaveLength(1)
  })

  it('renumbers steps that Gemini already numbered', () => {
    expect(buildNotes(['1. Mix', '2) Bake'], 'not a url')).toBe('1. Mix\n2. Bake')
  })
})

describe('mapToRecipe: tags and original lines', () => {
  const tags: Tag[] = [
    { id: 't-soup', name: 'Polievka', color: '#26A69A' },
    { id: 't-pork', name: 'bravčové', color: '#E57373' },
  ]

  it('maps tag names to existing ids ignoring case and accents, and lists unknown ones as new', () => {
    expect(mapTags({ tags: ['polievka', 'BRAVCOVE'], newTags: ['krevety'] }, tags)).toEqual({
      tagIds: ['t-soup', 't-pork'],
      newTags: ['krevety'],
    })
  })

  it('treats a "new" tag that already exists as the existing tag, and removes duplicates', () => {
    expect(mapTags({ tags: ['Polievka'], newTags: ['polievka', 'krevety', 'Krevety'] }, tags)).toEqual({
      tagIds: ['t-soup'],
      newTags: ['krevety'],
    })
  })

  it('proposes at most 3 new tags and tolerates missing lists', () => {
    expect(mapTags({ newTags: ['a1', 'b2', 'c3', 'd4'] }, tags).newTags).toEqual(['a1', 'b2', 'c3'])
    expect(mapTags({}, tags)).toEqual({ tagIds: [], newTags: [] })
  })

  it('returns at most 3 existing tag ids', () => {
    const many: Tag[] = ['a1', 'b2', 'c3', 'd4', 'e5'].map((n) => ({ id: 't-' + n, name: n, color: '#000000' }))
    expect(mapTags({ tags: ['a1', 'b2', 'c3', 'd4', 'e5'] }, many).tagIds).toEqual(['t-a1', 't-b2', 't-c3'])
  })

  it('puts the tags on the draft and uses the original line as the source text', () => {
    const draft = mapToRecipe(
      recipe([{ name: 'mrkva', quantity: 1, unit: 'pcs', line: '1 veľkú mrkvu' }], { tags: ['Polievka'], newTags: ['krevety'] }),
      db,
      URL,
      tags,
    )
    expect(draft.tagIds).toEqual(['t-soup'])
    expect(draft.newTags).toEqual(['krevety'])
    expect(draft.rows[0].sourceText).toBe('1 veľkú mrkvu')
  })

  it('keeps working without a tag list', () => {
    const draft = mapToRecipe(recipe([]), db, URL)
    expect(draft.tagIds).toEqual([])
    expect(draft.newTags).toEqual([])
  })
})
