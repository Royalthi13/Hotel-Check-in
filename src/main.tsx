import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function enableMocking() {
  // Usamos import.meta.env.DEV (estándar de Vite) en lugar de process.env
  if (!import.meta.env.DEV) {
    return
  }
  
  const { worker } = await import('./mocks/browser')
  // Iniciamos el worker interceptando peticiones
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})