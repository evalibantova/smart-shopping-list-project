import { MealPlanEntry } from '../../../types/mealPlan'

const STORAGE_KEY = 'slist_meal_plan'

function readAll(): MealPlanEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as MealPlanEntry[]) : []
  } catch {
    return []
  }
}

function writeAll(entries: MealPlanEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function getAll(): MealPlanEntry[] {
  return readAll()
}

export function create(entry: MealPlanEntry): MealPlanEntry {
  const existing = readAll()
  writeAll([...existing, entry])
  return entry
}

export function update(id: string, patch: Omit<Partial<MealPlanEntry>, 'id'>): MealPlanEntry {
  const existing = readAll()
  const index = existing.findIndex((e) => e.id === id)
  if (index === -1) throw new Error(`MealPlanEntry not found: ${id}`)
  const updated: MealPlanEntry = { ...existing[index], ...patch }
  existing[index] = updated
  writeAll(existing)
  return updated
}

export function remove(id: string): void {
  const existing = readAll()
  writeAll(existing.filter((e) => e.id !== id))
}
