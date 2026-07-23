import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { parseApiBaseUrl } from './config/environment'
import './styles/index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('The application root is unavailable.')
}

const root = createRoot(rootElement)

try {
  const apiBaseUrl = parseApiBaseUrl(import.meta.env.VITE_API_BASE_URL)

  root.render(
    <StrictMode>
      <BrowserRouter>
        <App apiBaseUrl={apiBaseUrl} />
      </BrowserRouter>
    </StrictMode>,
  )
} catch {
  root.render(
    <StrictMode>
      <main className="configuration-error">
        <h1>Application unavailable</h1>
        <p>The application is not configured correctly. Contact an administrator.</p>
      </main>
    </StrictMode>,
  )
}
