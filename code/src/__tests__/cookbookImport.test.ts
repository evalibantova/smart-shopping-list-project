import { describe, it, expect, beforeEach } from 'vitest'
import seed from '../data/cookbookSeed.json'
import { importCookbook, importCookbookIfNeeded, CookbookSeed } from '../data/cookbookImport'
import { ingredientsDbService } from '../services/ingredientsDbService'
import { tagService } from '../features/recipes/services/tagService'
import { recipeService } from '../features/recipes/services/recipeService'

describe('cookbook import', () => {
  beforeEach(() => localStorage.clear())

  it('imports every recipe with all ingredients resolved', () => {
    importCookbook(seed as CookbookSeed)
    const ids = new Set(ingredientsDbService.getAll().map((i) => i.id))
    const recipes = recipeService.getAll()
    expect(recipes).toHaveLength(seed.recipes.length)
    for (const r of recipes) for (const i of r.ingredients) expect(ids.has(i.ingredientId)).toBe(true)
  })

  it('seed quantities use the ingredient default_unit', () => {
    const units = Object.fromEntries(seed.ingredients.map((i) => [i.name, i.default_unit]))
    for (const r of seed.recipes)
      for (const i of r.ingredients) expect(i.unit).toBe(units[i.ingredient])
  })

  it('is idempotent', () => {
    importCookbookIfNeeded()
    importCookbookIfNeeded()
    expect(recipeService.getAll()).toHaveLength(seed.recipes.length)
  })

  it('creates category and main-ingredient tags with distinct colors, none for desserts', () => {
    importCookbook(seed as CookbookSeed)
    const tags = tagService.getAll()
    expect(new Set(tags.map((t) => t.color)).size).toBe(tags.length)
    const bravcove = tags.find((t) => t.name === 'bravčové')!
    const krkovicka = recipeService.getAll().find((r) => r.name === 'Bravčová krkovička na horčici')!
    expect(krkovicka.tagIds).toContain(bravcove.id)
    const dezertId = tags.find((t) => t.name === 'Dezert')!.id
    for (const r of recipeService.getAll().filter((r) => r.tagIds.includes(dezertId)))
      expect(r.tagIds).toHaveLength(1)
  })
})
