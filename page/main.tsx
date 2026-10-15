import './theme/tokens.css'
import './theme/app.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { pageAgent } from './agent/tools'
import { App } from './app/app'

declare global {
  interface Window {
    /** The page's door for an agent: its tools and the one way to run one. */
    pageAgent?: typeof pageAgent
  }
}
window.pageAgent = pageAgent

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
