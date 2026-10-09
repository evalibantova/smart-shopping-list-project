import { describe, it, expect, beforeEach } from 'vitest'
import { getAll, create, update, remove } from '../features/pantry/services/pantryService'

describe('pantryService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('(a) getAll returns [] on empty storage', () => {
    expect(getAll()).toEqual([])
  })

  it('(b) create({ingredientId, quantity: 2}) returns item with id and maxStock: 6', () => {
    const item = create({ ingredientId: 'ing-1', quantity: 2 })
    expect(item.id).toBeTruthy()
    expect(item.ingredientId).toBe('ing-1')
    expect(item.quantity).toBe(2)
    expect(item.maxStock).toBe(6)
  })

  it('(c) create persists to localStorage', () => {
    create({ ingredientId: 'ing-2', quantity: 3 })
    const all = getAll()
    expect(all).toHaveLength(1)
    expect(all[0].ingredientId).toBe('ing-2')
  })

  it('(d) update(id, { quantity: 5 }) returns updated item and persists', () => {
    const item = create({ ingredientId: 'ing-3', quantity: 2 })
    const updated = update(item.id, { quantity: 5 })
    expect(updated.quantity).toBe(5)
    expect(updated.maxStock).toBe(6) // unchanged
    const all = getAll()
    expect(all[0].quantity).toBe(5)
  })

  it('(e) remove(id) removes from storage', () => {
    const item = create({ ingredientId: 'ing-4', quantity: 1 })
    remove(item.id)
    expect(getAll()).toHaveLength(0)
  })

  it('(f) getAll() after remove returns remaining items', () => {
    const a = create({ ingredientId: 'ing-5', quantity: 1 })
    const b = create({ ingredientId: 'ing-6', quantity: 2 })
    remove(a.id)
    const remaining = getAll()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(b.id)
  })

  it('(g) update(id, patch) throws when id does not exist', () => {
    expect(() => update('nonexistent-id', { quantity: 5 })).toThrow('PantryItem not found')
  })
})
