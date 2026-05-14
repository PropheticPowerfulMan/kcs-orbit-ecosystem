import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'
import '@/index.css'
import '@/i18n'
import { getBasePath } from '@/utils/assets'

const queryClient = new QueryClient()
const routerBasePath = getBasePath()

if (import.meta.env.DEV && 'serviceWorker' in navigator && window.location.hostname === 'localhost') {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().catch(() => undefined)
      })
    })
    .catch(() => undefined)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasePath}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
