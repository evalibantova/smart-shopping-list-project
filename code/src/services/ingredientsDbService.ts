import { IngredientDbEntry } from '../types/ingredients'

const STORAGE_KEY = 'slist_ingredients_db'
const VALID_UNITS = new Set(['g', 'ml', 'kg', 'l', 'pcs', 'cloves', 'tbsp', 'tsp'])

function readAll(): IngredientDbEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as IngredientDbEntry[]) : []
  } catch {
    return []
  }
}

function writeAll(entries: IngredientDbEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export const ingredientsDbService = {
  getAll(): IngredientDbEntry[] {
    return readAll()
  },

  search(query: string): IngredientDbEntry[] {
    if (query.length < 2) return []
    const lower = query.toLowerCase()
    return readAll().filter((e) => e.name.toLowerCase().includes(lower))
  },

  create(name: string, unit: string, category: string): IngredientDbEntry {
    if (!VALID_UNITS.has(unit)) throw new Error(`Invalid unit: ${unit}`)
    const existing = readAll()
    const newEntry: IngredientDbEntry = {
      id: crypto.randomUUID(),
      name,
      default_unit: unit,
      category,
    }
    writeAll([...existing, newEntry])
    return newEntry
  },
}
