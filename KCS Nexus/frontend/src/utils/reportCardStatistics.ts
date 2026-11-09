export type ReportStatisticsStudent = {
  id: string;
  name: string;
  className: string;
  average: number | null;
  subjects: Array<{
    courseId: string;
    name: string;
    percentage: number | null;
  }>;
};
export function reportResultForCourse(
  student: ReportStatisticsStudent,
  courseId: string,
): number | null {
  const result =
    courseId === "ALL"
      ? student.average
      : student.subjects.find((subject) => subject.courseId === courseId)
          ?.percentage;
  return typeof result === "number" &&
    Number.isFinite(result) &&
    result >= 0 &&
    result <= 100
    ? result
    : null;
}
export function reportStatistics(values: Array<number | null | undefined>) {
  const numbers = values
    .filter(
      (value): value is number =>
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100,
    )
    .sort((a, b) => a - b);
  const count = numbers.length;
  const quantile = (fraction: number) => {
    if (!count) return null;
    const index = (count - 1) * fraction,
      lower = Math.floor(index);
    return (
      numbers[lower] +
      (numbers[Math.min(lower + 1, count - 1)] - numbers[lower]) *
        (index - lower)
    );
  };
  const mean = count
    ? numbers.reduce((sum, value) => sum + value, 0) / count
    : null;
  const deviation =
    mean === null
      ? null
      : Math.sqrt(
          numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count,
        );
  const passed = numbers.filter((value) => value >= 70).length;
  const bounds = [
    [0, 50],
    [50, 60],
    [60, 70],
    [70, 80],
    [80, 90],
    [90, 101],
  ];
  return {
    count,
    missing: values.length - count,
    mean,
    median: quantile(0.5),
    q1: quantile(0.25),
    q3: quantile(0.75),
    min: numbers[0] ?? null,
    max: numbers[count - 1] ?? null,
    deviation,
    passed,
    passRate: count ? (passed * 100) / count : null,
    distribution: bounds.map(([start, end]) => ({
      label: start === 90 ? "90-100" : start + "-<" + end,
      count: numbers.filter((value) => value >= start && value < end).length,
    })),
  };
}
