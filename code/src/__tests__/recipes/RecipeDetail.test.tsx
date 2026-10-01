import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeDetail from '../../components/shared/RecipeDetail/RecipeDetail'
import { useTagsStore } from '../../store/tagsStore'
import { useIngredientsStore } from '../../store/ingredientsStore'
import type { Recipe } from '../../types/recipe'

function resetStores() {
  useTagsStore.setState({ tags: [] })
  useIngredientsStore.setState({ ingredientsDb: [] })
  localStorage.clear()
}

const baseRecipe: Recipe = {
  id: 'r_test',
  emoji: '🍝',
  name: 'Spaghetti Bolognese',
  servings: 4,
  tagIds: [],
  ingredients: [
    { ingredientId: 'ing_001', quantity: 200 },
    { ingredientId: 'ing_002', quantity: 100 },
  ],
  notes: 'Cook on low heat for 30 minutes.',
  createdAt: 1000000,
}

function renderDetail(recipe = baseRecipe, onEdit = vi.fn()) {
  return render(<RecipeDetail recipe={recipe} onEdit={onEdit} />)
}

beforeEach(() => {
  resetStores()
  useIngredientsStore.getState().seedIngredients()
})

afterEach(() => {
  cleanup()
})

describe('AC10 — RecipeDetail: header', () => {
  it('renders the recipe emoji', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-emoji')).toHaveTextContent('🍝')
  })

  it('renders the recipe name', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-name')).toHaveTextContent('Spaghetti Bolognese')
  })
})

describe('AC10 — RecipeDetail: action buttons', () => {
  it('renders the Edit button', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-edit-btn')).toBeInTheDocument()
  })

  it('Edit button is not disabled', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-edit-btn')).not.toBeDisabled()
  })

  it('clicking Edit calls onEdit callback', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    renderDetail(baseRecipe, onEdit)
    await user.click(screen.getByTestId('recipe-detail-edit-btn'))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('renders the Add to Week button', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-add-to-week-btn')).toBeInTheDocument()
  })

  it('Add to Week button is disabled in this story', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-add-to-week-btn')).toBeDisabled()
  })
})

describe('AC10 — RecipeDetail: tag chips', () => {
  it('renders a chip for each associated tag', () => {
    const t1 = useTagsStore.getState().addTag('Quick', '#f07045')
    const t2 = useTagsStore.getState().addTag('Vegetarian', '#4caf50')
    const recipe: Recipe = { ...baseRecipe, tagIds: [t1.id, t2.id] }
    renderDetail(recipe)
    const chips = screen.getAllByTestId('tag-chip')
    expect(chips).toHaveLength(2)
  })

  it('each chip shows the tag name', () => {
    const tag = useTagsStore.getState().addTag('Quick', '#f07045')
    renderDetail({ ...baseRecipe, tagIds: [tag.id] })
    expect(screen.getByTestId('tag-chip')).toHaveTextContent('Quick')
  })

  it('renders no chips when recipe has no tags', () => {
    renderDetail({ ...baseRecipe, tagIds: [] })
    expect(screen.queryAllByTestId('tag-chip')).toHaveLength(0)
  })
})

describe('AC10 — RecipeDetail: servings scaler', () => {
  it('renders the current servings count', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-servings-display')).toHaveTextContent('4')
  })

  it('renders minus button', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-servings-minus')).toBeInTheDocument()
  })

  it('renders plus button', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-servings-plus')).toBeInTheDocument()
  })

  it('renders reset control', () => {
    renderDetail()
    expect(screen.getByTestId('recipe-detail-servings-reset')).toBeInTheDocument()
  })

  it('clicking plus increments servings display', async () => {
    const user = userEvent.setup()
    renderDetail()
    await user.click(screen.getByTestId('recipe-detail-servings-plus'))
    expect(screen.getByTestId('recipe-detail-servings-display')).toHaveTextContent('5')
  })

  it('clicking minus decrements servings display', async () => {
    const user = userEvent.setup()
    renderDetail()
    await user.click(screen.getByTestId('recipe-detail-servings-minus'))
    expect(screen.getByTestId('recipe-detail-servings-display')).toHaveTextContent('3')
  })

  it('servings do not go below 1 when clicking minus', async () => {
    const user = userEvent.setup()
    renderDetail({ ...baseRecipe, servings: 1 })
    await user.click(screen.getByTestId('recipe-detail-servings-minus'))
    expect(screen.getByTestId('recipe-detail-servings-display')).toHaveTextContent('1')
  })

  it('clicking reset restores original servings', async () => {
    const user = userEvent.setup()
    renderDetail()
    await user.click(screen.getByTestId('recipe-detail-servings-plus'))
    await user.click(screen.getByTestId('recipe-detail-servings-plus'))
    await user.click(screen.getByTestId('recipe-detail-servings-reset'))
    expect(screen.getByTestId('recipe-detail-servings-display')).toHaveTextContent('4')
  })

  it('ingredient quantities scale proportionally when servings changes', async () => {
    const user = userEvent.setup()
    const ing = useIngredientsStore.getState().ingredientsDb[0]
    const recipe: Recipe = {
      ...baseRecipe,
      servings: 2,
      ingredients: [{ ingredientId: ing.id, quantity: 100 }],
    }
    renderDetail(recipe)
    await user.click(screen.getByTestId('recipe-detail-servings-plus'))
    const row = screen.getByTestId('recipe-detail-ingredient-row')
    expect(row).toHaveTextContent('150')
  })
})

describe('AC10 — RecipeDetail: ingredient rows', () => {
  it('renders one row per ingredient', () => {
    renderDetail()
    expect(screen.getAllByTestId('recipe-detail-ingredient-row')).toHaveLength(2)
  })

  it('each row shows the ingredient name', () => {
    const ing = useIngredientsStore.getState().ingredientsDb[0]
    const recipe: Recipe = {
      ...baseRecipe,
      ingredients: [{ ingredientId: ing.id, quantity: 50 }],
    }
    renderDetail(recipe)
    expect(screen.getByTestId('recipe-detail-ingredient-row')).toHaveTextContent(ing.name)
  })

  it('each row shows the ingredient quantity', () => {
    const ing = useIngredientsStore.getState().ingredientsDb[0]
    const recipe: Recipe = {
      ...baseRecipe,
      ingredients: [{ ingredientId: ing.id, quantity: 75 }],
    }
    renderDetail(recipe)
    expect(screen.getByTestId('recipe-detail-ingredient-row')).toHaveTextContent('75')
  })

  it('each row shows the unit from the ingredient default', () => {
    const ing = useIngredientsStore.getState().ingredientsDb[0]
    const recipe: Recipe = {
      ...baseRecipe,
      ingredients: [{ ingredientId: ing.id, quantity: 75 }],
    }
    renderDetail(recipe)
    expect(screen.getByTestId('recipe-detail-ingredient-row')).toHaveTextContent(ing.defaultUnit)
  })
})

describe('AC10 — RecipeDetail: notes section', () => {
  it('shows notes section when recipe has notes', () => {
    renderDetail({ ...baseRecipe, notes: 'Stir frequently.' })
    expect(screen.getByTestId('recipe-detail-notes')).toBeInTheDocument()
  })

  it('notes section contains the notes text', () => {
    renderDetail({ ...baseRecipe, notes: 'Stir frequently.' })
    expect(screen.getByTestId('recipe-detail-notes')).toHaveTextContent('Stir frequently.')
  })

  it('notes section is absent when notes is empty string', () => {
    renderDetail({ ...baseRecipe, notes: '' })
    expect(screen.queryByTestId('recipe-detail-notes')).not.toBeInTheDocument()
  })
})
