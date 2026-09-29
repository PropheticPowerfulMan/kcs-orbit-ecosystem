import { useEffect, useState } from 'react'
import { Download, Share2, Smartphone, X } from 'lucide-react'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function InstallAppButton({ lang, compact = false }: { lang: 'fr' | 'en'; compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [help, setHelp] = useState(false)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const installed = () => setPrompt(null)
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installed)
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed) }
  }, [])

  if (standalone) return null
  async function install() {
    if (!prompt) return setHelp(true)
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setPrompt(null)
  }
  return <>
    <button className={compact ? 'install-app compact' : 'install-app'} onClick={install} title={lang === 'fr' ? 'Installer KCS Kitchen' : 'Install KCS Kitchen'}>
      <Download /> <span>{lang === 'fr' ? 'Installer' : 'Install'}</span>
    </button>
    {help && <div className="install-help-backdrop" role="dialog" aria-modal="true"><div className="install-help">
      <button className="icon-button install-help-close" onClick={() => setHelp(false)}><X /></button>
      <Smartphone className="install-device" />
      <h2>{lang === 'fr' ? 'Installer KCS Kitchen' : 'Install KCS Kitchen'}</h2>
      <p>{lang === 'fr' ? 'Sur iPhone ou iPad, touchez Partager puis « Sur l’écran d’accueil ». Sur Android ou ordinateur, ouvrez le menu du navigateur puis choisissez « Installer l’application ».' : 'On iPhone or iPad, tap Share then “Add to Home Screen”. On Android or desktop, open the browser menu and choose “Install app”.'}</p>
      <div className="install-tip"><Share2 /> {lang === 'fr' ? 'Aucune boutique d’applications n’est nécessaire.' : 'No app store is required.'}</div>
      <button className="primary large" onClick={() => setHelp(false)}>{lang === 'fr' ? 'Compris' : 'Got it'}</button>
    </div></div>}
  </>
}
