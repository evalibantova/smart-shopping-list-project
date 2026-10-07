import { Recipe } from '../../../types/recipes'

const STORAGE_KEY = 'slist_recipes'

function readAll(): Recipe[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Recipe[]) : []
  } catch {
    return []
  }
}

function writeAll(recipes: Recipe[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes))
}

export const recipeService = {
  getAll(): Recipe[] {
    return readAll()
  },

  create(data: Omit<Recipe, 'id' | 'createdAt'>): Recipe {
    const existing = readAll()
    const newRecipe: Recipe = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    }
    writeAll([...existing, newRecipe])
    return newRecipe
  },

  update(id: string, data: Partial<Omit<Recipe, 'id' | 'createdAt'>>): Recipe {
    const existing = readAll()
    const index = existing.findIndex((r) => r.id === id)
    if (index === -1) throw new Error(`Recipe not found: ${id}`)
    const updated: Recipe = { ...existing[index], ...data }
    existing[index] = updated
    writeAll(existing)
    return updated
  },

  delete(id: string): void {
    const existing = readAll()
    writeAll(existing.filter((r) => r.id !== id))
  },
}
