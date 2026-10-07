import { describe, it, expect, beforeEach } from 'vitest'
import { ingredientsDbService } from '../services/ingredientsDbService'

const CANONICAL_UNITS = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp']

describe('ingredientsDbService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('(a) seedIfEmpty on empty storage writes 76 entries each with UUID id and valid unit', () => {
    ingredientsDbService.seedIfEmpty()
    const all = ingredientsDbService.getAll()
    expect(all).toHaveLength(76)
    for (const entry of all) {
      expect(typeof entry.id).toBe('string')
      expect(entry.id.length).toBeGreaterThan(0)
      expect(entry.name.length).toBeGreaterThan(0)
      expect(CANONICAL_UNITS).toContain(entry.default_unit)
    }
  })

  it('(b) seedIfEmpty when already populated makes no change to count or ids', () => {
    ingredientsDbService.seedIfEmpty()
    const firstIds = ingredientsDbService.getAll().map((e) => e.id)

    ingredientsDbService.seedIfEmpty()
    const secondIds = ingredientsDbService.getAll().map((e) => e.id)

    expect(secondIds).toHaveLength(76)
    expect(secondIds).toEqual(firstIds)
  })

  it('(c) search("chi") returns only matching entries', () => {
    ingredientsDbService.seedIfEmpty()
    const results = ingredientsDbService.search('chi')
    expect(results.length).toBeGreaterThan(0)
    for (const entry of results) {
      expect(entry.name.toLowerCase()).toContain('chi')
    }
    // Expected matches include chicken breast, chicken thigh, chicken stock, chickpeas
    const names = results.map((e) => e.name)
    expect(names).toContain('Chicken breast')
    expect(names).toContain('Chicken thigh')
    expect(names).toContain('Chicken stock')
    expect(names).toContain('Chickpeas')
  })

  it('(d) search("c") returns []', () => {
    ingredientsDbService.seedIfEmpty()
    const results = ingredientsDbService.search('c')
    expect(results).toEqual([])
  })

  it('(e) create("Tahini","tbsp","Other") writes new entry, returns it with UUID id, count becomes 77', () => {
    ingredientsDbService.seedIfEmpty()
    const newEntry = ingredientsDbService.create('Tahini', 'tbsp', 'Other')

    expect(typeof newEntry.id).toBe('string')
    expect(newEntry.id.length).toBeGreaterThan(0)
    expect(newEntry.name).toBe('Tahini')
    expect(newEntry.default_unit).toBe('tbsp')
    expect(newEntry.category).toBe('Other')

    const all = ingredientsDbService.getAll()
    expect(all).toHaveLength(77)
    expect(all.some((e) => e.id === newEntry.id)).toBe(true)
  })
})
