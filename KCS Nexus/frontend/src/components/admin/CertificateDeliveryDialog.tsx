import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, Send, X } from "lucide-react";
import { academicRecordsAPI } from "@/services/api";
import { SCHOOL_LEVELS, normalizeSchoolLevel } from "@/constants/schoolLevels";
import { useUIStore } from "@/store/uiStore";

type Person = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};
type Student = {
  id: string;
  studentNumber: string;
  grade: string;
  section: string;
  user: Person;
  parentLinks: { parent: Person }[];
};
type Props = {
  studentIds?: string[];
  academicYear: string;
  documentType: "completion" | "attendance";
  documentLanguage: "fr" | "en";
  authenticated: boolean;
  initialGrade: string;
  onClose: () => void;
  onDelivered: () => void;
};
const name = (person: Person) =>
  [person.lastName, person.middleName, person.firstName]
    .filter(Boolean)
    .join(" ");
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const field =
  "w-full min-w-0 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white";
export default function CertificateDeliveryDialog({
  studentIds,
  academicYear,
  documentType,
  documentLanguage,
  authenticated,
  initialGrade,
  onClose,
  onDelivered,
}: Props) {
  const language = useUIStore((state) => state.language);
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [grade, setGrade] = useState(initialGrade);
  const [section, setSection] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [limit, setLimit] = useState(60);
  const [progress, setProgress] = useState("");
  const intent = useRef<{ signature: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setStudents(
        (await academicRecordsAPI.certificateRecipients()).data.data ?? [],
      );
    } catch (failure: any) {
      setError(
        failure?.response?.data?.message ||
          tr(
            "Impossible de charger les parents. Réessayez.",
            "Unable to load parents. Please retry.",
          ),
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => setLimit(60), [grade, section, query]);
  const rows = useMemo(
    () =>
      students
        .filter(
          (student) =>
            (!studentIds || studentIds.includes(student.id)) &&
            (documentType !== "completion" ||
              ["K4", "Grade 4", "Grade 8"].includes(
                normalizeSchoolLevel(student.grade) || "",
              )),
        )
        .flatMap((student) =>
          student.parentLinks.map(({ parent }) => ({ student, parent })),
        ),
    [students, documentType, studentIds],
  );
  const filtered = rows.filter(
    ({ student, parent }) =>
      (grade === "ALL" || normalizeSchoolLevel(student.grade) === grade) &&
      (section === "ALL" || student.section === section) &&
      normalize(query)
        .trim()
        .split(/\s+/)
        .every((token) =>
          normalize(
            [
              name(student.user),
              student.studentNumber,
              student.grade,
              student.section,
              name(parent),
              parent.email,
              parent.phone,
            ]
              .filter(Boolean)
              .join(" "),
          ).includes(token),
        ),
  );
  const chosen = rows.filter(({ student, parent }) =>
    selected[student.id]?.includes(parent.id),
  );
  const toggle = (studentId: string, parentId: string) =>
    setSelected((current) => ({
      ...current,
      [studentId]: current[studentId]?.includes(parentId)
        ? current[studentId].filter((id) => id !== parentId)
        : [...(current[studentId] ?? []), parentId],
    }));
  const send = async () => {
    if (inFlight.current || !chosen.length) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const deliveries = Object.entries(selected)
      .filter(([, ids]) => ids.length)
      .map(([studentId, parentIds]) => ({
        studentId,
        parentIds: [...parentIds].sort(),
      }))
      .sort((a, b) => a.studentId.localeCompare(b.studentId));
    const signature = JSON.stringify({
      academicYear,
      documentType,
      documentLanguage,
      authenticated,
      deliveries,
    });
    if (intent.current?.signature !== signature)
      intent.current = { signature, id: crypto.randomUUID() };
    try {
      for (let start = 0; start < deliveries.length; start += 50) {
        setProgress(
          tr("Envoi du lot ", "Sending batch ") +
            (Math.floor(start / 50) + 1) +
            " / " +
            Math.ceil(deliveries.length / 50),
        );
        await academicRecordsAPI.deliverCertificates({
          requestId: intent.current!.id + "-" + start,
          academicYear,
          documentType,
          language: documentLanguage,
          includeAuthentication: authenticated,
          deliveries: deliveries.slice(start, start + 50),
        });
      }
      setCompleted(true);
      onDelivered();
      setProgress(
        tr(
          "Les PDF sont disponibles dans la messagerie des parents et placés dans la file sécurisée d’envoi par e-mail.",
          "PDFs are available in parents’ inboxes and safely queued for email delivery.",
        ),
      );
    } catch (failure: any) {
      setError(
        failure?.response?.data?.message ||
          tr(
            "Envoi non confirmé. Réessayez avec la même sélection pour éviter les doublons.",
            "Delivery was not confirmed. Retry with the same selection to avoid duplicates.",
          ),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const title =
    documentType === "completion"
      ? tr("Certificats de réussite", "Completion certificates")
      : tr("Attestations de fréquentation", "Certificates of attendance");
  return createPortal(
    <div
      className="fixed inset-0 z-[10030] grid place-items-center bg-kcs-blue-950/80 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="certificate-delivery-title"
    >
      <section className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-2xl dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-sky-100 p-5 dark:border-kcs-blue-700">
          <div>
            <h2
              id="certificate-delivery-title"
              className="text-xl font-black text-kcs-blue-950 dark:text-white"
            >
              {tr(
                "Envoyer les certificats aux parents",
                "Send certificates to parents",
              )}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">
              {title} · {academicYear} ·{" "}
              {documentLanguage === "fr" ? "Français" : "English"} · PDF
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              {authenticated
                ? tr(
                    "Signatures et sceau inclus lorsqu’ils sont enregistrés.",
                    "Saved signatures and seal included when available.",
                  )
                : tr(
                    "Sans signatures ni sceau numériques.",
                    "Without digital signatures or seal.",
                  )}
            </p>
          </div>
          <button
            disabled={busy}
            onClick={onClose}
            aria-label={tr("Fermer", "Close")}
            className="rounded-xl border border-sky-200 p-2 text-kcs-blue-900 dark:border-kcs-blue-700 dark:text-white"
          >
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-kcs-blue-950 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white">
            <p className="font-black">{completed ? tr('3 · Envoi enregistré', '3 · Delivery recorded') : review ? tr('2 · Vérifier avant l’envoi', '2 · Review before sending') : tr('1 · Cocher les parents destinataires', '1 · Check parent recipients')}</p>
            <p className="mt-2 text-xs leading-5">{completed ? tr('Les PDF sont enregistrés dans les messageries Nexus et leur envoi par e-mail est placé dans la file sécurisée.', 'PDFs are saved in Nexus inboxes and email delivery is recorded in the secure queue.') : review ? tr('Relisez les noms des enfants, les parents et leurs e-mails ci-dessous. Confirmer l’envoi prépare les PDF et les place dans la file sécurisée de courriels.', 'Review the children, parents and email addresses below. Confirming delivery prepares the PDFs and places them in the secure email queue.') : tr('Chaque ligne relie un enfant à son parent. Cochez uniquement les parents qui doivent recevoir son certificat. Vous pouvez sélectionner plusieurs parents pour le même enfant.', 'Each row links a child to their parent. Check the parents who should receive that certificate. You can select multiple parents for the same child.')}</p>
            <p className="mt-3 font-bold">{new Set(chosen.map(row => row.student.id)).size} {tr('certificat(s)', 'certificate(s)')} · {new Set(chosen.map(row => row.parent.id)).size} {tr('parent(s) choisi(s)', 'selected parent(s)')}</p>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-rose-100 p-3 text-sm font-bold text-rose-900"
            >
              {error}{" "}
              {loading ? null : (
                <button onClick={() => void load()} className="underline">
                  {tr("Actualiser les parents", "Reload parents")}
                </button>
              )}
            </p>
          )}
          {progress && (
            <p
              role="status"
              className="rounded-xl bg-emerald-100 p-3 text-sm font-bold text-emerald-900"
            >
              {progress}
            </p>
          )}
          {!completed && !review && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[12rem_9rem_1fr]">
                <label className="text-xs font-bold dark:text-white">
                  {tr("Classe", "Grade")}
                  <select
                    value={grade}
                    onChange={(event) => { setGrade(event.target.value); setSection("ALL"); }}
                    className={field}
                  >
                    <option value="ALL">
                      {tr("Toutes les classes", "All grades")}
                    </option>
                    {(documentType === "completion"
                      ? ["K4", "Grade 4", "Grade 8"]
                      : SCHOOL_LEVELS
                    ).map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold dark:text-white">
                  {tr("Section", "Section")}
                  <select
                    value={section}
                    onChange={(event) => setSection(event.target.value)}
                    className={field}
                  >
                    <option value="ALL">{tr("Toutes", "All")}</option>
                    {[
                      ...new Set(
                        rows.map((row) => row.student.section).filter(Boolean),
                      ),
                    ]
                      .sort()
                      .map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                  </select>
                </label>
                <label className="text-xs font-bold dark:text-white">
                  {tr(
                    "Élève, parent, e-mail, téléphone ou matricule",
                    "Learner, parent, email, phone or student ID",
                  )}
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-3 text-slate-400"
                    />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className={field + " pl-9"}
                    />
                  </div>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-kcs-blue-900 dark:text-white">
                <span>
                  {chosen.length}{" "}
                  {tr("destinataire(s) retenu(s)", "selected recipient(s)")}
                </span>
                <button
                  onClick={() =>
                    setSelected((current) => {
                      const next = { ...current };
                      for (const { student, parent } of filtered)
                        if (parent.email?.trim())
                          next[student.id] = [
                            ...new Set([
                              ...(next[student.id] ?? []),
                              parent.id,
                            ]),
                          ];
                      return next;
                    })
                  }
                  className="rounded-lg border px-3 py-2"
                >
                  {tr(
                    "Sélectionner les résultats filtrés",
                    "Select filtered results",
                  )}
                </button>
                <button
                  onClick={() => setSelected({})}
                  className="rounded-lg border px-3 py-2"
                >
                  {tr("Effacer la sélection", "Clear selection")}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {tr(
                  "Changer les filtres conserve la sélection. Le récapitulatif montre tous les destinataires retenus.",
                  "Changing filters preserves the selection. The review shows every selected recipient.",
                )}
              </p>
            </>
          )}
          {loading ? (
            <p className="flex gap-2 text-sm dark:text-white">
              <Loader2 className="animate-spin" size={18} />
              {tr("Chargement des parents…", "Loading parents…")}
            </p>
          ) : (
            !completed && (
              <div className="grid gap-2 lg:grid-cols-2">
                {(review ? chosen : filtered)
                  .slice(0, limit)
                  .map(({ student, parent }) => (
                    <label
                      key={student.id + ":" + parent.id}
                      className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-kcs-blue-950 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={
                          selected[student.id]?.includes(parent.id) ?? false
                        }
                        disabled={review || !parent.email?.trim()}
                        onChange={() => toggle(student.id, parent.id)}
                        className="mt-1 size-4 shrink-0"
                      />
                      <span className="min-w-0 break-words">
                        <b>{name(student.user)}</b>
                        <span className="block text-xs text-slate-500 dark:text-slate-300">
                          {student.grade} {student.section} ·{" "}
                          {student.studentNumber}
                        </span>
                        <b className="mt-2 block">{name(parent)}</b>
                        <span className="block text-xs">
                          {parent.email ||
                            tr(
                              "E-mail manquant — envoi indisponible",
                              "Missing email — delivery unavailable",
                            )}
                        </span>
                      </span>
                    </label>
                  ))}
                {!(review ? chosen : filtered).length && (
                  <p className="text-sm dark:text-white">
                    {tr(
                      "Aucun parent correspondant. Vérifiez les filtres, puis les liens familiaux et les adresses e-mail dans Parents.",
                      "No matching parent. Check the filters, then family links and email addresses in Parents.",
                    )}
                  </p>
                )}
              </div>
            )
          )}
          {(review ? chosen : filtered).length > limit && !completed && (
            <button
              onClick={() => setLimit((value) => value + 60)}
              className="rounded-xl border px-4 py-2 text-sm font-bold dark:text-white"
            >
              {tr("Afficher davantage", "Show more")}
            </button>
          )}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-sky-100 p-4 dark:border-kcs-blue-700">
          <b className="mr-auto text-sm text-kcs-blue-950 dark:text-white">
            {chosen.length} {tr("destinataire(s)", "recipient(s)")}
          </b>
          <button
            disabled={busy}
            onClick={review && !completed ? () => setReview(false) : onClose}
            className="rounded-xl border border-sky-200 px-4 py-2.5 text-sm font-bold text-kcs-blue-900 dark:border-kcs-blue-700 dark:text-white"
          >
            {completed
              ? tr("Fermer", "Close")
              : review
                ? tr("Modifier la sélection", "Edit selection")
                : tr("Annuler", "Cancel")}
          </button>
          {!completed && (
            <button
              disabled={busy || loading || !chosen.length}
              onClick={
                review
                  ? () => void send()
                  : () => {
                      setReview(true);
                      setLimit(60);
                    }
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Send size={17} />
              )}{" "}
              {review
                ? tr("Confirmer l’envoi des PDF", "Confirm PDF delivery")
                : tr("Vérifier les destinataires", "Review recipients")}
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
