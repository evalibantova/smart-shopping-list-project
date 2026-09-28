export function PantryPage() {
  return (
    <>
      <div className="page-header">
        <span className="page-title">Pantry</span>
      </div>
      <div className="page-body" style={{ overflow: 'auto' }}>
        <div className="empty-state">
          <span className="empty-state-emoji">🏠</span>
          <span className="empty-state-title">Pantry coming soon</span>
          <span className="empty-state-desc">
            Track your home inventory here. Available in a future update.
          </span>
        </div>
      </div>
    </>
  )
}
