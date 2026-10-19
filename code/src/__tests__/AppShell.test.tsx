import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppShell from '../AppShell'
import { queryKeys } from '../api/queryKeys'
import { useToastStore } from '../store/toastStore'
import { errorResponse, gate, installApi } from '../test/fetchMock'
import { ENTRY_PANCAKES, FLOUR, MILK, PANCAKES, PANTRY_FLOUR, TAG_BREAKFAST } from '../test/fixtures'
import { renderWithClient, waitFor, type Rendered } from '../test/renderWithClient'

const LISTS = {
  recipes: [PANCAKES],
  tags: [TAG_BREAKFAST],
  ingredients: [FLOUR, MILK],
  pantry: [PANTRY_FLOUR],
  mealPlan: [ENTRY_PANCAKES],
}

function shell() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('AppShell gate', () => {
  let rendered: Rendered

  afterEach(() => {
    rendered.unmount()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    useToastStore.setState({ message: '' })
  })

  const text = () => document.body.textContent ?? ''
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

  it('shows one loader until all five lists have loaded, then the page', async () => {
    const g = gate()
    const server = installApi({
      seed: LISTS,
      handler: async (call) => {
        if (call.path === '/api/recipes') await g.wait
        return undefined
      },
    })
    rendered = renderWithClient(shell(), { seed: null })
    await waitFor(() => expect(server.calls.length).toBeGreaterThanOrEqual(5))
    expect(document.body.querySelector('[role="status"]')).not.toBeNull()
    expect(text()).not.toContain('page content')

    g.open()
    await waitFor(() => expect(text()).toContain('page content'))
    expect(document.body.querySelector('[role="status"]')).toBeNull()
    expect(server.calls.filter((c) => c.method === 'GET').map((c) => c.path).sort()).toEqual([
      '/api/ingredients',
      '/api/meal-plan',
      '/api/pantry',
      '/api/recipes',
      '/api/tags',
    ])
  })

  it('shows one "can\'t reach the server" panel when a list fails, and Retry loads the app once the server is back', async () => {
    let healthy = false
    installApi({
      seed: LISTS,
      handler: (call) => (!healthy && call.path === '/api/tags' ? errorResponse(500, 'server_error') : undefined),
    })
    rendered = renderWithClient(shell(), { seed: null })
    await waitFor(() => expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("Can't reach the server"))
    expect(text()).not.toContain('page content')

    healthy = true
    await act(async () => button('Retry').click())
    await waitFor(() => expect(text()).toContain('page content'))
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
  })

  it('a later refetch that fails is silent: the page and the cached data stay', async () => {
    let failing = false
    installApi({
      seed: LISTS,
      handler: (call) => (failing && call.path === '/api/tags' ? errorResponse(500, 'server_error') : undefined),
    })
    rendered = renderWithClient(shell(), { seed: null })
    await waitFor(() => expect(text()).toContain('page content'))

    failing = true
    await act(async () => {
      await rendered.client.refetchQueries({ queryKey: queryKeys.tags })
    })
    expect(text()).toContain('page content')
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
    expect(rendered.client.getQueryData(queryKeys.tags)).toEqual([TAG_BREAKFAST])
  })

  it('hosts the global toast', async () => {
    installApi({ seed: LISTS })
    rendered = renderWithClient(shell(), { seed: null })
    await waitFor(() => expect(text()).toContain('page content'))
    act(() => useToastStore.getState().show('Could not save — please try again.'))
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('Could not save — please try again.')
  })
})
