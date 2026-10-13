import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from '../features/settings'
import SettingsGear from '../components/nav/SettingsGear'
import { settingsService } from '../services/settingsService'
import { ImportError } from '../services/recipeImport/types'
import { testGeminiKey } from '../services/recipeImport/geminiParse'

vi.mock('../services/recipeImport/geminiParse', () => ({ testGeminiKey: vi.fn() }))

// Tell React this is an act() environment so act() calls do not warn
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Settings page and gear', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>

  beforeEach(() => {
    localStorage.clear()
    vi.mocked(testGeminiKey).mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  // The key makes React mount a fresh router per path (initialEntries is only read on mount)
  function renderAt(path: string, ui: ReactNode) {
    act(() => {
      root.render(
        <MemoryRouter key={path} initialEntries={[path]}>
          {ui}
        </MemoryRouter>,
      )
    })
  }

  const input = () => container.querySelector('#gemini-key') as HTMLInputElement
  const button = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

  it('shows a saved key masked and toggles visibility', () => {
    settingsService.setGeminiKey('abc')
    renderAt('/settings', <SettingsPage />)
    expect(input().value).toBe('abc')
    expect(input().type).toBe('password')
    act(() => (container.querySelector('[aria-label="Show key"]') as HTMLButtonElement).click())
    expect(input().type).toBe('text')
  })

  it('Save persists the key and Clear removes it', () => {
    renderAt('/settings', <SettingsPage />)
    act(() => typeInto(input(), '  newkey  '))
    act(() => button('Save').click())
    expect(settingsService.getGeminiKey()).toBe('newkey')
    expect(container.textContent).toContain('Saved')

    act(() => button('Clear').click())
    expect(settingsService.hasGeminiKey()).toBe(false)
    expect(input().value).toBe('')
  })

  it('Test key is disabled while the field is empty', () => {
    renderAt('/settings', <SettingsPage />)
    expect(button('Test key').disabled).toBe(true)
  })

  it('Test key reports success', async () => {
    vi.mocked(testGeminiKey).mockResolvedValue(undefined)
    renderAt('/settings', <SettingsPage />)
    act(() => typeInto(input(), 'abc'))
    await act(async () => button('Test key').click())
    expect(testGeminiKey).toHaveBeenCalledWith('abc')
    expect(container.textContent).toContain('Key works')
  })

  it('Test key shows the error message on failure', async () => {
    vi.mocked(testGeminiKey).mockRejectedValue(new ImportError('key_rejected'))
    renderAt('/settings', <SettingsPage />)
    act(() => typeInto(input(), 'bad'))
    await act(async () => button('Test key').click())
    expect(container.textContent).toContain('Gemini rejected the key')
  })

  it('the gear links to /settings on other pages and is hidden on /settings', () => {
    renderAt('/recipes', <SettingsGear />)
    expect(container.querySelector('a[href="/settings"]')).not.toBeNull()
    renderAt('/settings', <SettingsGear />)
    expect(container.querySelector('a[href="/settings"]')).toBeNull()
  })
})
