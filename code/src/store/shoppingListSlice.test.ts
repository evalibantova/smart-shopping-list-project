import { describe, it, expect } from 'vitest'
import { shoppingListSelectors } from './shoppingListSlice'
import type { Ingredient, MealPlanEntry, PantryItem, Recipe } from '../types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function mondayOfCurrentWeek(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function nextWeek(): string {
  const d = new Date()
  d.setDate(d.getDate() + 8)
  return d.toISOString().slice(0, 10)
}

const ING_ONION: Ingredient = { id: 'ing-1', name: 'Onion', default_unit: 'pcs', category: 'Produce' }
const ING_FLOUR: Ingredient = { id: 'ing-2', name: 'Flour', default_unit: 'g', category: 'Pantry & Dry Goods' }
const ING_MILK: Ingredient = { id: 'ing-3', name: 'Milk', default_unit: 'ml', category: 'Dairy' }

const RECIPE_A: Recipe = {
  id: 'rec-a',
  name: 'Pancakes',
  emoji: '🥞',
  servings: 2,
  tagNames: [],
  ingredients: [
    { ingredientId: 'ing-2', quantity: 200 },
    { ingredientId: 'ing-3', quantity: 300 },
  ],
  notes: '',
}

const RECIPE_B: Recipe = {
  id: 'rec-b',
  name: 'French Onion Soup',
  emoji: '🧅',
  servings: 4,
  tagNames: [],
  ingredients: [{ ingredientId: 'ing-1', quantity: 8 }],
  notes: '',
}

function entry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: 'mp-1',
    date: today(),
    slot: 'lunch',
    recipeId: 'rec-a',
    servings: 2,
    ...overrides,
  }
}

const NO_PANTRY: PantryItem[] = []
const ALL_INGS = [ING_ONION, ING_FLOUR, ING_MILK]

describe('shoppingListSelectors.selectShoppingItems', () => {
  it('returns empty list when no meal plan entries exist', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [],
      recipes: [RECIPE_A],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result).toHaveLength(0)
  })

  it('returns ingredients from a planned meal at full quantity when pantry is empty', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ recipeId: 'rec-a', servings: 2 })],
      recipes: [RECIPE_A, RECIPE_B],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result).toHaveLength(2)
    const flour = result.find(i => i.ingredientId === 'ing-2')
    expect(flour?.needed).toBe(200)
    expect(flour?.deficit).toBe(200)
    const milk = result.find(i => i.ingredientId === 'ing-3')
    expect(milk?.needed).toBe(300)
    expect(milk?.deficit).toBe(300)
  })

  it('scales ingredient quantities to planned servings', () => {
    // Recipe is for 2 servings; we plan 4 — quantities should double
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ recipeId: 'rec-a', servings: 4 })],
      recipes: [RECIPE_A],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    const flour = result.find(i => i.ingredientId === 'ing-2')
    expect(flour?.needed).toBe(400)
    expect(flour?.deficit).toBe(400)
  })

  it('subtracts pantry quantities from the deficit', () => {
    const pantry: PantryItem[] = [
      { id: 'p-1', ingredientId: 'ing-2', quantity: 100, maxStock: 500 },
    ]
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ recipeId: 'rec-a', servings: 2 })],
      recipes: [RECIPE_A],
      pantry,
      ingredientsDb: ALL_INGS,
    })
    const flour = result.find(i => i.ingredientId === 'ing-2')
    expect(flour?.needed).toBe(200)
    expect(flour?.pantryQty).toBe(100)
    expect(flour?.deficit).toBe(100)
  })

  it('excludes items where pantry fully covers the need', () => {
    const pantry: PantryItem[] = [
      { id: 'p-1', ingredientId: 'ing-2', quantity: 500, maxStock: 1000 },
      { id: 'p-2', ingredientId: 'ing-3', quantity: 500, maxStock: 1000 },
    ]
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ recipeId: 'rec-a', servings: 2 })],
      recipes: [RECIPE_A],
      pantry,
      ingredientsDb: ALL_INGS,
    })
    expect(result).toHaveLength(0)
  })

  it('excludes cooked meal plan entries', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ recipeId: 'rec-a', servings: 2, cooked: true })],
      recipes: [RECIPE_A],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result).toHaveLength(0)
  })

  it('excludes entries outside the current week', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ date: nextWeek() })],
      recipes: [RECIPE_A],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result).toHaveLength(0)
  })

  it('aggregates the same ingredient across multiple meals', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [
        entry({ id: 'mp-1', recipeId: 'rec-a', servings: 2 }),
        entry({ id: 'mp-2', recipeId: 'rec-a', servings: 2, slot: 'dinner' }),
      ],
      recipes: [RECIPE_A],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    const flour = result.find(i => i.ingredientId === 'ing-2')
    expect(flour?.needed).toBe(400)
    expect(flour?.deficit).toBe(400)
  })

  it('includes entries from any day within the current week', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ date: mondayOfCurrentWeek() })],
      recipes: [RECIPE_A],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns items sorted by category then name', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [
        entry({ id: 'mp-1', recipeId: 'rec-a', servings: 2 }),
        entry({ id: 'mp-2', recipeId: 'rec-b', servings: 4, slot: 'dinner' }),
      ],
      recipes: [RECIPE_A, RECIPE_B],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result.length).toBe(3)
    const categories = result.map(i => i.category)
    const sorted = [...categories].sort((a, b) => a.localeCompare(b))
    expect(categories).toEqual(sorted)
  })

  it('skips recipe ingredients with no matching ingredientsDb entry', () => {
    const recipeWithUnknown: Recipe = {
      ...RECIPE_A,
      ingredients: [{ ingredientId: 'unknown-id', quantity: 100 }],
    }
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ recipeId: RECIPE_A.id })],
      recipes: [recipeWithUnknown],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result).toHaveLength(0)
  })

  it('skips meal plan entries with no matching recipe', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ recipeId: 'nonexistent' })],
      recipes: [RECIPE_A],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result).toHaveLength(0)
  })

  it('exposes ingredient metadata on each shopping item', () => {
    const result = shoppingListSelectors.selectShoppingItems({
      mealPlan: [entry({ recipeId: 'rec-b', servings: 4 })],
      recipes: [RECIPE_B],
      pantry: NO_PANTRY,
      ingredientsDb: ALL_INGS,
    })
    expect(result[0]).toMatchObject({
      ingredientId: 'ing-1',
      name: 'Onion',
      unit: 'pcs',
      category: 'Produce',
    })
  })
})
