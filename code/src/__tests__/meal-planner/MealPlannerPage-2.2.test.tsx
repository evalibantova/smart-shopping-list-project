import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'
import { useMealPlanStore } from '../../store/mealPlanStore'
import { useRecipesStore } from '../../store/recipesStore'

// Pin date to same Wednesday as Story 2.1 tests (week: Mon 21 – Sun 27 Sep 2026)
const FAKE_NOW = new Date('2026-09-23T10:00:00Z').getTime()

// Monday of the pinned week — used to seed visible slot meals
const MONDAY_ISO = '2026-09-21'

// Wednesday of the pinned week (the "today" column) — used in AC10 assertions
const WEDNESDAY_ISO = '2026-09-23'

// ── Test fixtures ────────────────────────────────────────────────────────────

const testRecipe = {
  id: 'r1',
  emoji: '🍝',
  name: 'Pasta',
  servings: 2,
  tagIds: [],
  ingredients: [],
  notes: '',
  createdAt: 0,
}

const testRecipe2 = {
  id: 'r2',
  emoji: '🍕',
  name: 'Pizza',
  servings: 4,
  tagIds: [],
  ingredients: [],
  notes: '',
  createdAt: 0,
}

/** A PlannedMeal pre-seeded in the Monday breakfast slot of the pinned week. */
const seededMeal = {
  id: 'pm1',
  recipeId: 'r1',
  servings: 2,
  cooked: false,
  recipeName: 'Pasta',
  recipeEmoji: '🍝',
}

/** Store state with one meal already in Monday breakfast. */
const slotsWithOneMeal = {
  [`${MONDAY_ISO}-breakfast`]: [seededMeal],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderPlannerPage() {
  return render(
    <MemoryRouter initialEntries={['/meal-planner']}>
      <App />
    </MemoryRouter>
  )
}

// ── Global hooks ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FAKE_NOW)
  useRecipesStore.setState({ recipes: [testRecipe] })
  useMealPlanStore.setState({ slots: {} })
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

// ─────────────────────────────────────────────────────────────────────────────
// AC1 — Empty slot tap → recipe picker opens
// ─────────────────────────────────────────────────────────────────────────────

describe('AC1 — Empty slot tap opens recipe picker', () => {
  it('clicking slot-add on an empty slot opens recipe-picker-modal', () => {
    renderPlannerPage()
    const addButtons = screen.getAllByTestId('slot-add')
    fireEvent.click(addButtons[0])
    expect(screen.getByTestId('recipe-picker-modal')).toBeInTheDocument()
  })

  it('recipe-picker-search receives focus when picker opens', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    expect(screen.getByTestId('recipe-picker-search')).toHaveFocus()
  })

  it('pressing Escape closes the picker without adding a meal', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    // Picker must be open before Escape
    expect(screen.getByTestId('recipe-picker-modal')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('recipe-picker-modal'), { key: 'Escape' })
    expect(screen.queryByTestId('recipe-picker-modal')).not.toBeInTheDocument()
    const allMeals = Object.values(useMealPlanStore.getState().slots).flat()
    expect(allMeals).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC2 — Filled slot add-more tap → recipe picker opens
// ─────────────────────────────────────────────────────────────────────────────

describe('AC2 — Filled slot add-more opens recipe picker', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('clicking slot-add-more on a filled slot opens recipe-picker-modal', () => {
    renderPlannerPage()
    // slot-add-more testid will be added to the filled-slot + button in the implementation
    const addMoreBtn = screen.getByTestId('slot-add-more')
    fireEvent.click(addMoreBtn)
    expect(screen.getByTestId('recipe-picker-modal')).toBeInTheDocument()
  })

  it('existing slot-item card is not removed when add-more picker is opened', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-add-more'))
    expect(screen.getByTestId('slot-item')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — Recipe picker modal content & search filter
// ─────────────────────────────────────────────────────────────────────────────

describe('AC3a — Search filter narrows recipe list (case-insensitive)', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [testRecipe, testRecipe2] })
  })

  it('shows all recipes when picker first opens', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    const items = screen.getAllByTestId('recipe-picker-item')
    expect(items).toHaveLength(2)
  })

  it('typing in recipe-picker-search filters to matching recipes only', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    fireEvent.change(screen.getByTestId('recipe-picker-search'), { target: { value: 'past' } })
    const items = screen.getAllByTestId('recipe-picker-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Pasta')
  })

  it('search filter is case-insensitive (uppercase query matches lowercase name)', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    fireEvent.change(screen.getByTestId('recipe-picker-search'), { target: { value: 'PIZZA' } })
    const items = screen.getAllByTestId('recipe-picker-item')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Pizza')
  })

  it('shows recipe-picker-empty-state when search matches nothing', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    fireEvent.change(screen.getByTestId('recipe-picker-search'), { target: { value: 'xyz' } })
    expect(screen.getByTestId('recipe-picker-empty-state')).toBeInTheDocument()
    expect(screen.queryAllByTestId('recipe-picker-item')).toHaveLength(0)
  })
})

describe('AC3b — Empty state when recipe store has no recipes', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [] })
  })

  it('shows recipe-picker-empty-state when no recipes exist at all', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    expect(screen.getByTestId('recipe-picker-empty-state')).toBeInTheDocument()
  })

  it('does not show any recipe-picker-item rows when store is empty', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    // Picker must be open before checking recipe list
    expect(screen.getByTestId('recipe-picker-modal')).toBeInTheDocument()
    expect(screen.queryAllByTestId('recipe-picker-item')).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC4 — Selecting a recipe from picker adds a meal card
// ─────────────────────────────────────────────────────────────────────────────

describe('AC4 — Selecting a recipe closes picker and shows slot-item', () => {
  it('clicking recipe-picker-item closes the modal immediately', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    fireEvent.click(screen.getByTestId('recipe-picker-item'))
    expect(screen.queryByTestId('recipe-picker-modal')).not.toBeInTheDocument()
  })

  it('clicking recipe-picker-item shows a slot-item card in the grid', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    fireEvent.click(screen.getByTestId('recipe-picker-item'))
    expect(screen.getAllByTestId('slot-item').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking recipe-picker-item stores the meal with the correct recipe data', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    fireEvent.click(screen.getByTestId('recipe-picker-item'))
    const allMeals = Object.values(useMealPlanStore.getState().slots).flat()
    expect(allMeals).toHaveLength(1)
    expect(allMeals[0].recipeId).toBe('r1')
    expect(allMeals[0].servings).toBe(2)
    expect(allMeals[0].recipeName).toBe('Pasta')
    expect(allMeals[0].recipeEmoji).toBe('🍝')
  })

  it('each recipe-picker-item row shows the recipe emoji, name, and servings', () => {
    renderPlannerPage()
    fireEvent.click(screen.getAllByTestId('slot-add')[0])
    const item = screen.getByTestId('recipe-picker-item')
    expect(item).toHaveTextContent('🍝')
    expect(item).toHaveTextContent('Pasta')
    expect(item).toHaveTextContent('2')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC6 — Tapping a slot card opens RecipeDetail overlay
// ─────────────────────────────────────────────────────────────────────────────

describe('AC6 — Tapping a slot card opens meal-plan overlay', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('clicking slot-item opens meal-plan-overlay', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    expect(screen.getByTestId('meal-plan-overlay')).toBeInTheDocument()
  })

  it('meal-plan-overlay contains the recipe name', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    expect(screen.getByTestId('meal-plan-overlay')).toHaveTextContent('Pasta')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC7 — Add to Week button is ENABLED in the meal-plan overlay
// ─────────────────────────────────────────────────────────────────────────────

describe('AC7 — recipe-detail-add-to-week-btn is enabled inside meal-plan overlay', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('recipe-detail-add-to-week-btn is NOT disabled when opened from a slot card', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    expect(screen.getByTestId('recipe-detail-add-to-week-btn')).not.toBeDisabled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC8 — Remove from Plan
// ─────────────────────────────────────────────────────────────────────────────

describe('AC8a — Remove from Plan removes the meal and closes overlay', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('clicking meal-plan-remove-btn removes the slot-item from the grid', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('meal-plan-remove-btn'))
    expect(screen.queryAllByTestId('slot-item')).toHaveLength(0)
  })

  it('clicking meal-plan-remove-btn closes the overlay immediately', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('meal-plan-remove-btn'))
    expect(screen.queryByTestId('meal-plan-overlay')).not.toBeInTheDocument()
  })

  it('clicking meal-plan-remove-btn removes the meal from the store', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('meal-plan-remove-btn'))
    const meals = useMealPlanStore.getState().slots[`${MONDAY_ISO}-breakfast`] ?? []
    expect(meals).toHaveLength(0)
  })
})

describe('AC8b — After removing last meal, slot-add reappears', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('slot-add button reappears in the cell after the last meal is removed', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('meal-plan-remove-btn'))
    // After removal: all 21 slots should again show slot-add
    expect(screen.getAllByTestId('slot-add')).toHaveLength(21)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC9 — Add to Week modal
// ─────────────────────────────────────────────────────────────────────────────

describe('AC9 — Add to Week modal opens with all required elements', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('clicking recipe-detail-add-to-week-btn opens add-to-week-modal', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    expect(screen.getByTestId('add-to-week-modal')).toBeInTheDocument()
  })

  it('add-to-week-modal contains exactly 7 day radio buttons', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    expect(screen.getAllByTestId('add-to-week-day-radio')).toHaveLength(7)
  })

  it('add-to-week-modal contains a slot selector with Breakfast, Lunch, Dinner options', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    const select = screen.getByTestId('add-to-week-slot-select')
    expect(select).toBeInTheDocument()
    expect(select).toHaveTextContent(/Breakfast/i)
    expect(select).toHaveTextContent(/Lunch/i)
    expect(select).toHaveTextContent(/Dinner/i)
  })

  it('add-to-week-modal contains a servings input defaulted to recipe servings', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    const servingsInput = screen.getByTestId('add-to-week-servings') as HTMLInputElement
    expect(servingsInput.value).toBe('2')
  })

  it('add-to-week-modal contains a Confirm button', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    expect(screen.getByTestId('add-to-week-confirm')).toBeInTheDocument()
  })

  it('pressing Escape closes add-to-week-modal without adding a meal', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByTestId('add-to-week-modal')).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC6-extra — Escape key closes the meal-plan overlay
// ─────────────────────────────────────────────────────────────────────────────

describe('AC6-extra — Escape key closes the meal-plan overlay', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('Escape key closes the meal-plan overlay', async () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    expect(screen.getByTestId('meal-plan-overlay')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('meal-plan-overlay')).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC3-extra — Filter clears when picker is closed and reopened
// ─────────────────────────────────────────────────────────────────────────────

describe('AC3-extra — picker search filter clears when modal is closed and reopened', () => {
  beforeEach(() => {
    useRecipesStore.setState({ recipes: [testRecipe, testRecipe2] })
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('picker search filter clears when modal is closed and reopened', async () => {
    renderPlannerPage()
    // Open picker via slot-add-more (slot has one meal already)
    fireEvent.click(screen.getByTestId('slot-add-more'))
    // Type a filter that narrows to 1 result
    fireEvent.change(screen.getByTestId('recipe-picker-search'), { target: { value: 'past' } })
    expect(screen.getAllByTestId('recipe-picker-item')).toHaveLength(1)
    // Close the picker via Escape
    fireEvent.keyDown(screen.getByTestId('recipe-picker-modal'), { key: 'Escape' })
    expect(screen.queryByTestId('recipe-picker-modal')).not.toBeInTheDocument()
    // Reopen picker
    fireEvent.click(screen.getByTestId('slot-add-more'))
    // Both recipes should be shown (filter was reset)
    expect(screen.getAllByTestId('recipe-picker-item')).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC8-extra — Removing one of two meals leaves the remaining card and slot-add-more
// ─────────────────────────────────────────────────────────────────────────────

describe('AC8-extra — removing one of two meals leaves the remaining card and slot-add-more', () => {
  const seededMeal2 = {
    id: 'pm2',
    recipeId: 'r2',
    servings: 4,
    cooked: false,
    recipeName: 'Pizza',
    recipeEmoji: '🍕',
  }

  beforeEach(() => {
    useRecipesStore.setState({ recipes: [testRecipe, testRecipe2] })
    useMealPlanStore.setState({
      slots: {
        [`${MONDAY_ISO}-breakfast`]: [seededMeal, seededMeal2],
      },
    })
  })

  it('removing one of two meals leaves the remaining card and slot-add-more', async () => {
    renderPlannerPage()
    // Click the first slot-item to open the overlay for the first meal
    const items = screen.getAllByTestId('slot-item')
    fireEvent.click(items[0])
    fireEvent.click(screen.getByTestId('meal-plan-remove-btn'))
    // Exactly 1 slot-item should remain
    expect(screen.getAllByTestId('slot-item')).toHaveLength(1)
    // slot-add-more should still be present (slot not empty)
    expect(screen.getByTestId('slot-add-more')).toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC7-extra — Cooked toggle button is present but disabled in the meal-plan overlay
// ─────────────────────────────────────────────────────────────────────────────

describe('AC7-extra — cooked toggle button is present but disabled in the meal-plan overlay', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('cooked toggle button is present but disabled in the meal-plan overlay', async () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    const cookedBtn = screen.getByTestId('recipe-detail-cooked-btn')
    expect(cookedBtn).toBeInTheDocument()
    expect(cookedBtn).toBeDisabled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AC10 — Confirm in Add to Week
// ─────────────────────────────────────────────────────────────────────────────

describe('AC10 — Confirm in Add to Week adds the meal and closes modal', () => {
  beforeEach(() => {
    useMealPlanStore.setState({ slots: slotsWithOneMeal })
  })

  it('clicking add-to-week-confirm closes add-to-week-modal', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    // Select first day radio (Monday of current week)
    fireEvent.click(screen.getAllByTestId('add-to-week-day-radio')[0])
    // Select Lunch slot
    fireEvent.change(screen.getByTestId('add-to-week-slot-select'), { target: { value: 'lunch' } })
    fireEvent.click(screen.getByTestId('add-to-week-confirm'))
    expect(screen.queryByTestId('add-to-week-modal')).not.toBeInTheDocument()
  })

  it('after confirming, the overlay also closes', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    fireEvent.click(screen.getAllByTestId('add-to-week-day-radio')[0])
    fireEvent.change(screen.getByTestId('add-to-week-slot-select'), { target: { value: 'lunch' } })
    fireEvent.click(screen.getByTestId('add-to-week-confirm'))
    expect(screen.queryByTestId('meal-plan-overlay')).not.toBeInTheDocument()
  })

  it('after confirming, a new slot-item appears in the chosen slot', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    // Select Wednesday (index 2 = 2026-09-23, the pinned "today" column)
    fireEvent.click(screen.getAllByTestId('add-to-week-day-radio')[2])
    // Select Dinner slot (different from the seeded breakfast slot)
    fireEvent.change(screen.getByTestId('add-to-week-slot-select'), { target: { value: 'dinner' } })
    fireEvent.click(screen.getByTestId('add-to-week-confirm'))
    // There should now be 2 slot-items total (original breakfast + new dinner)
    expect(screen.getAllByTestId('slot-item').length).toBeGreaterThanOrEqual(2)
  })

  it('confirm calls addMeal with the selected day, slot, and servings', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('slot-item'))
    fireEvent.click(screen.getByTestId('recipe-detail-add-to-week-btn'))
    // Select Wednesday (index 2 = 2026-09-23)
    fireEvent.click(screen.getAllByTestId('add-to-week-day-radio')[2])
    // Select Dinner
    fireEvent.change(screen.getByTestId('add-to-week-slot-select'), { target: { value: 'dinner' } })
    // Change servings to 3
    fireEvent.change(screen.getByTestId('add-to-week-servings'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('add-to-week-confirm'))
    // Wednesday of the pinned week is 2026-09-23
    const dinnerMeals = useMealPlanStore.getState().slots[`${WEDNESDAY_ISO}-dinner`] ?? []
    expect(dinnerMeals).toHaveLength(1)
    expect(dinnerMeals[0].recipeId).toBe('r1')
    expect(dinnerMeals[0].servings).toBe(3)
    expect(dinnerMeals[0].recipeName).toBe('Pasta')
  })
})
