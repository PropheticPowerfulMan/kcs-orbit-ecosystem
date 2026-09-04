export function registerPwa() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const cacheCleanup = "caches" in window
      ? caches.keys().then((keys) => Promise.all(
          keys.filter((key) => key.startsWith("kcs-nexus-")).map((key) => caches.delete(key)),
        ))
      : Promise.resolve([]);

    Promise.all([
      cacheCleanup,
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      ),
    ]).then(() => {
      const reloadKey = "kcs-nexus-cache-migration-v1";
      if (hadController && sessionStorage.getItem(reloadKey) !== "done") {
        sessionStorage.setItem(reloadKey, "done");
        window.location.reload();
      }
    }).catch(() => undefined);
  });
}
