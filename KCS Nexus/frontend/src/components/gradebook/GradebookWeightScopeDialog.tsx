import { useState } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2 } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

type Props = {
  courses: Array<{ id: string; name: string; className: string }>;
  currentCourseId: string;
  academicYear: string;
  term: string;
  categories: Array<{ id: string; name: string; weight: number }>;
  onApply: (courseIds: string[]) => Promise<void>;
  onClose: () => void;
};
export default function GradebookWeightScopeDialog(props: Props) {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const [selected, setSelected] = useState([props.currentCourseId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const apply = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await props.onApply(selected);
      props.onClose();
    } catch (reason: any) {
      setError(
        reason?.response?.data?.message ||
          reason?.message ||
          tr(
            "La pondération n’a pas pu être appliquée.",
            "The weighting could not be applied.",
          ),
      );
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <div
      className="fixed inset-0 z-[10030] grid place-items-center bg-kcs-blue-950/80 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weight-scope-title"
    >
      <section className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-sky-200 bg-white p-5 shadow-2xl dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white sm:p-7">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="weight-scope-title"
              className="text-lg font-black text-kcs-blue-950 dark:text-white"
            >
              {tr(
                "À quels cours appliquer cette pondération ?",
                "Which courses should use this weighting?",
              )}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {props.academicYear} · {props.term}
            </p>
          </div>
          <button
            disabled={busy}
            type="button"
            onClick={props.onClose}
            aria-label={tr("Fermer", "Close")}
            className="rounded-xl border p-2 dark:border-kcs-blue-700"
          >
            <X size={18} />
          </button>
        </header>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {tr(
            "Le cours actuel conserve cette répartition. Choisissez les autres cours auxquels la recopier. Les notes déjà saisies restent conservées et les périodes clôturées gardent leur pondération figée.",
            "The current course keeps this distribution. Choose any other courses to copy it to. Entered grades are preserved and closed periods retain their frozen weighting.",
          )}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {props.categories.map((category) => (
            <div
              key={category.id}
              className="rounded-xl bg-sky-50 p-2 text-xs dark:bg-kcs-blue-900"
            >
              <b>{category.name}</b>
              <span className="float-right font-black">{category.weight}%</span>
            </div>
          ))}
        </div>
        <fieldset
          disabled={busy}
          className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto"
        >
          <legend className="mb-2 text-sm font-bold">
            {tr("Mes cours", "My courses")}
          </legend>
          {props.courses.map((course) => (
            <label
              key={course.id}
              className="flex items-center gap-3 rounded-xl border border-sky-100 p-3 dark:border-kcs-blue-800"
            >
              <input
                type="checkbox"
                checked={selected.includes(course.id)}
                disabled={course.id === props.currentCourseId}
                onChange={() =>
                  setSelected((ids) =>
                    ids.includes(course.id)
                      ? ids.filter((id) => id !== course.id)
                      : [...ids, course.id],
                  )
                }
              />
              <span className="min-w-0 text-sm">
                <b className="block break-words">{course.name}</b>
                <small className="text-slate-500 dark:text-slate-300">
                  {course.className}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200"
          >
            {error}
          </p>
        )}
        <footer className="mt-5 flex flex-wrap justify-center gap-2 border-t border-sky-100 pt-4 dark:border-kcs-blue-800">
          <button
            disabled={busy}
            type="button"
            onClick={props.onClose}
            className="rounded-xl border px-4 py-2.5 text-sm font-bold dark:border-kcs-blue-700"
          >
            {tr(
              "Garder uniquement le cours actuel",
              "Keep the current course only",
            )}
          </button>
          <button
            disabled={busy}
            type="button"
            onClick={() => void apply()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {busy
              ? tr("Application…", "Applying…")
              : tr("Appliquer à ", "Apply to ") +
                selected.length +
                tr(" cours", " course(s)")}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
