import { canonicalAcademicTerm } from "./academicCycle.js";

export type AcademicPeriodAccess = {
  calendars?: Array<{
    name: string;
    startDate: string;
    endDate: string;
    periods?: Array<{
      type: string;
      sequence: number;
      startDate: string;
      endDate: string;
    }>;
  }>;
  activeAcademicYear: string | null;
  closedPeriods: Array<{
    academicYear: string;
    term: string;
    closedAt?: string;
  }>;
};
export const quarterTerms = [
  "Semester 1 · Quarter 1",
  "Semester 1 · Quarter 2",
  "Semester 2 · Quarter 3",
  "Semester 2 · Quarter 4",
];
const termName = (term: string) => canonicalAcademicTerm(term) ?? term;
export function academicPeriodIsReadOnly(
  access: AcademicPeriodAccess,
  year: string,
  term: string,
) {
  const current = termName(term);
  const quarter = quarterTerms.indexOf(current);
  const semester =
    quarter < 0 ? current : quarter < 2 ? "Semester 1" : "Semester 2";
  return access.closedPeriods.some(
    (period) =>
      period.academicYear === year &&
      ["Annual final", current, semester].includes(termName(period.term)),
  );
}
function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])]),
  );
}
function closedSlice(
  value: unknown,
  lockedTerms: Set<string>,
  columnsOnly = false,
) {
  const snapshot = record(value);
  const closedTask = (task: any) =>
    lockedTerms.has(termName(String(task?.term || quarterTerms[0])));
  const tasks = (Array.isArray(value) ? value : snapshot.assignments || [])
    .filter(closedTask)
    .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
  const ids = tasks.map((task: any) => String(task.id));
  const cells = (values: unknown) =>
    Object.fromEntries(
      Object.entries(record(values)).filter(
        ([key, value]) =>
          ids.some((id: string) => key.startsWith(id + ":")) &&
          String(value ?? "") !== "",
      ),
    );
  const archived = (snapshot.archivedAssignments || [])
    .filter((entry: any) => closedTask(entry.assignment))
    .sort((a: any, b: any) =>
      String(a.assignment.id).localeCompare(String(b.assignment.id)),
    );
  const normalizedTasks = tasks.map((task: any) => {
    const { description, confirmedCycle, ...column } = task;
    return columnsOnly
      ? { ...column, term: termName(String(task.term || quarterTerms[0])) }
      : { ...task, term: termName(String(task.term || quarterTerms[0])) };
  });
  return stable({
    tasks: normalizedTasks,
    scores: columnsOnly ? {} : cells(snapshot.scores),
    comments: columnsOnly ? {} : cells(snapshot.comments),
    archived: columnsOnly ? [] : archived,
  });
}
export function closedGradebookChanged(
  previous: unknown,
  next: unknown,
  access: AcademicPeriodAccess,
) {
  const before = record(previous),
    after = record(next);
  for (const field of [
    "advancedGradebookByCycle",
    "advancedGradebookByCourse",
    "gradebookColumnsByCourse",
  ]) {
    const oldMap = record(before[field]),
      newMap = record(after[field]);
    for (const key of new Set([
      ...Object.keys(oldMap),
      ...Object.keys(newMap),
    ])) {
      const divider = key.lastIndexOf("::");
      const year =
        field === "advancedGradebookByCycle"
          ? key.slice(divider + 2)
          : "2026-2027";
      const lockedTerms = new Set(
        quarterTerms.filter((term) =>
          academicPeriodIsReadOnly(access, year, term),
        ),
      );
      if (!lockedTerms.size) continue;
      const courseId =
        field === "advancedGradebookByCycle" ? key.slice(0, divider) : key;
      const baseline =
        record(before.advancedGradebookByCycle)[courseId + "::" + year] ??
        (year === "2026-2027"
          ? record(before.advancedGradebookByCourse)[courseId]
          : undefined);
      const oldValue = oldMap[key] === undefined ? baseline : oldMap[key];
      if (
        JSON.stringify(
          closedSlice(
            oldValue,
            lockedTerms,
            field === "gradebookColumnsByCourse",
          ),
        ) !==
        JSON.stringify(
          closedSlice(
            newMap[key],
            lockedTerms,
            field === "gradebookColumnsByCourse",
          ),
        )
      )
        return true;
      if (academicPeriodIsReadOnly(access, year, "Annual final")) {
        const oldSnapshot = { ...record(oldMap[key]), savedAt: undefined };
        const newSnapshot = { ...record(newMap[key]), savedAt: undefined };
        if (
          JSON.stringify(stable(oldSnapshot)) !==
          JSON.stringify(stable(newSnapshot))
        )
          return true;
      }
      if (year === "2026-2027") {
        const courseId =
          field === "advancedGradebookByCycle" ? key.slice(0, divider) : key;
        const tasks = [
          ...(Array.isArray(oldMap[key])
            ? oldMap[key]
            : record(oldMap[key]).assignments || []),
          ...(Array.isArray(newMap[key])
            ? newMap[key]
            : record(newMap[key]).assignments || []),
        ];
        const prefixes = tasks
          .filter((task: any) =>
            lockedTerms.has(termName(String(task.term || quarterTerms[0]))),
          )
          .map((task: any) => courseId + "-" + task.id + "-");
        const oldScores = record(before.gradebookScores);
        const newScores = record(after.gradebookScores);
        const snapshotScores = record(record(baseline).scores);
        for (const key of new Set([
          ...Object.keys(oldScores),
          ...Object.keys(newScores),
        ])) {
          const prefix = prefixes.find((prefix: string) =>
            key.startsWith(prefix),
          );
          if (
            !prefix ||
            (String(oldScores[key] ?? "") === "" &&
              String(newScores[key] ?? "") === "")
          )
            continue;
          const taskId = prefix.slice(courseId.length + 1, -1);
          const canonicalKey = taskId + ":" + key.slice(prefix.length);
          const oldValue =
            String(oldScores[key] ?? "") === ""
              ? snapshotScores[canonicalKey]
              : oldScores[key];
          if (String(oldValue ?? "") !== String(newScores[key] ?? ""))
            return true;
        }
      }
    }
  }
  return false;
}

export function academicEntryPeriod(access: AcademicPeriodAccess, year: string) {
  const workflow = [quarterTerms[0], quarterTerms[1], 'Semester 1', quarterTerms[2], quarterTerms[3], 'Semester 2', 'Annual final']
  const pendingClosureTerm = workflow.find(term => !academicPeriodIsReadOnly(access, year, term)) ?? null
  const activeEntryTerm = pendingClosureTerm === 'Semester 1' ? quarterTerms[1]
    : pendingClosureTerm === 'Semester 2' ? quarterTerms[3] : pendingClosureTerm
  return { pendingClosureTerm, activeEntryTerm }
}

// Quarter advancement is authorized by explicit closure, never by the device date.
export function futureGradebookPeriods(access: AcademicPeriodAccess, year: string) {
  if (access.activeAcademicYear !== year) return [];
  const active = academicEntryPeriod(access, year).activeEntryTerm;
  const index = quarterTerms.indexOf(active || '');
  return index < 0 ? [] : quarterTerms.slice(index + 1);
}
export function futureGradebookChanged(previous: unknown, next: unknown, access: AcademicPeriodAccess) {
  const year = access.activeAcademicYear;
  if (!year) return false;
  return closedGradebookChanged(previous, next, {
    ...access,
    closedPeriods: futureGradebookPeriods(access, year).map(term => ({ academicYear: year, term })),
  });
}
