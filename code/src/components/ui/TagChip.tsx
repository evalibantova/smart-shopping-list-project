interface TagChipProps {
  name: string
  color: string
  size?: 'default' | 'sm'
  selected?: boolean
  onClick?: () => void
}

export function TagChip({ name, color, size = 'default', selected, onClick }: TagChipProps) {
  const dotSize = size === 'sm' ? 6 : 8
  const fontSize = size === 'sm' ? 10 : 11

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        cursor: onClick ? 'pointer' : 'default',
        padding: '2px 4px',
        borderRadius: 'var(--radius)',
        outline: selected ? `2px solid var(--coral)` : 'none',
        outlineOffset: 1,
        transition: 'outline 0.1s',
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: 'var(--text-mid)',
          lineHeight: 1,
        }}
      >
        {name}
      </span>
    </span>
  )
}
