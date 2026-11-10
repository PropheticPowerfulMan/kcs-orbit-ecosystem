import { ACADEMIC_REPORT_PERIODS, academicPeriodLabel } from '@/constants/academicPeriods'
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LockKeyhole, X } from "lucide-react";
import { academicCalendarAPI } from "@/services/api";
import {
  useAcademicPeriodAccess,
  isAcademicPeriodReadOnly,
} from "@/hooks/useAcademicPeriodAccess";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";

const terms = ACADEMIC_REPORT_PERIODS;
export default function AcademicPeriodClosurePanel({
  academicYear,
}: {
  academicYear: string;
}) {
  const userId = useAuthStore((state) => state.user?.id);
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const { access, loading } = useAcademicPeriodAccess();
  const [selected, setSelected] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [year, setYear] = useState(academicYear);
  useEffect(() => { setYear(academicYear); setSelected(''); setConfirmation('') }, [academicYear]);
  const years = [...new Set([academicYear, ...(access?.calendars ?? []).map(calendar => calendar.name)])].sort().reverse();
  const required = year + " · " + academicPeriodLabel(selected, language);
  const closePeriod = async () => {
    if (confirmation !== required || busy) return;
    setBusy(true);
    try {
      await academicCalendarAPI.closePeriod(
        year,
        selected,
        year + " · " + selected,
      );
      window.dispatchEvent(new Event("kcs-academic-period-closed"));
      setSelected("");
      setConfirmation("");
      setNotice(
        tr(
          "La période est clôturée. Les notes, bulletins et présences concernés sont désormais en lecture seule.",
          "The period is closed. Its grades, report-card content and attendance are now read-only.",
        ),
      );
    } catch (error: any) {
      setNotice(
        error?.response?.data?.message ||
          tr(
            "La clôture a échoué. Aucune clôture partielle n’a été appliquée.",
            "Closure failed. No partial closure was applied.",
          ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="my-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center gap-2">
        <LockKeyhole size={20} className="text-amber-700 dark:text-amber-300" />
        <h3 className="font-black text-kcs-blue-950 dark:text-white">
          {tr(
            "Clôture et protection des périodes",
            "Academic period closure and protection",
          )}
        </h3>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
        {tr(
          "Le SuperAdmin confirme la clôture de chaque quarter, semestre et année après finalisation des notes. Les dates du calendrier ne clôturent aucune période. Les données clôturées restent consultables en lecture seule.",
          "The SuperAdmin confirms closure of each quarter, semester and year after grades are finalized. Calendar dates never close a period. Closed records remain available read-only.",
        )}
      </p>
      <label className="mt-4 block max-w-sm text-xs font-bold text-kcs-blue-950 dark:text-white">{tr('Année à examiner ou clôturer', 'Year to review or close')}<select className="mt-1 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-kcs-blue-950 dark:border-amber-700 dark:bg-kcs-blue-950 dark:text-white" value={year} disabled={busy} onChange={event => { setYear(event.target.value); setSelected(''); setConfirmation('') }}>{years.map(value => <option key={value}>{value}</option>)}</select></label>
      {notice && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold dark:bg-kcs-blue-950 dark:text-white"
        >
          {notice}
        </p>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {terms.map((term) => {
          const readOnly = isAcademicPeriodReadOnly(access, year, term);
          return (
            <article
              key={term}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-kcs-blue-950"
            >
              <div>
                <b className="block text-xs dark:text-white">{academicPeriodLabel(term, language)}</b>
                <span
                  className={
                    readOnly
                      ? "text-xs font-bold text-amber-800 dark:text-amber-300"
                      : "text-xs font-bold text-emerald-700 dark:text-emerald-300"
                  }
                >
                  {readOnly
                    ? tr("Clôturée · lecture seule", "Closed · read-only")
                    : tr("Ouverte aux corrections", "Open for corrections")}
                </span>
              </div>
              {userId === "configured-superadmin" && (
                <button
                  type="button"
                  disabled={loading || readOnly || busy}
                  onClick={() => {
                    setSelected(term);
                    setConfirmation("");
                  }}
                  className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {tr("Clôturer", "Close period")}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {selected &&
        createPortal(
          <div
            className="fixed inset-0 z-[10020] grid place-items-center bg-kcs-blue-950/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-period-title"
          >
            <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-700 dark:bg-kcs-blue-950">
              <div className="flex items-start justify-between gap-3">
                <h2
                  id="close-period-title"
                  className="text-xl font-black text-kcs-blue-950 dark:text-white"
                >
                  {tr(
                    "Confirmer la clôture de la période",
                    "Confirm academic period closure",
                  )}
                </h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSelected("")}
                  aria-label={tr("Fermer", "Close")}
                  className="rounded-lg p-2 dark:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">
                {tr(
                  "Vérifiez que les enseignants ont finalisé leurs notes et que les corrections sont terminées. La clôture bloque les changements de points, de commentaires du bulletin et de présences pour toute l’école. Les documents existants restent consultables, imprimables et distribuables.",
                  "Check that teachers have finalized grades and corrections are complete. Closure blocks changes to grades, report-card comments and attendance across the school. Existing documents remain available for viewing, printing and delivery.",
                )}
              </p>
              <label className="mt-4 grid gap-2 text-sm font-bold text-kcs-blue-950 dark:text-white">
                {tr("Recopiez la période exacte", "Type the exact period")}
                <strong className="rounded-xl bg-amber-50 p-3 text-xs dark:bg-amber-950/50">
                  {required}
                </strong>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  className="rounded-xl border border-amber-300 bg-white p-3 text-sm dark:border-amber-700 dark:bg-kcs-blue-900 dark:text-white"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSelected("")}
                  className="rounded-xl border px-4 py-2.5 font-bold dark:border-kcs-blue-700 dark:text-white"
                >
                  {tr("Annuler", "Cancel")}
                </button>
                <button
                  type="button"
                  disabled={busy || confirmation !== required}
                  onClick={() => void closePeriod()}
                  className="rounded-xl bg-amber-700 px-4 py-2.5 font-bold text-white disabled:opacity-40"
                >
                  {busy
                    ? tr("Clôture…", "Closing…")
                    : tr("Clôturer et protéger", "Close and protect")}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </section>
  );
}
