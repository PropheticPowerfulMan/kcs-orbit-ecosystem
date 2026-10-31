import './buttonProcessingFeedback.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)

if ('serviceWorker' in navigator) {
  // Register immediately: waiting for the full load event can delay Chromium's
  // native beforeinstallprompt and makes the install button appear unreliable.
  void navigator.serviceWorker.getRegistrations()
    .then(async () => {
      // Each KCS application retains its own registration. Kitchen owns only
      // /kitchen/, and the browser selects this more-specific scope.
      const registration = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL, updateViaCache: 'none' })
      await registration.update()
    })
    .catch(() => undefined)
}
