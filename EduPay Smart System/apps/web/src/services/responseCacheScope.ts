const PREFIX = "edupay_api_cache_v2:";
const opaqueScopes = new Map<string, string>();
/** Offline snapshots belong to an authenticated account, never just a URL. */
export function responseCacheKey(path: string, token: string | null): string | null {
  if (!token) return null;
  let scope: string;
  try {
    const encoded = token.split('.')[1];
    const claims = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('No subject');
    scope = JSON.stringify([claims.sub, claims.schoolId ?? '', claims.role ?? '']);
  } catch {
    // Opaque/development sessions cannot share persistent cache keys across reloads.
    if (!opaqueScopes.has(token)) opaqueScopes.set(token, crypto.randomUUID());
    scope = opaqueScopes.get(token)!;
  }
  return PREFIX + encodeURIComponent(scope) + ':' + path;
}
export function clearResponseCaches() {
  try {
    Object.keys(localStorage).filter(key => /^edupay_api_cache_v[12]:/.test(key))
      .forEach(key => localStorage.removeItem(key));
  } catch { /* Storage can be unavailable; live requests still work. */ }
}
