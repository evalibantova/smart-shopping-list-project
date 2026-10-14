import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ImportRecipeModal } from '../features/recipes/ImportRecipeModal'
import { settingsService } from '../services/settingsService'
import { importRecipeFromUrl } from '../services/recipeImport/importRecipe'
import { ImportError } from '../services/recipeImport/types'
import type { RecipeDraft } from '../services/recipeImport/mapToRecipe'

// Tell React this is an act() environment so act() calls do not warn
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../services/recipeImport/importRecipe', () => ({ importRecipeFromUrl: vi.fn() }))

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const DRAFT: RecipeDraft = { name: 'X', servings: 2, rows: [], notes: '', sourceHost: 'example.com' }

describe('ImportRecipeModal', () => {
  let container: HTMLDivElement
  let root!: ReturnType<typeof createRoot>
  const onImported = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    vi.mocked(importRecipeFromUrl).mockReset()
    onImported.mockReset()
    onClose.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ''
  })

  function renderModal() {
    act(() => {
      root.render(
        <MemoryRouter>
          <ImportRecipeModal onImported={onImported} onClose={onClose} />
        </MemoryRouter>,
      )
    })
  }
  const urlInput = () => document.body.querySelector('input[type="url"]') as HTMLInputElement
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement

  it('without a key it points to Settings and keeps Import disabled', () => {
    renderModal()
    expect(document.body.querySelector('a[href="/settings"]')).not.toBeNull()
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    expect(button('Import').disabled).toBe(true)
  })

  it('with a key, Import is enabled only once a URL is typed', () => {
    settingsService.setGeminiKey('k')
    renderModal()
    expect(button('Import').disabled).toBe(true)
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    expect(button('Import').disabled).toBe(false)
  })

  it('hands the draft to onImported on success', async () => {
    settingsService.setGeminiKey('k')
    vi.mocked(importRecipeFromUrl).mockResolvedValue(DRAFT)
    renderModal()
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    await act(async () => button('Import').click())
    expect(importRecipeFromUrl).toHaveBeenCalledWith('https://example.com/p', expect.anything())
    expect(onImported).toHaveBeenCalledWith(DRAFT)
  })

  it('shows the error and re-enables Import on failure', async () => {
    settingsService.setGeminiKey('k')
    vi.mocked(importRecipeFromUrl).mockRejectedValue(new ImportError('no_recipe'))
    renderModal()
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    await act(async () => button('Import').click())
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("Couldn't find a recipe")
    expect(button('Import').disabled).toBe(false)
    expect(onImported).not.toHaveBeenCalled()
  })

  it('Cancel aborts the request and closes', async () => {
    settingsService.setGeminiKey('k')
    let signal: AbortSignal | undefined
    vi.mocked(importRecipeFromUrl).mockImplementation((_url, opts) => {
      signal = opts?.signal
      return new Promise<RecipeDraft>(() => {})
    })
    renderModal()
    act(() => typeInto(urlInput(), 'https://example.com/p'))
    await act(async () => button('Import').click())
    await act(async () => button('Cancel').click())
    expect(signal?.aborted).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
