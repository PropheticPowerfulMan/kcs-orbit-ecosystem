import { useEffect, useState } from "react";
import { Download } from "lucide-react";

const INSTALL_STATE_KEY = "savanex-pwa-installed-v1";
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
    <button type="button" onClick={() => void install()} aria-label="Installer SAVANEX" style={{ position: "fixed", right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1rem, env(safe-area-inset-bottom))", zIndex: 10000, minHeight: "44px", display: "inline-flex", alignItems: "center", gap: ".5rem", border: "1px solid #22d3ee", borderRadius: "8px", padding: ".65rem .9rem", background: "#0ea5d8", color: "#020617", fontWeight: 800, boxShadow: "0 12px 30px rgba(1, 4, 9, .48)", cursor: "pointer" }}>
      <Download size={17} aria-hidden="true" />
      <span>Installer SAVANEX</span>
    </button>
  );
}
