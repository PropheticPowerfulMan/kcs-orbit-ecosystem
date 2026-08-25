import InstallAppButton from '@/components/InstallAppButton'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'
import '@/index.css'
import '@/i18n'
import { getBasePath } from '@/utils/assets'
import { registerPwa } from '@/registerPwa'
import MutationFeedback from '@/components/shared/MutationFeedback'

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

registerPwa()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasePath}>
        <App />
        <MutationFeedback />
        <InstallAppButton />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
