import { describe, it, expect, beforeEach } from 'vitest'
import { tagService } from '../features/recipes/services/tagService'

describe('tagService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('(a) getAll() returns [] when slist_tags is absent', () => {
    const result = tagService.getAll()
    expect(result).toEqual([])
  })

  it('(b) create() returns a tag with UUID id and persists it', () => {
    const tag = tagService.create('Quick', '#f07045')

    expect(typeof tag.id).toBe('string')
    expect(tag.id.length).toBeGreaterThan(0)
    expect(tag.name).toBe('Quick')
    expect(tag.color).toBe('#f07045')

    // Verify persisted
    const raw = localStorage.getItem('slist_tags')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe(tag.id)
  })

  it('(c) getAll() after create() returns that tag', () => {
    const created = tagService.create('Vegetarian', '#6ab04c')
    const all = tagService.getAll()

    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(created.id)
    expect(all[0].name).toBe('Vegetarian')
    expect(all[0].color).toBe('#6ab04c')
  })
})
