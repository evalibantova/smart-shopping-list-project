import { describe, it, expect, beforeEach } from 'vitest'
import { recipeService } from '../features/recipes/services/recipeService'

describe('recipeService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('(a) getAll() returns [] when slist_recipes is absent', () => {
    const result = recipeService.getAll()
    expect(result).toEqual([])
  })

  it('(b) create() returns a recipe with UUID id and createdAt, and persists it', () => {
    const data = {
      emoji: '🍝',
      name: 'Spaghetti Bolognese',
      servings: 4,
      tagIds: [],
      ingredients: [],
      notes: '',
    }

    const recipe = recipeService.create(data)

    expect(typeof recipe.id).toBe('string')
    expect(recipe.id.length).toBeGreaterThan(0)
    expect(typeof recipe.createdAt).toBe('number')
    expect(recipe.createdAt).toBeGreaterThan(0)
    expect(recipe.name).toBe('Spaghetti Bolognese')
    expect(recipe.emoji).toBe('🍝')
    expect(recipe.servings).toBe(4)

    // Verify persisted
    const raw = localStorage.getItem('slist_recipes')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe(recipe.id)
  })

  it('(c) getAll() after create() returns that recipe', () => {
    const data = {
      emoji: '🥗',
      name: 'Caesar Salad',
      servings: 2,
      tagIds: [],
      ingredients: [],
      notes: 'Toss well',
    }

    const created = recipeService.create(data)
    const all = recipeService.getAll()

    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(created.id)
    expect(all[0].name).toBe('Caesar Salad')
  })

  it('(d) update() merges fields and persists', () => {
    const created = recipeService.create({
      emoji: '🍕',
      name: 'Margherita Pizza',
      servings: 2,
      tagIds: [],
      ingredients: [],
      notes: '',
    })

    const updated = recipeService.update(created.id, { name: 'Pepperoni Pizza', servings: 4 })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('Pepperoni Pizza')
    expect(updated.servings).toBe(4)
    expect(updated.emoji).toBe('🍕') // unchanged

    const all = recipeService.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Pepperoni Pizza')
    expect(all[0].servings).toBe(4)
  })

  it('(e) delete() removes recipe from stored array', () => {
    const r1 = recipeService.create({
      emoji: '🥩',
      name: 'Steak',
      servings: 1,
      tagIds: [],
      ingredients: [],
      notes: '',
    })
    const r2 = recipeService.create({
      emoji: '🍜',
      name: 'Ramen',
      servings: 2,
      tagIds: [],
      ingredients: [],
      notes: '',
    })

    expect(recipeService.getAll()).toHaveLength(2)

    recipeService.delete(r1.id)

    const all = recipeService.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(r2.id)
    expect(all.some((r) => r.id === r1.id)).toBe(false)
  })
})
