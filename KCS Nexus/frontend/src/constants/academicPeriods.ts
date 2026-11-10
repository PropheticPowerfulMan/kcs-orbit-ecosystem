export const ACADEMIC_REPORT_PERIODS = [
  "Semester 1 · Quarter 1",
  "Semester 1 · Quarter 2",
  "Semester 1",
  "Semester 2 · Quarter 3",
  "Semester 2 · Quarter 4",
  "Semester 2",
  "Annual final",
] as const;
export function academicPeriodLabel(value: string | null | undefined, language: string) {
  const term = String(value ?? "").replace(/Trimester/gi, "Quarter");
  return language === "fr"
    ? term
        .replace(/Semester/g, "Semestre")
        .replace(/Annual final/gi, "Bilan annuel")
        .replace(/days/gi, "jours")
    : term;
}
export function reportPeriodIncludesSource(selected: string, source: string) {
  const canonical = (term: string) =>
    term.replace(/Trimester/gi, "Quarter").trim();
  const term = canonical(selected),
    recorded = canonical(source);
  if (term === "Annual final")
    return ACADEMIC_REPORT_PERIODS.includes(
      recorded as (typeof ACADEMIC_REPORT_PERIODS)[number],
    );
  if (term === "Semester 1" || term === "Semester 2")
    return recorded === term || recorded.startsWith(term + " · Quarter ");
  return recorded === term;
}
export function reportStatusLabel(status: string, language: string) {
  const labels: Record<string, [string, string]> = {
    DRAFT: ["Brouillon", "Draft"],
    READY_FOR_REVIEW: ["À examiner", "Ready for review"],
    APPROVED: ["Approuvé", "Approved"],
    EMAILED: ["Envoyé par e-mail", "Emailed"],
    POSTED_TO_PORTAL: ["Publié dans le portail", "Posted to portal"],
  };
  return (
    labels[status]?.[language === "fr" ? 0 : 1] ?? status.replace(/_/g, " ")
  );
}
