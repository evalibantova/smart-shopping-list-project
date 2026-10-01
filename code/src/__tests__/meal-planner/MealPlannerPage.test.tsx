import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../App'
import { useMealPlanStore } from '../../store/mealPlanStore'

// Pin date to a known Wednesday: 2026-09-23 (week Mon 21 – Sun 27 Sep 2026)
const FAKE_NOW = new Date('2026-09-23T10:00:00Z').getTime()

function renderPlannerPage() {
  return render(
    <MemoryRouter initialEntries={['/meal-planner']}>
      <App />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FAKE_NOW)
  useMealPlanStore.setState({ slots: {} })
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

// ───────────────────────────── AC1 — Calendar Structure ─────────────────────

describe('AC1 — Calendar Structure', () => {
  it('renders 7 day columns in the header row', () => {
    renderPlannerPage()
    const dayHeaders = screen.getAllByTestId('day-header')
    expect(dayHeaders).toHaveLength(7)
  })

  it('day headers show Mon through Sun', () => {
    renderPlannerPage()
    const dayHeaders = screen.getAllByTestId('day-header')
    const dayNames = dayHeaders.map(h => h.querySelector('[data-testid="day-name"]')?.textContent)
    expect(dayNames).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('renders 3 meal rows: Breakfast, Lunch, Dinner', () => {
    renderPlannerPage()
    expect(screen.getByText(/Breakfast/i)).toBeInTheDocument()
    expect(screen.getByText(/Lunch/i)).toBeInTheDocument()
    expect(screen.getByText(/Dinner/i)).toBeInTheDocument()
  })

  it('renders exactly 21 meal slot cells (7 days × 3 meals)', () => {
    renderPlannerPage()
    const slots = screen.getAllByTestId('meal-slot')
    expect(slots).toHaveLength(21)
  })
})

// ───────────────────────────── AC2 — Week Navigation ────────────────────────

describe('AC2 — Week Navigation', () => {
  it('renders prev, next, and today buttons', () => {
    renderPlannerPage()
    expect(screen.getByTestId('nav-prev')).toBeInTheDocument()
    expect(screen.getByTestId('nav-next')).toBeInTheDocument()
    expect(screen.getByTestId('nav-today')).toBeInTheDocument()
  })

  it('shows the current week date range on initial render', () => {
    renderPlannerPage()
    expect(screen.getByTestId('week-label')).toHaveTextContent('21 – 27 Sep 2026')
  })

  it('clicking next advances to following week', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('nav-next'))
    expect(screen.getByTestId('week-label')).toHaveTextContent('28 Sep – 4 Oct 2026')
  })

  it('clicking prev goes back to previous week', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('nav-prev'))
    expect(screen.getByTestId('week-label')).toHaveTextContent('14 – 20 Sep 2026')
  })

  it('clicking today returns to current week from a future week', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('nav-next'))
    fireEvent.click(screen.getByTestId('nav-next'))
    fireEvent.click(screen.getByTestId('nav-today'))
    expect(screen.getByTestId('week-label')).toHaveTextContent('21 – 27 Sep 2026')
  })

  it('today button has data-dimmed=true when on the current week', () => {
    renderPlannerPage()
    const todayBtn = screen.getByTestId('nav-today')
    expect(todayBtn).toHaveAttribute('data-dimmed', 'true')
  })

  it('today button has data-dimmed=false when on a different week', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('nav-next'))
    const todayBtn = screen.getByTestId('nav-today')
    expect(todayBtn).toHaveAttribute('data-dimmed', 'false')
  })
})

// ───────────────────────────── AC3 — Today Highlighting ─────────────────────

describe('AC3 — Today Highlighting', () => {
  it('today column header has data-today=true', () => {
    renderPlannerPage()
    const dayHeaders = screen.getAllByTestId('day-header')
    // 2026-09-23 is Wednesday = index 2 (Mon=0, Tue=1, Wed=2)
    expect(dayHeaders[2]).toHaveAttribute('data-today', 'true')
  })

  it('non-today columns do NOT have data-today=true', () => {
    renderPlannerPage()
    const dayHeaders = screen.getAllByTestId('day-header')
    const todayHeaders = dayHeaders.filter(h => h.getAttribute('data-today') === 'true')
    expect(todayHeaders).toHaveLength(1)
  })

  it('no column is highlighted when viewing a different week', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('nav-next'))
    const dayHeaders = screen.getAllByTestId('day-header')
    const todayHeaders = dayHeaders.filter(h => h.getAttribute('data-today') === 'true')
    expect(todayHeaders).toHaveLength(0)
  })
})

// ───────────────────────────── AC4 — Mobile Horizontal Scroll ───────────────

describe('AC4 — Mobile Horizontal Scroll', () => {
  it('grid wrapper has overflow-x scroll/auto style or class', () => {
    renderPlannerPage()
    const gridWrapper = screen.getByTestId('planner-grid-wrapper')
    const style = window.getComputedStyle(gridWrapper)
    // Check either inline style or a class — JSDOM may not resolve CSS files,
    // so we test for the data attribute or inline style set on the element.
    const hasScrollClass =
      gridWrapper.classList.contains('planner-grid-wrapper') ||
      style.overflowX === 'auto' ||
      style.overflowX === 'scroll' ||
      gridWrapper.getAttribute('data-scroll') === 'true'
    expect(hasScrollClass).toBe(true)
  })
})

// ───────────────────────────── AC5 — Empty Slot Appearance ──────────────────

describe('AC5 — Empty Slot Appearance', () => {
  it('all 21 slots show a + add button when meal plan is empty', () => {
    renderPlannerPage()
    const addButtons = screen.getAllByTestId('slot-add')
    expect(addButtons).toHaveLength(21)
  })

  it('each + button is a button element (focusable)', () => {
    renderPlannerPage()
    const addButtons = screen.getAllByTestId('slot-add')
    for (const btn of addButtons) {
      expect(btn.tagName).toBe('BUTTON')
    }
  })
})

// ───────────────────────────── AC6 — Page Header Layout ─────────────────────

describe('AC6 — Page Header Layout', () => {
  it('renders page title "Meal Planner"', () => {
    renderPlannerPage()
    expect(screen.getByTestId('page-title')).toHaveTextContent('Meal Planner')
  })

  it('header contains title on left and nav group on right in one row', () => {
    renderPlannerPage()
    const header = screen.getByTestId('page-header')
    const title = screen.getByTestId('page-title')
    const navGroup = screen.getByTestId('week-nav')
    expect(header).toContainElement(title)
    expect(header).toContainElement(navGroup)
  })
})

// ───────────────────────────── AC7 — Slot Items (Populated) ─────────────────

describe('AC7 — Slot Items (Populated)', () => {
  beforeEach(() => {
    // Add a planned meal for 2026-09-21 (Monday) breakfast
    useMealPlanStore.setState({
      slots: {
        '2026-09-21-breakfast': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: false, recipeName: 'Scrambled Eggs', recipeEmoji: '🥚' },
        ],
      },
    })
  })

  it('renders a slot-item card for the planned meal', () => {
    renderPlannerPage()
    const items = screen.getAllByTestId('slot-item')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('slot-item contains the recipe name', () => {
    renderPlannerPage()
    expect(screen.getByText('Scrambled Eggs')).toBeInTheDocument()
  })

  it('slot-item contains an emoji badge', () => {
    renderPlannerPage()
    const badges = screen.getAllByTestId('slot-emoji-badge')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('cooked meal shows inline ✓ span', () => {
    useMealPlanStore.setState({
      slots: {
        '2026-09-21-breakfast': [
          { id: 'pm1', recipeId: 'r1', servings: 2, cooked: true, recipeName: 'Scrambled Eggs', recipeEmoji: '🥚' },
        ],
      },
    })
    renderPlannerPage()
    const checkSpan = screen.getAllByTestId('cooked-check')
    expect(checkSpan.length).toBeGreaterThanOrEqual(1)
    expect(checkSpan[0].tagName).toBe('SPAN')
    expect(checkSpan[0]).toHaveTextContent('✓')
  })
})

// ───────────────────────────── AC8 — Date Range Format ──────────────────────

describe('AC8 — Date Range Format', () => {
  it('date range matches D – D Mon YYYY pattern for current week', () => {
    renderPlannerPage()
    const label = screen.getByTestId('week-label').textContent ?? ''
    // Must match: single digit or double digit, en-dash, month abbr (3 letters), 4-digit year
    expect(label).toMatch(/^\d{1,2} – \d{1,2} [A-Z][a-z]{2} \d{4}$/)
  })

  it('no leading zeroes in day numbers', () => {
    renderPlannerPage()
    const label = screen.getByTestId('week-label').textContent ?? ''
    // Should NOT start with 0 for either number
    expect(label).not.toMatch(/^0\d/)
    expect(label).not.toMatch(/– 0\d/)
  })

  it('uses en-dash (–) not hyphen (-)', () => {
    renderPlannerPage()
    const label = screen.getByTestId('week-label').textContent ?? ''
    expect(label).toContain(' – ')
    expect(label).not.toContain(' - ')
  })

  it('cross-month week shows correct format (Sep–Oct boundary)', () => {
    renderPlannerPage()
    fireEvent.click(screen.getByTestId('nav-next'))
    // Next week: 28 Sep – 4 Oct 2026
    expect(screen.getByTestId('week-label')).toHaveTextContent('28 Sep – 4 Oct 2026')
  })
})
