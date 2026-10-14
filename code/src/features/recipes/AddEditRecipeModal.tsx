import { useState, useRef, useLayoutEffect } from 'react'
import { X, Plus, ChevronRight } from 'lucide-react'
import { Recipe } from '../../types/recipes'
import { recipeService } from './services/recipeService'
import { tagService } from './services/tagService'
import { useStore } from '../../store'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { NumberInput } from '../../components/ui/NumberInput'
import { TagChip } from '../../components/ui/TagChip'
import { IngredientAutocomplete } from '../../components/shared/IngredientAutocomplete'
import { IngredientDbEntry } from '../../types/ingredients'
import { ingredientsDbService } from '../../services/ingredientsDbService'
import type { RecipeDraft } from '../../services/recipeImport/mapToRecipe'
import type { NewIngredientProposal } from '../../services/recipeImport/types'
import { fold } from '../../services/recipeImport/ingredientMatch'

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

const NEW_TAG_COLOR = '#9E9E9E'

interface IngredientRow {
  rowId: string
  ingredientId: string | null
  ingredientName: string
  quantity: number
  unit: string
  /** Import review: quantity or match needs the user's attention. */
  flagged?: boolean
  /** Import review: the original line from the page. */
  sourceText?: string
  /** Import review: how the match was made. */
  matchedBy?: 'local' | 'ai'
  /** Import review: the quantity is a guess. */
  estimated?: boolean
  /** Import review: an ingredient to create on save when the row stays unbound. */
  newIngredient?: NewIngredientProposal | null
}

interface AddEditRecipeModalProps {
  mode: 'add' | 'edit' | 'import'
  recipe?: Recipe
  draft?: RecipeDraft
  onClose: () => void
}

export function AddEditRecipeModal({ mode, recipe, draft, onClose }: AddEditRecipeModalProps) {
  const tags = useStore((s) => s.tags)
  const addRecipe = useStore((s) => s.addRecipe)
  const updateRecipe = useStore((s) => s.updateRecipe)
  const addTag = useStore((s) => s.addTag)

  const isImport = mode === 'import'

  const [emoji, setEmoji] = useState(recipe?.emoji ?? '')
  const [name, setName] = useState(recipe?.name ?? draft?.name ?? '')
  const [servings, setServings] = useState(recipe?.servings ?? draft?.servings ?? 2)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(recipe?.tagIds ?? draft?.tagIds ?? [])
  const [pendingNewTags, setPendingNewTags] = useState<string[]>(draft?.newTags ?? [])
  const [notes, setNotes] = useState(recipe?.notes ?? draft?.notes ?? '')
  const [confirmingDrop, setConfirmingDrop] = useState(false)

  // Ingredients rows
  const [rows, setRows] = useState<IngredientRow[]>(() => {
    if (draft && draft.rows.length > 0) {
      return draft.rows.map((r) => ({ rowId: crypto.randomUUID(), ...r }))
    }
    if (!recipe || recipe.ingredients.length === 0) {
      return [{ rowId: crypto.randomUUID(), ingredientId: null, ingredientName: '', quantity: 1, unit: '' }]
    }
    const db = ingredientsDbService.getAll()
    const dbMap = new Map(db.map((e) => [e.id, e]))
    return recipe.ingredients.map((ing) => ({
      rowId: crypto.randomUUID(),
      ingredientId: ing.ingredientId,
      ingredientName: dbMap.get(ing.ingredientId)?.name ?? '',
      quantity: ing.quantity,
      unit: dbMap.get(ing.ingredientId)?.default_unit ?? '',
    }))
  })

  // The recipe name is a title: it grows with its content so one line sits on the rule
  const nameRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = nameRef.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [name])

  const [showAllTags, setShowAllTags] = useState(false)
  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))

  // New tag form state
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  function handleAddRow() {
    setRows((prev) => [...prev, { rowId: crypto.randomUUID(), ingredientId: null, ingredientName: '', quantity: 1, unit: '' }])
  }

  function handleRemoveRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleIngredientSelect(idx: number, entry: IngredientDbEntry) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? { ...row, ingredientId: entry.id, ingredientName: entry.name, unit: entry.default_unit, flagged: false, newIngredient: null, estimated: false }
          : row
      )
    )
  }

  function handleIngredientChange(idx: number, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? { ...row, ingredientName: value, ingredientId: null, unit: '', newIngredient: null, estimated: false }
          : row
      )
    )
  }

  function handleQuantityChange(idx: number, value: number) {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, quantity: value, flagged: false, estimated: false } : row))
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

  const isNewRow = (r: IngredientRow) => r.ingredientId === null && !!r.newIngredient
  const unboundCount = rows.filter((r) => r.ingredientName.trim() !== '' && r.ingredientId === null && !r.newIngredient).length
  const newIngredientCount = rows.filter(isNewRow).length
  const estimatedCount = rows.filter((r) => r.estimated && (r.ingredientId !== null || isNewRow(r))).length
  const flaggedCount = rows.filter((r) => r.flagged && !r.estimated && (r.ingredientId !== null || isNewRow(r))).length

  // A matched or new row whose quantity could not be converted would put a 0 on the shopping list
  const zeroQtyCount = rows.filter((r) => (r.ingredientId !== null || isNewRow(r)) && !(r.quantity > 0)).length
  const gateCount = unboundCount + zeroQtyCount

  function handleSave(force: boolean) {
    if (!name.trim()) return
    if (isImport && gateCount > 0 && !force) {
      setConfirmingDrop(true)
      return
    }

    // Nothing is created before this point: new ingredients and tags only exist once the user saves
    const createdIdByName = new Map<string, string>()
    const savedRows = rows.map((r) => {
      if (r.ingredientId !== null || !r.newIngredient) return r
      const key = fold(r.newIngredient.name)
      let id = createdIdByName.get(key)
      if (!id) {
        id = ingredientsDbService.create(r.newIngredient.name, r.newIngredient.default_unit, r.newIngredient.category).id
        createdIdByName.set(key, id)
      }
      return { ...r, ingredientId: id }
    })
    const createdTagIds = pendingNewTags.map((tagName) => {
      const tag = tagService.create(tagName, NEW_TAG_COLOR)
      addTag(tag)
      return tag.id
    })

    const validIngredients = savedRows
      .filter((r) => r.ingredientId !== null)
      .map((r) => ({ ingredientId: r.ingredientId!, quantity: r.quantity }))

    const data = {
      emoji: emoji.trim().slice(0, 2) || '🍽️',
      name: name.trim(),
      servings: Math.max(1, servings),
      tagIds: [...selectedTagIds, ...createdTagIds],
      ingredients: validIngredients,
      notes: notes.trim(),
    }

    if (mode === 'add' || mode === 'import') {
      const created = recipeService.create(data)
      addRecipe(created)
    } else if (mode === 'edit' && recipe) {
      const updated = recipeService.update(recipe.id, data)
      updateRecipe(updated)
    }

    onClose()
  }

  const title = mode === 'edit' ? 'Edit Recipe' : mode === 'import' ? 'Review imported recipe' : 'New Recipe'

  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

  const unmatchedText = `${unboundCount} unmatched ${plural(unboundCount, 'ingredient', 'ingredients')}`
  const confirmText =
    zeroQtyCount === 0
      ? `Save without ${unmatchedText}?`
      : unboundCount === 0
        ? `Save ${zeroQtyCount} ${plural(zeroQtyCount, 'ingredient', 'ingredients')} with quantity 0?`
        : `Save without ${unmatchedText} and with ${zeroQtyCount} at quantity 0?`

  const footer = confirmingDrop && gateCount > 0 ? (
    <>
      <span style={{ flex: 1, alignSelf: 'center', fontSize: 12, color: 'var(--amber)' }}>
        {confirmText}
      </span>
      <Button intent="ghost" size="sm" onClick={() => setConfirmingDrop(false)} type="button">
        Go back
      </Button>
      <Button intent="coral" size="sm" onClick={() => handleSave(true)} type="button">
        Save anyway
      </Button>
    </>
  ) : (
    <>
      <Button intent="ghost" size="sm" onClick={onClose} type="button">
        {isImport ? 'Discard' : 'Cancel'}
      </Button>
      <Button intent="coral" size="sm" onClick={() => handleSave(false)} type="button">
        {isImport ? 'Save recipe' : 'Save'}
      </Button>
    </>
  )

  return (
    <Modal isOpen onClose={onClose} title={title} footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {isImport && draft && (
          <div className="rf-import-banner" role="status">
            <strong>Imported from {draft.sourceHost || 'the web'}.</strong> Check everything, then save.
            {unboundCount > 0 && (
              <div>
                {unboundCount} {plural(unboundCount, 'ingredient needs', 'ingredients need')} matching.
              </div>
            )}
            {flaggedCount > 0 && (
              <div>
                {flaggedCount} {plural(flaggedCount, 'quantity', 'quantities')} to check.
              </div>
            )}
            {newIngredientCount > 0 && (
              <div>{newIngredientCount} new {plural(newIngredientCount, 'ingredient', 'ingredients')} will be created.</div>
            )}
            {estimatedCount > 0 && (
              <div>{estimatedCount} {plural(estimatedCount, 'quantity', 'quantities')} estimated.</div>
            )}
          </div>
        )}
        {/* Emoji + name */}
        <div className="rf-id-row">
          <input
            type="text"
            className="field rf-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={2}
            placeholder="🍽️"
            aria-label="Emoji"
          />
          <textarea
            ref={nameRef}
            className="field rf-title"
            rows={1}
            value={name}
            onChange={(e) => setName(e.target.value.replace(/\n/g, ' '))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault()
            }}
            placeholder="Recipe name"
            aria-label="Name"
          />
        </div>

        {/* Servings */}
        <div className="rf-inline-row">
          <span className="form-label">Servings</span>
          <NumberInput
            value={servings}
            onChange={(v) => setServings(parseInt(v) || 1)}
            min={1}
            width={44}
            aria-label="Servings"
          />
        </div>

        {/* Tags: selected ones up front, the full list on demand */}
        <div>
          <span className="form-label">
            Tags
            {selectedTags.length + pendingNewTags.length > 0 && (
              <span className="form-label-count">({selectedTags.length + pendingNewTags.length})</span>
            )}
          </span>
          <div className="rf-tags">
            {selectedTags.length === 0 && pendingNewTags.length === 0 ? (
              <span className="rf-empty">No tags selected</span>
            ) : (
              selectedTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  name={tag.name}
                  color={tag.color}
                  selected
                  onClick={() => toggleTag(tag.id)}
                />
              ))
            )}
            {pendingNewTags.map((tagName) => (
              <TagChip
                key={`new-${tagName}`}
                name={`${tagName} (new)`}
                color={NEW_TAG_COLOR}
                selected
                onClick={() => setPendingNewTags((prev) => prev.filter((n) => n !== tagName))}
              />
            ))}
          </div>
          <button
            type="button"
            className="rf-link"
            style={{ marginTop: 4 }}
            aria-expanded={showAllTags}
            onClick={() => setShowAllTags((v) => !v)}
          >
            <ChevronRight
              size={12}
              style={{
                transform: showAllTags ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
            {showAllTags ? 'Hide tags' : `Choose tags (${tags.length})`}
          </button>

          {showAllTags && (
            <div className="rf-tag-panel">
              <div className="rf-tags">
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
                  <button type="button" className="rf-new-tag" onClick={() => setShowNewTag(true)}>
                    <Plus size={11} />
                    New tag
                  </button>
                )}
              </div>

              {showNewTag && (
                <div className="rf-new-tag-form">
                  <input
                    type="text"
                    className="field"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    aria-label="Tag name"
                  />
                  <div className="rf-swatches">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="rf-swatch"
                        style={{ background: c }}
                        aria-label={`Colour ${c}`}
                        aria-pressed={newTagColor === c}
                        onClick={() => setNewTagColor(c)}
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
          )}
        </div>

        {/* Ingredients */}
        <div>
          <span className="form-label">
            Ingredients
            {rows.length > 0 && <span className="form-label-count">({rows.length})</span>}
          </span>
          <div className="rf-ing-list">
            {rows.map((row, idx) => {
              const newRow = isNewRow(row)
              const unlinked = row.ingredientName.trim() !== '' && row.ingredientId === null && !newRow
              const flagged = (row.flagged === true || row.estimated === true) && (row.ingredientId !== null || newRow)
              const hintParts = [
                newRow ? `New ingredient (${row.newIngredient!.default_unit})` : null,
                row.matchedBy === 'ai' && row.ingredientId !== null ? 'Matched by AI' : null,
                row.estimated ? '≈ estimated' : null,
              ].filter((p): p is string => p !== null)
              if (row.sourceText && (unlinked || flagged || hintParts.length > 0)) hintParts.push(`From page: ${row.sourceText}`)
              return (
                <div
                  key={row.rowId}
                  className={`rf-ing-row${unlinked ? ' rf-unlinked' : ''}${flagged ? ' rf-flagged' : ''}`}
                >
                  <div style={{ minWidth: 0 }}>
                    <IngredientAutocomplete
                      value={row.ingredientName}
                      onChange={(v) => handleIngredientChange(idx, v)}
                      onSelect={(entry) => handleIngredientSelect(idx, entry)}
                      placeholder="Ingredient…"
                    />
                    {hintParts.length > 0 && <div className="rf-ing-hint">{hintParts.join(' · ')}</div>}
                  </div>
                  <div className="qty-unit">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={row.quantity}
                      onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                      aria-label="Quantity"
                    />
                    <span className="unit">{row.unit || '—'}</span>
                  </div>
                  <IconButton
                    variant="danger"
                    onClick={() => handleRemoveRow(idx)}
                    style={{ width: 28, height: 28 }}
                    aria-label="Remove ingredient"
                  >
                    <X size={14} />
                  </IconButton>
                </div>
              )
            })}
          </div>
          <button type="button" className="rf-link" style={{ marginTop: 4 }} onClick={handleAddRow}>
            <Plus size={13} />
            Add ingredient
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="form-label" htmlFor="recipe-notes" style={{ marginBottom: 4 }}>
            Notes
          </label>
          <textarea
            id="recipe-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cooking notes, steps or tips… (Markdown and links supported)"
            rows={4}
            className="field"
          />
        </div>
      </div>
    </Modal>
  )
}
