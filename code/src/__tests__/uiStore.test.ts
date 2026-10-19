import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store'

describe('UI store', () => {
  beforeEach(() => {
    useStore.setState({ selectedId: null })
  })

  it('starts with nothing selected', () => {
    expect(useStore.getState().selectedId).toBeNull()
  })

  it('selectRecipe selects and clears', () => {
    useStore.getState().selectRecipe('r-1')
    expect(useStore.getState().selectedId).toBe('r-1')
    useStore.getState().selectRecipe(null)
    expect(useStore.getState().selectedId).toBeNull()
  })

  it('holds UI state only: server data lives in TanStack Query', () => {
    expect(Object.keys(useStore.getState()).sort()).toEqual(['selectRecipe', 'selectedId'])
  })
})
