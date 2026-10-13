import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

const MODAL_STYLES = `
@keyframes slideUp {
  from { transform: translateY(24px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes slideUpSheet {
  from { transform: translateY(100%); }
  to   { transform: translateY(0);    }
}
.modal-card {
  background: var(--surface);
  box-shadow: var(--shadow-md);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: var(--radius);
  animation: slideUp 0.20s ease;
  display: flex;
  flex-direction: column;
}
@media (max-width: 767px) {
  .modal-card {
    max-width: 100%;
    max-height: 92vh;
    border-radius: var(--modal-radius-mobile);
    animation: slideUpSheet 0.22s ease;
    margin-top: auto;
  }
  .modal-backdrop {
    align-items: flex-end !important;
  }
}
`

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** Remove the body padding, for full-bleed content such as lists. */
  flush?: boolean
}

let styleInjected = false

export function Modal({ isOpen, onClose, title, children, footer, flush }: ModalProps) {
  useEffect(() => {
    if (!styleInjected) {
      const style = document.createElement('style')
      style.textContent = MODAL_STYLES
      document.head.appendChild(style)
      styleInjected = true
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--modal-backdrop)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '16px',
      }}
    >
      <div className="modal-card">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 12px',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em' }}>{title}</h2>
          <IconButton variant="default" onClick={onClose} aria-label="Close">
            <X size={18} />
          </IconButton>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: flush ? 0 : '4px 16px 16px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '12px 16px',
              boxShadow: '0 -1px 0 var(--border)',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
