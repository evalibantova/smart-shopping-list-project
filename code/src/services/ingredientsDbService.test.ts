import { describe, it, expect } from 'vitest'
import { ingredientsDbService } from './ingredientsDbService'

describe('ingredientsDbService', () => {
  it('getAll returns empty array before seeding', () => {
    expect(ingredientsDbService.getAll()).toEqual([])
  })

  it('seed populates 79 ingredients with UUID ids', () => {
    const seeded = ingredientsDbService.seed()
    expect(seeded).toHaveLength(79)
    seeded.forEach(ing => {
      expect(ing.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(ing.name).toBeTruthy()
      expect(ing.default_unit).toBeTruthy()
      expect(ing.category).toBeTruthy()
    })
  })

  it('seed is idempotent — second call returns same data without duplicating', () => {
    ingredientsDbService.seed()
    ingredientsDbService.seed()
    expect(ingredientsDbService.getAll()).toHaveLength(79)
  })

  it('seed IDs are stable across calls (same data re-read)', () => {
    ingredientsDbService.seed()
    const first = ingredientsDbService.getAll().map(i => i.id)
    const second = ingredientsDbService.getAll().map(i => i.id)
    expect(first).toEqual(second)
  })

  it('create adds a new ingredient to the db', () => {
    ingredientsDbService.seed()
    const created = ingredientsDbService.create('Truffle', 'g', 'Other')
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.name).toBe('Truffle')
    expect(created.default_unit).toBe('g')
    expect(created.category).toBe('Other')
    const all = ingredientsDbService.getAll()
    expect(all).toHaveLength(80)
    expect(all.find(i => i.name === 'Truffle')).toBeDefined()
  })

  it('create defaults category to Other when omitted', () => {
    const created = ingredientsDbService.create('Mystery item', 'pcs')
    expect(created.category).toBe('Other')
  })

  it('getAll returns persisted ingredients', () => {
    ingredientsDbService.seed()
    const all = ingredientsDbService.getAll()
    expect(all.length).toBe(79)
    expect(all[0]).toHaveProperty('id')
    expect(all[0]).toHaveProperty('name')
    expect(all[0]).toHaveProperty('default_unit')
    expect(all[0]).toHaveProperty('category')
  })
})
