import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store'
import { create, remove, update, getAll } from '../features/meal-planner/services/mealPlanService'
import type { MealPlanEntry } from '../types/mealPlan'

// Real combined store + real service + jsdom localStorage (no mocks).

function makeEntry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return { id: 'e1', date: '2026-10-07', slot: 'lunch', recipeId: 'r-1', servings: 2, ...overrides }
}

describe('meal plan store ↔ localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ entries: [], recipes: [] })
  })

  it('initMealPlan hydrates entries from localStorage', () => {
    create(makeEntry({ id: 'a' }))
    create(makeEntry({ id: 'b', slot: 'dinner' }))
    useStore.getState().initMealPlan()
    expect(useStore.getState().entries.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('add (store + service) survives a reload', () => {
    const entry = makeEntry()
    useStore.getState().addEntry(entry)
    create(entry)
    useStore.setState({ entries: [] }) // simulate reload
    useStore.getState().initMealPlan()
    expect(useStore.getState().entries).toEqual([entry])
  })

  it('remove (store + service) stays removed after a reload', () => {
    const entry = makeEntry()
    useStore.getState().addEntry(entry)
    create(entry)
    useStore.getState().removeEntry(entry.id)
    remove(entry.id)
    useStore.getState().initMealPlan()
    expect(useStore.getState().entries).toEqual([])
    expect(getAll()).toEqual([])
  })

  it('cooked toggle persists across a reload', () => {
    const entry = makeEntry()
    useStore.getState().addEntry(entry)
    create(entry)
    useStore.getState().updateEntry(entry.id, { cooked: true })
    update(entry.id, { cooked: true })
    useStore.getState().initMealPlan()
    expect(useStore.getState().entries[0].cooked).toBe(true)
  })

  it('update throws for an unknown id, so callers can roll back the store', () => {
    expect(() => update('missing', { cooked: true })).toThrow()
  })

  it('combined store keeps recipes and entries independent', () => {
    useStore.getState().addEntry(makeEntry())
    expect(useStore.getState().recipes).toEqual([])
    expect(useStore.getState().entries).toHaveLength(1)
  })
})
