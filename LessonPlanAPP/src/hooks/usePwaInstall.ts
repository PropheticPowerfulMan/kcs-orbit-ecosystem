import { useSyncExternalStore } from "react";
import { pwaInstallStore } from "../services/pwaService";

const serverSnapshot = { canInstall: false, showInstall: false, installed: false };

export const usePwaInstall = () => {
  const state = useSyncExternalStore(
    pwaInstallStore.subscribe,
    pwaInstallStore.getSnapshot,
    () => serverSnapshot
  );

  return {
    ...state,
    install: pwaInstallStore.install
  };
};