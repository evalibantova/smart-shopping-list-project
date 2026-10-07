import { describe, it, expect, beforeEach } from 'vitest'
import { getAll, create, update, remove } from '../features/meal-planner/services/mealPlanService'

describe('mealPlanService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('(a) getAll returns [] when key is absent', () => {
    expect(getAll()).toEqual([])
  })

  it('(b) create returns entry with the provided id and correct fields', () => {
    const entry = create({ id: 'test-id-1', date: '2026-10-07', slot: 'lunch', recipeId: 'r-1', servings: 2 })
    expect(entry.id).toBe('test-id-1')
    expect(entry.date).toBe('2026-10-07')
    expect(entry.slot).toBe('lunch')
    expect(entry.recipeId).toBe('r-1')
    expect(entry.servings).toBe(2)
  })

  it('(c) getAll after create returns the created entry', () => {
    create({ id: 'test-id-2', date: '2026-10-07', slot: 'lunch', recipeId: 'r-1', servings: 2 })
    const all = getAll()
    expect(all).toHaveLength(1)
    expect(all[0].recipeId).toBe('r-1')
  })

  it('(d) update merges patch and persists', () => {
    const entry = create({ id: 'test-id-3', date: '2026-10-07', slot: 'lunch', recipeId: 'r-1', servings: 2 })
    update(entry.id, { cooked: true })
    const all = getAll()
    expect(all[0].cooked).toBe(true)
    expect(all[0].servings).toBe(2)
  })

  it('(e) remove deletes entry', () => {
    const entry = create({ id: 'test-id-5', date: '2026-10-07', slot: 'lunch', recipeId: 'r-1', servings: 2 })
    remove(entry.id)
    expect(getAll()).toHaveLength(0)
  })
})
