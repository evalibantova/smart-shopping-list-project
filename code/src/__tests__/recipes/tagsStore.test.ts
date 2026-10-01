import { describe, it, expect, beforeEach } from 'vitest'
import { useTagsStore } from '../../store/tagsStore'

function resetStore() {
  useTagsStore.setState({ tags: [] })
  localStorage.clear()
}

describe('AC11 — Tag creation and persistence', () => {
  beforeEach(resetStore)

  it('addTag() returns a tag object with a string id', () => {
    const tag = useTagsStore.getState().addTag('Vegetarian', '#4caf50')
    expect(typeof tag.id).toBe('string')
    expect(tag.id.length).toBeGreaterThan(0)
  })

  it('addTag() sets the correct name', () => {
    const tag = useTagsStore.getState().addTag('Quick', '#f07045')
    expect(tag.name).toBe('Quick')
  })

  it('addTag() sets the correct color', () => {
    const tag = useTagsStore.getState().addTag('Quick', '#f07045')
    expect(tag.color).toBe('#f07045')
  })

  it('addTag() appends the tag to the store', () => {
    useTagsStore.getState().addTag('Vegetarian', '#4caf50')
    expect(useTagsStore.getState().tags).toHaveLength(1)
  })

  it('multiple addTag() calls each generate unique ids', () => {
    const a = useTagsStore.getState().addTag('A', '#f07045')
    const b = useTagsStore.getState().addTag('B', '#f07045')
    expect(a.id).not.toBe(b.id)
  })

  it('tags are persisted to localStorage under slist_tags key', () => {
    useTagsStore.getState().addTag('Vegetarian', '#4caf50')
    const stored = localStorage.getItem('slist_tags')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.tags).toHaveLength(1)
    expect(parsed.state.tags[0].name).toBe('Vegetarian')
  })

  it('added tag is immediately readable from the store', () => {
    useTagsStore.getState().addTag('Weekend', '#f5a623')
    const tags = useTagsStore.getState().tags
    expect(tags.some(t => t.name === 'Weekend')).toBe(true)
  })

  it('second addTag() call accumulates to two tags', () => {
    useTagsStore.getState().addTag('A', '#f07045')
    useTagsStore.getState().addTag('B', '#4caf50')
    expect(useTagsStore.getState().tags).toHaveLength(2)
  })
})
