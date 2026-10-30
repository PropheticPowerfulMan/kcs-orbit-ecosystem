import { useEffect, useMemo, useState } from "react";
import { Archive, Download, Loader2, Search, Trash2 } from "lucide-react";
import { disciplineAPI } from "@/services/api";
import { useUIStore } from "@/store/uiStore";
import { canonicalClassLabel } from "@/utils/classLabels";
import { normalizeSchoolLevel, SCHOOL_LEVELS } from "@/constants/schoolLevels";

const field =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-sky-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white";

export default function StudentArchivesCenter() {
  const { language } = useUIStore();
  const fr = language === "fr";
  const tr = (a: string, b: string) => (fr ? a : b);
  const [rows, setRows] = useState<any[]>([]),
    [busy, setBusy] = useState(true),
    [query, setQuery] = useState(""),
    [grade, setGrade] = useState("ALL"),
    [notice, setNotice] = useState(""),
    [backedUp, setBackedUp] = useState<Set<string>>(new Set());
  const load = async () => {
    setBusy(true);
    try {
      const { data } = await disciplineAPI.dismissals();
      setRows(data?.data ?? []);
    } catch (e: any) {
      setNotice(
        e?.response?.data?.message ??
          tr("Chargement des archives impossible.", "Unable to load archives."),
      );
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const visible = useMemo(() => {
    const tokens = query
      .trim()
      .toLocaleLowerCase(fr ? "fr" : "en")
      .split(/\s+/)
      .filter(Boolean);
    return rows
      .filter(
        (row) =>
          (grade === "ALL" || normalizeSchoolLevel(row.grade) === grade) &&
          tokens.every((token) =>
            [
              row.fullName,
              row.studentNumber,
              row.grade,
              row.section,
              row.reason,
            ]
              .filter(Boolean)
              .join(" ")
              .toLocaleLowerCase(fr ? "fr" : "en")
              .includes(token),
          ),
      )
      .sort((a, b) =>
        String(a.fullName).localeCompare(String(b.fullName), fr ? "fr" : "en", {
          sensitivity: "base",
        }),
      );
  }, [rows, query, grade, fr]);
  const backup = async (row: any) => {
    try {
      const response = await disciplineAPI.archiveBackup(row.id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `KCS-ARCHIVE-${row.studentNumber}-${row.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackedUp((current) => new Set(current).add(row.id));
      setNotice(
        tr(
          `Sauvegarde de ${row.fullName} téléchargée.`,
          `Backup for ${row.fullName} downloaded.`,
        ),
      );
    } catch (e: any) {
      setNotice(
        e?.response?.data?.message ??
          tr("Sauvegarde impossible.", "Backup failed."),
      );
    }
  };
  const remove = async (row: any) => {
    if (!backedUp.has(row.id)) {
      setNotice(
        tr(
          "Téléchargez d’abord la sauvegarde obligatoire de ce dossier.",
          "Download the mandatory backup of this record first.",
        ),
      );
      return;
    }
    const confirmation = window.prompt(
      tr(
        `Suppression définitive de l’entrée d’archive de ${row.fullName}. Les preuves académiques restent conservées. Tapez SUPPRIMER ARCHIVE puis confirmez le matricule ${row.studentNumber}.`,
        `Permanent removal of ${row.fullName}'s archive entry. Academic evidence remains preserved. Type SUPPRIMER ARCHIVE, then confirm student ID ${row.studentNumber}.`,
      ),
    );
    if (confirmation !== "SUPPRIMER ARCHIVE") return;
    const studentNumber = window.prompt(
      tr("Confirmez le matricule exact :", "Confirm the exact student ID:"),
    );
    if (studentNumber !== row.studentNumber)
      return setNotice(
        tr(
          "Matricule incorrect : aucune suppression effectuée.",
          "Student ID mismatch: nothing was deleted.",
        ),
      );
    try {
      await disciplineAPI.deleteArchive(row.id, {
        confirmation: "SUPPRIMER ARCHIVE",
        studentNumber: String(studentNumber),
      });
      setNotice(
        tr(
          "Entrée d’archive supprimée; la trace d’audit et les preuves académiques sont conservées.",
          "Archive entry removed; audit trail and academic evidence are preserved.",
        ),
      );
      await load();
    } catch (e: any) {
      setNotice(
        e?.response?.data?.message ??
          tr("Suppression impossible.", "Deletion failed."),
      );
    }
  };
  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-kcs-blue-950 to-slate-800 p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[.18em] text-sky-200">
          {tr("Conservation institutionnelle", "Institutional retention")}
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-black">
          <Archive />
          {tr("Archives officielles des élèves", "Official learner archives")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-sky-100">
          {tr(
            "Les diplômés de Grade 12, renvois et retraits administratifs disparaissent des registres actifs sans destruction de leurs preuves académiques.",
            "Grade 12 graduates, dismissals and administrative removals leave active rosters without destroying academic evidence.",
          )}
        </p>
      </header>
      {notice ? (
        <p className="rounded-xl bg-sky-100 p-3 text-sm font-bold text-kcs-blue-950 dark:bg-kcs-blue-800 dark:text-white">
          {notice}
        </p>
      ) : null}
      <section className="rounded-2xl border border-sky-100 bg-white p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900">
        <div className="grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <label className="relative">
            <Search
              size={17}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              className={field + " pl-10"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr(
                "Nom, matricule, classe, section ou motif…",
                "Name, student ID, grade, section or reason…",
              )}
            />
          </label>
          <select
            className={field}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          >
            <option value="ALL">
              {tr("Toutes les classes", "All grades")}
            </option>
            {SCHOOL_LEVELS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-kcs-blue-700 px-4 py-2 font-black text-white"
          >
            {busy ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              tr("Actualiser", "Refresh")
            )}
          </button>
        </div>
        <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-300">
          {visible.length} {tr("dossier(s) archivé(s)", "archived record(s)")}
        </p>
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        {visible.map((row) => {
          const graduated = String(row.reason).startsWith("GRADUATION");
          return (
            <article
              key={row.id}
              className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-kcs-blue-950 dark:text-white">
                    {row.fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    {row.studentNumber} ·{" "}
                    {canonicalClassLabel(row.grade, row.section)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${graduated ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                >
                  {graduated
                    ? tr("DIPLÔMÉ", "GRADUATED")
                    : tr("ARCHIVÉ", "ARCHIVED")}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {row.reason}
              </p>
              <p className="mt-2 text-xs font-bold text-slate-500">
                {new Date(row.effectiveDate).toLocaleDateString(
                  fr ? "fr-FR" : "en-GB",
                )}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void backup(row)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-3 py-2.5 text-sm font-black text-white"
                >
                  <Download size={16} />
                  {tr("Télécharger le backup", "Download backup")}
                </button>
                <button
                  type="button"
                  disabled={!backedUp.has(row.id)}
                  onClick={() => void remove(row)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 px-3 py-2.5 text-sm font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-200"
                >
                  <Trash2 size={16} />
                  {tr("Supprimer de l’archive", "Delete from archive")}
                </button>
              </div>
            </article>
          );
        })}
      </section>
      {!busy && !visible.length ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm font-bold text-slate-500 dark:bg-kcs-blue-900">
          {tr(
            "Aucun dossier ne correspond à la recherche.",
            "No record matches this search.",
          )}
        </p>
      ) : null}
    </div>
  );
}
