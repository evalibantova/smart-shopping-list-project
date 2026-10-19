import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import PantryPage from '../features/pantry'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, installApi } from '../test/fetchMock'
import { FLOUR, MILK, PANTRY_FLOUR, PANTRY_MILK } from '../test/fixtures'
import { renderWithClient, typeInto, waitFor, type Rendered } from '../test/renderWithClient'
import type { PantryItem } from '../types/pantry'

const SEED = { ingredients: [FLOUR, MILK], pantry: [PANTRY_FLOUR, PANTRY_MILK] }

describe('PantryPage', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useToastStore.setState({ message: '' })
  })

  const pantry = () => rendered.client.getQueryData<PantryItem[]>(queryKeys.pantry) ?? []
  const text = () => document.body.textContent ?? ''
  const byTestId = (id: string) => document.body.querySelector(`[data-testid="${id}"]`) as HTMLElement
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement
  const render = (seed = SEED) => {
    rendered = renderWithClient(<PantryPage />, { seed })
  }

  it('lists the cached pantry with ingredient names and units', () => {
    render()
    expect(text()).toContain('Flour')
    expect(text()).toContain('500 g')
    expect(text()).toContain('Milk')
    expect(text()).toContain('100 ml')
  })

  it('editing a quantity applies it at once and PUTs the patch', async () => {
    const server = installApi({ seed: SEED })
    render()
    act(() => byTestId('pantry-row').click())
    act(() => typeInto(byTestId('pantry-edit-qty') as HTMLInputElement, '250'))
    act(() => typeInto(byTestId('pantry-edit-max') as HTMLInputElement, '2000'))
    act(() => byTestId('pantry-save-btn').click())
    expect(document.body.querySelector('[data-testid="pantry-row-editing"]')).toBeNull()
    await waitFor(() => expect(pantry()[0]).toMatchObject({ quantity: 250, maxStock: 2000 }))
    await waitFor(() => expect(server.find('PUT', '/api/pantry/pan-flour')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/pan-flour')[0].body).toEqual({ quantity: 250, maxStock: 2000 })
  })

  it('a failed save puts the old quantity back and toasts', async () => {
    installApi({ seed: SEED, handler: (call) => (call.method === 'PUT' ? errorResponse(500, 'server_error') : undefined) })
    render()
    act(() => byTestId('pantry-row').click())
    act(() => typeInto(byTestId('pantry-edit-qty') as HTMLInputElement, '250'))
    act(() => byTestId('pantry-save-btn').click())
    await waitFor(() => expect(useToastStore.getState().message).toBe('Could not save — please try again.'))
    expect(pantry()[0].quantity).toBe(500)
  })

  it('Delete removes the item at once and DELETEs it', async () => {
    const server = installApi({ seed: SEED })
    render()
    act(() => byTestId('pantry-row').click())
    act(() => byTestId('pantry-delete-btn').click())
    await waitFor(() => expect(server.find('DELETE', '/api/pantry/pan-flour')).toHaveLength(1))
    expect(pantry().map((p) => p.id)).toEqual(['pan-milk'])
  })

  async function addViaModal(name: string, search: string, qty: string) {
    act(() => byTestId('pantry-add-button').click())
    const input = document.body.querySelector('input[placeholder="Search ingredient…"]') as HTMLInputElement
    act(() => typeInto(input, search))
    const option = Array.from(document.body.querySelectorAll('[data-testid="ingredient-dropdown"] div')).find((d) =>
      d.textContent?.trim().startsWith(name),
    ) as HTMLElement
    act(() => option.click())
    act(() => typeInto(document.body.querySelector('#pantry-add-qty') as HTMLInputElement, qty))
    await act(async () => button('Save').click())
  }

  it('adding a new ingredient POSTs it with a client id and the default max stock', async () => {
    const server = installApi({ seed: { ...SEED, pantry: [PANTRY_FLOUR] } })
    render({ ...SEED, pantry: [PANTRY_FLOUR] })
    await addViaModal('Milk', 'Mil', '2')
    await waitFor(() => expect(server.find('POST', '/api/pantry')).toHaveLength(1))
    expect(server.find('POST', '/api/pantry')[0].body).toEqual({
      id: expect.any(String),
      ingredientId: 'ing-milk',
      quantity: 2,
      maxStock: 6,
    })
    await waitFor(() => expect(text()).not.toContain('Add Pantry Item'))
    expect(pantry().map((p) => p.ingredientId)).toEqual(['ing-flour', 'ing-milk'])
  })

  it('adding an ingredient that is already in the pantry adds to its quantity (PUT, no second row)', async () => {
    const server = installApi({ seed: SEED })
    render()
    await addViaModal('Flour', 'Flo', '50')
    await waitFor(() => expect(server.find('PUT', '/api/pantry/pan-flour')).toHaveLength(1))
    expect(server.find('PUT', '/api/pantry/pan-flour')[0].body).toEqual({ quantity: 550 })
    expect(server.find('POST', '/api/pantry')).toHaveLength(0)
  })

  it('a failed add shows an inline error and keeps the modal open', async () => {
    installApi({
      seed: { ...SEED, pantry: [] },
      handler: (call) => (call.method === 'POST' ? errorResponse(409, 'conflict') : undefined),
    })
    render({ ...SEED, pantry: [] })
    await addViaModal('Milk', 'Mil', '2')
    await waitFor(() => expect(text()).toContain('Could not save — please try again.'))
    expect(text()).toContain('Add Pantry Item')
    expect(pantry()).toEqual([])
  })
})
