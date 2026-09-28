import { useState } from 'react'
import { Pencil, CalendarPlus, Check, Trash2 } from 'lucide-react'
import { TagChip } from '../ui/TagChip'
import { useStore } from '../../store'
import { useShallow } from 'zustand/shallow'
import type { MealPlanEntry, Recipe, RecipeDetailContext } from '../../types'

interface RecipeDetailProps {
  recipe: Recipe
  context: RecipeDetailContext
  mealPlanEntry?: MealPlanEntry
  onEdit?: () => void
  onAddToWeek?: () => void
  onRemoveFromPlan?: () => void
}

export function RecipeDetail({
  recipe,
  context,
  mealPlanEntry,
  onEdit,
  onAddToWeek,
  onRemoveFromPlan,
}: RecipeDetailProps) {
  const [servings, setServings] = useState(mealPlanEntry?.servings ?? recipe.servings)
  const { tags, updateMealPlanEntry, showToast, ingredientsDb } = useStore(
    useShallow(s => ({
      tags: s.tags,
      updateMealPlanEntry: s.updateMealPlanEntry,
      showToast: s.showToast,
      ingredientsDb: s.ingredientsDb,
    }))
  )
  const scale = recipe.servings > 0 ? servings / recipe.servings : 1

  const isCooked = mealPlanEntry?.cooked ?? false

  function handleCookedToggle() {
    if (!mealPlanEntry) return
    updateMealPlanEntry({ ...mealPlanEntry, cooked: !isCooked })
    showToast(isCooked ? 'Marked as uncooked' : 'Marked as cooked ✓')
  }

  const recipeTags = recipe.tagNames
    .map(name => tags.find(t => t.name === name))
    .filter(Boolean) as { id: string; name: string; color: string }[]

  return (
    <div style={{ width: '100%' }}>
      <div className="recipe-detail-header">
        <div className="recipe-detail-title">
          <span className="recipe-detail-emoji">{recipe.emoji || '🍽️'}</span>
          <span className="recipe-detail-name">{recipe.name}</span>
        </div>
        <div className="recipe-detail-actions">
          {onEdit && (
            <button className="rd-act" onClick={onEdit} title="Edit recipe">
              <Pencil size={18} />
            </button>
          )}
          {onAddToWeek && (
            <button className="rd-act accent" onClick={onAddToWeek} title="Add to week">
              <CalendarPlus size={18} />
            </button>
          )}
          {context === 'meal-planner' && mealPlanEntry && (
            <button
              className={`rd-act green${isCooked ? ' cooked' : ''}`}
              onClick={handleCookedToggle}
              title={isCooked ? 'Mark as uncooked' : 'Mark as cooked'}
            >
              <Check size={18} />
            </button>
          )}
          {context === 'meal-planner' && onRemoveFromPlan && (
            <button className="rd-act danger" onClick={onRemoveFromPlan} title="Remove from plan">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {recipeTags.length > 0 && (
        <div className="recipe-detail-tags">
          {recipeTags.map(t => <TagChip key={t.id} name={t.name} color={t.color} />)}
        </div>
      )}

      <div className="servings-scaler">
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Servings:</span>
        <button type="button" onClick={() => setServings(prev => Math.max(1, prev - 1))}>−</button>
        <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{servings}</span>
        <button type="button" onClick={() => setServings(prev => prev + 1)}>+</button>
        {servings !== recipe.servings && (
          <span className="servings-reset" onClick={() => setServings(recipe.servings)}>reset</span>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        {recipe.ingredients.map((ri, i) => {
          const ing = ingredientsDb.find(x => x.id === ri.ingredientId)
          const scaledQty = (ri.quantity * scale)
          const displayQty = scaledQty % 1 === 0 ? scaledQty : parseFloat(scaledQty.toFixed(2))
          return (
            <div key={i} className="ingredient-row">
              <span className="ingredient-name">{ing?.name ?? ri.ingredientId}</span>
              <span className="ingredient-qty">{displayQty} {ing?.default_unit ?? ''}</span>
            </div>
          )
        })}
      </div>

      {recipe.notes && (
        <div className="recipe-notes">{recipe.notes}</div>
      )}
    </div>
  )
}
