import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { mealPlannerSlice } from '../store/mealPlannerSlice'
import type { MealPlannerSlice } from '../store/mealPlannerSlice'
import type { MealPlanEntry } from '../types/mealPlan'

vi.mock('../features/meal-planner/services/mealPlanService', () => ({
  getAll: () => [],
  create: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}))

function makeEntry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: crypto.randomUUID(),
    date: '2026-10-07',
    slot: 'lunch',
    recipeId: 'recipe-1',
    servings: 2,
    ...overrides,
  }
}

function makeStore() {
  return createStore<MealPlannerSlice>()((...a) => mealPlannerSlice(...a))
}

describe('mealPlannerSlice mutations', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    store = makeStore()
  })

  it('(a) addEntry adds the entry to state', () => {
    const entry = makeEntry({ id: 'e1' })
    store.getState().addEntry(entry)
    expect(store.getState().entries).toContainEqual(entry)
  })

  it('(b) addEntry × 2 accumulates both entries', () => {
    const e1 = makeEntry({ id: 'e1' })
    const e2 = makeEntry({ id: 'e2', slot: 'dinner' })
    store.getState().addEntry(e1)
    store.getState().addEntry(e2)
    expect(store.getState().entries).toHaveLength(2)
  })

  it('(c) removeEntry removes by id', () => {
    const e1 = makeEntry({ id: 'e1' })
    const e2 = makeEntry({ id: 'e2' })
    store.getState().addEntry(e1)
    store.getState().addEntry(e2)
    store.getState().removeEntry('e1')
    const ids = store.getState().entries.map((e) => e.id)
    expect(ids).not.toContain('e1')
    expect(ids).toContain('e2')
  })

  it('(d) removeEntry with unknown id is a no-op', () => {
    const e1 = makeEntry({ id: 'e1' })
    store.getState().addEntry(e1)
    store.getState().removeEntry('does-not-exist')
    expect(store.getState().entries).toHaveLength(1)
  })

  it('(e) updateEntry merges patch fields', () => {
    const e1 = makeEntry({ id: 'e1', servings: 2 })
    store.getState().addEntry(e1)
    store.getState().updateEntry('e1', { servings: 4, cooked: true })
    const updated = store.getState().entries.find((e) => e.id === 'e1')
    expect(updated?.servings).toBe(4)
    expect(updated?.cooked).toBe(true)
    expect(updated?.slot).toBe('lunch')
  })
})
