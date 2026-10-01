import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

interface ModalProps {
  children: ReactNode
  onClose: () => void
}

export default function Modal({ children, onClose }: ModalProps) {
  return createPortal(
    <div
      className="picker-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="picker-modal-card">
        {children}
      </div>
    </div>,
    document.body
  )
}
