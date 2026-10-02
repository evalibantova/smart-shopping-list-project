import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'
import { useMealPlanStore } from '../../store/mealPlanStore'
import { useRecipesStore } from '../../store/recipesStore'
import { useIngredientsStore } from '../../store/ingredientsStore'
import type { Recipe } from '../../types/recipe'
import type { Ingredient } from '../../types/ingredient'

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderShoppingListPage() {
  return render(
    <MemoryRouter initialEntries={['/shopping-list']}>
      <App />
    </MemoryRouter>
  )
}

function resetStores() {
  useMealPlanStore.setState({ slots: {} })
  useRecipesStore.setState({ recipes: [] })
  useIngredientsStore.setState({ ingredientsDb: [] })
  localStorage.clear()
}

beforeEach(resetStores)
afterEach(cleanup)

// ─── Shared fixtures ────────────────────────────────────────────────────────

const chickenBreast: Ingredient = {
  id: 'ing_031',
  name: 'Chicken Breast',
  defaultUnit: 'g',
  category: 'Meat',
}

const spinach: Ingredient = {
  id: 'ing_002',
  name: 'Spinach',
  defaultUnit: 'g',
  category: 'Produce',
}

const milk: Ingredient = {
  id: 'ing_010',
  name: 'Milk',
  defaultUnit: 'ml',
  category: 'Dairy',
}

// Recipe: 4 servings, 200g chicken
const chickenSalad: Recipe = {
  id: 'r1',
  name: 'Chicken Salad',
  emoji: '🥗',
  servings: 4,
  tagIds: [],
  notes: '',
  createdAt: 0,
  ingredients: [{ ingredientId: 'ing_031', quantity: 200 }],
}

// Recipe: 2 servings, 100g spinach + 300ml milk
const spinachSmoothie: Recipe = {
  id: 'r2',
  name: 'Spinach Smoothie',
  emoji: '🥤',
  servings: 2,
  tagIds: [],
  notes: '',
  createdAt: 0,
  ingredients: [
    { ingredientId: 'ing_002', quantity: 100 },
    { ingredientId: 'ing_010', quantity: 300 },
  ],
}

// ─── AC1 — Ingredient Aggregation (Scaling + Summing) ─────────────────────

describe('AC1 — Ingredient Aggregation (Scaling + Summing)', () => {
  it('scales ingredient quantity by (plannedServings / recipeServings)', () => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    // Recipe: 4 servings, 200g chicken. Planned: 2 servings → 200 * 2/4 = 100g
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
    renderShoppingListPage()
    const items = screen.getAllByTestId('shopping-list-item')
    expect(items).toHaveLength(1)
    // Should show 100 (not 200 — scaled down to 2 servings out of 4)
    expect(items[0]).toHaveTextContent('100')
  })

  it('sums quantities when the same ingredient appears in two planned meals', () => {
    // chickenSalad: 4 servings, 200g → planned 2 servings = 100g
    // chickenSoup:  4 servings, 100g → planned 2 servings = 50g
    // Total: 150g chicken
    const chickenSoup: Recipe = {
      id: 'r_soup',
      name: 'Chicken Soup',
      emoji: '🍲',
      servings: 4,
      tagIds: [],
      notes: '',
      createdAt: 0,
      ingredients: [{ ingredientId: 'ing_031', quantity: 100 }],
    }
    useRecipesStore.setState({ recipes: [chickenSalad, chickenSoup] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
        '2026-10-01-lunch': [
          { id: 'pm2', recipeId: 'r_soup', servings: 2, cooked: false, recipeName: 'Chicken Soup', recipeEmoji: '🍲' },
        ],
      },
    })
    renderShoppingListPage()
    // Same ingredient → aggregated into one row
    const items = screen.getAllByTestId('shopping-list-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('150')
  })

  it('renders separate rows for distinct ingredients', () => {
    useRecipesStore.setState({ recipes: [spinachSmoothie] })
    useIngredientsStore.setState({ ingredientsDb: [spinach, milk] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-breakfast': [
          { id: 'pm1', recipeId: 'r2', servings: 2, cooked: false, recipeName: 'Spinach Smoothie', recipeEmoji: '🥤' },
        ],
      },
    })
    renderShoppingListPage()
    const items = screen.getAllByTestId('shopping-list-item')
    expect(items).toHaveLength(2)
  })

  it('cooked meals are excluded from aggregation', () => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: true, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-empty')).toBeInTheDocument()
    expect(screen.queryAllByTestId('shopping-list-item')).toHaveLength(0)
  })

  it('only uncooked meals from multiple slots contribute to the list', () => {
    useRecipesStore.setState({ recipes: [chickenSalad, spinachSmoothie] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast, spinach, milk] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          // cooked — excluded
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: true, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
        '2026-10-01-breakfast': [
          // not cooked — included
          { id: 'pm2', recipeId: 'r2', servings: 2, cooked: false, recipeName: 'Spinach Smoothie', recipeEmoji: '🥤' },
        ],
      },
    })
    renderShoppingListPage()
    // Only smoothie ingredients (spinach + milk) should appear, not chicken
    const items = screen.getAllByTestId('shopping-list-item')
    expect(items).toHaveLength(2)
    const names = screen.getAllByTestId('shopping-list-item-name').map(el => el.textContent)
    expect(names.some(n => n?.includes('Chicken Breast'))).toBe(false)
  })
})

// ─── AC2 — Live-Computed (No Generate Button) ──────────────────────────────

describe('AC2 — Live-Computed (No Generate Button)', () => {
  it('page renders with data-testid="shopping-list-page"', () => {
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-page')).toBeInTheDocument()
  })

  it('there is no "Generate", "Refresh", or "Recalculate" button', () => {
    renderShoppingListPage()
    expect(screen.queryByRole('button', { name: /generate/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /recalculate/i })).toBeNull()
  })

  it('list updates immediately when a meal is added to the store (no extra user action)', () => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({ slots: {} })
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-empty')).toBeInTheDocument()

    // Add a meal directly to the Zustand store — list should update reactively
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })

    expect(screen.queryByTestId('shopping-list-empty')).toBeNull()
    expect(screen.getAllByTestId('shopping-list-item').length).toBeGreaterThan(0)
  })

  it('items disappear when a meal is marked cooked (no extra user action)', () => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
    renderShoppingListPage()
    expect(screen.getAllByTestId('shopping-list-item').length).toBeGreaterThan(0)

    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: true, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })

    expect(screen.getByTestId('shopping-list-empty')).toBeInTheDocument()
  })
})

// ─── AC3 — Category Grouping ───────────────────────────────────────────────

describe('AC3 — Category Grouping', () => {
  it('renders one category heading per represented category', () => {
    useRecipesStore.setState({ recipes: [spinachSmoothie] })
    useIngredientsStore.setState({ ingredientsDb: [spinach, milk] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-breakfast': [
          { id: 'pm1', recipeId: 'r2', servings: 2, cooked: false, recipeName: 'Spinach Smoothie', recipeEmoji: '🥤' },
        ],
      },
    })
    renderShoppingListPage()
    // Spinach = Produce, Milk = Dairy → exactly 2 headings
    const headings = screen.getAllByTestId('shopping-list-category')
    expect(headings).toHaveLength(2)
  })

  it('category heading includes the correct emoji and name for Meat', () => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
    renderShoppingListPage()
    const headings = screen.getAllByTestId('shopping-list-category')
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('🥩')
    expect(headings[0]).toHaveTextContent('Meat')
  })

  it('does not render category sections that have no items', () => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
    renderShoppingListPage()
    // Only Meat is present; Produce, Dairy, etc. should not appear
    const headings = screen.getAllByTestId('shopping-list-category')
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Meat')
  })

  it('category groups appear in fixed order: Produce before Meat before Fish & Seafood', () => {
    const salmon: Ingredient = { id: 'ing_050', name: 'Salmon', defaultUnit: 'g', category: 'Fish & Seafood' }
    const multiRecipe: Recipe = {
      id: 'r_multi',
      name: 'Mixed Plate',
      emoji: '🍽️',
      servings: 1,
      tagIds: [],
      notes: '',
      createdAt: 0,
      ingredients: [
        { ingredientId: 'ing_050', quantity: 200 }, // Fish & Seafood
        { ingredientId: 'ing_002', quantity: 100 }, // Produce
        { ingredientId: 'ing_031', quantity: 100 }, // Meat
      ],
    }
    useRecipesStore.setState({ recipes: [multiRecipe] })
    useIngredientsStore.setState({ ingredientsDb: [spinach, chickenBreast, salmon] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r_multi', servings: 1, cooked: false, recipeName: 'Mixed Plate', recipeEmoji: '🍽️' },
        ],
      },
    })
    renderShoppingListPage()
    const headings = screen.getAllByTestId('shopping-list-category')
    expect(headings).toHaveLength(3)
    expect(headings[0]).toHaveTextContent('Produce')
    expect(headings[1]).toHaveTextContent('Meat')
    expect(headings[2]).toHaveTextContent('Fish & Seafood')
  })

  it('items within a category are sorted alphabetically by ingredient name', () => {
    const tomato: Ingredient = { id: 'ing_003', name: 'Tomato', defaultUnit: 'g', category: 'Produce' }
    const apple: Ingredient = { id: 'ing_004', name: 'Apple', defaultUnit: 'g', category: 'Produce' }
    const carrot: Ingredient = { id: 'ing_005', name: 'Carrot', defaultUnit: 'g', category: 'Produce' }
    const produceRecipe: Recipe = {
      id: 'r_produce',
      name: 'Garden Bowl',
      emoji: '🥗',
      servings: 1,
      tagIds: [],
      notes: '',
      createdAt: 0,
      ingredients: [
        { ingredientId: 'ing_003', quantity: 100 },
        { ingredientId: 'ing_004', quantity: 200 },
        { ingredientId: 'ing_005', quantity: 150 },
      ],
    }
    useRecipesStore.setState({ recipes: [produceRecipe] })
    useIngredientsStore.setState({ ingredientsDb: [tomato, apple, carrot] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-lunch': [
          { id: 'pm1', recipeId: 'r_produce', servings: 1, cooked: false, recipeName: 'Garden Bowl', recipeEmoji: '🥗' },
        ],
      },
    })
    renderShoppingListPage()
    const names = screen.getAllByTestId('shopping-list-item-name').map(el => el.textContent)
    expect(names).toEqual(['Apple', 'Carrot', 'Tomato'])
  })
})

// ─── AC4 — Check Off an Item ───────────────────────────────────────────────

describe('AC4 — Check Off an Item', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
  })

  it('each line item renders a checkbox', () => {
    renderShoppingListPage()
    const checkboxes = screen.getAllByTestId('shopping-list-checkbox')
    expect(checkboxes).toHaveLength(1)
    expect(checkboxes[0].tagName).toBe('INPUT')
    expect(checkboxes[0]).toHaveAttribute('type', 'checkbox')
  })

  it('clicking an unchecked checkbox marks it as checked', () => {
    renderShoppingListPage()
    const checkbox = screen.getByTestId('shopping-list-checkbox')
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('checked item is marked with data-checked="true" on the row', () => {
    renderShoppingListPage()
    const checkbox = screen.getByTestId('shopping-list-checkbox')
    fireEvent.click(checkbox)
    const item = screen.getByTestId('shopping-list-item')
    expect(item).toHaveAttribute('data-checked', 'true')
  })

  it('checked item remains in the DOM (not removed)', () => {
    renderShoppingListPage()
    fireEvent.click(screen.getByTestId('shopping-list-checkbox'))
    expect(screen.getAllByTestId('shopping-list-item')).toHaveLength(1)
  })

  it('unchecked item does not carry data-checked="true"', () => {
    renderShoppingListPage()
    const item = screen.getByTestId('shopping-list-item')
    // Before clicking: not checked
    expect(item).not.toHaveAttribute('data-checked', 'true')
  })
})

// ─── AC5 — Uncheck an Item ────────────────────────────────────────────────

describe('AC5 — Uncheck an Item', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
  })

  it('clicking a checked checkbox marks it as unchecked', () => {
    renderShoppingListPage()
    const checkbox = screen.getByTestId('shopping-list-checkbox')
    fireEvent.click(checkbox) // check
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox) // uncheck
    expect(checkbox).not.toBeChecked()
  })

  it('unchecking removes data-checked="true" from the item row', () => {
    renderShoppingListPage()
    const checkbox = screen.getByTestId('shopping-list-checkbox')
    fireEvent.click(checkbox) // check
    fireEvent.click(checkbox) // uncheck
    expect(screen.getByTestId('shopping-list-item')).not.toHaveAttribute('data-checked', 'true')
  })

  it('the progress bar updates immediately when an item is unchecked', () => {
    useRecipesStore.setState({ recipes: [spinachSmoothie] })
    useIngredientsStore.setState({ ingredientsDb: [spinach, milk] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-breakfast': [
          { id: 'pm1', recipeId: 'r2', servings: 2, cooked: false, recipeName: 'Spinach Smoothie', recipeEmoji: '🥤' },
        ],
      },
    })
    renderShoppingListPage()
    const checkboxes = screen.getAllByTestId('shopping-list-checkbox')
    // Check both
    for (const cb of checkboxes) fireEvent.click(cb)
    expect(screen.getByTestId('shopping-list-progress')).toHaveTextContent('2 / 2')
    // Uncheck one
    fireEvent.click(checkboxes[0])
    expect(screen.getByTestId('shopping-list-progress')).toHaveTextContent('1 / 2')
  })
})

// ─── AC6 — Progress Bar ────────────────────────────────────────────────────

describe('AC6 — Progress Bar', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [spinachSmoothie] })
    useIngredientsStore.setState({ ingredientsDb: [spinach, milk] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-breakfast': [
          { id: 'pm1', recipeId: 'r2', servings: 2, cooked: false, recipeName: 'Spinach Smoothie', recipeEmoji: '🥤' },
        ],
      },
    })
  })

  it('renders a progress bar when there are shopping list items', () => {
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-progress')).toBeInTheDocument()
  })

  it('shows "0 / N checked" when no items are checked', () => {
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-progress')).toHaveTextContent('0 / 2 checked')
  })

  it('updates the checked count when an item is checked', () => {
    renderShoppingListPage()
    const checkboxes = screen.getAllByTestId('shopping-list-checkbox')
    fireEvent.click(checkboxes[0])
    expect(screen.getByTestId('shopping-list-progress')).toHaveTextContent('1 / 2 checked')
  })

  it('shows "N / N checked" when all items are checked', () => {
    renderShoppingListPage()
    const checkboxes = screen.getAllByTestId('shopping-list-checkbox')
    for (const cb of checkboxes) fireEvent.click(cb)
    expect(screen.getByTestId('shopping-list-progress')).toHaveTextContent('2 / 2 checked')
  })

  it('progress bar is not rendered in the empty state', () => {
    useMealPlanStore.setState({ slots: {} })
    renderShoppingListPage()
    expect(screen.queryByTestId('shopping-list-progress')).toBeNull()
  })
})

// ─── AC7 — Clear Checked Button ───────────────────────────────────────────

describe('AC7 — Clear Checked Button', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [spinachSmoothie] })
    useIngredientsStore.setState({ ingredientsDb: [spinach, milk] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-breakfast': [
          { id: 'pm1', recipeId: 'r2', servings: 2, cooked: false, recipeName: 'Spinach Smoothie', recipeEmoji: '🥤' },
        ],
      },
    })
  })

  it('"Clear checked" button is absent when no items are checked', () => {
    renderShoppingListPage()
    expect(screen.queryByTestId('shopping-list-clear-btn')).toBeNull()
  })

  it('"Clear checked" button appears after checking at least one item', () => {
    renderShoppingListPage()
    fireEvent.click(screen.getAllByTestId('shopping-list-checkbox')[0])
    expect(screen.getByTestId('shopping-list-clear-btn')).toBeInTheDocument()
  })

  it('clicking "Clear checked" removes checked items from the visible list', () => {
    renderShoppingListPage()
    // Check only the first item
    fireEvent.click(screen.getAllByTestId('shopping-list-checkbox')[0])
    fireEvent.click(screen.getByTestId('shopping-list-clear-btn'))
    // One item dismissed → only 1 remains visible
    expect(screen.getAllByTestId('shopping-list-item')).toHaveLength(1)
  })

  it('after clearing all items, the empty state is shown', () => {
    renderShoppingListPage()
    const checkboxes = screen.getAllByTestId('shopping-list-checkbox')
    for (const cb of checkboxes) fireEvent.click(cb)
    fireEvent.click(screen.getByTestId('shopping-list-clear-btn'))
    expect(screen.getByTestId('shopping-list-empty')).toBeInTheDocument()
  })

  it('after clearing, the progress bar reflects remaining items', () => {
    renderShoppingListPage()
    // Check only first of 2 items, then clear
    fireEvent.click(screen.getAllByTestId('shopping-list-checkbox')[0])
    fireEvent.click(screen.getByTestId('shopping-list-clear-btn'))
    // 1 item remains, 0 checked
    expect(screen.getByTestId('shopping-list-progress')).toHaveTextContent('0 / 1 checked')
  })

  it('"Clear checked" button is hidden again after clearing', () => {
    renderShoppingListPage()
    fireEvent.click(screen.getAllByTestId('shopping-list-checkbox')[0])
    fireEvent.click(screen.getByTestId('shopping-list-clear-btn'))
    expect(screen.queryByTestId('shopping-list-clear-btn')).toBeNull()
  })
})

// ─── AC8 — Empty State ─────────────────────────────────────────────────────

describe('AC8 — Empty State', () => {
  it('shows empty state when meal plan has no slots', () => {
    useMealPlanStore.setState({ slots: {} })
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-empty')).toBeInTheDocument()
  })

  it('empty state contains a helpful message string', () => {
    useMealPlanStore.setState({ slots: {} })
    renderShoppingListPage()
    const emptyEl = screen.getByTestId('shopping-list-empty')
    expect(emptyEl.textContent!.trim().length).toBeGreaterThan(5)
  })

  it('progress bar is absent in empty state', () => {
    useMealPlanStore.setState({ slots: {} })
    renderShoppingListPage()
    expect(screen.queryByTestId('shopping-list-progress')).toBeNull()
  })

  it('"Clear checked" button is absent in empty state', () => {
    useMealPlanStore.setState({ slots: {} })
    renderShoppingListPage()
    expect(screen.queryByTestId('shopping-list-clear-btn')).toBeNull()
  })

  it('empty state is replaced by the live list when a meal is added', () => {
    useMealPlanStore.setState({ slots: {} })
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-empty')).toBeInTheDocument()

    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })

    expect(screen.queryByTestId('shopping-list-empty')).toBeNull()
    expect(screen.getAllByTestId('shopping-list-item').length).toBeGreaterThan(0)
  })

  it('shows empty state when all planned meals are cooked', () => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: true, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-empty')).toBeInTheDocument()
    expect(screen.queryAllByTestId('shopping-list-item')).toHaveLength(0)
  })
})

// ─── AC9 — Auto Badge ──────────────────────────────────────────────────────

describe('AC9 — Auto Badge', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [chickenSalad] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Chicken Salad', recipeEmoji: '🥗' },
        ],
      },
    })
  })

  it('each shopping list item renders an "auto" badge', () => {
    renderShoppingListPage()
    const badges = screen.getAllByTestId('shopping-list-auto-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveTextContent('auto')
  })

  it('number of auto badges matches number of shopping list items', () => {
    useRecipesStore.setState({ recipes: [spinachSmoothie] })
    useIngredientsStore.setState({ ingredientsDb: [spinach, milk] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-breakfast': [
          { id: 'pm1', recipeId: 'r2', servings: 2, cooked: false, recipeName: 'Spinach Smoothie', recipeEmoji: '🥤' },
        ],
      },
    })
    renderShoppingListPage()
    const items = screen.getAllByTestId('shopping-list-item')
    const badges = screen.getAllByTestId('shopping-list-auto-badge')
    expect(badges).toHaveLength(items.length)
  })

  it('auto badge is rendered inside the shopping list item row', () => {
    renderShoppingListPage()
    const item = screen.getByTestId('shopping-list-item')
    const badge = within(item).getByTestId('shopping-list-auto-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('auto')
  })
})

// ─── AC10 — No Persistence (Local State Only) ─────────────────────────────

describe('AC10 — No Persistence (Local State Only)', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [spinachSmoothie] })
    useIngredientsStore.setState({ ingredientsDb: [spinach, milk] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-breakfast': [
          { id: 'pm1', recipeId: 'r2', servings: 2, cooked: false, recipeName: 'Spinach Smoothie', recipeEmoji: '🥤' },
        ],
      },
    })
  })

  it('checking an item does not write any shopping-list state to localStorage', () => {
    localStorage.clear()
    renderShoppingListPage()
    fireEvent.click(screen.getAllByTestId('shopping-list-checkbox')[0])

    const keys = Object.keys(localStorage)
    const shoppingListKeys = keys.filter(k =>
      k.toLowerCase().includes('shopping') || k.toLowerCase().includes('checked')
    )
    expect(shoppingListKeys).toHaveLength(0)
  })

  it('checking an item does not modify the cooked flag in the meal plan store', () => {
    renderShoppingListPage()
    fireEvent.click(screen.getAllByTestId('shopping-list-checkbox')[0])

    const slots = useMealPlanStore.getState().slots
    const allMeals = Object.values(slots).flat()
    // Shopping-list checked state is separate from meal plan cooked flag
    expect(allMeals.every(m => m.cooked === false)).toBe(true)
  })

  it('after checking items, only the known Zustand persist keys are in localStorage', () => {
    localStorage.clear()
    renderShoppingListPage()
    const checkboxes = screen.getAllByTestId('shopping-list-checkbox')
    for (const cb of checkboxes) fireEvent.click(cb)

    const knownKeys = new Set(['meal-plan-v1', 'slist_recipes', 'slist_ingredients', 'slist_tags'])
    const unexpectedKeys = Object.keys(localStorage).filter(k => !knownKeys.has(k))
    expect(unexpectedKeys).toHaveLength(0)
  })
})

// ─── Regression: BUG-1 — Division by zero when recipe.servings === 0 ────────

describe('Regression — recipe.servings === 0 does not crash or show Infinity', () => {
  it('ignores ingredients from a recipe with 0 servings', () => {
    const zeroServingRecipe: Recipe = {
      id: 'r_zero',
      name: 'Bad Recipe',
      emoji: '❌',
      servings: 0,
      tagIds: [],
      notes: '',
      createdAt: 0,
      ingredients: [{ ingredientId: 'ing_031', quantity: 200 }],
    }
    useRecipesStore.setState({ recipes: [zeroServingRecipe] })
    useIngredientsStore.setState({ ingredientsDb: [chickenBreast] })
    useMealPlanStore.setState({
      slots: {
        '2026-10-01-dinner': [
          { id: 'pm1', recipeId: 'r_zero', servings: 2, cooked: false, recipeName: 'Bad Recipe', recipeEmoji: '❌' },
        ],
      },
    })
    renderShoppingListPage()
    expect(screen.getByTestId('shopping-list-empty')).toBeInTheDocument()
    expect(screen.queryByText(/infinity/i)).toBeNull()
  })
})

// ─── Regression: BUG-2 — Checked items appear below unchecked in category ───

describe('Regression — checked items sort below unchecked within their category', () => {
  it('renders unchecked items before checked items within the same category', () => {
    const apple: Ingredient = { id: 'ing_apple', name: 'Apple', defaultUnit: 'pcs', category: 'Produce' }
    const banana: Ingredient = { id: 'ing_banana', name: 'Banana', defaultUnit: 'pcs', category: 'Produce' }
    const zucchini: Ingredient = { id: 'ing_zuc', name: 'Zucchini', defaultUnit: 'pcs', category: 'Produce' }
    const recipeABZ: Recipe = {
      id: 'r_abz',
      name: 'Fruit Mix',
      emoji: '🍎',
      servings: 1,
      tagIds: [],
      notes: '',
      createdAt: 0,
      ingredients: [
        { ingredientId: 'ing_apple', quantity: 1 },
        { ingredientId: 'ing_banana', quantity: 1 },
        { ingredientId: 'ing_zuc', quantity: 1 },
      ],
    }
    useRecipesStore.setState({ recipes: [recipeABZ] })
    useIngredientsStore.setState({ ingredientsDb: [apple, banana, zucchini] })
    useMealPlanStore.setState({
      slots: { '2026-10-01-dinner': [{ id: 'pm1', recipeId: 'r_abz', servings: 1, cooked: false, recipeName: 'Fruit Mix', recipeEmoji: '🍎' }] },
    })
    renderShoppingListPage()

    // Check "Apple" (first alphabetically)
    const checkboxes = screen.getAllByTestId('shopping-list-checkbox')
    fireEvent.click(checkboxes[0])

    // After checking Apple, it should appear after Banana and Zucchini
    const items = screen.getAllByTestId('shopping-list-item')
    const names = items.map(el => el.querySelector('[data-testid="shopping-list-item-name"]')?.textContent)
    const appleIndex = names.indexOf('Apple')
    const bananaIndex = names.indexOf('Banana')
    const zucchiniIndex = names.indexOf('Zucchini')

    expect(appleIndex).toBeGreaterThan(bananaIndex)
    expect(appleIndex).toBeGreaterThan(zucchiniIndex)
  })
})
