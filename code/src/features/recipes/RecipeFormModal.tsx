import { useState, useRef, useEffect } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useStore } from '../../store'
import type { Recipe, RecipeIngredient, Ingredient } from '../../types'

const TAG_COLORS = ['#f07045','#f5a623','#4caf50','#2196f3','#9c27b0','#e05c5c','#00bcd4','#795548','#607d8b','#ff5722']

interface IngredientRow {
  ingredientId: string
  ingredientName: string
  quantity: number
  unit: string
  locked: boolean
}

interface RecipeFormModalProps {
  open: boolean
  onClose: () => void
  recipe?: Recipe
}

export function RecipeFormModal({ open, onClose, recipe }: RecipeFormModalProps) {
  const { ingredientsDb, tags, addRecipe, updateRecipe, deleteRecipe, addIngredient, addTag, showToast } = useStore()

  const [emoji, setEmoji] = useState(recipe?.emoji ?? '🍽️')
  const [name, setName] = useState(recipe?.name ?? '')
  const [servings, setServings] = useState(recipe?.servings ?? 2)
  const [selectedTags, setSelectedTags] = useState<string[]>(recipe?.tagNames ?? [])
  const [notes, setNotes] = useState(recipe?.notes ?? '')
  const [ingRows, setIngRows] = useState<IngredientRow[]>(() => {
    if (!recipe) return []
    return recipe.ingredients.map(ri => {
      const ing = ingredientsDb.find(x => x.id === ri.ingredientId)
      return {
        ingredientId: ri.ingredientId,
        ingredientName: ing?.name ?? '',
        quantity: ri.quantity,
        unit: ing?.default_unit ?? '',
        locked: true,
      }
    })
  })

  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [showTagForm, setShowTagForm] = useState(false)

  function reset() {
    setEmoji(recipe?.emoji ?? '🍽️')
    setName(recipe?.name ?? '')
    setServings(recipe?.servings ?? 2)
    setSelectedTags(recipe?.tagNames ?? [])
    setNotes(recipe?.notes ?? '')
    setIngRows(recipe ? recipe.ingredients.map(ri => {
      const ing = ingredientsDb.find(x => x.id === ri.ingredientId)
      return { ingredientId: ri.ingredientId, ingredientName: ing?.name ?? '', quantity: ri.quantity, unit: ing?.default_unit ?? '', locked: true }
    }) : [])
    setNewTagName('')
    setShowTagForm(false)
  }

  useEffect(() => {
    if (open) reset()
  }, [open])

  function addIngRow() {
    setIngRows(r => [...r, { ingredientId: '', ingredientName: '', quantity: 1, unit: '', locked: false }])
  }

  function removeIngRow(i: number) {
    setIngRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateIngRow(i: number, patch: Partial<IngredientRow>) {
    setIngRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }

  function handleSave() {
    if (!name.trim()) { showToast('Recipe name is required', 'amber'); return }
    const finalIngredients: RecipeIngredient[] = ingRows
      .filter(r => r.ingredientId && r.quantity > 0)
      .map(r => ({ ingredientId: r.ingredientId, quantity: r.quantity }))
    const data = { emoji, name: name.trim(), servings, tagNames: selectedTags, ingredients: finalIngredients, notes }
    if (recipe) {
      updateRecipe({ ...recipe, ...data })
      showToast('Recipe updated')
    } else {
      addRecipe(data)
      showToast('Recipe added')
    }
    onClose()
  }

  function handleDelete() {
    if (!recipe) return
    if (!confirm(`Delete "${recipe.name}"?`)) return
    deleteRecipe(recipe.id)
    showToast('Recipe deleted')
    onClose()
  }

  function handleAddTag() {
    if (!newTagName.trim()) return
    addTag(newTagName.trim(), newTagColor)
    setSelectedTags(t => [...t, newTagName.trim()])
    setNewTagName('')
    setShowTagForm(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recipe ? 'Edit Recipe' : 'New Recipe'}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          {recipe ? (
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-coral btn-sm" onClick={handleSave}>Save</button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div>
            <label className="form-label">Emoji</label>
            <input className="form-input" style={{ width: 60, textAlign: 'center', fontSize: 20 }}
              value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="Recipe name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Servings</label>
            <input className="form-input" type="number" style={{ width: 70 }} min={1}
              value={servings} onChange={e => setServings(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        </div>

        <div>
          <label className="form-label">Tags</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {tags.map(t => (
              <button key={t.id} onClick={() => setSelectedTags(prev =>
                prev.includes(t.name) ? prev.filter(x => x !== t.name) : [...prev, t.name]
              )}
                style={{
                  background: selectedTags.includes(t.name) ? t.color : 'transparent',
                  color: selectedTags.includes(t.name) ? 'white' : t.color,
                  border: `1px solid ${t.color}`,
                  padding: '3px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t.name}
              </button>
            ))}
            <button className="btn btn-ghost btn-xs" onClick={() => setShowTagForm(v => !v)}>+ New tag</button>
          </div>
          {showTagForm && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="form-input" style={{ width: 120 }} placeholder="Tag name"
                value={newTagName} onChange={e => setNewTagName(e.target.value)} />
              <div style={{ display: 'flex', gap: 4 }}>
                {TAG_COLORS.map(c => (
                  <div key={c} className={`color-swatch${newTagColor === c ? ' selected' : ''}`}
                    style={{ background: c }} onClick={() => setNewTagColor(c)} />
                ))}
              </div>
              <button className="btn btn-primary btn-xs" onClick={handleAddTag}>Add</button>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Ingredients</label>
            <button className="btn btn-ghost btn-xs" onClick={addIngRow}>+ Add ingredient</button>
          </div>
          {ingRows.map((row, i) => (
            <IngredientFormRow
              key={i}
              row={row}
              ingredientsDb={ingredientsDb}
              onChange={patch => updateIngRow(i, patch)}
              onRemove={() => removeIngRow(i)}
              onCreateIngredient={(name, unit) => {
                const created = addIngredient(name, unit)
                updateIngRow(i, { ingredientId: created.id, ingredientName: created.name, unit: created.default_unit, locked: true })
              }}
            />
          ))}
          {ingRows.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '8px 0' }}>No ingredients yet.</div>
          )}
        </div>

        <div>
          <label className="form-label">Notes / Instructions</label>
          <textarea className="form-input" rows={4} placeholder="Cooking instructions..."
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical' }} />
        </div>
      </div>
    </Modal>
  )
}

interface IngRowProps {
  row: IngredientRow
  ingredientsDb: Ingredient[]
  onChange: (patch: Partial<IngredientRow>) => void
  onRemove: () => void
  onCreateIngredient: (name: string, unit: string) => void
}

function IngredientFormRow({ row, ingredientsDb, onChange, onRemove, onCreateIngredient }: IngRowProps) {
  const [query, setQuery] = useState(row.ingredientName)
  const [showDropdown, setShowDropdown] = useState(false)
  const [pendingCreate, setPendingCreate] = useState(false)
  const [newUnit, setNewUnit] = useState('g')
  const wrapRef = useRef<HTMLDivElement>(null)

  const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'cloves', 'tbsp', 'tsp']

  const suggestions = query.length >= 2
    ? ingredientsDb.filter(i => i.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  function selectIngredient(ing: Ingredient) {
    onChange({ ingredientId: ing.id, ingredientName: ing.name, unit: ing.default_unit, locked: true })
    setQuery(ing.name)
    setShowDropdown(false)
    setPendingCreate(false)
  }

  function handleBlur() {
    setTimeout(() => setShowDropdown(false), 150)
  }

  function confirmCreate() {
    onCreateIngredient(query.trim(), newUnit)
    setPendingCreate(false)
    setShowDropdown(false)
  }

  return (
    <div style={{ marginBottom: 6 }}>
      <div className="ingredient-form-row">
        <div className="autocomplete-wrap" ref={wrapRef}>
          <input
            className="form-input"
            placeholder="Ingredient name"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              onChange({ ingredientId: '', ingredientName: e.target.value, locked: false })
              setShowDropdown(true)
              setPendingCreate(false)
            }}
            onFocus={() => { if (query.length >= 2) setShowDropdown(true) }}
            onBlur={handleBlur}
          />
          {showDropdown && (suggestions.length > 0 || (query.length >= 2)) && (
            <div className="autocomplete-dropdown">
              {suggestions.map(ing => (
                <div key={ing.id} className="autocomplete-option" onMouseDown={() => selectIngredient(ing)}>
                  <span>{ing.name}</span>
                  <span className="autocomplete-unit">{ing.default_unit}</span>
                </div>
              ))}
              {suggestions.length === 0 && query.length >= 2 && (
                <div className="autocomplete-option" style={{ color: 'var(--coral)', fontWeight: 600 }}
                  onMouseDown={() => { setPendingCreate(true); setShowDropdown(false) }}>
                  + Create "{query}"
                </div>
              )}
            </div>
          )}
        </div>
        <input
          className="form-input"
          type="number"
          min="0"
          step="any"
          placeholder="Qty"
          value={row.quantity}
          onChange={e => onChange({ quantity: parseFloat(e.target.value) || 0 })}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', padding: '0 8px', height: 38 }}>
          {row.unit || '—'}
        </div>
        <button className="rd-act danger" style={{ width: 36, height: 36 }} onClick={onRemove}>✕</button>
      </div>
      {pendingCreate && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, paddingLeft: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Unit for "{query}":</span>
          <select className="form-input" style={{ width: 80 }} value={newUnit} onChange={e => setNewUnit(e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
          <button className="btn btn-coral btn-xs" onClick={confirmCreate}>Create</button>
          <button className="btn btn-ghost btn-xs" onClick={() => setPendingCreate(false)}>Cancel</button>
        </div>
      )}
    </div>
  )
}
