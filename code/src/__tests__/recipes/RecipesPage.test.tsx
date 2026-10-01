import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'
import { useRecipesStore } from '../../store/recipesStore'
import { useTagsStore } from '../../store/tagsStore'
import { useIngredientsStore } from '../../store/ingredientsStore'
import type { Recipe } from '../../types/recipe'

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
}

function renderRecipesPage() {
  return render(
    <MemoryRouter initialEntries={['/recipes']}>
      <App />
    </MemoryRouter>
  )
}

function seedRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const recipe: Recipe = {
    id: `r_${Math.random().toString(36).slice(2)}`,
    emoji: '🍝',
    name: 'Spaghetti Bolognese',
    servings: 4,
    tagIds: [],
    ingredients: [],
    notes: '',
    createdAt: Date.now(),
    ...overrides,
  }
  useRecipesStore.setState(s => ({ recipes: [...s.recipes, recipe] }))
  return recipe
}

beforeEach(() => {
  setViewport(1024)
  useRecipesStore.setState({ recipes: [] })
  useTagsStore.setState({ tags: [] })
  useIngredientsStore.setState({ ingredientsDb: [] })
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  setViewport(1024)
})

describe('AC1 — Desktop two-panel layout', () => {
  beforeEach(() => setViewport(1024))

  it('renders a recipe list panel on desktop', () => {
    renderRecipesPage()
    expect(screen.getByTestId('recipes-list-panel')).toBeInTheDocument()
  })

  it('renders a recipe detail panel on desktop', () => {
    renderRecipesPage()
    expect(screen.getByTestId('recipes-detail-panel')).toBeInTheDocument()
  })

  it('both panels are visible simultaneously on desktop', () => {
    renderRecipesPage()
    expect(screen.getByTestId('recipes-list-panel')).toBeInTheDocument()
    expect(screen.getByTestId('recipes-detail-panel')).toBeInTheDocument()
  })
})

describe('AC2 — Mobile full-screen overlay', () => {
  beforeEach(() => setViewport(375))

  it('shows a recipe detail overlay element on mobile', () => {
    seedRecipe()
    renderRecipesPage()
    expect(screen.getByTestId('recipe-detail-overlay')).toBeInTheDocument()
  })

  it('overlay opens when a recipe row is clicked on mobile', async () => {
    const user = userEvent.setup()
    seedRecipe({ name: 'Pasta' })
    renderRecipesPage()
    await user.click(screen.getByTestId('recipe-row'))
    expect(screen.getByTestId('recipe-detail-overlay')).toHaveAttribute('data-open', 'true')
  })

  it('a back button appears in the overlay on mobile', async () => {
    const user = userEvent.setup()
    seedRecipe({ name: 'Pasta' })
    renderRecipesPage()
    await user.click(screen.getByTestId('recipe-row'))
    expect(screen.getByTestId('recipe-detail-back')).toBeInTheDocument()
  })

  it('clicking back closes the overlay', async () => {
    const user = userEvent.setup()
    seedRecipe({ name: 'Pasta' })
    renderRecipesPage()
    await user.click(screen.getByTestId('recipe-row'))
    await user.click(screen.getByTestId('recipe-detail-back'))
    expect(screen.getByTestId('recipe-detail-overlay')).not.toHaveAttribute('data-open', 'true')
  })
})

describe('AC3 — Empty state', () => {
  it('shows empty state when no recipes exist', () => {
    renderRecipesPage()
    expect(screen.getByTestId('recipes-empty-state')).toBeInTheDocument()
  })

  it('empty state contains descriptive text', () => {
    renderRecipesPage()
    const emptyState = screen.getByTestId('recipes-empty-state')
    expect(emptyState.textContent).toBeTruthy()
    expect(emptyState.textContent!.length).toBeGreaterThan(5)
  })

  it('empty state is not shown when recipes exist', () => {
    seedRecipe()
    renderRecipesPage()
    expect(screen.queryByTestId('recipes-empty-state')).not.toBeInTheDocument()
  })
})

describe('AC4 — Recipe list rows', () => {
  it('renders one row per recipe', () => {
    seedRecipe({ name: 'Spaghetti' })
    seedRecipe({ name: 'Risotto', emoji: '🍚' })
    renderRecipesPage()
    expect(screen.getAllByTestId('recipe-row')).toHaveLength(2)
  })

  it('row shows the recipe emoji', () => {
    seedRecipe({ emoji: '🍝', name: 'Spaghetti' })
    renderRecipesPage()
    expect(screen.getByTestId('recipe-row')).toHaveTextContent('🍝')
  })

  it('row shows the recipe name', () => {
    seedRecipe({ name: 'Spaghetti Bolognese' })
    renderRecipesPage()
    expect(screen.getByTestId('recipe-row')).toHaveTextContent('Spaghetti Bolognese')
  })

  it('row shows the servings count', () => {
    seedRecipe({ servings: 6 })
    renderRecipesPage()
    expect(screen.getByTestId('recipe-row')).toHaveTextContent('6')
  })

  it('row shows tag chips for associated tags', () => {
    const tag = useTagsStore.getState().addTag('Quick', '#f07045')
    seedRecipe({ tagIds: [tag.id] })
    renderRecipesPage()
    expect(screen.getByTestId('recipe-row')).toHaveTextContent('Quick')
  })
})

describe('AC5 — Real-time search / filter', () => {
  it('renders search bar', () => {
    renderRecipesPage()
    expect(screen.getByTestId('recipe-search')).toBeInTheDocument()
  })

  it('filters by recipe name as user types', async () => {
    const user = userEvent.setup()
    seedRecipe({ name: 'Spaghetti Bolognese' })
    seedRecipe({ name: 'Mushroom Risotto', emoji: '🍚' })
    renderRecipesPage()
    await user.type(screen.getByTestId('recipe-search'), 'Spa')
    const rows = screen.getAllByTestId('recipe-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Spaghetti Bolognese')
  })

  it('filters by tag name as user types', async () => {
    const user = userEvent.setup()
    const tag = useTagsStore.getState().addTag('Vegetarian', '#4caf50')
    seedRecipe({ name: 'Tofu Stir Fry', tagIds: [tag.id] })
    seedRecipe({ name: 'Steak', emoji: '🥩', tagIds: [] })
    renderRecipesPage()
    await user.type(screen.getByTestId('recipe-search'), 'Vegetarian')
    const rows = screen.getAllByTestId('recipe-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Tofu Stir Fry')
  })

  it('filter is case-insensitive', async () => {
    const user = userEvent.setup()
    seedRecipe({ name: 'Spaghetti' })
    renderRecipesPage()
    await user.type(screen.getByTestId('recipe-search'), 'SPAG')
    expect(screen.getAllByTestId('recipe-row')).toHaveLength(1)
  })

  it('shows all recipes when search is cleared', async () => {
    const user = userEvent.setup()
    seedRecipe({ name: 'Spaghetti' })
    seedRecipe({ name: 'Risotto', emoji: '🍚' })
    renderRecipesPage()
    const input = screen.getByTestId('recipe-search')
    await user.type(input, 'Spa')
    await user.clear(input)
    expect(screen.getAllByTestId('recipe-row')).toHaveLength(2)
  })

  it('shows no rows when no recipes match the search term', async () => {
    const user = userEvent.setup()
    seedRecipe({ name: 'Spaghetti' })
    renderRecipesPage()
    await user.type(screen.getByTestId('recipe-search'), 'XYZ-no-match')
    expect(screen.queryAllByTestId('recipe-row')).toHaveLength(0)
  })
})
