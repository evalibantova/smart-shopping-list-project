import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Recipe } from '../../types/recipes'
import { recipeService } from './services/recipeService'
import { tagService } from './services/tagService'
import { useStore } from '../../store'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { TagChip } from '../../components/ui/TagChip'
import { IngredientAutocomplete } from '../../components/shared/IngredientAutocomplete'
import { IngredientDbEntry } from '../../types/ingredients'
import { ingredientsDbService } from '../../services/ingredientsDbService'

const TAG_COLORS = [
  '#f07045',
  '#f5a623',
  '#6ab04c',
  '#4a90d9',
  '#9b59b6',
  '#e05c5c',
  '#2ecc71',
  '#1a1a1a',
]

interface IngredientRow {
  ingredientId: string | null
  ingredientName: string
  quantity: number
  unit: string
}

interface AddEditRecipeModalProps {
  mode: 'add' | 'edit'
  recipe?: Recipe
  onClose: () => void
}

export function AddEditRecipeModal({ mode, recipe, onClose }: AddEditRecipeModalProps) {
  const tags = useStore((s) => s.tags)
  const addRecipe = useStore((s) => s.addRecipe)
  const updateRecipe = useStore((s) => s.updateRecipe)
  const addTag = useStore((s) => s.addTag)

  const [emoji, setEmoji] = useState(recipe?.emoji ?? '')
  const [name, setName] = useState(recipe?.name ?? '')
  const [servings, setServings] = useState(recipe?.servings ?? 2)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(recipe?.tagIds ?? [])
  const [notes, setNotes] = useState(recipe?.notes ?? '')

  // Ingredients rows
  const [rows, setRows] = useState<IngredientRow[]>(() => {
    if (!recipe || recipe.ingredients.length === 0) {
      return [{ ingredientId: null, ingredientName: '', quantity: 1, unit: '' }]
    }
    const db = ingredientsDbService.getAll()
    const dbMap = new Map(db.map((e) => [e.id, e]))
    return recipe.ingredients.map((ing) => ({
      ingredientId: ing.ingredientId,
      ingredientName: dbMap.get(ing.ingredientId)?.name ?? '',
      quantity: ing.quantity,
      unit: dbMap.get(ing.ingredientId)?.default_unit ?? '',
    }))
  })

  // New tag form state
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  function handleAddRow() {
    setRows((prev) => [...prev, { ingredientId: null, ingredientName: '', quantity: 1, unit: '' }])
  }

  function handleRemoveRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleIngredientSelect(idx: number, entry: IngredientDbEntry) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? { ...row, ingredientId: entry.id, ingredientName: entry.name, unit: entry.default_unit }
          : row
      )
    )
  }

  function handleIngredientChange(idx: number, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? { ...row, ingredientName: value, ingredientId: null, unit: '' }
          : row
      )
    )
  }

  function handleQuantityChange(idx: number, value: number) {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, quantity: value } : row))
    )
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  function handleCreateTag() {
    if (!newTagName.trim()) return
    const tag = tagService.create(newTagName.trim(), newTagColor)
    addTag(tag)
    setSelectedTagIds((prev) => [...prev, tag.id])
    setNewTagName('')
    setNewTagColor(TAG_COLORS[0])
    setShowNewTag(false)
  }

  function handleSave() {
    if (!name.trim()) return

    const validIngredients = rows
      .filter((r) => r.ingredientId !== null)
      .map((r) => ({ ingredientId: r.ingredientId!, quantity: r.quantity }))

    const data = {
      emoji: emoji.trim().slice(0, 2) || '🍽️',
      name: name.trim(),
      servings: Math.max(1, servings),
      tagIds: selectedTagIds,
      ingredients: validIngredients,
      notes: notes.trim(),
    }

    if (mode === 'add') {
      const created = recipeService.create(data)
      addRecipe(created)
    } else if (mode === 'edit' && recipe) {
      const updated = recipeService.update(recipe.id, data)
      updateRecipe(updated)
    }

    onClose()
  }

  const title = mode === 'add' ? 'New Recipe' : 'Edit Recipe'

  const footer = (
    <>
      <Button intent="ghost" size="sm" onClick={onClose} type="button">
        Cancel
      </Button>
      <Button intent="coral" size="sm" onClick={handleSave} type="button">
        Save
      </Button>
    </>
  )

  return (
    <Modal isOpen onClose={onClose} title={title} footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Emoji + Name row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)' }}>EMOJI</label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={2}
              placeholder="🍽️"
              style={{
                width: 52,
                padding: '6px 8px',
                fontSize: 20,
                textAlign: 'center',
                border: '1px solid var(--border-mid)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface2)',
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)' }}>NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recipe name"
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border-mid)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface2)',
                fontSize: 14,
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Servings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)' }}>SERVINGS</label>
          <input
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(parseInt(e.target.value) || 1)}
            style={{
              width: 80,
              padding: '6px 10px',
              border: '1px solid var(--border-mid)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface2)',
              fontSize: 14,
            }}
          />
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)' }}>TAGS</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {tags.map((tag) => (
              <TagChip
                key={tag.id}
                name={tag.name}
                color={tag.color}
                selected={selectedTagIds.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
              />
            ))}
            {!showNewTag && (
              <button
                type="button"
                onClick={() => setShowNewTag(true)}
                style={{
                  fontSize: 11,
                  color: 'var(--text-mid)',
                  background: 'transparent',
                  border: '1px dashed var(--border-mid)',
                  borderRadius: 'var(--radius)',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Plus size={11} />
                New tag
              </button>
            )}
          </div>

          {showNewTag && (
            <div
              style={{
                border: '1px solid var(--border-mid)',
                borderRadius: 'var(--radius)',
                padding: 12,
                background: 'var(--surface2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                style={{
                  padding: '5px 8px',
                  border: '1px solid var(--border-mid)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)',
                  fontSize: 13,
                }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      background: c,
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      outline: newTagColor === c ? '2px solid var(--coral)' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button intent="coral" size="xs" type="button" onClick={handleCreateTag}>
                  Add
                </Button>
                <Button
                  intent="ghost"
                  size="xs"
                  type="button"
                  onClick={() => {
                    setShowNewTag(false)
                    setNewTagName('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Ingredients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)' }}>
            INGREDIENTS
          </label>
          {rows.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <IngredientAutocomplete
                  value={row.ingredientName}
                  onChange={(v) => handleIngredientChange(idx, v)}
                  onSelect={(entry) => handleIngredientSelect(idx, entry)}
                  placeholder="Ingredient…"
                />
              </div>
              <input
                type="number"
                min={0}
                step={0.1}
                value={row.quantity}
                onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                style={{
                  width: 60,
                  padding: '6px 8px',
                  border: '1px solid var(--border-mid)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface2)',
                  fontSize: 13,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  width: 36,
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {row.unit || '—'}
              </span>
              <IconButton
                variant="danger"
                onClick={() => handleRemoveRow(idx)}
                style={{ width: 32, height: 32 }}
                aria-label="Remove ingredient"
              >
                <X size={14} />
              </IconButton>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddRow}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: 'var(--text-mid)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
              fontWeight: 600,
            }}
          >
            <Plus size={13} />
            Add ingredient
          </button>
        </div>

        {/* Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mid)' }}>NOTES</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any cooking notes or tips…"
            rows={3}
            style={{
              padding: '8px 10px',
              border: '1px solid var(--border-mid)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface2)',
              fontSize: 13,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
        </div>
      </div>
    </Modal>
  )
}
