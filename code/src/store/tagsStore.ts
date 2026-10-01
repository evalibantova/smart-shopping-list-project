import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Tag } from '../types/recipe'

interface TagsState {
  tags: Tag[]
  addTag: (name: string, color: string) => Tag
}

export const useTagsStore = create<TagsState>()(
  persist(
    (set) => ({
      tags: [],
      addTag(name, color) {
        const tag: Tag = { id: crypto.randomUUID(), name, color }
        set(s => ({ tags: [...s.tags, tag] }))
        return tag
      },
    }),
    { name: 'slist_tags' }
  )
)
