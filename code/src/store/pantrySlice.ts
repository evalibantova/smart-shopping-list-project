import type { PantryItem } from '../types'

const KEY = 'slist_pantry'

function load(): PantryItem[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

function save(items: PantryItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export interface PantrySlice {
  pantry: PantryItem[]
  loadPantry: () => void
  addPantryItem: (item: Omit<PantryItem, 'id'>) => PantryItem
  updatePantryItem: (item: PantryItem) => void
  deletePantryItem: (id: string) => void
}

export const createPantrySlice = (set: (fn: (s: any) => any) => void): PantrySlice => ({
  pantry: [],

  loadPantry() {
    set(() => ({ pantry: load() }))
  },

  addPantryItem(item) {
    const created: PantryItem = { ...item, id: crypto.randomUUID() }
    const all = load()
    save([...all, created])
    set((s: any) => ({ pantry: [...s.pantry, created] }))
    return created
  },

  updatePantryItem(item) {
    const all = load()
    save(all.map(i => i.id === item.id ? item : i))
    set((s: any) => ({ pantry: s.pantry.map((i: PantryItem) => i.id === item.id ? item : i) }))
  },

  deletePantryItem(id) {
    const all = load()
    save(all.filter(i => i.id !== id))
    set((s: any) => ({ pantry: s.pantry.filter((i: PantryItem) => i.id !== id) }))
  },
})
