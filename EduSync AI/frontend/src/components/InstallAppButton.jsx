import { useEffect, useState } from "react";

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const capture = (event) => { event.preventDefault(); setPromptEvent(event); };
    const syncInstalledState = () => setInstalled(isStandalone());
    const done = () => setInstalled(true);
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
      if (choice.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }
    alert("Installation disponible. Chrome ou Edge : utilisez Installer dans la barre d'adresse ou le menu. iPhone et iPad : Partager puis Sur l'ecran d'accueil. Safari macOS : Fichier puis Ajouter au Dock.");
  };

  return <button type="button" onClick={() => void install()} aria-label="Installer EduSync AI" style={{ position: "fixed", right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1rem, env(safe-area-inset-bottom))", zIndex: 10000, minHeight: "44px", border: "1px solid var(--border-strong)", borderRadius: "8px", padding: ".65rem .95rem", background: "linear-gradient(120deg, var(--primary), var(--primary-strong))", color: "white", fontWeight: 800, boxShadow: "var(--shadow)", cursor: "pointer" }}>Installer EduSync AI</button>;
}
