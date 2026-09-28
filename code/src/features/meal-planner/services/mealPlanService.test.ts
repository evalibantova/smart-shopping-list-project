import { describe, it, expect } from 'vitest'
import { mealPlanService } from './mealPlanService'
import type { MealPlanEntry } from '../../../types'

const BASE: Omit<MealPlanEntry, 'id'> = {
  date: '2026-09-22',
  slot: 'lunch',
  recipeId: 'rec-1',
  servings: 2,
}

describe('mealPlanService', () => {
  it('getAll returns empty array when localStorage is empty', () => {
    expect(mealPlanService.getAll()).toEqual([])
  })

  it('create stores an entry and assigns a UUID id', () => {
    const created = mealPlanService.create(BASE)
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.date).toBe('2026-09-22')
    expect(mealPlanService.getAll()).toHaveLength(1)
  })

  it('create appends multiple entries independently', () => {
    mealPlanService.create(BASE)
    mealPlanService.create({ ...BASE, slot: 'dinner' })
    expect(mealPlanService.getAll()).toHaveLength(2)
  })

  it('update patches the matching entry', () => {
    const e = mealPlanService.create(BASE)
    mealPlanService.update({ ...e, servings: 6 })
    expect(mealPlanService.getAll()[0].servings).toBe(6)
  })

  it('update sets cooked flag', () => {
    const e = mealPlanService.create(BASE)
    mealPlanService.update({ ...e, cooked: true })
    expect(mealPlanService.getAll()[0].cooked).toBe(true)
  })

  it('delete removes the entry', () => {
    const e1 = mealPlanService.create(BASE)
    const e2 = mealPlanService.create({ ...BASE, slot: 'dinner' })
    mealPlanService.delete(e1.id)
    const all = mealPlanService.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(e2.id)
  })

  it('delete on unknown id is a no-op', () => {
    mealPlanService.create(BASE)
    mealPlanService.delete('unknown')
    expect(mealPlanService.getAll()).toHaveLength(1)
  })
})
