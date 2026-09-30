const recoveryKeys = ["access_token", "refresh_token", "expires_in", "expires_at", "token_type", "type", "error", "error_code", "error_description", "temporary_password"];

export const normalizeRecoveryUrlBeforeRouter = () => {
  if (typeof window === "undefined") return;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;

  const startsWithRecoveryPayload = recoveryKeys.some((key) => hash.startsWith(`${key}=`) || hash.includes(`&${key}=`));
  const loginHasAmpersandParams = hash.startsWith("/login&");
  if (!startsWithRecoveryPayload && !loginHasAmpersandParams) return;

  const payload = loginHasAmpersandParams ? hash.replace(/^\/login&/, "") : hash;
  const nextUrl = `${window.location.pathname}${window.location.search}#/login?${payload}`;
  window.history.replaceState(null, "", nextUrl);
};

export const getRecoveryParam = (key: string) => {
  if (typeof window === "undefined") return "";
  const query = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#/, "");
  const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash.replace(/^\/?login&?/, "");
  const hashParams = new URLSearchParams(hashQuery);
  return hashParams.get(key) || query.get(key) || "";
};
