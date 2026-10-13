import { describe, it, expect } from 'vitest'
import { computeAvailability } from '../features/cook-now/utils/cookNowUtils'
import type { Recipe } from '../types/recipes'
import type { MealPlanEntry } from '../types/mealPlan'
import type { PantryItem } from '../types/pantry'

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    emoji: '🍝',
    name: 'Test Recipe',
    servings: 2,
    tagIds: [],
    ingredients: [
      { ingredientId: 'ing-a', quantity: 3 },
      { ingredientId: 'ing-b', quantity: 2 },
    ],
    notes: '',
    createdAt: 0,
    ...overrides,
  }
}

function makeEntry(overrides: Partial<Pick<MealPlanEntry, 'servings'>> = {}): Pick<MealPlanEntry, 'servings'> {
  return { servings: 2, ...overrides }
}

function makePantry(items: Array<{ ingredientId: string; quantity: number }>): PantryItem[] {
  return items.map((item, i) => ({
    id: `p${i}`,
    ingredientId: item.ingredientId,
    quantity: item.quantity,
    maxStock: item.quantity * 3,
  }))
}

describe('computeAvailability', () => {
  it('all ready: pantry covers all → tier=ready, missingCount=0, all values true', () => {
    const recipe = makeRecipe()
    const entry = makeEntry({ servings: 2 })
    // scale = 2/2 = 1; ing-a needs 3, ing-b needs 2
    const pantry = makePantry([
      { ingredientId: 'ing-a', quantity: 3 },
      { ingredientId: 'ing-b', quantity: 2 },
    ])

    const result = computeAvailability(recipe, entry, pantry)

    expect(result.tier).toBe('ready')
    expect(result.missingCount).toBe(0)
    expect(result.ingredientAvailability['ing-a']).toBe(true)
    expect(result.ingredientAvailability['ing-b']).toBe(true)
  })

  it('some missing: one ingredient below required → tier=almost, missingCount=1, that ingredient false', () => {
    const recipe = makeRecipe()
    const entry = makeEntry({ servings: 2 })
    // ing-a needs 3, only 2 in pantry → missing; ing-b needs 2, has 5 → ok
    const pantry = makePantry([
      { ingredientId: 'ing-a', quantity: 2 },
      { ingredientId: 'ing-b', quantity: 5 },
    ])

    const result = computeAvailability(recipe, entry, pantry)

    expect(result.tier).toBe('almost')
    expect(result.missingCount).toBe(1)
    expect(result.ingredientAvailability['ing-a']).toBe(false)
    expect(result.ingredientAvailability['ing-b']).toBe(true)
  })

  it('all missing but within the 4-ingredient threshold → tier=almost, all values false', () => {
    const recipe = makeRecipe()
    const entry = makeEntry({ servings: 2 })
    // No pantry items at all
    const pantry: PantryItem[] = []

    const result = computeAvailability(recipe, entry, pantry)

    expect(result.tier).toBe('almost')
    expect(result.missingCount).toBe(2)
    expect(result.ingredientAvailability['ing-a']).toBe(false)
    expect(result.ingredientAvailability['ing-b']).toBe(false)
  })

  it('more than 4 missing → tier=far', () => {
    const recipe = makeRecipe({
      ingredients: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ ingredientId: `ing-${id}`, quantity: 1 })),
    })
    const entry = makeEntry({ servings: 2 })

    const result = computeAvailability(recipe, entry, [])

    expect(result.tier).toBe('far')
    expect(result.missingCount).toBe(5)
  })

  it('zero-servings guard: recipe.servings=0 → scale=1, comparisons still work', () => {
    const recipe = makeRecipe({ servings: 0 })
    const entry = makeEntry({ servings: 4 })
    // scale = 1 (guard); ing-a needs 3*1=3, ing-b needs 2*1=2
    const pantry = makePantry([
      { ingredientId: 'ing-a', quantity: 3 },
      { ingredientId: 'ing-b', quantity: 2 },
    ])

    const result = computeAvailability(recipe, entry, pantry)

    expect(result.tier).toBe('ready')
    expect(result.missingCount).toBe(0)
    expect(result.ingredientAvailability['ing-a']).toBe(true)
    expect(result.ingredientAvailability['ing-b']).toBe(true)
  })

  it('ingredient absent from pantry: treated as 0 quantity → not sufficient', () => {
    const recipe = makeRecipe({
      ingredients: [{ ingredientId: 'ing-z', quantity: 1 }],
    })
    const entry = makeEntry({ servings: 2 })
    // ing-z is not in pantry at all
    const pantry = makePantry([{ ingredientId: 'ing-other', quantity: 10 }])

    const result = computeAvailability(recipe, entry, pantry)

    expect(result.ingredientAvailability['ing-z']).toBe(false)
    expect(result.tier).toBe('almost')
    expect(result.missingCount).toBe(1)
  })

  it('recipe with no ingredients: tier=ready, missingCount=0', () => {
    const recipe = makeRecipe({ ingredients: [] })
    const entry = makeEntry({ servings: 2 })
    const pantry: PantryItem[] = []

    const result = computeAvailability(recipe, entry, pantry)

    expect(result.tier).toBe('ready')
    expect(result.missingCount).toBe(0)
    expect(result.ingredientAvailability).toEqual({})
  })
})
