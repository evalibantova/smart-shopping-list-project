import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import App from './App.tsx'

const container = document.getElementById('root')!
// Guard against HMR re-executing this module and calling createRoot twice,
// which would attach duplicate event delegation listeners to the same node.
type RootedElement = HTMLElement & { _reactRoot?: ReturnType<typeof createRoot> }
const el = container as RootedElement
if (!el._reactRoot) {
  el._reactRoot = createRoot(el)
}
el._reactRoot.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
