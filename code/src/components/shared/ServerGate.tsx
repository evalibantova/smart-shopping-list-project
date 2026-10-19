import { Button } from '../ui/Button'

/** The one loader shown while the first load of the five lists is running. */
export function GateLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--text-dim)',
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '3px solid var(--coral)',
          borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite',
        }}
      />
      <span style={{ fontSize: 14 }}>Loading…</span>
    </div>
  )
}

/** Full-screen panel shown when the first load failed. */
export function ServerErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
      }}
    >
      <span style={{ fontSize: 48 }}>🔌</span>
      <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' }}>
        {"Can't reach the server"}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-mid)', textAlign: 'center', maxWidth: 320 }}>
        Check your connection and try again. Nothing you saved has been lost.
      </p>
      <Button intent="coral" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
