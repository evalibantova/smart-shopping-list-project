import { Tag } from '../../../types/recipes'

const STORAGE_KEY = 'slist_tags'

function readAll(): Tag[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Tag[]) : []
  } catch {
    return []
  }
}

function writeAll(tags: Tag[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags))
}

export const tagService = {
  getAll(): Tag[] {
    return readAll()
  },

  create(name: string, color: string): Tag {
    const existing = readAll()
    const newTag: Tag = {
      id: crypto.randomUUID(),
      name,
      color,
    }
    writeAll([...existing, newTag])
    return newTag
  },
}
