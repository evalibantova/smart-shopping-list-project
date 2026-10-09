import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { pantrySlice } from '../store/pantrySlice'
import type { PantrySlice } from '../store/pantrySlice'
import * as pantryService from '../features/pantry/services/pantryService'
import { buildCookDeltas } from '../features/meal-planner/MealPlanOverlay'
import type { Recipe } from '../types/recipes'
import type { MealPlanEntry } from '../types/mealPlan'

function makeStore() {
  return createStore<PantrySlice>()((...a) => pantrySlice(...a))
}

describe('batchUpdatePantry', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    localStorage.clear()
    store = makeStore()
  })

  it('(a) deducts matched ingredient: qty=3, delta=-1.5 → qty=1.5', () => {
    pantryService.create({ ingredientId: 'ing-1', quantity: 3, maxStock: 9 })
    store.getState().initPantry()

    store.getState().batchUpdatePantry([{ ingredientId: 'ing-1', delta: -1.5 }])

    const result = store.getState().pantryItems.find((i) => i.ingredientId === 'ing-1')
    expect(result?.quantity).toBe(1.5)
  })

  it('(b) floors at 0: qty=1, delta=-3 → qty=0', () => {
    pantryService.create({ ingredientId: 'ing-2', quantity: 1, maxStock: 3 })
    store.getState().initPantry()

    store.getState().batchUpdatePantry([{ ingredientId: 'ing-2', delta: -3 }])

    const result = store.getState().pantryItems.find((i) => i.ingredientId === 'ing-2')
    expect(result?.quantity).toBe(0)
  })

  it('(c) skips unknown ingredientId silently; other items unaffected', () => {
    pantryService.create({ ingredientId: 'ing-3', quantity: 5, maxStock: 15 })
    store.getState().initPantry()

    store.getState().batchUpdatePantry([{ ingredientId: 'unknown-ing', delta: -2 }])

    const unchanged = store.getState().pantryItems.find((i) => i.ingredientId === 'ing-3')
    expect(unchanged?.quantity).toBe(5)
    expect(store.getState().pantryItems).toHaveLength(1)
  })

  it('(d) rollback on failure: restores all matched items when second service call throws', () => {
    const item1 = pantryService.create({ ingredientId: 'ing-4', quantity: 5, maxStock: 15 })
    const item2 = pantryService.create({ ingredientId: 'ing-5', quantity: 5, maxStock: 15 })
    store.getState().initPantry()

    // Remove item2 from localStorage so pantryService.update throws for it
    const withoutItem2 = pantryService.getAll().filter((i) => i.id !== item2.id)
    localStorage.setItem('slist_pantry', JSON.stringify(withoutItem2))

    expect(() =>
      store.getState().batchUpdatePantry([
        { ingredientId: 'ing-4', delta: -2 },
        { ingredientId: 'ing-5', delta: -2 },
      ])
    ).toThrow()

    // Both items should be restored to original qty in the store
    const restored1 = store.getState().pantryItems.find((i) => i.id === item1.id)
    const restored2 = store.getState().pantryItems.find((i) => i.id === item2.id)
    expect(restored1?.quantity).toBe(5)
    expect(restored2?.quantity).toBe(5)
  })

  it('(e) reverse delta adds back: qty=1.5, delta=+1.5 → qty=3', () => {
    pantryService.create({ ingredientId: 'ing-6', quantity: 1.5, maxStock: 9 })
    store.getState().initPantry()

    store.getState().batchUpdatePantry([{ ingredientId: 'ing-6', delta: 1.5 }])

    const result = store.getState().pantryItems.find((i) => i.ingredientId === 'ing-6')
    expect(result?.quantity).toBe(3)
  })
})

describe('buildCookDeltas', () => {
  const baseRecipe: Recipe = {
    id: 'r1',
    emoji: '🍝',
    name: 'Test Recipe',
    servings: 2,
    tagIds: [],
    ingredients: [{ ingredientId: 'ing-a', quantity: 3 }],
    notes: '',
    createdAt: 0,
  }

  const baseEntry: Pick<MealPlanEntry, 'servings'> = { servings: 4 }

  it('(a) scale formula: entry.servings=4, recipe.servings=2, quantity=3, cooking → delta=-6', () => {
    const result = buildCookDeltas(baseRecipe, baseEntry, true)
    expect(result).toHaveLength(1)
    expect(result[0].ingredientId).toBe('ing-a')
    expect(result[0].delta).toBe(-6)
  })

  it('(b) direction: same inputs, newCooked=false → delta=+6', () => {
    const result = buildCookDeltas(baseRecipe, baseEntry, false)
    expect(result[0].delta).toBe(6)
  })

  it('(c) zero-servings guard: recipe.servings=0 → scale=1, delta=-3 for quantity=3', () => {
    const zeroServingsRecipe: Recipe = { ...baseRecipe, servings: 0 }
    const result = buildCookDeltas(zeroServingsRecipe, { servings: 4 }, true)
    expect(result[0].delta).toBe(-3)
  })

  it('(d) recipe with no ingredients → returns []', () => {
    const emptyRecipe: Recipe = { ...baseRecipe, ingredients: [] }
    const result = buildCookDeltas(emptyRecipe, baseEntry, true)
    expect(result).toHaveLength(0)
  })
})
