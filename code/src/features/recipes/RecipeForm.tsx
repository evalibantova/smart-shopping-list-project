import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import IngredientAutocomplete from '../../components/ui/IngredientAutocomplete/IngredientAutocomplete'
import Modal from '../../components/ui/Modal/Modal'
import { useTagsStore } from '../../store/tagsStore'
import { useIngredientsStore } from '../../store/ingredientsStore'
import { recipeService } from '../../services/recipeService'
import type { Recipe, RecipeIngredient } from '../../types/recipe'
import type { Ingredient, IngredientUnit } from '../../types/ingredient'

interface IngredientRow {
  ingredientId: string | null
  name: string
  quantity: string
  unit: string
}

interface RecipeFormProps {
  recipe?: Recipe
  onClose: () => void
}

const TAG_COLORS = [
  'var(--coral)',
  'var(--amber)',
  'var(--tag-green)',
  'var(--tag-blue)',
  'var(--tag-purple)',
  'var(--tag-brown)',
  'var(--tag-slate)',
  'var(--tag-pink)',
]

export default function RecipeForm({ recipe, onClose }: RecipeFormProps) {
  const isEdit = recipe !== undefined
  const tags = useTagsStore(s => s.tags)
  const addTag = useTagsStore(s => s.addTag)

  const [emoji, setEmoji] = useState(recipe?.emoji ?? '')
  const [name, setName] = useState(recipe?.name ?? '')
  const [servings, setServings] = useState(recipe?.servings ?? 2)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(recipe?.tagIds ?? [])
  const [notes, setNotes] = useState(recipe?.notes ?? '')

  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(() => {
    if (!recipe || recipe.ingredients.length === 0) {
      return [{ ingredientId: null, name: '', quantity: '', unit: '' }]
    }
    const db = useIngredientsStore.getState().ingredientsDb
    return recipe.ingredients.map(ri => {
      const ing = db.find(i => i.id === ri.ingredientId)
      return {
        ingredientId: ri.ingredientId,
        name: ing?.name ?? ri.ingredientId,
        quantity: String(ri.quantity),
        unit: ing?.defaultUnit ?? '',
      }
    })
  })

  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  function handleIngredientChange(idx: number, field: keyof IngredientRow, value: string) {
    setIngredientRows(rows =>
      rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    )
  }

  function handleIngredientSelect(idx: number, ing: Ingredient) {
    setIngredientRows(rows =>
      rows.map((r, i) =>
        i === idx
          ? { ...r, ingredientId: ing.id, name: ing.name, unit: ing.defaultUnit }
          : r
      )
    )
  }

  function handleCreateIngredient(idx: number, ingName: string, unit: string) {
    const newIng = useIngredientsStore.getState().addIngredient(ingName, unit as IngredientUnit, 'Other')
    setIngredientRows(rows =>
      rows.map((r, i) =>
        i === idx
          ? { ...r, ingredientId: newIng.id, name: newIng.name, unit: newIng.defaultUnit }
          : r
      )
    )
  }

  function addIngredientRow() {
    setIngredientRows(rows => [...rows, { ingredientId: null, name: '', quantity: '', unit: '' }])
  }

  function removeIngredientRow(idx: number) {
    setIngredientRows(rows => rows.filter((_, i) => i !== idx))
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds(ids =>
      ids.includes(tagId) ? ids.filter(id => id !== tagId) : [...ids, tagId]
    )
  }

  function handleSaveNewTag() {
    if (!newTagName.trim()) return
    const tag = addTag(newTagName.trim(), newTagColor)
    setSelectedTagIds(ids => [...ids, tag.id])
    setNewTagName('')
    setShowNewTag(false)
  }

  function buildIngredients(): RecipeIngredient[] {
    return ingredientRows
      .filter(r => r.ingredientId && r.quantity)
      .map(r => ({ ingredientId: r.ingredientId!, quantity: Number(r.quantity) }))
  }

  function handleSave() {
    const data = {
      emoji,
      name,
      servings: Number(servings),
      tagIds: selectedTagIds,
      ingredients: buildIngredients(),
      notes,
    }
    if (isEdit) {
      recipeService.update(recipe!.id, data)
    } else {
      recipeService.create(data)
    }
    onClose()
  }

  function handleDelete() {
    recipeService.delete(recipe!.id)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
          {isEdit ? 'Edit recipe' : 'New recipe'}
        </h2>

        <div>
          <label className="form-label" htmlFor="recipe-emoji">Emoji</label>
          <input
            id="recipe-emoji"
            className="form-input"
            data-testid="recipe-form-emoji"
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            placeholder="🍝"
            maxLength={4}
          />
        </div>

        <div>
          <label className="form-label" htmlFor="recipe-name">Name</label>
          <input
            id="recipe-name"
            className="form-input"
            data-testid="recipe-form-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Recipe name"
          />
        </div>

        <div>
          <label className="form-label" htmlFor="recipe-servings">Servings</label>
          <input
            id="recipe-servings"
            className="form-input"
            data-testid="recipe-form-servings"
            type="number"
            min={1}
            value={servings}
            onChange={e => setServings(Number(e.target.value))}
          />
        </div>

        <div data-testid="recipe-form-tags">
          <div className="form-label">Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {tags.map(tag => (
              <button
                key={tag.id}
                className={`btn btn-xs ${selectedTagIds.includes(tag.id) ? 'btn-primary' : 'btn-secondary'}`}
                style={{ color: selectedTagIds.includes(tag.id) ? undefined : tag.color }}
                onClick={() => toggleTag(tag.id)}
                type="button"
              >
                •&nbsp;{tag.name}
              </button>
            ))}
            <button
              className="btn btn-xs btn-ghost"
              data-testid="recipe-form-new-tag-btn"
              onClick={() => setShowNewTag(v => !v)}
              type="button"
            >
              + New tag
            </button>
          </div>
          {showNewTag && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'var(--surface2)' }}>
              <input
                className="form-input"
                data-testid="recipe-form-new-tag-name"
                placeholder="Tag name"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    style={{
                      width: '24px',
                      height: '24px',
                      background: color,
                      border: newTagColor === color ? '2px solid var(--charcoal)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              <button
                className="btn btn-primary btn-sm"
                data-testid="recipe-form-new-tag-save"
                onClick={handleSaveNewTag}
                type="button"
              >
                Add tag
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="form-label">Ingredients</div>
          <div data-testid="recipe-form-ingredients" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ingredientRows.map((row, idx) => (
              <div
                key={idx}
                data-testid="recipe-form-ingredient-row"
                style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}
              >
                <div style={{ flex: 2 }}>
                  <IngredientAutocomplete
                    name={row.name}
                    ingredientId={row.ingredientId}
                    unit={row.unit}
                    onChange={v => handleIngredientChange(idx, 'name', v)}
                    onSelect={ing => handleIngredientSelect(idx, ing)}
                    onCreateNew={(ingName, unit) => handleCreateIngredient(idx, ingName, unit)}
                  />
                </div>
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: '60px' }}
                  type="number"
                  min={0}
                  placeholder="Qty"
                  value={row.quantity}
                  onChange={e => handleIngredientChange(idx, 'quantity', e.target.value)}
                  aria-label="Quantity"
                />
                {ingredientRows.length > 1 && (
                  <button
                    className="rd-act danger"
                    type="button"
                    onClick={() => removeIngredientRow(idx)}
                    aria-label="Remove ingredient"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            data-testid="recipe-form-add-ingredient"
            type="button"
            onClick={addIngredientRow}
            style={{ marginTop: '6px' }}
          >
            <Plus size={14} strokeWidth={2} />
            Add ingredient
          </button>
        </div>

        <div>
          <label className="form-label" htmlFor="recipe-notes">Notes</label>
          <textarea
            id="recipe-notes"
            className="form-input"
            data-testid="recipe-form-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Cooking instructions…"
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
          {isEdit && (
            <button
              className="btn btn-danger btn-sm"
              data-testid="recipe-form-delete"
              type="button"
              onClick={handleDelete}
            >
              Delete recipe
            </button>
          )}
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button
              className="btn btn-secondary"
              data-testid="recipe-form-cancel"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              data-testid="recipe-form-save"
              type="button"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
