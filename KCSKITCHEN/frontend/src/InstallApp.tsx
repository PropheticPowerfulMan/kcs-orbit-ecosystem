import { useEffect, useState } from 'react'
import { Download, Share2, Smartphone, X } from 'lucide-react'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
type InstallHelpKind = 'ios' | 'safari-desktop' | 'firefox-android' | 'firefox-desktop' | 'browser-menu'

let deferredPrompt: InstallPrompt | null = null
let installed = false
const promptListeners = new Set<() => void>()

function notifyPromptListeners() {
  promptListeners.forEach(listener => listener())
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIosOrIpadOs() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function installHelpKind(): InstallHelpKind {
  if (isIosOrIpadOs()) return 'ios'
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/firefox/i.test(userAgent)) return /android/i.test(userAgent) ? 'firefox-android' : 'firefox-desktop'
  if (/safari/i.test(userAgent) && !/chrome|chromium|android/i.test(userAgent)) return 'safari-desktop'
  return 'browser-menu'
}

// Chromium exposes this event only once. Capturing it at module load makes the
// first user gesture able to open the real native installation prompt.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredPrompt = event as InstallPrompt
    notifyPromptListeners()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    notifyPromptListeners()
  })
}

export default function InstallAppButton({ lang, compact = false }: { lang: 'fr' | 'en'; compact?: boolean }) {
  const [help, setHelp] = useState(false)
  const [, renderPromptState] = useState(0)
  const standalone = isStandalone() || installed
  const helpKind = installHelpKind()

  useEffect(() => {
    const listener = () => renderPromptState(value => value + 1)
    promptListeners.add(listener)
    const media = window.matchMedia('(display-mode: standalone)')
    media.addEventListener?.('change', listener)
    return () => {
      promptListeners.delete(listener)
      media.removeEventListener?.('change', listener)
    }
  }, [])

  // Firefox desktop and Safari do not expose Chromium's prompt API. The button
  // remains visible there and opens accurate browser-specific instructions.
  if (standalone) return null

  async function install() {
    if (!deferredPrompt) {
      setHelp(true)
      return
    }
    const prompt = deferredPrompt
    deferredPrompt = null
    notifyPromptListeners()
    await prompt.prompt()
    await prompt.userChoice
  }

  const instructions = helpKind === 'ios'
    ? (lang === 'fr' ? 'Dans Safari, touchez Partager puis « Sur l’écran d’accueil ».' : 'In Safari, tap Share, then “Add to Home Screen”.')
    : helpKind === 'safari-desktop'
      ? (lang === 'fr' ? 'Dans Safari, ouvrez le menu Fichier puis choisissez « Ajouter au Dock ».' : 'In Safari, open the File menu, then choose “Add to Dock”.')
      : helpKind === 'firefox-android'
        ? (lang === 'fr' ? 'Dans Firefox, ouvrez le menu du navigateur puis choisissez « Installer » ou « Ajouter à l’écran d’accueil ».' : 'In Firefox, open the browser menu, then choose “Install” or “Add to Home screen”.')
        : helpKind === 'firefox-desktop'
          ? (lang === 'fr' ? 'Firefox pour ordinateur ne propose pas l’installation PWA directe. Ouvrez cette page dans Edge ou Chrome pour obtenir le dialogue automatique, ou créez un raccourci depuis le menu Firefox.' : 'Desktop Firefox does not provide direct PWA installation. Open this page in Edge or Chrome for the automatic prompt, or create a shortcut from the Firefox menu.')
          : (lang === 'fr' ? 'Ouvrez le menu du navigateur puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».' : 'Open the browser menu, then choose “Install app” or “Add to Home screen”.')

  return <>
    <button className={compact ? 'install-app compact' : 'install-app'} onClick={install} title={lang === 'fr' ? 'Installer KCS Kitchen' : 'Install KCS Kitchen'}>
      <Download /> <span>{lang === 'fr' ? 'Installer' : 'Install'}</span>
    </button>
    {help && <div className="install-help-backdrop" role="dialog" aria-modal="true"><div className="install-help">
      <button className="icon-button install-help-close" onClick={() => setHelp(false)} aria-label={lang === 'fr' ? 'Fermer' : 'Close'}><X /></button>
      <Smartphone className="install-device" />
      <h2>{lang === 'fr' ? 'Installer KCS Kitchen' : 'Install KCS Kitchen'}</h2>
      <p>{instructions}</p>
      <div className="install-tip"><Share2 /> {lang === 'fr' ? 'La méthode dépend des capacités de votre navigateur.' : 'The method depends on your browser capabilities.'}</div>
      <button className="primary large" onClick={() => setHelp(false)}>{lang === 'fr' ? 'Compris' : 'Got it'}</button>
    </div></div>}
  </>
}
