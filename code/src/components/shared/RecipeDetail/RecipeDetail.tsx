import { useState } from 'react'
import { Pencil, CalendarPlus } from 'lucide-react'
import { useIngredientsStore } from '../../../store/ingredientsStore'
import { useTagsStore } from '../../../store/tagsStore'
import TagChip from '../../ui/TagChip/TagChip'
import type { Recipe } from '../../../types/recipe'

interface RecipeDetailProps {
  recipe: Recipe
  onEdit: () => void
}

export default function RecipeDetail({ recipe, onEdit }: RecipeDetailProps) {
  const [localServings, setLocalServings] = useState(recipe.servings)
  const ingredientsDb = useIngredientsStore(s => s.ingredientsDb)
  const tags = useTagsStore(s => s.tags)

  const scaleFactor = localServings / recipe.servings

  const recipeTags = recipe.tagIds
    .map(id => tags.find(t => t.id === id))
    .filter(Boolean) as import('../../../types/recipe').Tag[]

  function increment() { setLocalServings(s => s + 1) }
  function decrement() { setLocalServings(s => Math.max(1, s - 1)) }
  function reset() { setLocalServings(recipe.servings) }

  return (
    <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            data-testid="recipe-detail-emoji"
            style={{ fontSize: '32px', lineHeight: 1 }}
          >
            {recipe.emoji}
          </span>
          <span
            data-testid="recipe-detail-name"
            style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}
          >
            {recipe.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
          <button
            className="rd-act accent"
            data-testid="recipe-detail-edit-btn"
            onClick={onEdit}
            aria-label="Edit recipe"
          >
            <Pencil size={18} strokeWidth={2} />
          </button>
          <button
            className="rd-act"
            data-testid="recipe-detail-add-to-week-btn"
            disabled
            aria-label="Add to week"
          >
            <CalendarPlus size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {recipeTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {recipeTags.map(tag => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="btn btn-secondary btn-sm"
          data-testid="recipe-detail-servings-minus"
          onClick={decrement}
          aria-label="Decrease servings"
        >
          −
        </button>
        <span
          data-testid="recipe-detail-servings-display"
          style={{ minWidth: '24px', textAlign: 'center', fontWeight: 700 }}
        >
          {localServings}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          data-testid="recipe-detail-servings-plus"
          onClick={increment}
          aria-label="Increase servings"
        >
          +
        </button>
        <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>servings</span>
        {localServings !== recipe.servings && (
          <button
            className="btn btn-ghost btn-xs"
            data-testid="recipe-detail-servings-reset"
            onClick={reset}
          >
            reset
          </button>
        )}
        {localServings === recipe.servings && (
          <button
            className="btn btn-ghost btn-xs"
            data-testid="recipe-detail-servings-reset"
            onClick={reset}
            style={{ opacity: 0.4 }}
          >
            reset
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {recipe.ingredients.map((ri, idx) => {
          const ing = ingredientsDb.find(i => i.id === ri.ingredientId)
          const scaledQty = Math.round(ri.quantity * scaleFactor * 10) / 10
          return (
            <div
              key={idx}
              data-testid="recipe-detail-ingredient-row"
              style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text)' }}
            >
              <span style={{ flex: 1 }}>{ing?.name ?? ri.ingredientId}</span>
              <span style={{ fontWeight: 600 }}>{scaledQty}</span>
              <span style={{ color: 'var(--text-dim)', minWidth: '28px' }}>{ing?.defaultUnit}</span>
            </div>
          )
        })}
      </div>

      {recipe.notes && (
        <div data-testid="recipe-detail-notes" style={{ color: 'var(--text-mid)', fontSize: '14px' }}>
          {recipe.notes}
        </div>
      )}
    </div>
  )
}
