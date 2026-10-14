// code/src/__tests__/resolveRows.test.ts
import { describe, it, expect } from 'vitest'
import { mapToRecipe } from '../services/recipeImport/mapToRecipe'
import { applyResolutions, buildResolveItems } from '../services/recipeImport/resolveRows'
import type { ParsedRecipe, Resolution } from '../services/recipeImport/types'
import type { IngredientDbEntry } from '../types/ingredients'

const db: IngredientDbEntry[] = [
  { id: 'kapusta', name: 'kapusta', default_unit: 'g', category: 'Produce' },
  { id: 'kysla', name: 'kapusta kyslá', default_unit: 'g', category: 'Pantry & Dry Goods' },
  { id: 'nudle', name: 'nudle ryžové', default_unit: 'g', category: 'Pantry & Dry Goods' },
  { id: 'sol', name: 'soľ', default_unit: 'tsp', category: 'Pantry & Dry Goods' },
  { id: 'olej', name: 'olej', default_unit: 'ml', category: 'Pantry & Dry Goods' },
  { id: 'mrkva', name: 'mrkva', default_unit: 'pcs', category: 'Produce' },
]
const URL = 'https://example.com/r'

const parsed: ParsedRecipe = {
  name: 'Rezance',
  servings: 2,
  steps: ['Mix'],
  ingredients: [
    { name: 'čínska kapusta', quantity: 0.33, unit: null, line: '1/3 čínskej kapusty' }, // 0 unmatched
    { name: 'mrkva', quantity: 1, unit: 'pcs', line: '1 veľkú mrkvu' }, // 1 matched, converted
    { name: 'ryžové rezance', quantity: 100, unit: 'g', line: '100 g ryžových rezancov' }, // 2 unmatched
    { name: 'soľ', quantity: null, unit: null, line: 'morskú/himalájsku soľ' }, // 3 matched, no amount
    { name: 'olivový olej', quantity: 3, unit: 'tbsp', line: '3 lyžice olivového oleja' }, // 4 unmatched
    { name: '', quantity: 1, unit: 'pcs' }, // 5 would be dropped upstream; guard for empty names
  ],
}
const draft = () => mapToRecipe({ ...parsed, ingredients: parsed.ingredients.slice(0, 5) }, db, URL)
const NEW_CABBAGE = { name: 'čínska kapusta', default_unit: 'g' as const, category: 'Produce' }

describe('buildResolveItems', () => {
  it('asks about unmatched rows and flagged matched rows, with the original lines', () => {
    const items = buildResolveItems(draft(), parsed, db)
    expect(items.map((i) => i.index)).toEqual([0, 2, 3, 4])
    expect(items[0].line).toBe('1/3 čínskej kapusty')
    expect(items[0].locked).toBe(false)
    expect(items[0].candidates.map((c) => c.name)).toEqual(['kapusta', 'kapusta kyslá'])
  })

  it('locks a matched row that only needs an estimate, with its own ingredient as the single candidate', () => {
    const sol = buildResolveItems(draft(), parsed, db).find((i) => i.index === 3)!
    expect(sol.locked).toBe(true)
    expect(sol.candidates).toEqual([{ id: 'sol', name: 'soľ', default_unit: 'tsp' }])
  })

  it('leaves out rows that are matched and converted, and rows without a name', () => {
    const d = mapToRecipe(parsed, db, URL)
    const indexes = buildResolveItems(d, parsed, db).map((i) => i.index)
    expect(indexes).not.toContain(1)
    expect(indexes).not.toContain(5)
  })

  it('caps the candidates at 5', () => {
    const many: IngredientDbEntry[] = Array.from({ length: 9 }, (_, n) => ({
      id: `k${n}`,
      name: `kapusta ${n}`,
      default_unit: 'g',
      category: 'Produce',
    }))
    const d = mapToRecipe({ ...parsed, ingredients: [parsed.ingredients[0]] }, many, URL)
    expect(buildResolveItems(d, { ...parsed, ingredients: [parsed.ingredients[0]] }, many)[0].candidates).toHaveLength(5)
  })
})

describe('applyResolutions', () => {
  const res = (r: Partial<Resolution> & { index: number }): Resolution => ({
    matchId: null,
    newIngredient: null,
    estimate: null,
    ...r,
  })

  it('binds a valid model pick and converts the parsed quantity into its unit', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 2, matchId: 'nudle' })], db)
    expect(out.rows[2]).toMatchObject({
      ingredientId: 'nudle',
      ingredientName: 'nudle ryžové',
      quantity: 100,
      unit: 'g',
      flagged: false,
      matchedBy: 'ai',
    })
  })

  it('converts units into the picked ingredient (3 tbsp of an ml ingredient is 45)', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 4, matchId: 'olej' })], db)
    expect(out.rows[4]).toMatchObject({ ingredientId: 'olej', quantity: 45, unit: 'ml', flagged: false })
  })

  it('turns a proposed new ingredient into a new-ingredient row, using the estimate when conversion is impossible', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 0, newIngredient: NEW_CABBAGE, estimate: 300 })], db)
    expect(out.rows[0]).toMatchObject({
      ingredientId: null,
      ingredientName: 'čínska kapusta',
      unit: 'g',
      quantity: 300,
      estimated: true,
      flagged: true,
      matchedBy: 'ai',
      newIngredient: NEW_CABBAGE,
    })
  })

  it('binds a proposed new ingredient to an existing one when the local matcher already knows it', () => {
    const out = applyResolutions(
      draft(),
      parsed,
      [res({ index: 0, newIngredient: { name: 'Kapusta', default_unit: 'g', category: 'Produce' }, estimate: 400 })],
      db,
    )
    expect(out.rows[0].ingredientId).toBe('kapusta')
    expect(out.rows[0].newIngredient ?? null).toBeNull()
    expect(out.rows[0]).toMatchObject({ quantity: 400, estimated: true })
  })

  it('gives a locked row its estimate and keeps its binding', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 3, matchId: 'sol', estimate: 0.5 })], db)
    expect(out.rows[3]).toMatchObject({ ingredientId: 'sol', quantity: 0.5, estimated: true, flagged: true })
  })

  it('ignores an estimate for a matched row that was converted and not asked about', () => {
    const before = draft()
    const out = applyResolutions(before, parsed, [res({ index: 1, estimate: 5 })], db)
    expect(out.rows[1]).toEqual(before.rows[1])
    expect(out.rows[1]).toMatchObject({ quantity: 1, flagged: false })
    expect(out.rows[1].estimated).not.toBe(true)
  })

  it('leaves a locked row unchanged when the model gives no estimate', () => {
    const before = draft()
    const out = applyResolutions(before, parsed, [res({ index: 3, matchId: 'sol' })], db)
    expect(out.rows[3]).toEqual(before.rows[3])
  })

  it('flags a row with no usable amount at quantity 0', () => {
    const out = applyResolutions(draft(), parsed, [res({ index: 2, matchId: 'nudle' })], db)
    const noAmount = applyResolutions(
      draft(),
      { ...parsed, ingredients: parsed.ingredients.map((i, n) => (n === 2 ? { ...i, quantity: null, unit: null } : i)) },
      [res({ index: 2, matchId: 'nudle' })],
      db,
    )
    expect(out.rows[2].quantity).toBe(100)
    expect(noAmount.rows[2]).toMatchObject({ quantity: 0, flagged: true, estimated: false })
  })

  it('leaves rows unchanged when there is no usable resolution', () => {
    const before = draft()
    const out = applyResolutions(
      before,
      parsed,
      [res({ index: 0 }), res({ index: 2, matchId: 'not-in-db' }), res({ index: 99, matchId: 'nudle' })],
      db,
    )
    expect(out.rows).toEqual(before.rows)
  })

  it('does not change the rows it was not asked about, or the rest of the draft', () => {
    const before = draft()
    const out = applyResolutions(before, parsed, [res({ index: 2, matchId: 'nudle' })], db)
    expect(out.rows[1]).toEqual(before.rows[1])
    expect(out.name).toBe(before.name)
    expect(out.notes).toBe(before.notes)
  })
})
