import { describe, it, expect, beforeEach } from 'vitest'
import { ingredientsDbService } from '../services/ingredientsDbService'

const FIXTURES: [string, string][] = [
  ['Chicken breast', 'g'],
  ['Chicken thigh', 'g'],
  ['Chicken stock', 'ml'],
  ['Chickpeas', 'g'],
  ['Garlic', 'cloves'],
]

function seedFixtures() {
  for (const [name, unit] of FIXTURES) ingredientsDbService.create(name, unit, 'Other')
}

describe('ingredientsDbService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('(c) search("chi") returns only matching entries', () => {
    seedFixtures()
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
    seedFixtures()
    const results = ingredientsDbService.search('c')
    expect(results).toEqual([])
  })

  it('(e) create("Tahini","tbsp","Other") writes new entry, returns it with UUID id, count becomes 6', () => {
    seedFixtures()
    const newEntry = ingredientsDbService.create('Tahini', 'tbsp', 'Other')

    expect(typeof newEntry.id).toBe('string')
    expect(newEntry.id.length).toBeGreaterThan(0)
    expect(newEntry.name).toBe('Tahini')
    expect(newEntry.default_unit).toBe('tbsp')
    expect(newEntry.category).toBe('Other')

    const all = ingredientsDbService.getAll()
    expect(all).toHaveLength(6)
    expect(all.some((e) => e.id === newEntry.id)).toBe(true)
  })
})
