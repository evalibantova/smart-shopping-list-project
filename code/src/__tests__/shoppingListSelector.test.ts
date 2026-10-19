import { describe, it, expect } from 'vitest'
import { computeShoppingList } from '../features/shopping-list/shoppingListSelector'
import type { MealPlanEntry } from '../types/mealPlan'
import type { Recipe } from '../types/recipes'
import type { IngredientDbEntry } from '../types/ingredients'
import type { PantryItem } from '../types/pantry'

const ING_TOMATO: IngredientDbEntry = { id: 'ing-tomato', name: 'Tomato', default_unit: 'pcs', category: 'Produce' }
const ING_ONION: IngredientDbEntry = { id: 'ing-onion', name: 'Onion', default_unit: 'pcs', category: 'Produce' }
const ING_CHICKEN: IngredientDbEntry = { id: 'ing-chicken', name: 'Chicken breast', default_unit: 'g', category: 'Meat' }

const RECIPE_PASTA: Recipe = {
  id: 'recipe-pasta',
  emoji: '🍝',
  name: 'Pasta',
  servings: 2,
  tagIds: [],
  ingredients: [
    { ingredientId: 'ing-tomato', quantity: 4 },
    { ingredientId: 'ing-onion', quantity: 2 },
  ],
  notes: '',
  createdAt: 0,
}

const RECIPE_CHICKEN: Recipe = {
  id: 'recipe-chicken',
  emoji: '🍗',
  name: 'Chicken',
  servings: 2,
  tagIds: [],
  ingredients: [
    { ingredientId: 'ing-chicken', quantity: 300 },
    { ingredientId: 'ing-onion', quantity: 1 },
  ],
  notes: '',
  createdAt: 0,
}

// A fixed Monday in the test week
const WEEK_START = new Date('2026-10-05')
const IN_WEEK_DATE = '2026-10-06' // Tuesday
const OUT_OF_WEEK_DATE = '2026-09-28' // previous week

function makeEntry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: crypto.randomUUID(),
    date: IN_WEEK_DATE,
    slot: 'lunch',
    recipeId: 'recipe-pasta',
    servings: 2,
    ...overrides,
  }
}

const DB = [ING_TOMATO, ING_ONION, ING_CHICKEN]

describe('computeShoppingList', () => {
  it('(a) empty entries returns empty list', () => {
    const result = computeShoppingList([], [RECIPE_PASTA], DB, WEEK_START, [])
    expect(result).toEqual([])
  })

  it('(b) entry outside current week is excluded', () => {
    const entry = makeEntry({ date: OUT_OF_WEEK_DATE })
    const result = computeShoppingList([entry], [RECIPE_PASTA], DB, WEEK_START, [])
    expect(result).toHaveLength(0)
  })

  it('(c) cooked entry is excluded', () => {
    const entry = makeEntry({ cooked: true })
    const result = computeShoppingList([entry], [RECIPE_PASTA], DB, WEEK_START, [])
    expect(result).toHaveLength(0)
  })

  it('(d) single entry produces scaled ShoppingItems', () => {
    const entry = makeEntry({ servings: 4, recipeId: 'recipe-pasta' })
    const result = computeShoppingList([entry], [RECIPE_PASTA], DB, WEEK_START, [])
    const tomato = result.find((i) => i.ingredientId === 'ing-tomato')
    const onion = result.find((i) => i.ingredientId === 'ing-onion')
    // recipe base = 2 servings, entry = 4 servings → scale = 2
    expect(tomato?.quantity).toBe(8)
    expect(onion?.quantity).toBe(4)
    expect(tomato?.unit).toBe('pcs')
    expect(tomato?.name).toBe('Tomato')
    expect(tomato?.category).toBe('Produce')
  })

  it('(e) same ingredient from two entries is summed', () => {
    const e1 = makeEntry({ servings: 2, recipeId: 'recipe-pasta' })
    const e2 = makeEntry({ servings: 2, recipeId: 'recipe-chicken' })
    const result = computeShoppingList([e1, e2], [RECIPE_PASTA, RECIPE_CHICKEN], DB, WEEK_START, [])
    // onion: pasta=2*(2/2)=2, chicken=1*(2/2)=1 → total=3
    const onion = result.find((i) => i.ingredientId === 'ing-onion')
    expect(onion?.quantity).toBe(3)
  })

  it('(f) entry with unknown recipe ID is excluded', () => {
    const entry = makeEntry({ recipeId: 'does-not-exist' })
    const result = computeShoppingList([entry], [RECIPE_PASTA], DB, WEEK_START, [])
    expect(result).toHaveLength(0)
  })

  it('(g) ingredient not in ingredientsDb is excluded from output', () => {
    const entry = makeEntry({ recipeId: 'recipe-pasta' })
    // Only provide CHICKEN in the db — tomato and onion not present
    const result = computeShoppingList([entry], [RECIPE_PASTA], [ING_CHICKEN], WEEK_START, [])
    expect(result).toHaveLength(0)
  })

  it('(h) recipe.servings === 0 does not divide-by-zero — scale defaults to 1', () => {
    const zeroServingsRecipe: Recipe = { ...RECIPE_PASTA, servings: 0 }
    const entry = makeEntry({ recipeId: 'recipe-pasta', servings: 4 })
    // Should not throw; returns items at scale 1 (raw quantities)
    expect(() => computeShoppingList([entry], [zeroServingsRecipe], DB, WEEK_START, [])).not.toThrow()
    const result = computeShoppingList([entry], [zeroServingsRecipe], DB, WEEK_START, [])
    const tomato = result.find((i) => i.ingredientId === 'ing-tomato')
    expect(tomato?.quantity).toBe(4) // raw recipe quantity × scale 1
  })

  it('(i) fractional quantities are rounded to 2 decimal places', () => {
    const recipe: Recipe = { ...RECIPE_PASTA, servings: 3 }
    const entry = makeEntry({ servings: 1, recipeId: 'recipe-pasta' })
    // tomato: 4 * (1/3) = 1.333... → rounds to 1.33
    const result = computeShoppingList([entry], [recipe], DB, WEEK_START, [])
    const tomato = result.find((i) => i.ingredientId === 'ing-tomato')
    expect(tomato?.quantity).toBe(1.33)
  })

  it('(j) entries on different days within the same week are both included', () => {
    const e1 = makeEntry({ date: '2026-10-05', servings: 2 }) // Monday
    const e2 = makeEntry({ date: '2026-10-09', servings: 2 }) // Friday
    const result = computeShoppingList([e1, e2], [RECIPE_PASTA], DB, WEEK_START, [])
    const tomato = result.find((i) => i.ingredientId === 'ing-tomato')
    expect(tomato?.quantity).toBe(8) // 4 from each entry (scale=1 each)
  })

  it('(k) pantry covers part of deficit: meal needs 3g A, pantry has 1g A → deficit 2g shown', () => {
    const ING_A: IngredientDbEntry = { id: 'ing-a', name: 'Ingredient A', default_unit: 'g', category: 'Other' }
    const RECIPE_A: Recipe = {
      id: 'recipe-a',
      emoji: '🍲',
      name: 'Recipe A',
      servings: 1,
      tagIds: [],
      ingredients: [{ ingredientId: 'ing-a', quantity: 3 }],
      notes: '',
      createdAt: 0,
    }
    const entry = makeEntry({ recipeId: 'recipe-a', servings: 1 })
    const pantry: PantryItem[] = [{ id: 'p-1', ingredientId: 'ing-a', quantity: 1, maxStock: 6 }]
    const result = computeShoppingList([entry], [RECIPE_A], [ING_A], WEEK_START, pantry)
    const itemA = result.find((i) => i.ingredientId === 'ing-a')
    expect(itemA).toBeDefined()
    expect(itemA?.quantity).toBe(2)
  })

  it('(l) pantry fully covers: meal needs 2g B, pantry has 5g B → B not in result', () => {
    const ING_B: IngredientDbEntry = { id: 'ing-b', name: 'Ingredient B', default_unit: 'g', category: 'Other' }
    const RECIPE_B: Recipe = {
      id: 'recipe-b',
      emoji: '🍲',
      name: 'Recipe B',
      servings: 1,
      tagIds: [],
      ingredients: [{ ingredientId: 'ing-b', quantity: 2 }],
      notes: '',
      createdAt: 0,
    }
    const entry = makeEntry({ recipeId: 'recipe-b', servings: 1 })
    const pantry: PantryItem[] = [{ id: 'p-2', ingredientId: 'ing-b', quantity: 5, maxStock: 10 }]
    const result = computeShoppingList([entry], [RECIPE_B], [ING_B], WEEK_START, pantry)
    expect(result.find((i) => i.ingredientId === 'ing-b')).toBeUndefined()
  })

  it('(m) empty pantryItems: existing behavior unchanged', () => {
    const ING_C: IngredientDbEntry = { id: 'ing-c', name: 'Ingredient C', default_unit: 'g', category: 'Other' }
    const RECIPE_C: Recipe = {
      id: 'recipe-c',
      emoji: '🍲',
      name: 'Recipe C',
      servings: 1,
      tagIds: [],
      ingredients: [{ ingredientId: 'ing-c', quantity: 3 }],
      notes: '',
      createdAt: 0,
    }
    const entry = makeEntry({ recipeId: 'recipe-c', servings: 1 })
    const result = computeShoppingList([entry], [RECIPE_C], [ING_C], WEEK_START, [])
    const itemC = result.find((i) => i.ingredientId === 'ing-c')
    expect(itemC).toBeDefined()
    expect(itemC?.quantity).toBe(3)
  })
})
