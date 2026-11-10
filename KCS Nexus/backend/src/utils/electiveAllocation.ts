import { createHash } from "node:crypto";

type Offering = {
  id: string;
  code: string;
  eligibleGrades: string[];
  capacity: number;
};
type Choice = { studentProfileId: string; offeringId: string; rank: number };
type Student = { id: string; grade: string };
const fairKey = (cycleId: string, studentId: string) =>
  createHash("sha256")
    .update(cycleId + ":" + studentId)
    .digest("hex");

export function allocateElectives(
  cycleId: string,
  offerings: Offering[],
  choices: Choice[],
  students: Student[],
  count: number,
) {
  const grades = new Map(
    students.map((student) => [student.id, student.grade]),
  );
  const byId = new Map(offerings.map((offering) => [offering.id, offering]));
  const validChoices = choices.filter((choice) => {
    const offering = byId.get(choice.offeringId);
    return (
      offering &&
      offering.eligibleGrades.includes(
        grades.get(choice.studentProfileId) ?? "",
      )
    );
  });
  const participantIds = new Set(
    validChoices.map((choice) => choice.studentProfileId),
  );
  const participants = students.filter((student) =>
    participantIds.has(student.id),
  );
  const capacity = new Map(
    offerings.map((offering) => [offering.id, offering.capacity]),
  );
  const assigned = new Map<string, Set<string>>();
  const rows: Array<{
    cycleId: string;
    studentProfileId: string;
    offeringId: string;
    preferenceRank: number;
    published: boolean;
  }> = [];
  const assign = (studentId: string, offeringId: string, rank: number) => {
    const own = assigned.get(studentId) ?? new Set<string>();
    if (
      own.size >= count ||
      own.has(offeringId) ||
      (capacity.get(offeringId) ?? 0) <= 0
    )
      return;
    own.add(offeringId);
    assigned.set(studentId, own);
    capacity.set(offeringId, (capacity.get(offeringId) ?? 0) - 1);
    rows.push({
      cycleId,
      studentProfileId: studentId,
      offeringId,
      preferenceRank: rank,
      published: false,
    });
  };
  for (let rank = 1; rank <= count; rank++) {
    const round = validChoices
      .filter((choice) => choice.rank === rank)
      .sort((a, b) =>
        fairKey(cycleId, a.studentProfileId).localeCompare(
          fairKey(cycleId, b.studentProfileId),
        ),
      );
    for (const choice of round)
      assign(choice.studentProfileId, choice.offeringId, rank);
  }
  for (const student of participants.sort((a, b) =>
    fairKey(cycleId, a.id).localeCompare(fairKey(cycleId, b.id)),
  )) {
    const own = assigned.get(student.id) ?? new Set<string>();
    const fallback = offerings
      .filter(
        (offering) =>
          offering.eligibleGrades.includes(student.grade) &&
          !own.has(offering.id) &&
          (capacity.get(offering.id) ?? 0) > 0,
      )
      .sort(
        (a, b) =>
          (capacity.get(b.id) ?? 0) - (capacity.get(a.id) ?? 0) ||
          a.code.localeCompare(b.code),
      );
    for (const offering of fallback) assign(student.id, offering.id, count + 1);
  }
  const incomplete = participants
    .filter((student) => (assigned.get(student.id)?.size ?? 0) < count)
    .map((student) => student.id);
  return {
    rows,
    incomplete,
    students: participants.length,
    fallbacks: rows.filter((row) => row.preferenceRank > count).length,
    remainingCapacity: Object.fromEntries(capacity),
  };
}
