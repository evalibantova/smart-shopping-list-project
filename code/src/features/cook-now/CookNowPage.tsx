export function CookNowPage() {
  return (
    <>
      <div className="page-header">
        <span className="page-title">Cook Now</span>
      </div>
      <div className="page-body" style={{ overflow: 'auto' }}>
        <div className="empty-state">
          <span className="empty-state-emoji">👨‍🍳</span>
          <span className="empty-state-title">Cook Now coming soon</span>
          <span className="empty-state-desc">
            See today's planned meals with ingredient availability. Available in a future update.
          </span>
        </div>
      </div>
    </>
  )
}
