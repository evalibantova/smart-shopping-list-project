import { Minus, Plus } from 'lucide-react'

interface NumberInputProps {
  value: number | string
  onChange: (value: string) => void
  min?: number
  step?: number
  /** Width of the value field in px (stepper buttons are extra). */
  width?: number
  placeholder?: string
  'aria-label'?: string
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  step = 1,
  width = 44,
  placeholder,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  const current = parseFloat(String(value)) || 0

  function bump(dir: 1 | -1) {
    onChange(String(Math.max(min, round(current + dir * step))))
  }

  return (
    <div className="field-group">
      <button
        type="button"
        className="field-step"
        onClick={() => bump(-1)}
        disabled={current <= min}
        aria-label="Decrease"
        tabIndex={-1}
      >
        <Minus size={12} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        className="field"
        min={min}
        step="any"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        style={{ width }}
      />
      <button
        type="button"
        className="field-step"
        onClick={() => bump(1)}
        aria-label="Increase"
        tabIndex={-1}
      >
        <Plus size={12} />
      </button>
    </div>
  )
}
