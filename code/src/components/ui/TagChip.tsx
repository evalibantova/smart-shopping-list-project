import { Check } from 'lucide-react'

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

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 8px',
    font: 'inherit',
    cursor: onClick ? 'pointer' : 'default',
    border: 'none',
    borderRadius: 4,
    // selected = tinted background in the tag's own colour + check mark
    background: selected ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
    transition: 'background-color 0.15s ease',
  }

  const content = (
    <>
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
          color: selected ? color : 'var(--text-mid)',
          lineHeight: 1,
        }}
      >
        {name}
      </span>
      {selected && <Check size={fontSize + 1} strokeWidth={3} color={color} />}
    </>
  )

  if (!onClick) {
    return <span style={style}>{content}</span>
  }

  return (
    <button
      type="button"
      className="tag-chip"
      onClick={onClick}
      aria-pressed={selected ?? false}
      style={style}
    >
      {content}
    </button>
  )
}
