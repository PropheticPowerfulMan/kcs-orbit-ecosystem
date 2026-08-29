export type GreetingLanguage = "fr" | "en";

export function getGivenName(fullName: string | null | undefined): string {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const givenName = parts[parts.length - 1];
  return givenName === givenName.toUpperCase()
    ? givenName.charAt(0).toUpperCase() + givenName.slice(1).toLocaleLowerCase("fr")
    : givenName;
}

export function getKinshasaHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kinshasa",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).find((part) => part.type === "hour")?.value;

  return Number(hour ?? date.getHours());
}

export function buildTimeGreeting(
  fullName: string | null | undefined,
  lang: GreetingLanguage,
  date = new Date()
): string {
  const hour = getKinshasaHour(date);
  const greeting = hour < 5 || hour >= 18
    ? (lang === "fr" ? "Bonsoir" : "Good evening")
    : hour < 12
      ? (lang === "fr" ? "Bonjour" : "Good morning")
      : (lang === "fr" ? "Bon après-midi" : "Good afternoon");
  const givenName = getGivenName(fullName);
  return givenName ? `${greeting}, ${givenName}` : greeting;
}
