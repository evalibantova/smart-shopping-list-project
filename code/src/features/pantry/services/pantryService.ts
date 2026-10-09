import type { PantryItem } from '../../../types/pantry'

const STORAGE_KEY = 'slist_pantry'

function readAll(): PantryItem[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PantryItem[]) : []
  } catch {
    return []
  }
}

function writeAll(items: PantryItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function getAll(): PantryItem[] {
  return readAll()
}

export function create(item: Omit<PantryItem, 'id' | 'maxStock'> & { maxStock?: number }): PantryItem {
  const existing = readAll()
  const newItem: PantryItem = {
    id: crypto.randomUUID(),
    ingredientId: item.ingredientId,
    quantity: item.quantity,
    maxStock: item.maxStock ?? Math.max(1, item.quantity * 3),
  }
  writeAll([...existing, newItem])
  return newItem
}

export function update(id: string, patch: Partial<PantryItem>): PantryItem {
  const existing = readAll()
  const index = existing.findIndex((e) => e.id === id)
  if (index === -1) throw new Error(`PantryItem not found: ${id}`)
  const updated: PantryItem = { ...existing[index], ...patch }
  existing[index] = updated
  writeAll(existing)
  return updated
}

export function remove(id: string): void {
  const existing = readAll()
  writeAll(existing.filter((e) => e.id !== id))
}
