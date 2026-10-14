import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { settingsService } from '../../services/settingsService'
import { importRecipeFromUrl, type ImportStage } from '../../services/recipeImport/importRecipe'
import { ImportError } from '../../services/recipeImport/types'
import type { RecipeDraft } from '../../services/recipeImport/mapToRecipe'

interface Props {
  onImported: (draft: RecipeDraft) => void
  onClose: () => void
}

const STAGE_LABEL: Record<ImportStage, string> = {
  fetching: 'Fetching page…',
  reading: 'Reading recipe…',
  matching: 'Matching ingredients…',
}

export function ImportRecipeModal({ onImported, onClose }: Props) {
  const hasKey = settingsService.hasGeminiKey()
  const [url, setUrl] = useState('')
  const [stage, setStage] = useState<ImportStage | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const working = stage !== null
  const canImport = hasKey && url.trim() !== '' && !working

  // Cancel, Escape and the backdrop all abort any request in flight before closing
  function handleCancel() {
    abortRef.current?.abort()
    onClose()
  }
  // Unmounting for any other reason (route change) aborts too
  useEffect(() => () => abortRef.current?.abort(), [])

  async function handleImport() {
    if (!canImport) return
    const controller = new AbortController()
    abortRef.current = controller
    setError('')
    setStage('fetching')
    try {
      const draft = await importRecipeFromUrl(url, { signal: controller.signal, onStage: setStage })
      // A request that resolves after Cancel must not reopen a review the user dismissed
      if (controller.signal.aborted) return
      onImported(draft)
    } catch (err) {
      if (err instanceof ImportError && err.code === 'aborted') return
      setError(err instanceof ImportError ? err.message : 'Something went wrong. Try again.')
      setStage(null)
    }
  }

  const footer = (
    <>
      <Button intent="ghost" size="sm" type="button" onClick={handleCancel}>
        Cancel
      </Button>
      <Button intent="coral" size="sm" type="button" onClick={handleImport} disabled={!canImport}>
        {stage ? STAGE_LABEL[stage] : 'Import'}
      </Button>
    </>
  )

  return (
    <Modal isOpen onClose={handleCancel} title="Import from URL" footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!hasKey && (
          <p style={{ fontSize: 13, color: 'var(--text-mid)' }}>
            Add your Gemini key in <Link to="/settings">Settings</Link> to import recipes.
          </p>
        )}
        <div>
          <label className="form-label" htmlFor="import-url">
            Recipe page address
          </label>
          <input
            id="import-url"
            type="url"
            className="field"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleImport()
            }}
            placeholder="https://…"
            disabled={working}
            autoFocus
          />
        </div>
        {error && (
          <p role="alert" style={{ fontSize: 13, color: 'var(--red)' }}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
