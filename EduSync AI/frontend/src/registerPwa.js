export function registerPwa() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL || "./";
    navigator.serviceWorker.register(`${baseUrl}sw.js`, { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => undefined);
  });
}
