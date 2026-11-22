type Person = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
};
const titles = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "mme",
  "mlle",
  "m",
  "dr",
  "teacher",
  "prof",
  "professor",
]);
const tokens = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((v) => v && !titles.has(v));
/** One short surname is accepted only when it identifies exactly one institutional teacher. */
export function academyScheduleBelongsTo(
  label: string | null,
  userId: string,
  teachers: Person[],
) {
  const parts = tokens(label || "");
  if (!parts.length) return false;
  const matches = teachers.filter((t) => {
    const own = new Set(
      tokens([t.firstName, t.middleName, t.lastName].filter(Boolean).join(" ")),
    );
    return parts.every((v) => own.has(v));
  });
  return matches.length === 1 && matches[0].id === userId;
}
