import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeForm from '../../features/recipes/RecipeForm'
import { useRecipesStore } from '../../store/recipesStore'
import { useTagsStore } from '../../store/tagsStore'
import { useIngredientsStore } from '../../store/ingredientsStore'
import { recipeService } from '../../services/recipeService'
import type { Recipe } from '../../types/recipe'

function resetStores() {
  useRecipesStore.setState({ recipes: [] })
  useTagsStore.setState({ tags: [] })
  useIngredientsStore.setState({ ingredientsDb: [] })
  localStorage.clear()
}

const existingRecipe: Recipe = {
  id: 'r_test_01',
  emoji: '🍝',
  name: 'Spaghetti Bolognese',
  servings: 4,
  tagIds: [],
  ingredients: [{ ingredientId: 'ing_001', quantity: 200 }],
  notes: 'Cook on low heat.',
  createdAt: 1000000,
}

function renderCreateForm(onClose = vi.fn()) {
  return render(<RecipeForm onClose={onClose} />)
}

function renderEditForm(recipe = existingRecipe, onClose = vi.fn()) {
  return render(<RecipeForm recipe={recipe} onClose={onClose} />)
}

beforeEach(() => {
  resetStores()
  useIngredientsStore.getState().seedIngredients()
})

afterEach(() => {
  cleanup()
})

describe('AC6 — Recipe form fields', () => {
  it('renders emoji input', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-emoji')).toBeInTheDocument()
  })

  it('renders name input', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-name')).toBeInTheDocument()
  })

  it('renders servings input', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-servings')).toBeInTheDocument()
  })

  it('renders tags section', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-tags')).toBeInTheDocument()
  })

  it('renders ingredient rows container', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-ingredients')).toBeInTheDocument()
  })

  it('renders add ingredient button', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-add-ingredient')).toBeInTheDocument()
  })

  it('renders notes textarea', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-notes')).toBeInTheDocument()
  })

  it('renders save button', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-save')).toBeInTheDocument()
  })

  it('renders cancel button', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-cancel')).toBeInTheDocument()
  })

  it('starts with one empty ingredient row', () => {
    renderCreateForm()
    expect(screen.getAllByTestId('recipe-form-ingredient-row')).toHaveLength(1)
  })

  it('add ingredient button appends a new row', async () => {
    const user = userEvent.setup()
    renderCreateForm()
    await user.click(screen.getByTestId('recipe-form-add-ingredient'))
    expect(screen.getAllByTestId('recipe-form-ingredient-row')).toHaveLength(2)
  })

  it('tags section shows new-tag button for creating a custom tag', () => {
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-new-tag-btn')).toBeInTheDocument()
  })

  it('clicking new-tag button reveals name and color inputs', async () => {
    const user = userEvent.setup()
    renderCreateForm()
    await user.click(screen.getByTestId('recipe-form-new-tag-btn'))
    expect(screen.getByTestId('recipe-form-new-tag-name')).toBeInTheDocument()
  })
})

describe('AC7 — Create recipe via form', () => {
  it('filling name and saving adds recipe to the store', async () => {
    const user = userEvent.setup()
    renderCreateForm()
    await user.type(screen.getByTestId('recipe-form-emoji'), '🍕')
    await user.type(screen.getByTestId('recipe-form-name'), 'Pizza Margherita')
    await user.clear(screen.getByTestId('recipe-form-servings'))
    await user.type(screen.getByTestId('recipe-form-servings'), '2')
    await user.click(screen.getByTestId('recipe-form-save'))
    const recipes = useRecipesStore.getState().recipes
    expect(recipes.some(r => r.name === 'Pizza Margherita')).toBe(true)
  })

  it('saved recipe gets a UUID id', async () => {
    const user = userEvent.setup()
    renderCreateForm()
    await user.type(screen.getByTestId('recipe-form-name'), 'Pizza')
    await user.click(screen.getByTestId('recipe-form-save'))
    const recipe = useRecipesStore.getState().recipes[0]
    expect(typeof recipe.id).toBe('string')
    expect(recipe.id.length).toBeGreaterThan(0)
  })

  it('onClose is called after saving', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<RecipeForm onClose={onClose} />)
    await user.type(screen.getByTestId('recipe-form-name'), 'Pizza')
    await user.click(screen.getByTestId('recipe-form-save'))
    expect(onClose).toHaveBeenCalled()
  })

  it('onClose is called when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<RecipeForm onClose={onClose} />)
    await user.click(screen.getByTestId('recipe-form-cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('AC8 — Edit recipe: pre-population', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [existingRecipe] })
  })

  it('emoji input is pre-filled with existing emoji', () => {
    renderEditForm()
    expect(screen.getByTestId('recipe-form-emoji')).toHaveValue('🍝')
  })

  it('name input is pre-filled with existing name', () => {
    renderEditForm()
    expect(screen.getByTestId('recipe-form-name')).toHaveValue('Spaghetti Bolognese')
  })

  it('servings input is pre-filled with existing servings', () => {
    renderEditForm()
    expect(screen.getByTestId('recipe-form-servings')).toHaveValue(4)
  })

  it('notes textarea is pre-filled with existing notes', () => {
    renderEditForm()
    expect(screen.getByTestId('recipe-form-notes')).toHaveValue('Cook on low heat.')
  })

  it('ingredient rows are pre-filled (one row for existing ingredient)', () => {
    renderEditForm()
    expect(screen.getAllByTestId('recipe-form-ingredient-row')).toHaveLength(1)
  })

  it('saving edit calls recipeService.update() — store has updated name', async () => {
    const user = userEvent.setup()
    renderEditForm()
    const nameInput = screen.getByTestId('recipe-form-name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Pasta Bolognese')
    await user.click(screen.getByTestId('recipe-form-save'))
    const updated = useRecipesStore.getState().recipes.find(r => r.id === existingRecipe.id)
    expect(updated?.name).toBe('Pasta Bolognese')
  })

  it('delete button is present in edit mode', () => {
    renderEditForm()
    expect(screen.getByTestId('recipe-form-delete')).toBeInTheDocument()
  })

  it('delete button is absent in create mode', () => {
    renderCreateForm()
    expect(screen.queryByTestId('recipe-form-delete')).not.toBeInTheDocument()
  })
})

describe('AC9 — Delete recipe from edit form', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [existingRecipe] })
  })

  it('clicking delete removes recipe from store', async () => {
    const user = userEvent.setup()
    renderEditForm()
    await user.click(screen.getByTestId('recipe-form-delete'))
    expect(useRecipesStore.getState().recipes).toHaveLength(0)
  })

  it('onClose is called after deletion', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<RecipeForm recipe={existingRecipe} onClose={onClose} />)
    await user.click(screen.getByTestId('recipe-form-delete'))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('AC11 — Tag creation in form', () => {
  it('creating a new tag saves it to slist_tags', async () => {
    const user = userEvent.setup()
    renderCreateForm()
    await user.click(screen.getByTestId('recipe-form-new-tag-btn'))
    await user.type(screen.getByTestId('recipe-form-new-tag-name'), 'Weeknight')
    await user.click(screen.getByTestId('recipe-form-new-tag-save'))
    expect(useTagsStore.getState().tags.some(t => t.name === 'Weeknight')).toBe(true)
  })

  it('existing tags appear as selectable options in the tag picker', () => {
    useTagsStore.getState().addTag('Quick', '#f07045')
    renderCreateForm()
    expect(screen.getByTestId('recipe-form-tags')).toHaveTextContent('Quick')
  })
})
