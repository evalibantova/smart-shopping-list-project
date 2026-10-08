import { useEffect, useRef } from 'react'

interface ToastProps {
  message: string
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  const dismissRef = useRef(onDismiss)
  useEffect(() => { dismissRef.current = onDismiss })
  useEffect(() => {
    const t = setTimeout(() => dismissRef.current(), 3000)
    return () => clearTimeout(t)
  }, [])

  if (!message) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface2)',
        boxShadow: 'var(--shadow-md)',
        padding: '12px 20px',
        borderRadius: 4,
        fontSize: 14,
        zIndex: 2000,
        color: 'var(--text)',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  )
}
