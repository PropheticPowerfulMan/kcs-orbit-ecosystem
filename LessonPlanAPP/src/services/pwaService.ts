interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type Listener = () => void;
type InstallSnapshot = { canInstall: boolean; showInstall: boolean; installed: boolean };

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
let snapshot: InstallSnapshot = { canInstall: false, showInstall: false, installed: false };
const listeners = new Set<Listener>();
const pwaInstalledKey = "kcs-eduplanner:pwa-installed";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const wasInstalled = () => localStorage.getItem(pwaInstalledKey) === "true";
const rememberInstallation = () => localStorage.setItem(pwaInstalledKey, "true");

const updateSnapshot = (installed = isStandalone() || wasInstalled()) => {
  const desktop = window.matchMedia("(min-width: 768px)").matches;
  snapshot = {
    canInstall: Boolean(deferredPrompt) && !installed,
    showInstall: desktop && !installed,
    installed
  };
  listeners.forEach((listener) => listener());
};

export const initializePwaInstall = () => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  updateSnapshot();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    updateSnapshot(false);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    rememberInstallation();
    updateSnapshot(true);
  });

  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    const installed = isStandalone();
    if (installed) deferredPrompt = null;
    updateSnapshot(installed);
  });

  window.matchMedia("(min-width: 768px)").addEventListener("change", () => updateSnapshot());
};

export const pwaInstallStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return snapshot;
  },
  async install() {
    if (!deferredPrompt || snapshot.installed) return false;
    const prompt = deferredPrompt;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      deferredPrompt = null;
      rememberInstallation();
      updateSnapshot(true);
      return true;
    }
    return false;
  }
};

export const registerPwaServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    const swUrl = base.replace(/\/$/, "") + "/sw.js";
    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.warn("PWA service worker registration failed", error);
    });
  });
};