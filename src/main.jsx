import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const container = document.getElementById('root')

// The production build ships prerendered markup (see prerender.js), so hydrate
// it rather than throwing it away. Dev serves an empty shell, so render fresh.
if (container.hasChildNodes()) {
  hydrateRoot(container, <StrictMode><App /></StrictMode>)
} else {
  createRoot(container).render(<StrictMode><App /></StrictMode>)
}
