import { useEffect, useState } from "react";

const INSTALL_STATE_KEY = "edusync-pwa-installed-v1";
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true || localStorage.getItem(INSTALL_STATE_KEY) === "1";

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const capture = (event) => { event.preventDefault(); setPromptEvent(event); };
    const syncInstalledState = () => setInstalled(isStandalone());
    const done = () => { localStorage.setItem(INSTALL_STATE_KEY, "1"); setInstalled(true); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    displayMode.addEventListener?.("change", syncInstalledState);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
      displayMode.removeEventListener?.("change", syncInstalledState);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") { localStorage.setItem(INSTALL_STATE_KEY, "1"); setInstalled(true); }
      setPromptEvent(null);
      return;
    }
    alert("Installation disponible. Chrome ou Edge : utilisez Installer dans la barre d'adresse ou le menu. iPhone et iPad : Partager puis Sur l'ecran d'accueil. Safari macOS : Fichier puis Ajouter au Dock.");
  };

  return (
    <button type="button" onClick={() => void install()} aria-label="Installer EduSync AI" className="edusync-install-button">
      <span className="edusync-install-icon" aria-hidden="true">↓</span>
      <span className="edusync-install-copy"><strong>Installer EduSync AI</strong><small>Application sécurisée KCS</small></span>
      <span className="edusync-install-arrow" aria-hidden="true">→</span>
    </button>
  );
}
