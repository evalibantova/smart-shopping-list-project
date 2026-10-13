import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NotesMarkdown } from '../components/shared/NotesMarkdown'

describe('NotesMarkdown', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(source: string) {
    act(() => root.render(<NotesMarkdown source={source} />))
  }

  it('renders numbered steps and markdown links as clickable links', () => {
    render('1. Mix\n2. Bake\n\nZdroj: [example.com](https://example.com/r)')
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    const a = container.querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://example.com/r')
    expect(a.getAttribute('target')).toBe('_blank')
  })

  it('autolinks bare URLs and allows safe inline HTML', () => {
    render('See https://example.com/x and <b>bold</b>')
    expect(container.querySelector('a')!.getAttribute('href')).toBe('https://example.com/x')
    expect(container.querySelector('b')!.textContent).toBe('bold')
  })

  it('strips scripts and event handlers', () => {
    render('<script>window.__x=1</script><img src="x" onerror="window.__x=1">ok')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('onerror') ?? null).toBeNull()
  })
})
