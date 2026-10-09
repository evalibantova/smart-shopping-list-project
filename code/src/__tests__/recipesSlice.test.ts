import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand'
import { recipesSlice, RecipesSlice } from '../store/recipesSlice'
import type { Recipe } from '../types/recipes'
import type { Tag } from '../types/recipes'

const RECIPE_FIXTURE: Recipe = {
  id: 'r-1',
  emoji: '🍝',
  name: 'Spaghetti',
  servings: 4,
  tagIds: ['t-1'],
  ingredients: [],
  notes: '',
  createdAt: 1000000,
}

const TAG_FIXTURE: Tag = {
  id: 't-1',
  name: 'Italian',
  color: '#f07045',
}

describe('recipesSlice — initRecipes()', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('(a-d) seeds localStorage, creates fresh store, calls initRecipes, asserts state', () => {
    // Seed localStorage
    localStorage.setItem('slist_recipes', JSON.stringify([RECIPE_FIXTURE]))
    localStorage.setItem('slist_tags', JSON.stringify([TAG_FIXTURE]))

    // Create a fresh Zustand store using the slice
    const store = createStore<RecipesSlice>()(recipesSlice)

    // Verify initial state is empty
    expect(store.getState().recipes).toHaveLength(0)
    expect(store.getState().tags).toHaveLength(0)

    // Call initRecipes
    store.getState().initRecipes()

    // Verify state loaded from localStorage
    const state = store.getState()
    expect(state.recipes).toHaveLength(1)
    expect(state.recipes[0].id).toBe('r-1')
    expect(state.recipes[0].name).toBe('Spaghetti')

    expect(state.tags).toHaveLength(1)
    expect(state.tags[0].id).toBe('t-1')
    expect(state.tags[0].name).toBe('Italian')
  })

  it('(e) initRecipes() with empty storage returns empty arrays for both recipes and tags', () => {
    // localStorage is empty (cleared in beforeEach)
    const store = createStore<RecipesSlice>()(recipesSlice)

    store.getState().initRecipes()

    const state = store.getState()
    expect(state.recipes).toEqual([])
    expect(state.tags).toEqual([])
  })

  it('(f) removeRecipe with id matching selectedId resets selectedId to null', () => {
    localStorage.setItem('slist_recipes', JSON.stringify([RECIPE_FIXTURE]))
    localStorage.setItem('slist_tags', JSON.stringify([TAG_FIXTURE]))

    const store = createStore<RecipesSlice>()(recipesSlice)
    store.getState().initRecipes()
    store.getState().selectRecipe('r-1')

    expect(store.getState().selectedId).toBe('r-1')

    store.getState().removeRecipe('r-1')

    expect(store.getState().selectedId).toBeNull()
  })

  it('(g) removeRecipe with id not matching selectedId leaves selectedId unchanged', () => {
    const otherRecipe: Recipe = { ...RECIPE_FIXTURE, id: 'r-2', name: 'Other' }
    localStorage.setItem('slist_recipes', JSON.stringify([RECIPE_FIXTURE, otherRecipe]))
    localStorage.setItem('slist_tags', JSON.stringify([TAG_FIXTURE]))

    const store = createStore<RecipesSlice>()(recipesSlice)
    store.getState().initRecipes()
    store.getState().selectRecipe('r-1')

    expect(store.getState().selectedId).toBe('r-1')

    store.getState().removeRecipe('r-2')

    expect(store.getState().selectedId).toBe('r-1')
  })
})
