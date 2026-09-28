import { describe, it, expect } from 'vitest'
import { recipeService } from './recipeService'
import type { Recipe } from '../../../types'

const BASE: Omit<Recipe, 'id'> = {
  name: 'Pasta',
  emoji: '🍝',
  servings: 2,
  tagNames: ['quick'],
  ingredients: [{ ingredientId: 'ing-1', quantity: 200 }],
  notes: 'Boil water',
}

describe('recipeService', () => {
  it('getAll returns empty array when localStorage is empty', () => {
    expect(recipeService.getAll()).toEqual([])
  })

  it('create stores a recipe and returns it with a UUID id', () => {
    const created = recipeService.create(BASE)
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.name).toBe('Pasta')
    const all = recipeService.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(created.id)
  })

  it('create appends to existing recipes', () => {
    recipeService.create(BASE)
    recipeService.create({ ...BASE, name: 'Risotto' })
    expect(recipeService.getAll()).toHaveLength(2)
  })

  it('update replaces the matching recipe', () => {
    const created = recipeService.create(BASE)
    recipeService.update({ ...created, name: 'Tagliatelle' })
    const all = recipeService.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Tagliatelle')
  })

  it('update does not affect other recipes', () => {
    const r1 = recipeService.create(BASE)
    const r2 = recipeService.create({ ...BASE, name: 'Risotto' })
    recipeService.update({ ...r1, name: 'Changed' })
    const all = recipeService.getAll()
    expect(all.find(r => r.id === r2.id)?.name).toBe('Risotto')
  })

  it('delete removes the recipe by id', () => {
    const r1 = recipeService.create(BASE)
    const r2 = recipeService.create({ ...BASE, name: 'Risotto' })
    recipeService.delete(r1.id)
    const all = recipeService.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(r2.id)
  })

  it('delete on unknown id is a no-op', () => {
    recipeService.create(BASE)
    recipeService.delete('does-not-exist')
    expect(recipeService.getAll()).toHaveLength(1)
  })
})
