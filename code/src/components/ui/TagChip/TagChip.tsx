import type { Tag } from '../../../types/recipe'

interface TagChipProps {
  tag: Tag
}

export default function TagChip({ tag }: TagChipProps) {
  return (
    <span className="tag-chip" data-testid="tag-chip" style={{ color: tag.color }}>
      •&nbsp;{tag.name}
    </span>
  )
}
