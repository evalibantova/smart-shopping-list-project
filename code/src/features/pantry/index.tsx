import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../../store'
import { ingredientsDbService } from '../../services/ingredientsDbService'
import { IngredientAutocomplete } from '../../components/shared/IngredientAutocomplete'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { SavingIndicator } from '../../components/ui/SavingIndicator'
import { Toast } from '../../components/ui/Toast'
import type { IngredientDbEntry } from '../../types/ingredients'

export function stockBarColor(ratio: number): string {
  if (ratio > 0.5) return 'var(--coral)'
  if (ratio >= 0.2) return 'var(--amber)'
  return 'var(--red)'
}

interface AddItemModalProps {
  onClose: () => void
  onSave: (ingredientId: string, quantity: number) => Promise<void>
}

function AddItemModal({ onClose, onSave }: AddItemModalProps) {
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientDbEntry | null>(null)
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleSelect(entry: IngredientDbEntry) {
    setSelectedIngredient(entry)
    setIngredientSearch(entry.name)
  }

  async function handleSave() {
    if (!selectedIngredient) {
      setError('Please select an ingredient.')
      return
    }
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a positive quantity.')
      return
    }
    setSaving(true)
    try {
      await onSave(selectedIngredient.id, qty)
      onClose()
    } catch {
      setError('Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add Pantry Item"
      footer={
        <>
          <Button intent="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button intent="coral" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)' }}>
            Ingredient
          </label>
          <IngredientAutocomplete
            value={ingredientSearch}
            onChange={(v) => {
              setIngredientSearch(v)
              if (!v) setSelectedIngredient(null)
            }}
            onSelect={handleSelect}
            placeholder="Search ingredient…"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mid)' }}>
            Quantity
            {selectedIngredient && (
              <span style={{ fontWeight: 400, marginLeft: 4 }}>
                ({selectedIngredient.default_unit})
              </span>
            )}
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 2"
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{error}</p>
        )}
      </div>
    </Modal>
  )
}

export default function PantryPage() {
  const pantryItems = useStore((s) => s.pantryItems)
  const addPantryItem = useStore((s) => s.addPantryItem)
  const updatePantryItem = useStore((s) => s.updatePantryItem)
  const deletePantryItem = useStore((s) => s.deletePantryItem)

  const ingredientsDb = useMemo(() => ingredientsDbService.getAll(), [])
  const ingMap = useMemo(
    () => new Map(ingredientsDb.map((i) => [i.id, i])),
    [ingredientsDb]
  )

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editMaxStock, setEditMaxStock] = useState('')
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  function startEdit(id: string, quantity: number, maxStock: number) {
    setEditingId(id)
    setEditQty(String(quantity))
    setEditMaxStock(String(maxStock))
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSave(id: string) {
    const qty = parseFloat(editQty)
    const max = parseFloat(editMaxStock)
    if (isNaN(qty) || qty < 0 || isNaN(max) || max <= 0) return
    setSaving(true)
    try {
      updatePantryItem(id, { quantity: qty, maxStock: max })
      setEditingId(null)
    } catch (err: unknown) {
      setToastMsg(err instanceof Error ? err.message : 'Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true)
    try {
      deletePantryItem(id)
      setEditingId(null)
    } catch (err: unknown) {
      setToastMsg(err instanceof Error ? err.message : 'Could not delete — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(ingredientId: string, quantity: number) {
    setSaving(true)
    try {
      addPantryItem({ ingredientId, quantity })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <SavingIndicator visible={saving} />
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg('')} />}

      <div className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flexShrink: 1 }}>
          <h1>Pantry</h1>
          {pantryItems.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pantryItems.length} item{pantryItems.length !== 1 ? 's' : ''} · click to edit
            </span>
          )}
        </div>
        <Button
          intent="primary"
          size="sm"
          style={{ paddingInline: '1.25rem' }}
          onClick={() => setShowAddModal(true)}
          data-testid="pantry-add-button"
        >
          <Plus size={14} />
          Add item
        </Button>
      </div>

      {pantryItems.length === 0 ? (
        <div
          data-testid="pantry-empty"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            gap: 12,
            color: 'var(--text-dim)',
            flex: 1,
          }}
        >
          <span style={{ fontSize: 48 }}>🫙</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-mid)', textAlign: 'center' }}>
            Your pantry is empty
          </span>
          <span style={{ fontSize: 13, textAlign: 'center' }}>
            Add items you already have at home — they'll be subtracted from your shopping list.
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {pantryItems.map((item) => {
            const ing = ingMap.get(item.ingredientId)
            const ratio = item.maxStock > 0 ? item.quantity / item.maxStock : 0
            const barColor = stockBarColor(ratio)
            const isEditing = editingId === item.id

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  data-testid="pantry-row-editing"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '12px 24px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    borderLeft: '3px solid var(--coral)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {ing?.name ?? item.ingredientId}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-mid)', minWidth: 60 }}>
                      Qty ({ing?.default_unit ?? ''})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      style={{ width: 80 }}
                      data-testid="pantry-edit-qty"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-mid)', minWidth: 60 }}>
                      Max stock
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={editMaxStock}
                      onChange={(e) => setEditMaxStock(e.target.value)}
                      style={{ width: 80 }}
                      data-testid="pantry-edit-max"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Button
                      intent="coral"
                      size="xs"
                      onClick={() => handleSave(item.id)}
                      disabled={saving}
                      data-testid="pantry-save-btn"
                    >
                      Save
                    </Button>
                    <Button
                      intent="ghost"
                      size="xs"
                      onClick={cancelEdit}
                      disabled={saving}
                      data-testid="pantry-cancel-btn"
                    >
                      Cancel
                    </Button>
                    <Button
                      intent="danger"
                      size="xs"
                      onClick={() => handleDelete(item.id)}
                      disabled={saving}
                      data-testid="pantry-delete-btn"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={item.id}
                data-testid="pantry-row"
                onClick={() => startEdit(item.id, item.quantity, item.maxStock)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                    {ing?.name ?? item.ingredientId}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 2 }}>
                    {item.quantity} {ing?.default_unit ?? ''}
                  </div>
                </div>
                <div
                  data-testid="pantry-stock-bar"
                  style={{
                    width: 52,
                    height: 6,
                    background: 'var(--border)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(ratio, 1) * 100}%`,
                      background: barColor,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAdd}
        />
      )}
    </div>
  )
}
