import { describe, it, expect, beforeEach } from 'vitest'
import { useIngredientsStore } from '../../store/ingredientsStore'

function resetStore() {
  useIngredientsStore.setState({ ingredientsDb: [] })
  localStorage.clear()
}

describe('AC1 — Seed 76 canonical ingredients on first load', () => {
  beforeEach(resetStore)

  it('seeds exactly 76 ingredients when store is empty', () => {
    useIngredientsStore.getState().seedIngredients()
    expect(useIngredientsStore.getState().ingredientsDb).toHaveLength(76)
  })

  it('seedIngredients is idempotent — calling twice stays at 76', () => {
    useIngredientsStore.getState().seedIngredients()
    useIngredientsStore.getState().seedIngredients()
    expect(useIngredientsStore.getState().ingredientsDb).toHaveLength(76)
  })

  it('each ingredient has id, name, defaultUnit, category', () => {
    useIngredientsStore.getState().seedIngredients()
    const ing = useIngredientsStore.getState().ingredientsDb[0]
    expect(ing).toHaveProperty('id')
    expect(ing).toHaveProperty('name')
    expect(ing).toHaveProperty('defaultUnit')
    expect(ing).toHaveProperty('category')
  })

  it('all defaultUnits are valid metric units', () => {
    useIngredientsStore.getState().seedIngredients()
    const validUnits = ['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp']
    useIngredientsStore.getState().ingredientsDb.forEach(ing => {
      expect(validUnits).toContain(ing.defaultUnit)
    })
  })

  it('all categories are from the allowed set', () => {
    useIngredientsStore.getState().seedIngredients()
    const validCategories = [
      'Produce',
      'Meat',
      'Fish & Seafood',
      'Dairy',
      'Pantry & Dry Goods',
      'Other',
    ]
    useIngredientsStore.getState().ingredientsDb.forEach(ing => {
      expect(validCategories).toContain(ing.category)
    })
  })

  it('all ingredient ids are unique', () => {
    useIngredientsStore.getState().seedIngredients()
    const ids = useIngredientsStore.getState().ingredientsDb.map(i => i.id)
    expect(new Set(ids).size).toBe(76)
  })

  it('skips seeding when store already has entries', () => {
    useIngredientsStore.getState().addIngredient('Existing', 'g', 'Other')
    useIngredientsStore.getState().seedIngredients()
    expect(useIngredientsStore.getState().ingredientsDb).toHaveLength(1)
  })
})

describe('AC2 — localStorage persistence', () => {
  beforeEach(resetStore)

  it('store starts empty before seeding', () => {
    expect(useIngredientsStore.getState().ingredientsDb).toHaveLength(0)
  })

  it('persists ingredientsDb to localStorage under slist_ingredients key after seeding', () => {
    useIngredientsStore.getState().seedIngredients()
    const stored = localStorage.getItem('slist_ingredients')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.ingredientsDb).toHaveLength(76)
  })

  it('persists a newly added ingredient to localStorage', () => {
    useIngredientsStore.getState().addIngredient('Quinoa', 'g', 'Pantry & Dry Goods')
    const stored = localStorage.getItem('slist_ingredients')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.ingredientsDb.some((i: { name: string }) => i.name === 'Quinoa')).toBe(true)
  })
})

describe('AC9 — Store actions: addIngredient', () => {
  beforeEach(resetStore)

  it('returns the new ingredient with correct fields', () => {
    const ing = useIngredientsStore.getState().addIngredient('Quinoa', 'g', 'Pantry & Dry Goods')
    expect(ing.name).toBe('Quinoa')
    expect(ing.defaultUnit).toBe('g')
    expect(ing.category).toBe('Pantry & Dry Goods')
    expect(typeof ing.id).toBe('string')
    expect(ing.id.length).toBeGreaterThan(0)
  })

  it('appends the new ingredient to ingredientsDb', () => {
    useIngredientsStore.getState().addIngredient('Quinoa', 'g', 'Pantry & Dry Goods')
    const db = useIngredientsStore.getState().ingredientsDb
    expect(db.some(i => i.name === 'Quinoa')).toBe(true)
  })

  it('generates unique ids across multiple calls', () => {
    const a = useIngredientsStore.getState().addIngredient('A', 'g', 'Other')
    const b = useIngredientsStore.getState().addIngredient('B', 'ml', 'Other')
    expect(a.id).not.toBe(b.id)
  })

  it('AC8 — newly added ingredient appears in store for future autocomplete', () => {
    useIngredientsStore.getState().seedIngredients()
    const before = useIngredientsStore.getState().ingredientsDb.length
    useIngredientsStore.getState().addIngredient('Quinoa', 'g', 'Pantry & Dry Goods')
    expect(useIngredientsStore.getState().ingredientsDb).toHaveLength(before + 1)
  })
})
