import type { PantryItem } from '../types/pantry'

export interface PantryDelta {
  ingredientId: string
  delta: number
}

/**
 * Applies quantity deltas keyed by ingredient, exactly like `PUT /api/pantry/batch`: one after the other,
 * clamped at 0 after each, ingredients without a pantry item skipped. Returns a new list; items that did not
 * change keep their identity and the input is never mutated.
 */
export function applyPantryDeltas(items: PantryItem[], deltas: PantryDelta[]): PantryItem[] {
  const changed = new Map<string, PantryItem>()
  for (const { ingredientId, delta } of deltas) {
    const current = items.find((i) => i.ingredientId === ingredientId)
    if (!current) continue
    const base = changed.get(current.id) ?? current
    changed.set(current.id, { ...base, quantity: Math.max(0, base.quantity + delta) })
  }
  return items.map((i) => changed.get(i.id) ?? i)
}
