export function SavingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: '2px solid var(--coral)',
        borderTopColor: 'transparent',
        animation: 'spin 1s linear infinite',
        zIndex: 1001,
      }}
    />
  )
}
