import { describe, it, expect } from 'vitest'
import type { Recipe } from '../types/recipes'

// ---------------------------------------------------------------------------
// Pure filter logic extracted from features/recipes/index.tsx
// ---------------------------------------------------------------------------
interface Tag {
  id: string
  name: string
}

function filterRecipes(recipes: Recipe[], tags: Tag[], search: string): Recipe[] {
  return search.trim()
    ? recipes.filter((r) => {
        const q = search.toLowerCase()
        if (r.name.toLowerCase().includes(q)) return true
        const recipeTags = tags.filter((t) => r.tagIds.includes(t.id))
        return recipeTags.some((t) => t.name.toLowerCase().includes(q))
      })
    : recipes
}

// ---------------------------------------------------------------------------
// Pure servings scaler logic extracted from components/shared/RecipeDetail.tsx
// ---------------------------------------------------------------------------
function scaleQty(quantity: number, baseServings: number, displayServings: number): number {
  const scale = displayServings / baseServings
  return Math.round(quantity * scale * 100) / 100
}

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
    const quickTag: Tag = { id: 'tag-1', name: 'Quick Meals' }
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
    expect(scaleQty(200, 4, 8)).toBe(400)
  })

  it('(f) halve servings halves the quantity', () => {
    expect(scaleQty(200, 4, 2)).toBe(100)
  })

  it('(g) non-even division rounds to 2 decimal places', () => {
    // base=3, displayServings=1, qty=100 → scale=1/3 → 33.3333... → rounds to 33.33
    expect(scaleQty(100, 3, 1)).toBe(33.33)
  })
})
