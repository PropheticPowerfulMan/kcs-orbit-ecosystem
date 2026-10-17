import './buttonProcessingFeedback.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)

if ('serviceWorker' in navigator) {
  // Register immediately: waiting for the full load event can delay Chromium's
  // native beforeinstallprompt and makes the install button appear unreliable.
  const kitchenScope = new URL(import.meta.env.BASE_URL, window.location.origin).href
  void navigator.serviceWorker.getRegistrations()
    .then(async registrations => {
      // Remove only broader ancestor workers (not sibling applications) so an
      // old root-scoped Nexus worker cannot claim the Kitchen launch URL.
      await Promise.all(registrations.filter(registration => registration.scope !== kitchenScope && kitchenScope.startsWith(registration.scope)).map(registration => registration.unregister()))
      const registration = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL, updateViaCache: 'none' })
      await registration.update()
    })
    .catch(() => undefined)
}
