import { describe, it, expect } from 'vitest'
import { buildNotes, convertQuantity, mapToRecipe } from '../services/recipeImport/mapToRecipe'
import type { ParsedRecipe } from '../services/recipeImport/types'
import type { IngredientDbEntry } from '../types/ingredients'

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
})
