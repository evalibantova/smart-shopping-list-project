import { describe, it, expect, beforeEach } from 'vitest'
import { useRecipesStore } from '../../store/recipesStore'
import { recipeService } from '../../services/recipeService'
import type { Recipe } from '../../types/recipe'

function resetStore() {
  useRecipesStore.setState({ recipes: [] })
  localStorage.clear()
}

const baseData: Omit<Recipe, 'id' | 'createdAt'> = {
  emoji: '🍝',
  name: 'Spaghetti Bolognese',
  servings: 4,
  tagIds: [],
  ingredients: [{ ingredientId: 'ing_001', quantity: 200 }],
  notes: 'Cook on low heat.',
}

describe('AC7 — Create recipe', () => {
  beforeEach(resetStore)

  it('recipeService.create() returns a Recipe with a string id', () => {
    const recipe = recipeService.create(baseData)
    expect(typeof recipe.id).toBe('string')
    expect(recipe.id.length).toBeGreaterThan(0)
  })

  it('created recipe appears immediately in the store', () => {
    recipeService.create(baseData)
    expect(useRecipesStore.getState().recipes).toHaveLength(1)
    expect(useRecipesStore.getState().recipes[0].name).toBe('Spaghetti Bolognese')
  })

  it('each create() generates a unique id', () => {
    const a = recipeService.create(baseData)
    const b = recipeService.create({ ...baseData, name: 'Risotto' })
    expect(a.id).not.toBe(b.id)
  })

  it('created recipe has a numeric createdAt timestamp', () => {
    const recipe = recipeService.create(baseData)
    expect(typeof recipe.createdAt).toBe('number')
    expect(recipe.createdAt).toBeGreaterThan(0)
  })

  it('created recipe stores all supplied fields', () => {
    const recipe = recipeService.create(baseData)
    expect(recipe.emoji).toBe('🍝')
    expect(recipe.name).toBe('Spaghetti Bolognese')
    expect(recipe.servings).toBe(4)
    expect(recipe.ingredients).toHaveLength(1)
    expect(recipe.notes).toBe('Cook on low heat.')
  })

  it('persists recipes to localStorage under slist_recipes key', () => {
    recipeService.create(baseData)
    const stored = localStorage.getItem('slist_recipes')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.recipes).toHaveLength(1)
    expect(parsed.state.recipes[0].name).toBe('Spaghetti Bolognese')
  })
})

describe('AC8 — Update recipe', () => {
  beforeEach(resetStore)

  it('recipeService.update() modifies the named field in the store', () => {
    const recipe = recipeService.create(baseData)
    recipeService.update(recipe.id, { name: 'Pasta Bolognese' })
    const updated = useRecipesStore.getState().recipes.find(r => r.id === recipe.id)
    expect(updated?.name).toBe('Pasta Bolognese')
  })

  it('update() preserves fields not in the patch', () => {
    const recipe = recipeService.create(baseData)
    recipeService.update(recipe.id, { name: 'Pasta' })
    const updated = useRecipesStore.getState().recipes.find(r => r.id === recipe.id)
    expect(updated?.servings).toBe(4)
    expect(updated?.emoji).toBe('🍝')
    expect(updated?.notes).toBe('Cook on low heat.')
  })

  it('update() returns the updated recipe object', () => {
    const recipe = recipeService.create(baseData)
    const result = recipeService.update(recipe.id, { name: 'Pasta', servings: 2 })
    expect(result.name).toBe('Pasta')
    expect(result.servings).toBe(2)
    expect(result.id).toBe(recipe.id)
  })

  it('store length stays the same after update', () => {
    recipeService.create(baseData)
    const b = recipeService.create({ ...baseData, name: 'Risotto' })
    recipeService.update(b.id, { name: 'Mushroom Risotto' })
    expect(useRecipesStore.getState().recipes).toHaveLength(2)
  })

  it('update() persists the change to localStorage', () => {
    const recipe = recipeService.create(baseData)
    recipeService.update(recipe.id, { name: 'Pasta' })
    const stored = localStorage.getItem('slist_recipes')
    const parsed = JSON.parse(stored!)
    expect(parsed.state.recipes[0].name).toBe('Pasta')
  })
})

describe('AC9 — Delete recipe', () => {
  beforeEach(resetStore)

  it('recipeService.delete() removes the recipe from the store', () => {
    const recipe = recipeService.create(baseData)
    recipeService.delete(recipe.id)
    expect(useRecipesStore.getState().recipes).toHaveLength(0)
  })

  it('deleting one recipe leaves others intact', () => {
    const a = recipeService.create(baseData)
    const b = recipeService.create({ ...baseData, name: 'Risotto' })
    recipeService.delete(a.id)
    const remaining = useRecipesStore.getState().recipes
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(b.id)
  })

  it('localStorage reflects the deletion', () => {
    const recipe = recipeService.create(baseData)
    recipeService.delete(recipe.id)
    const stored = localStorage.getItem('slist_recipes')
    const parsed = JSON.parse(stored!)
    expect(parsed.state.recipes).toHaveLength(0)
  })
})
