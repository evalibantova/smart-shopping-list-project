interface FilterTabsProps {
  tabs: readonly string[]
  active: string
  onChange: (tab: string) => void
}

export function FilterTabs({ tabs, active, onChange }: FilterTabsProps) {
  return (
    <div
      data-testid="cook-now-filter-tabs"
      role="tablist"
      style={{ display: 'flex', flexDirection: 'row', gap: 6 }}
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          style={{
            borderRadius: 20,
            padding: '5px 14px',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: active === tab ? 'var(--coral)' : 'var(--surface2)',
            color: active === tab ? 'white' : 'var(--text-mid)',
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
