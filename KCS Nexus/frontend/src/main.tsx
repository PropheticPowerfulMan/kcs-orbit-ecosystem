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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasePath}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
