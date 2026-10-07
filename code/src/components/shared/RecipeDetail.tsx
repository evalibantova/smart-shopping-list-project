import { useState, useEffect } from 'react'
import { Pencil, CalendarPlus, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import { ingredientsDbService } from '../../services/ingredientsDbService'
import { IconButton } from '../ui/IconButton'
import { TagChip } from '../ui/TagChip'

interface RecipeDetailProps {
  recipeId: string | null
  context: 'recipes' | 'meal-planner' | 'cook-now'
  onEdit?: () => void
  onDelete?: () => void
  onAddToWeek?: () => void
}

export function RecipeDetail({ recipeId, context, onEdit, onDelete, onAddToWeek }: RecipeDetailProps) {
  const recipe = useStore((s) => s.recipes.find((r) => r.id === recipeId) ?? null)
  const tags = useStore((s) => s.tags)
  const [displayServings, setDisplayServings] = useState<number | null>(null)

  useEffect(() => {
    setDisplayServings(null)
  }, [recipeId])

  if (!recipe) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          gap: 8,
          padding: 24,
        }}
      >
        <span style={{ fontSize: 40 }}>🍽️</span>
        <span style={{ fontSize: 14, textAlign: 'center' }}>Select a recipe to see details</span>
      </div>
    )
  }

  const base = recipe.servings
  const displayed = displayServings ?? base
  const scale = base > 0 ? displayed / base : 1

  const allIngredients = ingredientsDbService.getAll()
  const ingredientMap = new Map(allIngredients.map((i) => [i.id, i]))

  const recipeTags = tags.filter((t) => recipe.tagIds.includes(t.id))

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{recipe.emoji || '🍽️'}</span>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {recipe.name}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
          {onDelete && (
            <IconButton variant="danger" onClick={onDelete} aria-label="Delete recipe">
              <Trash2 size={18} />
            </IconButton>
          )}
          {onEdit && (
            <IconButton variant="default" onClick={onEdit} aria-label="Edit recipe">
              <Pencil size={18} />
            </IconButton>
          )}
          <IconButton
            variant="accent"
            onClick={context !== 'recipes' ? onAddToWeek : undefined}
            aria-label="Add to week"
            style={{ opacity: context === 'recipes' ? 0.35 : 1, cursor: context === 'recipes' ? 'default' : 'pointer' }}
          >
            <CalendarPlus size={18} />
          </IconButton>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Tags */}
        {recipeTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
            {recipeTags.map((tag) => (
              <TagChip key={tag.id} name={tag.name} color={tag.color} />
            ))}
          </div>
        )}

        {/* Servings scaler */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-mid)', flex: 1 }}>
            SERVINGS
          </span>
          <IconButton
            variant="default"
            onClick={() => setDisplayServings(Math.max(1, displayed - 1))}
            aria-label="Decrease servings"
            style={{ width: 32, height: 32 }}
          >
            <Minus size={14} />
          </IconButton>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              minWidth: 24,
              textAlign: 'center',
            }}
          >
            {displayed}
          </span>
          <IconButton
            variant="default"
            onClick={() => setDisplayServings(displayed + 1)}
            aria-label="Increase servings"
            style={{ width: 32, height: 32 }}
          >
            <Plus size={14} />
          </IconButton>
          {displayServings !== null && (
            <IconButton
              variant="default"
              onClick={() => setDisplayServings(null)}
              aria-label="Reset servings"
              style={{ width: 32, height: 32 }}
            >
              <RotateCcw size={13} />
            </IconButton>
          )}
        </div>

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-mid)',
                marginBottom: 8,
                letterSpacing: '0.04em',
              }}
            >
              INGREDIENTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recipe.ingredients.map((ing, idx) => {
                const entry = ingredientMap.get(ing.ingredientId)
                if (!entry) return null
                const scaledQty = Math.round(ing.quantity * scale * 100) / 100
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--text)' }}>{entry.name}</span>
                    <span style={{ color: 'var(--text-mid)', fontWeight: 600 }}>
                      {scaledQty} {entry.default_unit}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {recipe.notes && (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-mid)',
                marginBottom: 8,
                letterSpacing: '0.04em',
              }}
            >
              NOTES
            </div>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {recipe.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
