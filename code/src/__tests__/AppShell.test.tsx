import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  })
}

function renderApp(path = '/recipes') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

beforeEach(() => {
  setViewport(1024)
})

afterEach(() => {
  cleanup()
  setViewport(1024)
})

describe('AC1 — Default route and navigation structure', () => {
  it('renders Recipes heading at /recipes', () => {
    renderApp('/recipes')
    expect(screen.getByRole('heading', { name: /^recipes$/i })).toBeInTheDocument()
  })

  it('redirects / to /recipes and renders Recipes page', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: /^recipes$/i })).toBeInTheDocument()
  })

  it('shows sidebar and no bottom nav at viewport ≥768px', () => {
    setViewport(1024)
    renderApp('/recipes')
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument()
  })

  it('shows bottom nav and no sidebar at viewport <768px', () => {
    setViewport(375)
    renderApp('/recipes')
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument()
  })
})

describe('AC2 — Desktop sidebar (≥768px)', () => {
  beforeEach(() => setViewport(1024))

  it('renders sidebar with data-testid="sidebar"', () => {
    renderApp('/recipes')
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('sidebar contains exactly 5 navigation links', () => {
    renderApp('/recipes')
    expect(within(screen.getByTestId('sidebar')).getAllByRole('link')).toHaveLength(5)
  })

  it('sidebar shows all 5 nav labels', () => {
    renderApp('/recipes')
    const sidebar = screen.getByTestId('sidebar')
    for (const label of ['Recipes', 'Meal Planner', 'Shopping List', 'Pantry', 'Cook Now']) {
      expect(within(sidebar).getByText(label)).toBeInTheDocument()
    }
  })

  it('active link at /recipes has class nav-link--active', () => {
    renderApp('/recipes')
    const activeLink = within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Recipes' })
    expect(activeLink).toHaveClass('nav-link--active')
  })

  it('active link has aria-current="page"', () => {
    renderApp('/recipes')
    const activeLink = within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Recipes' })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
  })

  it('inactive links have neither nav-link--active class nor aria-current attribute', () => {
    renderApp('/recipes')
    const inactiveLink = within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Meal Planner' })
    expect(inactiveLink).not.toHaveClass('nav-link--active')
    expect(inactiveLink).not.toHaveAttribute('aria-current', 'page')
  })

  it('Meal Planner link is active at /meal-planner', () => {
    renderApp('/meal-planner')
    const mpLink = within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Meal Planner' })
    expect(mpLink).toHaveClass('nav-link--active')
    expect(mpLink).toHaveAttribute('aria-current', 'page')
  })
})

describe('AC3 — Mobile bottom nav (<768px)', () => {
  beforeEach(() => setViewport(375))

  it('renders bottom-nav and not sidebar', () => {
    renderApp('/recipes')
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument()
  })

  it('bottom nav contains exactly 5 links', () => {
    renderApp('/recipes')
    expect(within(screen.getByTestId('bottom-nav')).getAllByRole('link')).toHaveLength(5)
  })

  it('all 5 bottom nav labels are present in sentence-case', () => {
    renderApp('/recipes')
    const nav = screen.getByTestId('bottom-nav')
    for (const label of ['Recipes', 'Meal Planner', 'Pantry', 'Cook Now', 'Shopping List']) {
      expect(within(nav).getByText(label)).toBeInTheDocument()
    }
  })

  it('active item icon has class bottom-nav-icon--active', () => {
    renderApp('/recipes')
    const activeLink = within(screen.getByTestId('bottom-nav')).getByRole('link', { name: /recipes/i })
    expect(activeLink.querySelector('svg')).toHaveClass('bottom-nav-icon--active')
  })

  it('active item label has class bottom-nav-label--active', () => {
    renderApp('/recipes')
    const activeLink = within(screen.getByTestId('bottom-nav')).getByRole('link', { name: /recipes/i })
    expect(activeLink.querySelector('span')).toHaveClass('bottom-nav-label--active')
  })

  it('active item has no background-pill class on the link element', () => {
    renderApp('/recipes')
    const activeLink = within(screen.getByTestId('bottom-nav')).getByRole('link', { name: /recipes/i })
    expect(activeLink).not.toHaveClass('active-pill')
    expect(activeLink).not.toHaveClass('bg-pill')
    expect(activeLink).not.toHaveClass('pill')
  })

  it('main content has page--mobile class providing bottom padding', () => {
    renderApp('/recipes')
    expect(document.querySelector('.page--mobile')).toBeInTheDocument()
  })
})

describe('AC4 — Clicking a nav link changes route and renders the correct page', () => {
  beforeEach(() => setViewport(1024))

  it('clicking Meal Planner renders MealPlannerPage', async () => {
    const user = userEvent.setup()
    renderApp('/recipes')
    await user.click(within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Meal Planner' }))
    expect(screen.getByRole('heading', { name: /meal planner/i })).toBeInTheDocument()
  })

  it('clicking Shopping List renders ShoppingListPage', async () => {
    const user = userEvent.setup()
    renderApp('/recipes')
    await user.click(within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Shopping List' }))
    expect(screen.getByRole('heading', { name: /shopping list/i })).toBeInTheDocument()
  })

  it('clicking Pantry renders PantryPage', async () => {
    const user = userEvent.setup()
    renderApp('/recipes')
    await user.click(within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Pantry' }))
    expect(screen.getByRole('heading', { name: /pantry/i })).toBeInTheDocument()
  })

  it('clicking Cook Now renders CookNowPage', async () => {
    const user = userEvent.setup()
    renderApp('/recipes')
    await user.click(within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Cook Now' }))
    expect(screen.getByRole('heading', { name: /cook now/i })).toBeInTheDocument()
  })

  it('clicking Recipes from another page renders RecipesPage', async () => {
    const user = userEvent.setup()
    renderApp('/meal-planner')
    await user.click(within(screen.getByTestId('sidebar')).getByRole('link', { name: 'Recipes' }))
    expect(screen.getByRole('heading', { name: /^recipes$/i })).toBeInTheDocument()
  })
})

describe('AC5 — Direct URL access renders correct page', () => {
  beforeEach(() => setViewport(1024))

  it('renders RecipesPage at /recipes', () => {
    renderApp('/recipes')
    expect(screen.getByRole('heading', { name: /^recipes$/i })).toBeInTheDocument()
  })

  it('renders MealPlannerPage at /meal-planner', () => {
    renderApp('/meal-planner')
    expect(screen.getByRole('heading', { name: /meal planner/i })).toBeInTheDocument()
  })

  it('renders ShoppingListPage at /shopping-list', () => {
    renderApp('/shopping-list')
    expect(screen.getByRole('heading', { name: /shopping list/i })).toBeInTheDocument()
  })

  it('renders PantryPage at /pantry', () => {
    renderApp('/pantry')
    expect(screen.getByRole('heading', { name: /pantry/i })).toBeInTheDocument()
  })

  it('renders CookNowPage at /cook-now', () => {
    renderApp('/cook-now')
    expect(screen.getByRole('heading', { name: /cook now/i })).toBeInTheDocument()
  })
})

describe('AC7 — Page header is always a single flex row', () => {
  beforeEach(() => setViewport(1024))

  it('every page has a .page-header element', () => {
    renderApp('/recipes')
    expect(document.querySelector('.page-header')).toBeInTheDocument()
  })

  it('.page-header does not carry a flex-col class', () => {
    renderApp('/recipes')
    expect(document.querySelector('.page-header')).not.toHaveClass('flex-col')
  })

  it('.page-header contains an h1 (title left) and .page-header-controls (controls right)', () => {
    renderApp('/recipes')
    expect(document.querySelector('.page-header h1')).toBeInTheDocument()
    expect(document.querySelector('.page-header .page-header-controls')).toBeInTheDocument()
  })

  it('MealPlannerPage header also has .page-header', () => {
    renderApp('/meal-planner')
    expect(document.querySelector('.page-header')).toBeInTheDocument()
  })
})
