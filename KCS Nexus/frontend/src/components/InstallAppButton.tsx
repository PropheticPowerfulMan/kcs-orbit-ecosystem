import { useEffect, useMemo, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true

const deviceKind = () => {
  const agent = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(agent)
  const isSafari = /Safari/i.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(agent)
  return { isIOS, isAndroid, isSafari }
}

export default function InstallAppButton() {
  const location = useLocation()
  const language = useUIStore((state) => state.language)
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [helpOpen, setHelpOpen] = useState(false)
  const device = useMemo(deviceKind, [])
  const copy = language === 'fr'
    ? {
        label: 'Installer l’application', title: 'Installer KCS Nexus',
        iosSafari: 'Dans Safari, touchez le bouton Partager, faites défiler le menu, puis choisissez « Sur l’écran d’accueil » et confirmez avec « Ajouter ».',
        iosBrowser: 'Sur iPhone ou iPad, ouvrez d’abord cette page dans Safari. Touchez ensuite Partager, puis « Sur l’écran d’accueil ».',
        android: 'Ouvrez le menu du navigateur, puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
        desktop: 'Utilisez l’icône d’installation dans la barre d’adresse ou l’option « Installer KCS Nexus » du menu du navigateur.',
        close: 'Fermer', ready: 'KCS Nexus apparaîtra ensuite comme une application sur votre écran d’accueil.',
      }
    : {
        label: 'Install the application', title: 'Install KCS Nexus',
        iosSafari: 'In Safari, tap the Share button, scroll through the menu, choose “Add to Home Screen”, then confirm with “Add”.',
        iosBrowser: 'On iPhone or iPad, first open this page in Safari. Then tap Share and choose “Add to Home Screen”.',
        android: 'Open the browser menu, then choose “Install app” or “Add to Home screen”.',
        desktop: 'Use the install icon in the address bar or choose “Install KCS Nexus” from the browser menu.',
        close: 'Close', ready: 'KCS Nexus will then appear as an application on your Home Screen.',
      }

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const capture = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent) }
    const sync = () => setInstalled(isStandalone())
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', sync)
    displayMode.addEventListener?.('change', sync)
    return () => {
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', sync)
      displayMode.removeEventListener?.('change', sync)
    }
  }, [])

  const isWorkspace = /^(\/portal|\/admin|\/incident-reports)(\/|$)/.test(location.pathname)
  if (installed || isWorkspace) return null

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setPromptEvent(null)
      return
    }
    setHelpOpen(true)
  }
  const instructions = device.isIOS ? (device.isSafari ? copy.iosSafari : copy.iosBrowser) : device.isAndroid ? copy.android : copy.desktop

  return <>
    <button type="button" onClick={() => void install()} aria-label={copy.label} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-kcs-blue-800 px-3.5 text-sm font-bold text-white shadow-xl transition hover:bg-kcs-blue-700 focus:outline-none focus:ring-2 focus:ring-kcs-gold-400 focus:ring-offset-2 sm:h-12 sm:px-4">
      <Download size={17} aria-hidden="true"/><span>{copy.label}</span>
    </button>
    {helpOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-kcs-blue-950/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" onClick={() => setHelpOpen(false)}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-950" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-kcs-blue-100 text-kcs-blue-700"><Share/></div><button type="button" onClick={() => setHelpOpen(false)} aria-label={copy.close} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-kcs-blue-800"><X/></button></div>
        <h2 id="pwa-install-title" className="mt-5 text-xl font-bold text-kcs-blue-950 dark:text-white">{copy.title}</h2>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{instructions}</p>
        <p className="mt-3 rounded-xl bg-kcs-blue-50 p-3 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-kcs-blue-100">{copy.ready}</p>
        <button type="button" className="btn-primary mt-5 w-full" onClick={() => setHelpOpen(false)}>{copy.close}</button>
      </div>
    </div>}
  </>
}
