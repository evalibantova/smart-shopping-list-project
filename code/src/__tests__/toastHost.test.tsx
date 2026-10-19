import { describe, it, expect, afterEach } from 'vitest'
import { act } from 'react'
import { ToastHost } from '../components/ui/ToastHost'
import { useToastStore } from '../store/toastStore'
import { renderWithClient } from '../test/renderWithClient'

afterEach(() => {
  useToastStore.setState({ message: '' })
  document.body.innerHTML = ''
})

describe('ToastHost', () => {
  it('renders nothing without a message and the message once the store has one', () => {
    renderWithClient(<ToastHost />)
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
    act(() => useToastStore.getState().show('Could not save — please try again.'))
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('Could not save — please try again.')
  })

  it('dismiss clears the message', () => {
    renderWithClient(<ToastHost />)
    act(() => useToastStore.getState().show('Oops'))
    act(() => useToastStore.getState().dismiss())
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
  })
})
