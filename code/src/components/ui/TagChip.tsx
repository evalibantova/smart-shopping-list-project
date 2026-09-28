interface TagChipProps {
  name: string
  color: string
}

export function TagChip({ name, color }: TagChipProps) {
  return (
    <span className="tag-chip" style={{ color }}>
      <span>●</span>
      <span>{name}</span>
    </span>
  )
}
