import { env } from "../config/env.js";
import { getOrbitSharedDirectory } from "./orbitSharedDirectory.js";

type Student = {
  studentNumber: string;
  officialAvatar?: string | null;
  user: { orbitUserId?: string | null };
};
export async function officialStudentPortrait(
  student: Student,
): Promise<string | null> {
  if (
    env.KCS_ORBIT_API_URL &&
    env.KCS_ORBIT_API_KEY &&
    env.KCS_ORBIT_ORGANIZATION_ID
  ) {
    try {
      const directory = await getOrbitSharedDirectory();
      const canonical = directory.students.find(
        (entity) =>
          entity.id === student.user.orbitUserId ||
          entity.studentNumber === student.studentNumber ||
          entity.externalIds.some(
            (link) => link.externalId === student.studentNumber,
          ),
      );
      if (
        canonical &&
        Object.prototype.hasOwnProperty.call(canonical, "photoData")
      )
        return canonical.photoData || null;
    } catch {
      /* A previously synchronized official portrait remains usable during an outage. */
    }
  }
  return student.officialAvatar || null;
}
