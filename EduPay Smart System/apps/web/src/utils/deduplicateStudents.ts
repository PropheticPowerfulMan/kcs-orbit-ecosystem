type StudentIdentifier = {
  id?: string | null;
  externalStudentId?: string | null;
  fullName?: string | null;
  className?: string | null;
};

function normalizeIdentifier(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function normalizeFingerprintPart(value: string | null | undefined) {
  return normalizeIdentifier(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function deduplicateStudents<T extends StudentIdentifier>(students: T[]): T[] {
  const seenIdentifiers = new Set<string>();
  const seenFingerprints = new Set<string>();

  return students.filter((student) => {
    const identifiers = [student.id, student.externalStudentId]
      .map(normalizeIdentifier)
      .filter(Boolean);
    const normalizedName = normalizeFingerprintPart(student.fullName);
    const normalizedClass = normalizeFingerprintPart(student.className);
    const fingerprint = normalizedName && normalizedClass ? `${normalizedName}|${normalizedClass}` : "";

    if (identifiers.some((identifier) => seenIdentifiers.has(identifier)) || (fingerprint && seenFingerprints.has(fingerprint))) {
      return false;
    }

    identifiers.forEach((identifier) => seenIdentifiers.add(identifier));
    if (fingerprint) seenFingerprints.add(fingerprint);
    return true;
  });
}
