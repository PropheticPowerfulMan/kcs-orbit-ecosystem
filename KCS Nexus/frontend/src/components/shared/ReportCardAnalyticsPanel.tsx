import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, Printer, Trophy } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { compareClassLabels } from "@/utils/classLabels";
import { rankGradebookRows } from "@/utils/gradebookRanking";
import {
  reportStatistics,
  reportResultForCourse,
  type ReportStatisticsStudent,
} from "@/utils/reportCardStatistics";
import { printReportCardAnalytics } from "@/utils/officialReportCardAnalyticsPrint";

type Props = {
  students: ReportStatisticsStudent[];
  academicYear: string;
  term: string;
};
const field =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-kcs-blue-950 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white";
export default function ReportCardAnalyticsPanel({
  students,
  academicYear,
  term,
}: Props) {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const [className, setClassName] = useState("ALL");
  const [courseId, setCourseId] = useState("ALL");
  const [limit, setLimit] = useState("3");
  const [showRanking, setShowRanking] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState("");
  const classes = [
    ...new Set(students.map((student) => student.className)),
  ].sort(compareClassLabels);
  const selectedClassName = className === "ALL" || classes.includes(className) ? className : "ALL";
  const scoped = useMemo(
    () =>
      students.filter(
        (student) => selectedClassName === "ALL" || student.className === selectedClassName,
      ),
    [students, selectedClassName],
  );
  const courses = [
    ...new Map(
      scoped.flatMap((student) =>
        student.subjects.map(
          (subject) => [subject.courseId, subject.name] as const,
        ),
      ),
    ).entries(),
  ].sort((left, right) => left[1].localeCompare(right[1]));
  const selectedCourseId =
    courseId === "ALL" || courses.some(([id]) => id === courseId)
      ? courseId
      : "ALL";
  const courseName =
    selectedCourseId === "ALL"
      ? tr("Moyenne générale du bulletin", "Overall report-card average")
      : courses.find(([id]) => id === selectedCourseId)![1];
  const measured = scoped.map((student) => ({
    ...student,
    average: reportResultForCourse(student, selectedCourseId),
  }));
  const ranked = rankGradebookRows(measured);
  const count = Math.min(
    ranked.length,
    Math.max(1, Math.floor(Number(limit) || 1)),
  );
  const selected = ranked.slice(0, count);
  const stats = reportStatistics(measured.map((student) => student.average));
  const print = async () => {
    if (printing || !ranked.length) return;
    setPrinting(true);
    setNotice("");
    try {
      await printReportCardAnalytics(
        {
          students: scoped,
          academicYear,
          term,
          scope:
            selectedClassName === "ALL"
              ? tr(
                  "Toutes les classes du périmètre affiché",
                  "All grades in the displayed scope",
                )
              : selectedClassName,
          courseId: selectedCourseId,
          courseName,
          limit: count,
          language: language === "fr" ? "fr" : "en",
        },
        setNotice,
      );
    } finally {
      setPrinting(false);
    }
  };
  return (
    <section
      aria-label={tr(
        "Classement et statistiques des bulletins",
        "Report-card ranking and statistics",
      )}
      className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50 p-4 shadow-sm dark:border-indigo-800 dark:from-kcs-blue-950 dark:to-indigo-950/40 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-black text-kcs-blue-950 dark:text-white">
            <Trophy size={19} className="text-amber-600 dark:text-amber-300" />
            {tr(
              "Les trois premiers et analyse des résultats",
              "Top three learners and result analysis",
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {academicYear} · {term} ·{" "}
            {tr(
              "Les résultats manquants sont exclus, sans leur attribuer zéro.",
              "Missing results are excluded without assigning zero.",
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={printing || !ranked.length}
          onClick={() => void print()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          <Printer size={17} />
          {printing
            ? tr("Préparation…", "Preparing…")
            : tr(
                "PDF classement et statistiques",
                "Ranking and statistics PDF",
              )}
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
          {tr("Classe / section", "Grade / section")}
          <select
            aria-label={tr("Classe du classement", "Ranking grade")}
            value={selectedClassName}
            onChange={(event) => {
              setClassName(event.target.value);
              setCourseId("ALL");
            }}
            className={field}
          >
            <option value="ALL">
              {tr("Tout le périmètre affiché", "Entire displayed scope")}
            </option>
            {classes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
          {tr("Résultat à classer", "Result to rank")}
          <select
            aria-label={tr("Cours du classement", "Ranking course")}
            value={selectedCourseId}
            onChange={(event) => setCourseId(event.target.value)}
            className={field}
          >
            <option value="ALL">
              {tr(
                "Moyenne générale du bulletin",
                "Overall report-card average",
              )}
            </option>
            {courses.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
          {tr("Nombre N des premiers élèves", "Number N of leading learners")}
          <input
            aria-label={tr(
              "Nombre d’élèves à classer",
              "Number of ranked learners",
            )}
            className={field}
            type="number"
            min={1}
            max={ranked.length || 1}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {ranked.slice(0, 3).map((student) => (
          <article
            key={student.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 text-sm dark:border-amber-700 dark:bg-kcs-blue-950"
          >
            <b className="min-w-0 break-words text-kcs-blue-950 dark:text-white">
              {student.rank}. {student.name}
            </b>
            <strong className="shrink-0 text-emerald-700 dark:text-emerald-300">
              {student.average!.toFixed(2)}%
            </strong>
          </article>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {stats.count} {tr("résultats disponibles", "available results")} ·{" "}
          {stats.missing} {tr("manquants", "missing")} ·{" "}
          {tr("Médiane", "Median")} {stats.median?.toFixed(2) ?? "—"}% ·{" "}
          {tr("Écart-type", "Std. deviation")}{" "}
          {stats.deviation?.toFixed(2) ?? "—"} pp
        </p>
        <button
          type="button"
          onClick={() => setShowRanking((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-800 dark:border-indigo-700 dark:bg-kcs-blue-900 dark:text-indigo-100"
        >
          <BarChart3 size={15} />
          {showRanking
            ? tr("Masquer le classement", "Hide ranking")
            : tr("Afficher les N premiers", "Show top N learners")}
          <ChevronDown size={14} />
        </button>
      </div>
      {notice && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-rose-800 dark:bg-kcs-blue-950 dark:text-rose-200"
        >
          {notice}
        </p>
      )}
      {showRanking && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-indigo-100 dark:border-indigo-800">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-indigo-700 text-xs uppercase text-white">
              <tr>
                <th className="p-3">{tr("Rang", "Rank")}</th>
                <th>{tr("Élève", "Learner")}</th>
                <th>{tr("Classe", "Class")}</th>
                <th>{tr("Résultat", "Result")}</th>
              </tr>
            </thead>
            <tbody>
              {selected.map((student) => (
                <tr
                  key={student.id}
                  className="border-t border-indigo-100 bg-white dark:border-indigo-800 dark:bg-kcs-blue-950 dark:text-white"
                >
                  <td className="p-3 font-bold">{student.rank}</td>
                  <td>{student.name}</td>
                  <td>{student.className}</td>
                  <td className="font-bold">{student.average!.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!ranked.length && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {tr(
            "Aucun résultat disponible pour ce périmètre et cette période.",
            "No results are available for this scope and period.",
          )}
        </p>
      )}
    </section>
  );
}
