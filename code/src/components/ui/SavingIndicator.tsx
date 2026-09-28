import { useStore } from '../../store'

export function SavingIndicator() {
  const savingCount = useStore(s => s.savingCount)
  if (savingCount === 0) return null
  return <div className="saving-indicator" />
}
