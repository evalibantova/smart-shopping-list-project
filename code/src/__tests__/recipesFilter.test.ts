import { describe, it, expect } from 'vitest'
import type { Recipe } from '../types/recipes'
import { filterRecipes } from '../features/recipes/index'
import { scaleQty } from '../components/shared/RecipeDetail'

// ---------------------------------------------------------------------------
// Minimal recipe fixture builder
// ---------------------------------------------------------------------------
function makeRecipe(overrides: Partial<Recipe> & { name: string }): Recipe {
  return {
    id: overrides.id ?? 'r-' + overrides.name,
    emoji: overrides.emoji ?? '🍽️',
    name: overrides.name,
    servings: overrides.servings ?? 4,
    ingredients: overrides.ingredients ?? [],
    notes: overrides.notes ?? '',
    tagIds: overrides.tagIds ?? [],
    createdAt: overrides.createdAt ?? Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Recipe filter logic', () => {
  it('(a) empty — filter with empty recipes array returns []', () => {
    const result = filterRecipes([], [], 'pasta')
    expect(result).toEqual([])
  })

  it('(b) search by name — case-insensitive match returns matching recipe, excludes non-matching', () => {
    const pastaBake = makeRecipe({ name: 'Pasta Bake' })
    const chickenCurry = makeRecipe({ name: 'Chicken Curry' })
    const recipes = [pastaBake, chickenCurry]

    const result = filterRecipes(recipes, [], 'pasta')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Pasta Bake')
  })

  it('(c) search by tag name — returns recipe with matching tag, excludes recipe without it', () => {
    const quickTag = { id: 'tag-1', name: 'Quick Meals', color: '#f07045' }
    const tagged = makeRecipe({ name: 'Stir Fry', tagIds: ['tag-1'] })
    const untagged = makeRecipe({ name: 'Slow Roast', tagIds: [] })
    const recipes = [tagged, untagged]

    const result = filterRecipes(recipes, [quickTag], 'quick')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Stir Fry')
  })

  it('(d) no search term returns all recipes', () => {
    const recipes = [
      makeRecipe({ name: 'Recipe A' }),
      makeRecipe({ name: 'Recipe B' }),
      makeRecipe({ name: 'Recipe C' }),
    ]

    const result = filterRecipes(recipes, [], '')

    expect(result).toHaveLength(3)
    expect(result).toEqual(recipes)
  })
})

describe('Servings scaler logic', () => {
  it('(e) double servings doubles the quantity', () => {
    // scaleQty(qty, displayed, base): displayed=8, base=4 → scale=2
    expect(scaleQty(200, 8, 4)).toBe(400)
  })

  it('(f) halve servings halves the quantity', () => {
    // scaleQty(qty, displayed, base): displayed=2, base=4 → scale=0.5
    expect(scaleQty(200, 2, 4)).toBe(100)
  })

  it('(g) non-even division rounds to 2 decimal places', () => {
    // base=3, displayServings=1, qty=100 → scale=1/3 → 33.3333... → rounds to 33.33
    expect(scaleQty(100, 1, 3)).toBe(33.33)
  })

  it('(h) base=0 divide-by-zero guard — returns qty unchanged', () => {
    // scaleQty(2, 1, 0) → scale defaults to 1 → result = 2
    expect(scaleQty(2, 1, 0)).toBe(2)
  })
})
