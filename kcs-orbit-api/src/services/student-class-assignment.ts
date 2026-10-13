export type StudentClassPatch = {
  className?: string | null;
  classOrbitId?: string | null;
};

export type OrbitClassReference = {
  id: string;
  name: string;
};

function owns(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function normalizeClassKey(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function normalizeClassLabel(value?: string | null) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized || null;
}

/**
 * Keeps the legacy class-name snapshot and the relational class link atomic.
 * An explicit name is authoritative because it is the value edited by the
 * school registry. When no matching Class exists, the stale relation is
 * cleared instead of allowing an old class to shadow the new value.
 */
export function buildStudentClassUpdate(
  patch: StudentClassPatch,
  matchedClass: OrbitClassReference | null,
) {
  const hasClassName = owns(patch, "className");
  const hasClassOrbitId = owns(patch, "classOrbitId");
  if (!hasClassName && !hasClassOrbitId) return {};

  const requestedName = hasClassName ? normalizeClassLabel(patch.className) : undefined;

  if (hasClassOrbitId && patch.classOrbitId) {
    return {
      classId: patch.classOrbitId,
      className: matchedClass?.name ? normalizeClassLabel(matchedClass.name) : requestedName,
    };
  }

  if (hasClassOrbitId && patch.classOrbitId === null) {
    return {
      classId: null,
      ...(hasClassName ? { className: requestedName ?? null } : {}),
    };
  }

  return {
    className: requestedName ?? null,
    classId: matchedClass?.id ?? null,
  };
}

export function resolveSharedStudentClassName(input: {
  className?: string | null;
  relatedClassName?: string | null;
  classId?: string | null;
}) {
  return normalizeClassLabel(input.className)
    ?? normalizeClassLabel(input.relatedClassName)
    ?? normalizeClassLabel(input.classId)
    ?? null;
}
