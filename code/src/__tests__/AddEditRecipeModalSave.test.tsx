import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { AddEditRecipeModal } from '../features/recipes/AddEditRecipeModal'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { FLOUR, MILK, PANCAKES, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { DraftRow, RecipeDraft } from '../services/recipeImport/mapToRecipe'

const SEED = { ingredients: [FLOUR, MILK], tags: [TAG_BREAKFAST] }

describe('AddEditRecipeModal: saving', () => {
  const onClose = vi.fn()
  let rendered: Rendered

  beforeEach(() => {
    onClose.mockReset()
  })

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  const text = () => document.body.textContent ?? ''
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const alertText = () => document.body.querySelector('[role="alert"]')?.textContent ?? ''
  const nameInput = () => document.body.querySelector('textarea[aria-label="Name"]') as HTMLTextAreaElement

  function renderAdd() {
    rendered = renderWithClient(<AddEditRecipeModal mode="add" onClose={onClose} />, { seed: SEED })
  }
  function renderEdit() {
    rendered = renderWithClient(<AddEditRecipeModal mode="edit" recipe={PANCAKES} onClose={onClose} />, { seed: SEED })
  }

  it('add: POSTs the recipe and closes after the server answered', async () => {
    const server = installApi({ seed: SEED })
    renderAdd()
    act(() => typeInto(nameInput(), 'Soup'))
    await act(async () => button('Save').click())
    await waitFor(() => expect(server.find('POST', '/api/recipes')).toHaveLength(1))
    expect(server.find('POST', '/api/recipes')[0].body).toEqual({
      emoji: '🍽️',
      name: 'Soup',
      servings: 2,
      tagIds: [],
      ingredients: [],
      notes: '',
    })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('add: a recipe without a name sends nothing', async () => {
    const server = installApi({ seed: SEED })
    renderAdd()
    await act(async () => button('Save').click())
    expect(server.calls).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('edit: PUTs /api/recipes/<id> with the full body and no createdAt', async () => {
    const server = installApi({ seed: { ...SEED, recipes: [PANCAKES] } })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(server.find('PUT', '/api/recipes/rec-pancakes')).toHaveLength(1))
    expect(server.find('PUT', '/api/recipes/rec-pancakes')[0].body).toEqual({
      emoji: '🥞',
      name: 'Pancakes',
      servings: 2,
      tagIds: ['tag-breakfast'],
      ingredients: [
        { ingredientId: 'ing-flour', quantity: 200 },
        { ingredientId: 'ing-milk', quantity: 300 },
      ],
      notes: 'Mix and fry.',
    })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('shows Saving… and disables the button while the request is in flight, and does not close early', async () => {
    const g = gate()
    installApi({
      seed: { ...SEED, recipes: [PANCAKES] },
      handler: async (call) => {
        if (call.method === 'PUT') await g.wait
        return undefined
      },
    })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(button('Saving…')).toBeDefined())
    expect(button('Saving…').disabled).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    g.open()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('a 409 on the recipe says something it uses no longer exists, and keeps the modal open', async () => {
    installApi({
      seed: { ...SEED, recipes: [PANCAKES] },
      handler: (call) => (call.method === 'PUT' ? errorResponse(409, 'conflict') : undefined),
    })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(alertText()).toContain('Something this recipe uses no longer exists'))
    expect(onClose).not.toHaveBeenCalled()
    expect(button('Save').disabled).toBe(false)
  })

  it('a 422 shows the validation message', async () => {
    installApi({
      seed: { ...SEED, recipes: [PANCAKES] },
      handler: (call) => (call.method === 'PUT' ? errorResponse(422, 'invalid') : undefined),
    })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(alertText()).toContain('rejected'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a network failure shows the generic save error', async () => {
    installApi({
      seed: { ...SEED, recipes: [PANCAKES] },
      handler: (call) => {
        if (call.method === 'PUT') throw new TypeError('Failed to fetch')
        return undefined
      },
    })
    renderEdit()
    await act(async () => button('Save').click())
    await waitFor(() => expect(alertText()).toBe('Could not save — please try again.'))
    expect(onClose).not.toHaveBeenCalled()
  })

  async function openNewTagForm() {
    act(() => button('Choose tags (1)').click())
    act(() => button('New tag').click())
    const input = document.body.querySelector('input[aria-label="Tag name"]') as HTMLInputElement
    act(() => typeInto(input, 'Soup'))
  }

  it('new tag: waits for the server, then selects the saved tag', async () => {
    const g = gate()
    const server = installApi({
      seed: SEED,
      handler: async (call) => {
        if (call.method === 'POST' && call.path === '/api/tags') await g.wait
        return undefined
      },
    })
    renderAdd()
    await openNewTagForm()
    await act(async () => button('Add').click())
    await waitFor(() => expect(button('Adding…')).toBeDefined())
    expect(button('Adding…').disabled).toBe(true)
    g.open()
    await waitFor(() => expect(server.find('POST', '/api/tags')).toHaveLength(1))
    expect(server.find('POST', '/api/tags')[0].body).toEqual({ name: 'Soup', color: '#f07045' })
    // the form closes and the saved tag is shown as selected
    await waitFor(() => expect(document.body.querySelector('input[aria-label="Tag name"]')).toBeNull())
    expect(text()).toContain('Tags(1)')
  })

  it('new tag: a 409 says the name already exists and keeps the form open', async () => {
    installApi({
      seed: SEED,
      handler: (call) => (call.method === 'POST' && call.path === '/api/tags' ? errorResponse(409, 'conflict') : undefined),
    })
    renderAdd()
    await openNewTagForm()
    await act(async () => button('Add').click())
    await waitFor(() => expect(alertText()).toBe('A tag with that name already exists.'))
    expect(document.body.querySelector('input[aria-label="Tag name"]')).not.toBeNull()
  })

  const newRow: DraftRow = {
    ingredientId: null,
    ingredientName: 'tahini',
    quantity: 50,
    unit: 'g',
    flagged: false,
    sourceText: '50 g tahini',
    newIngredient: { name: 'tahini', default_unit: 'g', category: 'Other' },
  }
  const importDraft = (): RecipeDraft => ({ name: 'Hummus', servings: 2, notes: '', sourceHost: 'example.com', rows: [newRow] })
  function renderImport() {
    rendered = renderWithClient(<AddEditRecipeModal mode="import" draft={importDraft()} onClose={onClose} />, { seed: SEED })
  }

  it('a 409 while creating a new ingredient says the name exists and never sends the recipe', async () => {
    const server = installApi({
      seed: SEED,
      handler: (call) => (call.path === '/api/ingredients' && call.method === 'POST' ? errorResponse(409, 'conflict') : undefined),
    })
    renderImport()
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(alertText()).toBe('An ingredient with that name already exists.'))
    expect(server.find('POST', '/api/recipes')).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a retry after a failed recipe save does not create the new ingredient twice', async () => {
    let recipeAttempts = 0
    const server = installApi({
      seed: SEED,
      handler: (call) =>
        call.method === 'POST' && call.path === '/api/recipes' && ++recipeAttempts === 1 ? errorResponse(409, 'conflict') : undefined,
    })
    renderImport()
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(alertText()).toContain('no longer exists'))
    await act(async () => button('Save recipe').click())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(server.find('POST', '/api/ingredients')).toHaveLength(1)
    expect(server.find('POST', '/api/recipes')).toHaveLength(2)
    const retryBody = server.find('POST', '/api/recipes')[1].body as { ingredients: { ingredientId: string }[] }
    expect(retryBody.ingredients[0].ingredientId).toBe('srv-1')
  })
})
