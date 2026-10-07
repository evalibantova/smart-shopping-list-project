import { describe, it, expect, vi } from 'vitest'
import { computeShoppingList } from '../features/shopping-list/shoppingListSelector'
import type { MealPlanEntry } from '../types/mealPlan'
import type { Recipe } from '../types/recipes'
import type { IngredientDbEntry } from '../types/ingredients'

vi.mock('../features/meal-planner/services/mealPlanService', () => ({
  getAll: () => [],
  create: vi.fn(),
  remove: vi.fn(),
}))

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
    const result = computeShoppingList([], [RECIPE_PASTA], DB, WEEK_START)
    expect(result).toEqual([])
  })

  it('(b) entry outside current week is excluded', () => {
    const entry = makeEntry({ date: OUT_OF_WEEK_DATE })
    const result = computeShoppingList([entry], [RECIPE_PASTA], DB, WEEK_START)
    expect(result).toHaveLength(0)
  })

  it('(c) cooked entry is excluded', () => {
    const entry = makeEntry({ cooked: true })
    const result = computeShoppingList([entry], [RECIPE_PASTA], DB, WEEK_START)
    expect(result).toHaveLength(0)
  })

  it('(d) single entry produces scaled ShoppingItems', () => {
    const entry = makeEntry({ servings: 4, recipeId: 'recipe-pasta' })
    const result = computeShoppingList([entry], [RECIPE_PASTA], DB, WEEK_START)
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
    const result = computeShoppingList([e1, e2], [RECIPE_PASTA, RECIPE_CHICKEN], DB, WEEK_START)
    // onion: pasta=2*(2/2)=2, chicken=1*(2/2)=1 → total=3
    const onion = result.find((i) => i.ingredientId === 'ing-onion')
    expect(onion?.quantity).toBe(3)
  })

  it('(f) entry with unknown recipe ID is excluded', () => {
    const entry = makeEntry({ recipeId: 'does-not-exist' })
    const result = computeShoppingList([entry], [RECIPE_PASTA], DB, WEEK_START)
    expect(result).toHaveLength(0)
  })

  it('(g) ingredient not in ingredientsDb is excluded from output', () => {
    const entry = makeEntry({ recipeId: 'recipe-pasta' })
    // Only provide CHICKEN in the db — tomato and onion not present
    const result = computeShoppingList([entry], [RECIPE_PASTA], [ING_CHICKEN], WEEK_START)
    expect(result).toHaveLength(0)
  })
})
