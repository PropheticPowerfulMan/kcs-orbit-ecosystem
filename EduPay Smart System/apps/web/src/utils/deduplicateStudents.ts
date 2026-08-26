type StudentIdentifier = {
  id?: string | null;
  externalStudentId?: string | null;
};

function normalizeIdentifier(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

export function deduplicateStudents<T extends StudentIdentifier>(students: T[]): T[] {
  const seenIdentifiers = new Set<string>();

  return students.filter((student) => {
    const identifiers = [student.id, student.externalStudentId]
      .map(normalizeIdentifier)
      .filter(Boolean);

    if (identifiers.some((identifier) => seenIdentifiers.has(identifier))) {
      return false;
    }

    identifiers.forEach((identifier) => seenIdentifiers.add(identifier));
    return true;
  });
}