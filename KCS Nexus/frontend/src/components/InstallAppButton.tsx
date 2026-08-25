import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useLocation } from "react-router-dom";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function InstallAppButton() {
  const location = useLocation();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const capture = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
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

  const isWorkspace = /^(\/portal|\/admin|\/incident-reports)(\/|$)/.test(location.pathname);
  if (installed || isWorkspace) return null;

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

  return (
    <button
      type="button"
      onClick={() => void install()}
      aria-label="Installer KCS Nexus"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40 inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-kcs-blue-800 px-3.5 text-sm font-bold text-white shadow-xl transition hover:bg-kcs-blue-700 focus:outline-none focus:ring-2 focus:ring-kcs-gold-400 focus:ring-offset-2 sm:h-12 sm:px-4"
    >
      <Download size={17} aria-hidden="true" />
      <span>Installer l'application</span>
    </button>
  );
}
