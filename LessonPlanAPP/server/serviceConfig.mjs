export function serviceUrl(value, name, {supabase = false} = {}) {
  let url;
  try { url = new URL(String(value || "").trim()); }
  catch { throw new Error(name + " must be a valid HTTP(S) service URL"); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(name + " must be a valid HTTP(S) service URL without credentials, query or fragment");
  }
  if (supabase && !["/", "/rest/v1", "/rest/v1/"].includes(url.pathname)) {
    throw new Error(name + " must identify the Supabase project, not an API endpoint");
  }
  return supabase ? url.origin : url.toString().replace(/\/$/, "");
}
