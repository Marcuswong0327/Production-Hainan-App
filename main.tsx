import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import { registerServiceWorker } from './lib/pushNotifications'

// Register service worker early so push is available after login
registerServiceWorker().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)




