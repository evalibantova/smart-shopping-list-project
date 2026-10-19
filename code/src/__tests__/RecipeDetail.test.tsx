import { describe, it, expect, afterEach } from 'vitest'
import { act } from 'react'
import { RecipeDetail } from '../components/shared/RecipeDetail'
import { FLOUR, MILK, PANCAKES, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, type Rendered } from '../test/renderWithClient'

const SEED = { recipes: [PANCAKES], tags: [TAG_BREAKFAST], ingredients: [FLOUR, MILK] }

describe('RecipeDetail', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
  })

  const text = () => document.body.textContent ?? ''

  it('shows the recipe, its tags and its ingredients with units from the cached lists', () => {
    rendered = renderWithClient(<RecipeDetail recipeId="rec-pancakes" context="recipes" />, { seed: SEED })
    expect(text()).toContain('Pancakes')
    expect(text()).toContain('Breakfast')
    expect(text()).toContain('Flour')
    expect(text()).toContain('200 g')
    expect(text()).toContain('Milk')
    expect(text()).toContain('300 ml')
    expect(text()).toContain('Mix and fry.')
  })

  it('scales the quantities with the servings stepper', () => {
    rendered = renderWithClient(<RecipeDetail recipeId="rec-pancakes" context="recipes" />, { seed: SEED })
    const plus = document.body.querySelector('button[aria-label="Increase servings"]') as HTMLButtonElement
    act(() => plus.click())
    expect(text()).toContain('300 g')
    expect(text()).toContain('450 ml')
  })

  it('shows the placeholder when there is no such recipe', () => {
    rendered = renderWithClient(<RecipeDetail recipeId="nope" context="recipes" />, { seed: SEED })
    expect(text()).toContain('Select a recipe to see details')
  })
})
