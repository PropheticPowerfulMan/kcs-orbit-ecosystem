import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export default function InstallAppButton() {
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

  return (
    <button type="button" onClick={() => void install()} aria-label="Installer EduPay" title="Installer EduPay" style={{ position: "fixed", right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1rem, env(safe-area-inset-bottom))", zIndex: 2147483647, minHeight: "44px", display: "inline-flex", alignItems: "center", gap: ".5rem", border: "1px solid #7de8ff", borderRadius: "999px", padding: ".65rem .95rem", background: "linear-gradient(135deg, #14b8de, #0786ad)", color: "#03131d", fontWeight: 800, boxShadow: "0 12px 30px rgba(5, 16, 24, .38)", cursor: "pointer", visibility: "visible", opacity: 1 }}>
      <Download size={17} aria-hidden="true" />
      <span>Installer EduPay</span>
    </button>
  );
}
