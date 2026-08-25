export function normalizeUsdInput(value: string): string {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return "";
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return value;
  return (Math.round((amount + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function parseUsdInput(value: string): number {
  const amount = Number(normalizeUsdInput(value));
  return Number.isFinite(amount) ? amount : 0;
}