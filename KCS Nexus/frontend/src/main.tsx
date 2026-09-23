import './buttonProcessingFeedback.js'
import InstallAppButton from '@/components/InstallAppButton'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'
import '@/index.css'
import '@/i18n'
import { getRouteBasePath } from '@/utils/assets'
import { registerPwa } from '@/registerPwa'
import MutationFeedback from '@/components/shared/MutationFeedback'
import ConnectionGuard from '@/components/shared/ConnectionGuard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
})
const routerBasePath = getRouteBasePath()

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
        <ConnectionGuard />
        <MutationFeedback />
        <InstallAppButton />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
