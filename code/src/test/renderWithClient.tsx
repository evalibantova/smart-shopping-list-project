import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { seedClient, type Seed } from './seed'

// Tell React this is an act() environment so act() calls do not warn
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** A fresh client for one test: no retries, nothing goes stale. `seed: null` leaves the cache empty (to test loading). */
export function makeTestClient(seed: Seed | null = {}): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  if (seed !== null) seedClient(client, seed)
  return client
}

export interface Rendered {
  client: QueryClient
  container: HTMLElement
  unmount: () => void
}

export function renderWithClient(ui: ReactElement, opts: { seed?: Seed | null; client?: QueryClient } = {}): Rendered {
  const client = opts.client ?? makeTestClient(opts.seed === undefined ? {} : opts.seed)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  })
  return {
    client,
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

export function renderHookWithClient<T>(hook: () => T, opts: { seed?: Seed | null; client?: QueryClient } = {}) {
  const result = { current: undefined as T }
  function Probe() {
    result.current = hook()
    return null
  }
  return { ...renderWithClient(<Probe />, opts), result }
}

/** Retries `assertion` (flushing React between tries) until it stops throwing or the timeout passes. */
export async function waitFor(assertion: () => void, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  for (;;) {
    try {
      assertion()
      return
    } catch (err) {
      if (Date.now() - start > timeoutMs) throw err
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

/** Sets an input's or textarea's value the way a keystroke would, so React's onChange fires. */
export function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
