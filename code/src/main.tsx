import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/tokens.css'
import App from './App'
import { ingredientsDbService } from './services/ingredientsDbService'

ingredientsDbService.seedIfEmpty()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('No #root element found')

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
