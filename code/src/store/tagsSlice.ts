import type { Tag } from '../types'

const KEY = 'slist_tags'

function loadTags(): Tag[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

function saveTags(tags: Tag[]) {
  localStorage.setItem(KEY, JSON.stringify(tags))
}

export interface TagsSlice {
  tags: Tag[]
  loadTags: () => void
  addTag: (name: string, color: string) => Tag
}

export const createTagsSlice = (set: (fn: (s: any) => any) => void): TagsSlice => ({
  tags: [],

  loadTags() {
    set(() => ({ tags: loadTags() }))
  },

  addTag(name, color) {
    const tag: Tag = { id: crypto.randomUUID(), name, color }
    const all = loadTags()
    saveTags([...all, tag])
    set((s: any) => ({ tags: [...s.tags, tag] }))
    return tag
  },
})
