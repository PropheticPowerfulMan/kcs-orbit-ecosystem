export function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/'
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      .then((registration) => registration.update())
      .catch((error) => console.warn('[pwa] Service worker registration failed.', error))
  })
}
