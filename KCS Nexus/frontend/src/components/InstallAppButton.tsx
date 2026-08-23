import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  useEffect(() => { const capture = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); }; const done = () => setInstalled(true); window.addEventListener("beforeinstallprompt", capture); window.addEventListener("appinstalled", done); return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); }; }, []);
  if (installed) return null;
  const install = async () => { if (promptEvent) { await promptEvent.prompt(); const choice = await promptEvent.userChoice; if (choice.outcome === "accepted") setInstalled(true); setPromptEvent(null); return; } alert("Sur iPhone/iPad : touchez Partager puis Ajouter à l’écran d’accueil. Sur Android : ouvrez le menu du navigateur puis Installer l’application."); };
  return <button type="button" onClick={() => void install()} aria-label="Installer cette application sur l’appareil" style={{ position: "fixed", right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1rem, env(safe-area-inset-bottom))", zIndex: 10000, border: "1px solid rgba(255,255,255,.25)", borderRadius: "999px", padding: ".7rem 1rem", background: "#0f3b78", color: "white", fontWeight: 800, boxShadow: "0 12px 35px rgba(2,8,23,.35)", cursor: "pointer" }}>Installer l’application</button>;
}