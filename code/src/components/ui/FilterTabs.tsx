interface Tab {
  key: string
  label: string
}

interface FilterTabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

export function FilterTabs({ tabs, active, onChange }: FilterTabsProps) {
  return (
    <div className="filter-tabs">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`filter-tab${active === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
