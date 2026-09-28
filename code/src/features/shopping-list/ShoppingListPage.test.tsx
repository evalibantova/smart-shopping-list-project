import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShoppingListPage } from './ShoppingListPage'
import { shoppingListSelectors } from '../../store/shoppingListSlice'
import type { MealPlanEntry, Recipe, Ingredient } from '../../types'

vi.mock('../../store', () => ({
  useStore: vi.fn(),
}))

import { useStore } from '../../store'
const mockUseStore = vi.mocked(useStore)

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

const ING_FLOUR: Ingredient = { id: 'ing-f', name: 'Flour', default_unit: 'g', category: 'Pantry & Dry Goods' }
const ING_MILK: Ingredient = { id: 'ing-m', name: 'Milk', default_unit: 'ml', category: 'Dairy' }
const RECIPE: Recipe = {
  id: 'rec-1',
  name: 'Pancakes',
  emoji: '🥞',
  servings: 2,
  tagNames: [],
  ingredients: [
    { ingredientId: 'ing-f', quantity: 200 },
    { ingredientId: 'ing-m', quantity: 300 },
  ],
  notes: '',
}
const ENTRY: MealPlanEntry = {
  id: 'mp-1',
  date: today(),
  slot: 'lunch',
  recipeId: 'rec-1',
  servings: 2,
}

function makeStore(overrides: Record<string, unknown> = {}) {
  const base = {
    recipes: [] as Recipe[],
    mealPlan: [] as MealPlanEntry[],
    pantry: [],
    ingredientsDb: [] as Ingredient[],
    ...overrides,
  }
  return {
    ...base,
    selectShoppingItems: (args: Parameters<typeof shoppingListSelectors.selectShoppingItems>[0]) =>
      shoppingListSelectors.selectShoppingItems(args),
  }
}

describe('ShoppingListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when there are no meal plan entries', () => {
    mockUseStore.mockReturnValue(makeStore() as ReturnType<typeof useStore>)
    render(<ShoppingListPage />)
    expect(screen.getByText('Nothing needed')).toBeInTheDocument()
    expect(screen.getByText(/Plan some meals first/i)).toBeInTheDocument()
  })

  it('shows pantry message when meals are planned but everything is covered', () => {
    mockUseStore.mockReturnValue(makeStore({
      mealPlan: [ENTRY],
      recipes: [RECIPE],
      ingredientsDb: [ING_FLOUR, ING_MILK],
      pantry: [
        { id: 'p-1', ingredientId: 'ing-f', quantity: 1000, maxStock: 2000 },
        { id: 'p-2', ingredientId: 'ing-m', quantity: 1000, maxStock: 2000 },
      ],
    }) as ReturnType<typeof useStore>)
    render(<ShoppingListPage />)
    expect(screen.getByText(/pantry covers/i)).toBeInTheDocument()
  })

  it('renders shopping items with name, quantity, and auto badge', () => {
    mockUseStore.mockReturnValue(makeStore({
      mealPlan: [ENTRY],
      recipes: [RECIPE],
      ingredientsDb: [ING_FLOUR, ING_MILK],
    }) as ReturnType<typeof useStore>)
    render(<ShoppingListPage />)
    expect(screen.getByText('Flour')).toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()
    const autoBadges = screen.getAllByText('auto')
    expect(autoBadges.length).toBe(2)
  })

  it('shows progress bar when items exist', () => {
    mockUseStore.mockReturnValue(makeStore({
      mealPlan: [ENTRY],
      recipes: [RECIPE],
      ingredientsDb: [ING_FLOUR, ING_MILK],
    }) as ReturnType<typeof useStore>)
    render(<ShoppingListPage />)
    expect(screen.getByText(/0 \/ 2/i)).toBeInTheDocument()
  })

  it('checking an item updates the progress count', async () => {
    mockUseStore.mockReturnValue(makeStore({
      mealPlan: [ENTRY],
      recipes: [RECIPE],
      ingredientsDb: [ING_FLOUR, ING_MILK],
    }) as ReturnType<typeof useStore>)
    render(<ShoppingListPage />)
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument()
  })

  it('shows Clear checked button after checking an item', async () => {
    mockUseStore.mockReturnValue(makeStore({
      mealPlan: [ENTRY],
      recipes: [RECIPE],
      ingredientsDb: [ING_FLOUR, ING_MILK],
    }) as ReturnType<typeof useStore>)
    render(<ShoppingListPage />)
    expect(screen.queryByText(/clear checked/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getByText(/clear checked/i)).toBeInTheDocument()
  })

  it('groups items by category with emoji headers', () => {
    mockUseStore.mockReturnValue(makeStore({
      mealPlan: [ENTRY],
      recipes: [RECIPE],
      ingredientsDb: [ING_FLOUR, ING_MILK],
    }) as ReturnType<typeof useStore>)
    render(<ShoppingListPage />)
    expect(screen.getByText(/🥛/)).toBeInTheDocument()
    expect(screen.getByText(/🫙/)).toBeInTheDocument()
  })
})
