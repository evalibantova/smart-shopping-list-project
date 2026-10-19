import { describe, it, expect } from 'vitest'
import { computeCookNowCards } from '../features/cook-now/cookNowSelector'
import type { MealPlanEntry } from '../types/mealPlan'
import type { Recipe } from '../types/recipes'
import type { PantryItem } from '../types/pantry'

const TODAY = '2026-10-09'
const OTHER_DATE = '2026-10-08'

const RECIPE_A: Recipe = {
  id: 'recipe-a',
  emoji: '🍳',
  name: 'Scrambled Eggs',
  servings: 2,
  tagIds: [],
  ingredients: [
    { ingredientId: 'ing-egg', quantity: 4 },
    { ingredientId: 'ing-butter', quantity: 1 },
    { ingredientId: 'ing-salt', quantity: 0.5 },
  ],
  notes: '',
  createdAt: 0,
}

const RECIPE_EMPTY: Recipe = {
  id: 'recipe-empty',
  emoji: '🍽️',
  name: 'Empty Recipe',
  servings: 1,
  tagIds: [],
  ingredients: [],
  notes: '',
  createdAt: 0,
}

function makeEntry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: crypto.randomUUID(),
    date: TODAY,
    slot: 'lunch',
    recipeId: 'recipe-a',
    servings: 2,
    ...overrides,
  }
}

function makePantryItem(ingredientId: string, quantity: number): PantryItem {
  return { id: crypto.randomUUID(), ingredientId, quantity, maxStock: quantity * 2 }
}

describe('computeCookNowCards', () => {
  it('(a) all ingredients in pantry → ready', () => {
    const entry = makeEntry()
    const pantry = [
      makePantryItem('ing-egg', 10),
      makePantryItem('ing-butter', 5),
      makePantryItem('ing-salt', 2),
    ]
    const result = computeCookNowCards([entry], [RECIPE_A], pantry, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].availability).toBe('ready')
    expect(result[0].missingCount).toBe(0)
  })

  it('(b) some ingredients missing → almost with correct missingCount', () => {
    const entry = makeEntry()
    // egg and butter covered, salt missing (need 0.5 per 2 servings at scale 1, pantry has 0)
    const pantry = [
      makePantryItem('ing-egg', 10),
      makePantryItem('ing-butter', 5),
    ]
    const result = computeCookNowCards([entry], [RECIPE_A], pantry, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].availability).toBe('almost')
    expect(result[0].missingCount).toBe(1)
    expect(result[0].totalIngredients).toBe(3)
  })

  it('(c) all ingredients missing → far', () => {
    const entry = makeEntry()
    const result = computeCookNowCards([entry], [RECIPE_A], [], TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].availability).toBe('far')
    expect(result[0].missingCount).toBe(3)
    expect(result[0].totalIngredients).toBe(3)
  })

  it('(d) recipe with no ingredients → ready', () => {
    const entry = makeEntry({ recipeId: 'recipe-empty' })
    const result = computeCookNowCards([entry], [RECIPE_EMPTY], [], TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].availability).toBe('ready')
    expect(result[0].missingCount).toBe(0)
    expect(result[0].totalIngredients).toBe(0)
  })

  it('(e) no entries today → empty array', () => {
    const entry = makeEntry({ date: OTHER_DATE })
    const result = computeCookNowCards([entry], [RECIPE_A], [], TODAY)
    expect(result).toHaveLength(0)
  })

  it('(f) unknown recipeId → entry omitted', () => {
    const entry = makeEntry({ recipeId: 'recipe-does-not-exist' })
    const result = computeCookNowCards([entry], [RECIPE_A], [], TODAY)
    expect(result).toHaveLength(0)
  })

  it('(g) recipe.servings=0 → scale=1, still computes correctly', () => {
    const zeroServingsRecipe: Recipe = { ...RECIPE_A, servings: 0 }
    // With scale=1, need egg=4, butter=1, salt=0.5; pantry has egg=4 exactly (not strictly less)
    // and butter=1 (not strictly less), salt=0 → missing
    const entry = makeEntry({ recipeId: 'recipe-a', servings: 4 })
    const pantry = [
      makePantryItem('ing-egg', 4),
      makePantryItem('ing-butter', 1),
    ]
    expect(() =>
      computeCookNowCards([entry], [zeroServingsRecipe], pantry, TODAY)
    ).not.toThrow()
    const result = computeCookNowCards([entry], [zeroServingsRecipe], pantry, TODAY)
    expect(result).toHaveLength(1)
    // scale=1 → egg need 4, have 4 (not missing); butter need 1, have 1 (not missing); salt need 0.5, have 0 (missing)
    expect(result[0].missingCount).toBe(1)
    expect(result[0].availability).toBe('almost')
  })

  it('(h) slot ordering: dinner before breakfast in store → sorted breakfast first', () => {
    const dinnerEntry = makeEntry({ slot: 'dinner', recipeId: 'recipe-a' })
    const breakfastEntry = makeEntry({ slot: 'breakfast', recipeId: 'recipe-empty' })
    const lunchEntry = makeEntry({ slot: 'lunch', recipeId: 'recipe-a' })
    const result = computeCookNowCards(
      [dinnerEntry, lunchEntry, breakfastEntry],
      [RECIPE_A, RECIPE_EMPTY],
      [],
      TODAY
    )
    expect(result).toHaveLength(3)
    expect(result[0].slot).toBe('breakfast')
    expect(result[1].slot).toBe('lunch')
    expect(result[2].slot).toBe('dinner')
  })

  it('(j) non-unity scale: planning 4 servings of a 2-serving recipe with one-batch pantry → almost', () => {
    // RECIPE_A: servings=2, egg=4, butter=1, salt=0.5
    // entry: servings=4 → scale=2 → need egg=8, butter=2, salt=1
    // pantry covers egg at the scaled need (8) but only one base batch of butter (1) and salt (0.5)
    // egg: 8 >= 8 → not missing; butter: 1 < 2 → missing; salt: 0.5 < 1 → missing
    // missingCount=2 out of 3 → almost
    const entry = makeEntry({ servings: 4, recipeId: 'recipe-a' })
    const pantry = [
      makePantryItem('ing-egg', 8),
      makePantryItem('ing-butter', 1),
      makePantryItem('ing-salt', 0.5),
    ]
    const result = computeCookNowCards([entry], [RECIPE_A], pantry, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].availability).toBe('almost')
    expect(result[0].missingCount).toBe(2)
  })

  it('(i) pantry deduplicates by ingredientId: two pantry entries combine quantities', () => {
    const entry = makeEntry()
    // Two pantry entries for 'ing-egg': 2 + 3 = 5 total, need 4 → covered
    const pantry = [
      makePantryItem('ing-egg', 2),
      makePantryItem('ing-egg', 3),
      makePantryItem('ing-butter', 5),
      makePantryItem('ing-salt', 2),
    ]
    const result = computeCookNowCards([entry], [RECIPE_A], pantry, TODAY)
    expect(result[0].availability).toBe('ready')
    expect(result[0].missingCount).toBe(0)
  })
})
