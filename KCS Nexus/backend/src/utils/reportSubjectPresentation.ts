type Correction = {
  courseId: string;
  courseName?: string;
  percentage: number;
  letterGrade?: string;
};

// A fresh teacher submission supersedes edited marks while retaining the bulletin label.
export function replaceSubmittedSubjectCorrection(
  subjects: Correction[],
  courseId: string,
  percentage: number | null,
): Correction[] {
  return subjects.flatMap((subject) => {
    if (subject.courseId !== courseId) return [subject];
    if (!subject.courseName || percentage === null) return [];
    return [{ courseId, courseName: subject.courseName, percentage }];
  });
}
