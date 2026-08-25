import { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true);
  useEffect(() => { const capture = (event) => { event.preventDefault(); setPromptEvent(event); }; const done = () => setInstalled(true); window.addEventListener("beforeinstallprompt", capture); window.addEventListener("appinstalled", done); return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); }; }, []);
  if (installed) return null;
  const install = async () => { if (promptEvent) { await promptEvent.prompt(); const choice = await promptEvent.userChoice; if (choice.outcome === "accepted") setInstalled(true); setPromptEvent(null); return; } alert("Installation disponible. Chrome ou Edge sur ordinateur et tablette : utilisez icone Installer dans la barre adresse ou Menu puis Installer cette application. iPhone et iPad : Partager puis Sur ecran accueil. Safari macOS : Fichier puis Ajouter au Dock."); };
  return <button type="button" onClick={() => void install()} aria-label="Installer cette application sur l’appareil" style={{ position: "fixed", right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1rem, env(safe-area-inset-bottom))", zIndex: 10000, border: "1px solid rgba(255,255,255,.25)", borderRadius: "999px", padding: ".7rem 1rem", background: "#0f3b78", color: "white", fontWeight: 800, boxShadow: "0 12px 35px rgba(2,8,23,.35)", cursor: "pointer" }}>Installer l’application</button>;
}