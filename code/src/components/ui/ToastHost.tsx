import { Toast } from './Toast'
import { useToastStore } from '../../store/toastStore'

/** Mounted once in the AppShell. Keyed by message so a new message restarts the 3 s timer. */
export function ToastHost() {
  const message = useToastStore((s) => s.message)
  const dismiss = useToastStore((s) => s.dismiss)
  if (!message) return null
  return <Toast key={message} message={message} onDismiss={dismiss} />
}
