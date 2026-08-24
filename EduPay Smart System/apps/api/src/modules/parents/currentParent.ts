import { prisma } from "../../prisma";

type ParentUserIdentity = {
  id: string;
  schoolId: string;
  fullName: string;
  email: string;
};

function identityKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join("|");
}

export async function resolveCurrentParent(user: ParentUserIdentity) {
  const linkedParent = await prisma.parent.findFirst({
    where: { schoolId: user.schoolId, userId: user.id },
    select: { id: true, fullName: true, photoUrl: true, userId: true },
  });
  if (linkedParent) return linkedParent;

  const normalizedEmail = user.email.trim().toLowerCase();
  const parentByEmail = normalizedEmail
    ? await prisma.parent.findFirst({
      where: { schoolId: user.schoolId, email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, fullName: true, photoUrl: true, userId: true },
    })
    : null;

  let resolvedParent = parentByEmail;
  if (!resolvedParent) {
    const expectedIdentity = identityKey(user.fullName);
    const candidates = await prisma.parent.findMany({
      where: { schoolId: user.schoolId, userId: null },
      select: { id: true, fullName: true, photoUrl: true, userId: true },
    });
    const identityMatches = candidates.filter((parent) => identityKey(parent.fullName) === expectedIdentity);
    resolvedParent = identityMatches.length === 1 ? identityMatches[0] : null;
  }

  if (!resolvedParent || (resolvedParent.userId && resolvedParent.userId !== user.id)) return null;

  const [parent] = await prisma.$transaction([
    prisma.parent.update({
      where: { id: resolvedParent.id },
      data: { userId: user.id },
      select: { id: true, fullName: true, photoUrl: true, userId: true },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { fullName: resolvedParent.fullName },
    }),
  ]);
  return parent;
}