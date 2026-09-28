import { useStore } from '../../store'

export function Toast() {
  const toasts = useStore(s => s.toasts)
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.variant === 'amber' ? ' amber' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
