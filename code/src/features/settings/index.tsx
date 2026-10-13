import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { settingsService } from '../../services/settingsService'
import { testGeminiKey } from '../../services/recipeImport/geminiParse'
import { ImportError } from '../../services/recipeImport/types'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'

type Status =
  | { kind: 'none' }
  | { kind: 'saved' }
  | { kind: 'cleared' }
  | { kind: 'testing' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

const STATUS_TEXT: Record<Exclude<Status['kind'], 'error' | 'none'>, string> = {
  saved: 'Saved.',
  cleared: 'Key removed.',
  testing: 'Testing…',
  ok: 'Key works.',
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [value, setValue] = useState(() => settingsService.getGeminiKey())
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'none' })

  function handleSave() {
    settingsService.setGeminiKey(value)
    setValue(value.trim())
    setStatus({ kind: 'saved' })
  }

  function handleClear() {
    settingsService.clearGeminiKey()
    setValue('')
    setStatus({ kind: 'cleared' })
  }

  async function handleTest() {
    setStatus({ kind: 'testing' })
    try {
      await testGeminiKey(value.trim())
      setStatus({ kind: 'ok' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof ImportError ? err.message : 'Test failed.' })
    }
  }

  const statusText = status.kind === 'none' ? '' : status.kind === 'error' ? status.message : STATUS_TEXT[status.kind]

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton className="settings-back" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft size={20} />
          </IconButton>
          <h1>Settings</h1>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="form-label" htmlFor="gemini-key">
          Gemini API key
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            id="gemini-key"
            type={visible ? 'text' : 'password'}
            className="field"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your key"
          />
          <IconButton
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide key' : 'Show key'}
            style={{ width: 32, height: 32 }}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </IconButton>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button intent="coral" size="sm" type="button" onClick={handleSave}>
            Save
          </Button>
          <Button
            intent="secondary"
            size="sm"
            type="button"
            onClick={handleTest}
            disabled={!value.trim() || status.kind === 'testing'}
          >
            Test key
          </Button>
          <Button intent="ghost" size="sm" type="button" onClick={handleClear}>
            Clear
          </Button>
        </div>

        <p
          role="status"
          style={{ fontSize: 13, minHeight: 18, color: status.kind === 'error' ? 'var(--red)' : 'var(--text-mid)' }}
        >
          {statusText}
        </p>

        <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          The key is used to read recipes from web pages (Import from URL). Get one at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>
          . It stays in this browser and is sent only to Google. In AI Studio, restrict the key to this site's address
          (HTTP referrer) and set a low quota.
        </p>
      </div>
    </div>
  )
}
